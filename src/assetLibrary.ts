export type ImageAsset = {id:string;name:string;mime:string;created:number;url:string};

export async function loadImageAssets():Promise<ImageAsset[]> {
  const response=await fetch('/api/assets',{credentials:'same-origin'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Unable to load images.');
  return result;
}

export async function uploadImageAsset(file:File):Promise<ImageAsset> {
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a PNG, JPEG, WebP, or GIF under 10 MB.');
  const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('Unable to read image.'));reader.readAsDataURL(file)});
  const response=await fetch('/api/assets',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name:file.name,mime:file.type,content})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Unable to upload image.');
  window.dispatchEvent(new Event('studio-assets-changed'));
  return result;
}
