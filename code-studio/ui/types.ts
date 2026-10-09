export type StudioFile={path:string;content:string;binary?:boolean;directory?:boolean;mime?:string};
export type Project={id:string;name:string;description:string;kind:string;category:string;entry:string;files:StudioFile[];revision:number;fork?:string;updated?:number};
export type Account={id:string;email:string;role:'admin'|'user';local?:boolean};
export type Release=Project & {version:number;status?:'published'|'unpublished'|'draft'};
export async function api<T=any>(path:string,method='GET',data?:unknown):Promise<T>{const r=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin'});const result=await r.json();if(!r.ok)throw new Error(result.error||'Request failed');return result;}
