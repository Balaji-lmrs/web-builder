import {useEffect,useRef,useState} from 'react';
import {api} from './types';

type ImageAsset={id:string;name:string;url:string;mime:string;created:number};

export default function AssetLibraryView(){
 const [assets,setAssets]=useState<ImageAsset[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<ImageAsset|null>(null);
 const [removeTarget,setRemoveTarget]=useState<ImageAsset|null>(null);
 const [copied,setCopied]=useState(false);
 const input=useRef<HTMLInputElement>(null);

 useEffect(()=>{let live=true;api<ImageAsset[]>('assets').then(items=>{if(live)setAssets(items)}).catch(reason=>{if(live)setError(reason.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);

 const upload=async(file?:File)=>{
  if(!file)return;
  setError('');
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>10*1024*1024){setError('Choose a PNG, JPEG, WebP, or GIF under 10 MB.');return}
  setBusy(true);
  try{
   const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('Unable to read image.'));reader.readAsDataURL(file)});
   const asset=await api<ImageAsset>('assets','POST',{name:file.name,mime:file.type,content});
   setAssets(items=>[asset,...items]);
   window.dispatchEvent(new Event('studio-assets-changed'));
  }catch(reason){setError(reason instanceof Error?reason.message:'Unable to upload image.')}finally{setBusy(false);if(input.current)input.current.value=''}
 };
 const remove=async()=>{
  if(!removeTarget||busy)return;
  setBusy(true);setError('');
  try{await api(`assets/${removeTarget.id}`,'DELETE');setAssets(items=>items.filter(item=>item.id!==removeTarget.id));if(selected?.id===removeTarget.id)setSelected(null);setRemoveTarget(null);window.dispatchEvent(new Event('studio-assets-changed'))}catch(reason){setError(reason instanceof Error?reason.message:'Unable to delete image.')}finally{setBusy(false)}
 };
 const copy=async(asset:ImageAsset)=>{setSelected(asset);setCopied(false);try{await navigator.clipboard.writeText(location.origin+asset.url);setCopied(true)}catch{setError('Select and copy the image link below.')}};

 return <section className="cs-library cs-asset-page">
  <div className="cs-asset-page-head"><div><h1>Assets</h1><p>Upload images and use their links in your code.</p></div><button className="cs-primary" type="button" disabled={busy} onClick={()=>input.current?.click()}>＋ Upload image</button></div>
  <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event=>void upload(event.target.files?.[0])}/>
  {error&&<p className="cs-error" role="alert">{error}</p>}
  {loading?<p>Loading images…</p>:assets.length?<div className="cs-asset-grid">{assets.map(asset=><article key={asset.id}><img src={asset.url} alt={asset.name}/><strong title={asset.name}>{asset.name}</strong><div><button type="button" onClick={()=>void copy(asset)}>{selected?.id===asset.id&&copied?'Copied link':'Copy link'}</button><button type="button" onClick={()=>{setError('');setRemoveTarget(asset)}}>Delete</button></div></article>)}</div>:<p>No images uploaded yet.</p>}
  {selected&&<label className="cs-asset-selected-link">Image link<input readOnly value={location.origin+selected.url} onFocus={event=>event.target.select()}/></label>}
  {removeTarget&&<div className="cs-asset-modal-backdrop" onClick={()=>!busy&&setRemoveTarget(null)}><div className="cs-asset-modal" role="dialog" aria-modal="true" aria-label="Delete image" onClick={event=>event.stopPropagation()}><h2>Delete image?</h2><p>Delete “{removeTarget.name}” from Assets? This cannot be undone.</p>{error&&<p className="cs-error" role="alert">{error}</p>}<div><button type="button" disabled={busy} onClick={()=>setRemoveTarget(null)}>Cancel</button><button type="button" className="cs-danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Delete image'}</button></div></div></div>}
 </section>
}
