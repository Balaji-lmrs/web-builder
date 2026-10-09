import {useEffect,useRef,useState} from 'react';
export default function CodeStudio({projectId}:{projectId?:string}){
 const frame=useRef<HTMLIFrameElement>(null);
 const [editing,setEditing]=useState(false);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;if(event.data?.studioLayout)setEditing(event.data.studioLayout==='editor')};addEventListener('message',receive);return()=>removeEventListener('message',receive)},[]);
 return <section id="studio-layout-host" data-editing={editing} aria-label="Code Studio"><style>{`
 .app:has(#studio-layout-host)>.sidebar{width:210px!important;z-index:60}
 #studio-layout-host{position:fixed;inset:0 0 0 210px;z-index:50;background:#0d1425}
 #studio-layout-host[data-editing="true"]{left:0}
 .app:has(#studio-layout-host[data-editing="true"])>.sidebar{display:none!important}
 .app:has(#studio-layout-host) .desktopAccount{display:flex!important;z-index:200!important}
 @media(max-width:700px){#studio-layout-host{left:0}.app:has(#studio-layout-host)>.sidebar{display:none!important}}
 `}</style><iframe ref={frame} title="Code Studio workspace" src={projectId?`/studio/?project=${encodeURIComponent(projectId)}`:"/studio/"} style={{display:'block',width:'100%',height:'100%',border:0}}/></section>;
}
