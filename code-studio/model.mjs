import {createHash} from 'node:crypto';
export function checkPath(value){
 if(typeof value!=='string'||!value||value.length>240||value.startsWith('/')||/[\\\x00-\x1f:]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'||p==='.git'))throw new Error('Use a relative project path without .. or special characters.');
 return value;
}
export function validateProject(input){
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>100)throw new Error('Project name is required (maximum 100 characters).');
 if(!Array.isArray(input.files)||input.files.length>1500)throw new Error('Maximum 1,500 project files. Exclude generated folders such as node_modules and dist.');
 const seen=new Set();let size=0;
 const files=input.files.map(f=>{const path=checkPath(f.path);if(seen.has(path))throw new Error('Duplicate file path.');seen.add(path);if(typeof f.content!=='string')throw new Error('Invalid file content.');size+=Buffer.byteLength(f.content);return {path,content:f.content,binary:!!f.binary,directory:!!f.directory,mime:typeof f.mime==='string'?f.mime.slice(0,100):''};});
 if(size>50*1024*1024)throw new Error('Project must be smaller than 50 MB.');
 for(const f of files){const segments=f.path.split('/');segments.pop();while(segments.length){const ancestor=files.find(x=>x.path===segments.join('/'));if(ancestor&&!ancestor.directory)throw new Error('A file cannot contain another file.');segments.pop();}}
 const entry=input.entry===''?'':checkPath(input.entry||'index.html');
 if(entry&&!files.some(f=>f.path===entry&&!f.directory&&!f.binary))throw new Error('Choose an existing entry file.');
 return {name:input.name.trim(),description:String(input.description||'').slice(0,1000),kind:['component','container','template'].includes(input.kind)?input.kind:'component',category:String(input.category||'Custom').slice(0,60),entry,files};
}
export function digest(project){return createHash('sha256').update(JSON.stringify([...project.files].sort((a,b)=>a.path.localeCompare(b.path)))).digest('hex');}
export function categoryFor(files){const html=files.filter(f=>/\.(html?|[jt]sx)$/.test(f.path)).map(f=>f.content).join('\n');return /<form[\s>]/i.test(html)?'Forms':/<nav[\s>]/i.test(html)?'Navigation':/<footer[\s>]/i.test(html)?'Footers':/<button[\s>]/i.test(html)?'Buttons':'Custom';}
export const starter={name:'Button component',description:'An interactive button built with HTML, CSS and JavaScript.',kind:'component',category:'Buttons',entry:'index.html',files:[
 {path:'index.html',content:'<!doctype html>\n<html lang="en">\n<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Button component</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main class="demo">\n    <span class="eyebrow">MADE IN CODE STUDIO</span>\n    <h1>A small interaction.<br>A better experience.</h1>\n    <p>Create something useful. Make it yours.</p>\n    <button id="cart-button" type="button">Add to cart</button>\n    <p id="message" role="status">Your cart is empty.</p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>'},
 {path:'styles.css',content:'* { box-sizing: border-box; }\nbody { margin: 0; font-family: Arial, sans-serif; background: #f7f8fc; color: #192338; }\n.demo { min-height: 100vh; padding: 72px 36px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }\n.eyebrow { font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #7160cc; }\nh1 { font-size: clamp(26px, 5vw, 42px); line-height: 1.15; letter-spacing: -1.5px; }\np { color: #6b7280; line-height: 1.6; }\nbutton { margin: 24px 0 12px; padding: 16px 30px; border: 0; border-radius: 12px; background: #08a854; color: white; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 8px 20px #08a85430; transition: transform .15s; }\nbutton:hover { transform: translateY(-2px); background: #078744; }\nbutton:focus-visible { outline: 3px solid #6555ff; outline-offset: 4px; }'},
 {path:'script.js',content:"let count = 0;\nconst button = document.getElementById('cart-button');\nbutton.addEventListener('click', () => {\n  count += 1;\n  document.getElementById('message').textContent = `${count} item${count === 1 ? '' : 's'} added to your cart.`;\n  console.log('Cart updated:', count);\n});"},
 {path:'assets',content:'',directory:true}]};
