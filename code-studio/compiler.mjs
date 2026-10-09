import {bridge} from './preview-bridge.mjs';
import {build} from 'esbuild';
import {parse,serialize} from 'parse5';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const root=path.dirname(fileURLToPath(import.meta.url));
const walk=(node,fn)=>{fn(node);for(const child of node.childNodes||[])walk(child,fn);};
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const set=(node,name,value)=>{node.attrs=node.attrs||[];const a=node.attrs.find(a=>a.name===name);if(a)a.value=value;else node.attrs.push({name,value});};
const textNode=value=>({nodeName:'#text',value,parentNode:null});
function local(base,target){const name=target.split(/[?#]/)[0];return path.posix.normalize(name.startsWith('/')?name.slice(1):path.posix.join(path.posix.dirname(base),name));}
function resolveFile(files,p){return [p,...['.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js','/index.jsx'].map(e=>p+e)].find(p=>files[p]);}
export async function bundle(files,entry){
 const result=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',logLevel:'silent',absWorkingDir:root,plugins:[{name:'project-files',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(args.namespace==='vendor')return {path:createRequire(args.importer).resolve(args.path),namespace:'vendor'};
   if(args.kind==='entry-point')return {path:entry,namespace:'project'};
   if(args.kind==='url-token'&&/^(https:|data:)/.test(args.path))return {path:args.path,external:true};
   if(/^(https?:|node:|file:)/.test(args.path))return {errors:[{text:'External and Node imports require a configured runtime. Use project files or the bundled React libraries.'}]};
   if(!args.path.startsWith('.')&&!args.path.startsWith('/')&&!['url-token','import-rule'].includes(args.kind)){
    if(!/^react(?:-dom)?(?:\/|$)/.test(args.path))return {errors:[{text:`Package ${args.path} is not installed in the preview runtime. React and react-dom are available.`}]};
    return {path:require.resolve(args.path),namespace:'vendor'};
   }
   const p=resolveFile(files,local(args.importer,args.path));
   return p?{path:p,namespace:'project'}:{errors:[{text:`File not found: ${args.path} (from ${args.importer})`}]};
  });
  b.onLoad({filter:/.*/,namespace:'project'},args=>{const file=files[args.path];const ext=path.extname(args.path).slice(1);return {contents:file.binary?Buffer.from(file.content,'base64'):file.content,loader:file.binary||/^(svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp[34]|webm)$/.test(ext)?'dataurl':['js','jsx','ts','tsx','json','css'].includes(ext)?ext:'text',resolveDir:root};});
  b.onLoad({filter:/.*/,namespace:'vendor'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:'js'}));
 }}],outdir:'build',define:{'process.env.NODE_ENV':'"development"'}});
 return {js:result.outputFiles.filter(f=>f.path.endsWith('.js')).map(f=>f.text).join('\n'),css:result.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n'),warnings:result.warnings.map(x=>x.text)};
}
export async function compile(project,token){
 const files=Object.fromEntries(project.files.filter(f=>!f.directory).map(f=>[f.path,f]));const entry=project.entry;const file=files[entry];if(!file)throw new Error('Entry file is missing.');
 let source=file.content,css='',js='',warnings=[];
 if(/\.[jt]sx?$/.test(entry)){const b=await bundle(files,entry);css=b.css;js=b.js;warnings=b.warnings;source='<!doctype html><html><head></head><body><div id="root"></div></body></html>';}
 else if(!/\.html?$/.test(entry))throw new Error('Preview needs an HTML, JavaScript, TypeScript, JSX or TSX entry file.');
 const doc=parse(source);const nodes=[];walk(doc,n=>{if(n.tagName)nodes.push(n);});
 for(const [index,node] of nodes.entries()){
  if(!['html','head','meta','link','title','script','style','body','base'].includes(node.tagName))set(node,'data-studio-node',String(index));
  if(node.tagName==='base'||node.tagName==='meta'&&attr(node,'http-equiv')){node.parentNode.childNodes=node.parentNode.childNodes.filter(n=>n!==node);continue;}
  if(node.tagName==='link'&&attr(node,'rel')==='stylesheet'){
   const p=local(entry,attr(node,'href')||'');if(!files[p])throw new Error(`Stylesheet not found: ${p}`);
   const b=await bundle(files,p);css+='\n'+b.css;warnings.push(...b.warnings);node.parentNode.childNodes=node.parentNode.childNodes.filter(n=>n!==node);
  }
  if(node.tagName==='script'&&(attr(node,'src')||attr(node,'type')==='module')){
   let p=local(entry,attr(node,'src')||'');if(!attr(node,'src')){p='__inline_'+nodes.indexOf(node)+'.js';files[p]={content:(node.childNodes||[]).map(x=>x.value||'').join('')};}
   if(!files[p]){warnings.push(`Script not found: ${p}; the page was rendered without that script.`);node.parentNode.childNodes=node.parentNode.childNodes.filter(n=>n!==node);continue;}const b=await bundle(files,p);set(node,'type','text/javascript');node.attrs=node.attrs.filter(a=>a.name!=='src');node.childNodes=[{...textNode(b.js.replace(/<\/script/gi,'<\\/script')),parentNode:node}];css+='\n'+b.css;warnings.push(...b.warnings);
  }
  for(const name of ['src','poster']){const value=attr(node,name);if(value&&!/^(data:|https?:|blob:)/.test(value)){const f=files[local(entry,value)];if(f)set(node,name,`data:${f.mime||'image/svg+xml'};base64,${f.binary?f.content:Buffer.from(f.content).toString('base64')}`);}}
 }
 css=css.replace(/url\(["']?([^)'"\s]+)["']?\)/g,(match,url)=>{if(/^(data:|https?:|#)/.test(url))return match;const f=files[local(entry,url)]||files[url];return f?`url("data:${f.mime||'application/octet-stream'};base64,${f.binary?f.content:Buffer.from(f.content).toString('base64')}")`:match;});
 let html=serialize(doc);const security=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob: https: http://localhost:* http://127.0.0.1:*; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
 html=html.replace('<head>',`<head>${security}<script>${bridge(token)}</script><style>${css.replace(/<\/style/gi,'<\\/style')}</style>`);
 if(js)html=html.replace('</body>',`<script>${js.replace(/<\/script/gi,'<\\/script')}</script></body>`);
 return {html,warnings};
}
export function inspectEdit(project,nodeIndex,changes){
 if(!/\.html?$/.test(project.entry))throw new Error('Edit React elements in their source file.');
 const files=structuredClone(project.files);const file=files.find(f=>f.path===project.entry);const doc=parse(file.content);const nodes=[];walk(doc,n=>{if(n.tagName)nodes.push(n);});const node=nodes[nodeIndex];if(!node||['html','head','body','script','style','meta','link'].includes(node.tagName))throw new Error('Select an editable element.');
 if(changes.delete)node.parentNode.childNodes=node.parentNode.childNodes.filter(n=>n!==node);
 else if(changes.duplicate){const cloneNode=(n,parent)=>{const copy={...n,parentNode:parent,attrs:n.attrs?.map(a=>({...a,value:a.name==='id'?a.value+'-copy':a.value}))};copy.childNodes=(n.childNodes||[]).map(child=>cloneNode(child,copy));return copy;};const copy=cloneNode(node,node.parentNode);node.parentNode.childNodes.splice(node.parentNode.childNodes.indexOf(node)+1,0,copy);}
 else {if(typeof changes.text==='string'){if(node.childNodes.some(n=>n.tagName))throw new Error('This element contains other elements. Edit its child text instead.');node.childNodes=[textNode(changes.text)];}
 if(changes.href!==undefined){if(!/^(https?:\/\/|mailto:|tel:|#|\.?\.?\/|[a-z0-9_-]+\.html)/i.test(changes.href)&&changes.href!=='')throw new Error('Use an HTTP, email, phone or relative link.');set(node,'href',changes.href);}
 const allowed=['background','color','width','height','border-radius','padding','font-size','position','left','top','transform','z-index','margin','box-sizing'];let style=attr(node,'style')||'';
 for(const [key,value]of Object.entries(changes.style||{})){if(!allowed.includes(key)||typeof value!=='string'||/[;{}<>]/.test(value)||/url\(|expression/i.test(value))throw new Error('Invalid style value.');style=style.replace(new RegExp('(^|;)\\s*'+key+':[^;]*;?','gi'),'$1');style+=`;${key}:${value};`;}
 if(changes.style)set(node,'style',style);}
 file.content=serialize(doc);return files;
}
