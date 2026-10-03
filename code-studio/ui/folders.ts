import type {StudioFile} from './types';
import {mimeFor} from './archive';

// Directory handles are granted by the user's browser picker, never by a path string.
export type DirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
  requestPermission(options: {mode: string}): Promise<string>;
};
export const supportsFolders = () => 'showDirectoryPicker' in window;
export async function chooseFolder(): Promise<DirectoryHandle> {
  return (window as any).showDirectoryPicker({mode:'readwrite'});
}
export function isTextFile(name:string) {
  return /(^|\/)(dockerfile|makefile|license|readme)$/i.test(name) || /\.(html?|css|scss|sass|less|[cm]?[jt]sx?|json|jsonc|md|mdx|txt|csv|xml|svg|py|java|[ch]|[ch]pp|hxx|cc|rs|go|php|rb|sh|bash|zsh|ps1|sql|ya?ml|toml|ini|env|vue|svelte|astro|dart|kt|kts|swift|log|graphql|gql|prisma|properties|gradle|lock|gitignore|npmrc)$/i.test(name) || !name.includes('.');
}
export async function readFile(file:File,name=file.name):Promise<StudioFile> {
  if(file.size>20*1024*1024)throw new Error('Each file must be smaller than 20 MB.');
  const binary=!isTextFile(name);let content:string;
  if(!binary)content=await file.text();
  else {const bytes=new Uint8Array(await file.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));content=btoa(value);}
  return {path:name,content,binary,mime:file.type||mimeFor(name)};
}
export async function readFolder(handle:DirectoryHandle):Promise<StudioFile[]> {
  const files:StudioFile[]=[];let size=0;
  async function visit(directory:DirectoryHandle,prefix='') {
    for await(const entry of directory.values()) {
      if(['.git','node_modules','.next','dist'].includes(entry.name))continue;
      const name=prefix+entry.name;
      if(entry.kind==='directory'){files.push({path:name,content:'',directory:true});await visit(entry as DirectoryHandle,name+'/');}
      else {const file=await readFile(await (entry as FileSystemFileHandle).getFile(),name);size+=file.content.length;files.push(file);}
      if(files.length>1500||size>50*1024*1024)throw new Error('Folder exceeds the current limit of 1,500 files or 50 MB. Exclude generated folders such as node_modules and dist.');
    }
  }
  await visit(handle);return files;
}
export async function writeFolder(handle:DirectoryHandle,files:StudioFile[],knownPaths:Set<string>) {
  if(await handle.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Folder write permission was not granted.');
  async function parentFor(filePath:string,create:boolean){const parts=filePath.split('/');const name=parts.pop()!;let parent:FileSystemDirectoryHandle=handle;for(const segment of parts)parent=await parent.getDirectoryHandle(segment,{create});return {parent,name};}
  // Only remove entries previously loaded by this workspace and explicitly removed in its explorer.
  for(const removed of [...knownPaths].filter(p=>!files.some(f=>f.path===p)).sort((a,b)=>b.split('/').length-a.split('/').length)) {
    try{const {parent,name}=await parentFor(removed,false);await parent.removeEntry(name);}catch(e){if(!['NotFoundError','InvalidModificationError'].includes((e as DOMException).name))throw e;}
  }
  for(const file of files){const {parent,name}=await parentFor(file.path,true);if(file.directory){await parent.getDirectoryHandle(name,{create:true});continue;}const target=await parent.getFileHandle(name,{create:true});const stream=await target.createWritable();try{await stream.write(file.binary?Uint8Array.from(atob(file.content),c=>c.charCodeAt(0)):file.content);await stream.close();}catch(e){await stream.abort();throw e;}}
  return new Set(files.map(f=>f.path));
}
export function previewEntry(files:StudioFile[],preferred='') {
  const text=files.filter(f=>!f.binary&&!f.directory);
  return (text.find(f=>f.path===preferred)||text.find(f=>f.path==='index.html')||text.find(f=>/\.html?$/i.test(f.path))||text.find(f=>/\.[jt]sx?$/i.test(f.path)))?.path||'';
}
