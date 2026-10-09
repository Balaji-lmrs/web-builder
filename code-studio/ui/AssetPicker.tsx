import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {api} from './types';

type ImageAsset={id:string;name:string;url:string;mime:string;created:number};
export default function AssetPicker({showTrigger=true}:{showTrigger?:boolean}){
 const [open,setOpen]=useState(false),[items,setItems]=useState<ImageAsset[]>([]),[error,setError]=useState(''),[selected,setSelected]=useState<ImageAsset|null>(null),[copied,setCopied]=useState(false);
 useEffect(()=>{const show=()=>{setOpen(true);setError('');setCopied(false)};window.addEventListener('open-code-studio-assets',show);return()=>window.removeEventListener('open-code-studio-assets',show)},[]);
 useEffect(()=>{if(!open)return;let live=true;api<ImageAsset[]>('assets').then(result=>{if(live)setItems(result)}).catch(reason=>{if(live)setError(reason.message)});return()=>{live=false}},[open]);
 const copy=async()=>{if(!selected)return;try{await navigator.clipboard.writeText(location.origin+selected.url);setCopied(true)}catch{setError('Select and copy the link below.')}};
 return <div className="cs-assets-control">{showTrigger&&<button type="button" onClick={()=>{setOpen(value=>!value);setError('');setCopied(false)}} aria-expanded={open}>Assets</button>}{open&&createPortal(<div className="cs-assets-popover" role="dialog" aria-label="Assets"><div className="cs-assets-heading"><b>Uploaded images</b><button type="button" aria-label="Close Assets" onClick={()=>setOpen(false)}>×</button></div>{error&&<p role="alert">{error}</p>}{items.length?<div className="cs-assets-list">{items.map(item=><button type="button" key={item.id} className={selected?.id===item.id?'selected':''} onClick={()=>{setSelected(item);setCopied(false)}}><img src={item.url} alt=""/><span title={item.name}>{item.name}</span></button>)}</div>:<p>No images yet. Upload one in My Projects → Assets.</p>}{selected&&<div className="cs-asset-link"><label>Image link<input readOnly value={location.origin+selected.url} onFocus={event=>event.target.select()}/></label><button type="button" onClick={()=>void copy()}>{copied?'Copied':'Copy link'}</button><small>Use this link as an image src in your code.</small></div>}</div>,document.body)}</div>
}
