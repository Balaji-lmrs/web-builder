import { useEffect, useState } from 'react';
import type { PublishedItem, Section, Template } from './types';

export function sectionFromRelease(item: PublishedItem): Section {
  return {id:item.id,kind:'custom',title:item.name,text:item.description,publishedItem:item};
}

export function usePublishedLibrary() {
  const [items,setItems]=useState<PublishedItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let controller: AbortController | undefined;
    const refresh=async()=>{
      controller?.abort();controller=new AbortController();const signal=controller.signal;
      try {
        const response=await fetch('/api/library',{signal,credentials:'same-origin'});
        if(!response.ok)throw new Error('The published library is unavailable. Run the website with its Code Studio service.');
        const data=await response.json();
        if(!Array.isArray(data))throw new Error('The published library service returned an invalid response.');
        if(!signal.aborted){setItems(data);setError('');}
      } catch(e) {if(!signal.aborted)setError(e instanceof Error?e.message:'Unable to load the published library.');}
      finally {if(!signal.aborted)setLoading(false);}
    };
    void refresh();window.addEventListener('focus',refresh);
    return()=>{controller?.abort();window.removeEventListener('focus',refresh);};
  },[]);
  const components=items.filter(item=>item.kind==='component'||item.kind==='container').map(sectionFromRelease);
  const templates:Template[]=items.filter(item=>item.kind==='template').map(item=>({id:item.id,name:item.name,description:item.description,category:item.category,style:`Version ${item.version}`,color:'#a78bfa',tags:[item.category],sections:[sectionFromRelease(item)]}));
  return {components,templates,loading,error};
}

export function LibraryStatus({loading,error,empty}:{loading:boolean;error:string;empty:boolean}) {
  if(error)return <p role="alert">{error}</p>;
  if(loading)return <p role="status">Loading published items…</p>;
  return empty?<p>No published items yet. Create and publish in Code Studio to fill this library.</p>:null;
}

const previewCache=new Map<string,string>();
export function PublishedSection({item}:{item:PublishedItem}) {
  const [html,setHtml]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();const key=`${item.id}:${item.version}`;
    setHtml(previewCache.get(key)||'');setError('');
    if(previewCache.has(key))return()=>controller.abort();
    void (async()=>{
      try {
        const response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item),signal:controller.signal});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Preview could not be built.');
        if(!controller.signal.aborted){if(previewCache.size>=30)previewCache.clear();previewCache.set(key,data.html);setHtml(data.html);}
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Preview unavailable.');}
    })();
    return()=>controller.abort();
  },[item]);
  return <div style={{width:'100%',minWidth:0}}>{error?<p role="alert">{error}</p>:html?<iframe title={`${item.name} — published preview`} sandbox="allow-scripts" srcDoc={html} style={{display:'block',width:'100%',height:item.kind==='template'?700:420,border:0,background:'#fff',resize:'vertical'}}/>:<p role="status">Preparing preview…</p>}</div>;
}
