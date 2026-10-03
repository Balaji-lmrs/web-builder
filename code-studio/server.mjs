import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {compile,inspectEdit} from './compiler.mjs';
import {validateProject,digest,categoryFor,starter} from './model.mjs';
import {runtimeStatus,runTerminal} from './runtime.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const fail=(status,message)=>Object.assign(new Error(message),{status});
function password(value,salt){return scryptSync(value,salt,64).toString('hex');}
export function startStudio({port=4317,dataDir=path.join(root,'.data'),hostRoot=path.join(root,'host-dist'),localAccess=true}={}){
 fs.mkdirSync(dataDir,{recursive:true});const db=new DatabaseSync(path.join(dataDir,'studio.sqlite'));db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE,hash TEXT,salt TEXT,role TEXT);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,owner TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT,body TEXT,revision INTEGER,updated INTEGER,fork TEXT);
 CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,project TEXT,body TEXT,created INTEGER);
 CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY,project TEXT,owner TEXT,version INTEGER,body TEXT,hash TEXT,created INTEGER,active INTEGER);
 `);
 let localUser=null;
 if(localAccess){
  let account=db.prepare("SELECT id,email,role FROM accounts WHERE role='admin' ORDER BY rowid LIMIT 1").get();
  if(!account){account={id:randomUUID(),email:'local@studio.invalid',role:'admin'};const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(account.id,account.email,password(randomBytes(32).toString('hex'),salt),salt,account.role);}
  localUser={...account,local:true};
 }
 const sessions=new Map(); // Login attempt counters expire, never store passwords.
 function own(id,user){const row=db.prepare('SELECT * FROM projects WHERE id=? AND owner=?').get(id,user.id);if(!row)throw fail(404,'Project not found.');return row;}
 function projectRow(row){return {...JSON.parse(row.body),id:row.id,revision:row.revision,updated:row.updated,fork:row.fork};}
 function create(body,user,fork=null){const project=validateProject(body),id=randomUUID();db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(id,user.id,JSON.stringify(project),1,Date.now(),fork);return projectRow(own(id,user));}
 function save(id,body,user){const row=own(id,user);if(body.revision!==row.revision)throw fail(409,'A newer version was saved in another tab. Reopen the project before saving.');const p=validateProject(body);db.exec('BEGIN');try{db.prepare('INSERT INTO history VALUES(?,?,?,?)').run(randomUUID(),id,row.body,Date.now());db.prepare('UPDATE projects SET body=?,revision=revision+1,updated=? WHERE id=?').run(JSON.stringify(p),Date.now(),id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return projectRow(own(id,user));}
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>70*1024*1024)throw fail(413,'Upload exceeds 70 MB.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw fail(400,'Invalid JSON request.');}}
 const server=http.createServer(async(req,res)=>{try{
 const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))throw fail(403,'Code Studio is local only.');
 const url=new URL(req.url,'http://'+host),route=url.pathname,method=req.method;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(route.startsWith('/api/')){
 if(req.headers.origin&&req.headers.origin!=='http://'+host)throw fail(403,'Cross-origin requests are blocked.');
 const data=['POST','PUT','DELETE'].includes(method)?await body(req):{};
 if(route==='/api/status')return send(res,200,{setup:!localAccess&&!db.prepare('SELECT id FROM accounts LIMIT 1').get(),runtime:await runtimeStatus()});
 if(route==='/api/session'&&method==='POST'){if(localAccess)throw fail(404,'Login is not used in local Code Studio.');
 const email=String(data.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||typeof data.password!=='string'||data.password.length<10||data.password.length>200)throw fail(400,'Enter a valid email and a password with 10–200 characters.');
 const attempts=sessions.get(email);if(attempts&&attempts.until>Date.now()&&attempts.count>=8)throw fail(429,'Too many attempts. Try again in one minute.');
 let user=db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
 if(data.register){if(user)throw fail(409,'This account already exists. Sign in.');const role=db.prepare('SELECT id FROM accounts LIMIT 1').get()?'user':'admin';const salt=randomBytes(16).toString('hex');user={id:randomUUID(),email,role,salt,hash:password(data.password,salt)};db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(user.id,email,user.hash,salt,role);}
 if(!user||!timingSafeEqual(Buffer.from(user.hash,'hex'),Buffer.from(password(data.password,user.salt),'hex'))){const old=attempts?.until>Date.now()?attempts:{count:0,until:Date.now()+60000};sessions.set(email,{...old,count:old.count+1});throw fail(401,'Email or password is incorrect.');}
 sessions.delete(email);const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,Date.now()+86400000);res.setHeader('Set-Cookie',`studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);return send(res,200,{id:user.id,email:user.email,role:user.role});}
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)studio_session=([a-f0-9]+)/)?.[1];const user=localUser||(token&&db.prepare('SELECT a.id,a.email,a.role FROM accounts a JOIN sessions s ON a.id=s.owner WHERE s.token=? AND s.expires>?').get(token,Date.now()));if(!user)throw fail(401,'Sign in to Code Studio.');
 if(route==='/api/me')return send(res,200,user);
 if(route==='/api/logout'){if(localAccess)return send(res,200,{ok:true});db.prepare('DELETE FROM sessions WHERE token=?').run(token);res.setHeader('Set-Cookie','studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(route==='/api/projects'&&method==='GET')return send(res,200,db.prepare('SELECT * FROM projects WHERE owner=? ORDER BY updated DESC').all(user.id).map(projectRow));
 if(route==='/api/projects'&&method==='POST')return send(res,201,create(Array.isArray(data.files)?data:{name:data.name||'Untitled project',kind:data.kind||'component',description:data.description||'',category:data.category||'Auto',entry:'',files:[]},user));
 const match=route.match(/^\/api\/projects\/([\w-]+)(?:\/(\w+))?$/);
 if(match){const [,id,action]=match,row=own(id,user),p=projectRow(row);
 if(!action&&method==='GET')return send(res,200,p);
 if(!action&&method==='PUT')return send(res,200,save(id,data,user));
 if(!action&&method==='DELETE'){db.prepare('DELETE FROM projects WHERE id=?').run(id);return send(res,200,{ok:true});}
 if(action==='history')return send(res,200,db.prepare('SELECT id,created FROM history WHERE project=? ORDER BY created DESC LIMIT 50').all(id));
 if(action==='restore'&&method==='POST'){const snapshot=db.prepare('SELECT body FROM history WHERE id=? AND project=?').get(data.version,id);if(!snapshot)throw fail(404,'Version not found.');return send(res,200,save(id,{...JSON.parse(snapshot.body),revision:data.revision},user));}
 if(action==='publish'&&method==='POST'){
 if(user.role!=='admin')throw fail(403,'Only admins can publish.');if(data.revision!==p.revision)throw fail(409,'Save your current changes before publishing.');
 await compile(p,'validation');const hash=digest(p),previous=db.prepare('SELECT * FROM releases WHERE project=? ORDER BY version DESC LIMIT 1').get(id);
 const release={...validateProject(p),category:p.category==='Auto'?categoryFor(p.files):p.category};
 if(previous?.active&&previous.hash===hash&&previous.body===JSON.stringify(release))return send(res,200,{id:previous.id,version:previous.version,unchanged:true});
 const releaseId=randomUUID(),version=(previous?.version||0)+1;
 db.prepare('INSERT INTO releases VALUES(?,?,?,?,?,?,?,?)').run(releaseId,id,user.id,version,JSON.stringify(release),hash,Date.now(),1);return send(res,201,{id:releaseId,version});}
 if(action==='terminal'&&method==='POST')return send(res,200,await runTerminal(p,data.command));
 }
 if(route==='/api/preview'&&method==='POST')return send(res,200,await compile(validateProject(data),String(data.token||'preview').slice(0,100)));
 if(route==='/api/inspect'&&method==='POST')return send(res,200,{files:inspectEdit(validateProject(data.project),data.node,data.changes)});
 if(route==='/api/library'&&method==='GET')return send(res,200,db.prepare('SELECT r.* FROM releases r WHERE active=1 AND version=(SELECT MAX(version) FROM releases newer WHERE newer.project=r.project AND active=1) ORDER BY created DESC').all().map(r=>({...JSON.parse(r.body),id:r.id,version:r.version,created:r.created})));
 const releaseMatch=route.match(/^\/api\/library\/([\w-]+)\/(fork|unpublish)$/);
 if(releaseMatch&&method==='POST'){const release=db.prepare('SELECT * FROM releases WHERE id=? AND active=1').get(releaseMatch[1]);if(!release)throw fail(404,'Published item not found.');if(releaseMatch[2]==='fork')return send(res,201,create({...JSON.parse(release.body),name:data.name||JSON.parse(release.body).name+' — my copy'},user,release.id));if(user.role!=='admin'||release.owner!==user.id)throw fail(403,'Only the publishing admin can unpublish.');db.prepare('UPDATE releases SET active=0 WHERE project=?').run(release.project);return send(res,200,{ok:true});}
 if(route==='/api/modifications'){if(user.role!=='admin')throw fail(403,'Admin access required.');return send(res,200,db.prepare('SELECT p.*,r.hash originalHash,a.email FROM projects p JOIN releases r ON r.id=p.fork JOIN accounts a ON a.id=p.owner WHERE r.owner=?').all(user.id).filter(p=>digest(JSON.parse(p.body))!==p.originalHash).map(p=>({...projectRow(p),user:p.email})));}
 if(route==='/api/runtime')return send(res,200,await runtimeStatus());
 throw fail(404,'Unknown Code Studio action.');
 }
 let base=hostRoot,relative=decodeURIComponent(route);if(route.startsWith('/studio')){base=path.join(root,'dist');relative=route.slice('/studio'.length)||'/index.html';}
 let target=path.resolve(base,'.'+relative);if(target!==base&&!target.startsWith(base+path.sep))throw fail(403,'Invalid path.');
 if(!fs.existsSync(target)||fs.statSync(target).isDirectory()){if(path.extname(relative))throw fail(404,'File not found.');target=path.join(base,'index.html');}
 if(!fs.existsSync(target))throw fail(503,'Build Code Studio before starting its preview.');
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
 }catch(e){if(!res.headersSent)send(res,e.status||400,{error:e.errors?.map(x=>`${x.location?.file||''}:${x.location?.line||''} ${x.text}`).join('\n')||e.message});else res.end();}});
 server.listen(port,'127.0.0.1');return {server,db,close:()=>new Promise(resolve=>server.close(()=>{db.close();resolve();}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=startStudio({port:Number(process.env.STUDIO_PORT||4317),dataDir:process.env.STUDIO_DATA_DIR});app.server.on('listening',()=>console.log(`Code Studio: http://localhost:${app.server.address().port}/code/atlas`));}
