import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { usePublishedLibrary, LibraryStatus, PublishedSection } from '../../publishedLibrary';
import { useStore } from '../../store';
import type { Project } from '../../types';

const demoProducts=[['Stillwater Bottle','$28','Mist'],['Arc Lamp','$86','Studio'],['Quiet Form','$42','Amber']];

export function EcommerceProducts(){const [cart,setCart]=useState(0);return <div className="shopBlock"><div className="cartStatus" aria-live="polite"><ShoppingBag size={16}/><span>Cart</span><b>{cart}</b></div><div className="productGrid">{demoProducts.map(([name,price,tone])=><article key={name} className="storeProduct"><div className={`productImage ${tone.toLowerCase()}`}></div><div><h3>{name}</h3><p>{price}</p></div><button onClick={()=>setCart(value=>value+1)}>Add to cart</button></article>)}</div>{cart>0&&<p className="cartMessage">{cart} item{cart===1?'':'s'} added to your cart.</p>}</div>}

export function RenderSite({project}:{project:Project}){return <div className="publishedSite">{project.sections.map(s=>s.publishedItem?<PublishedSection key={s.id} item={s.publishedItem}/>:<section className={`siteSection ${s.kind}`} key={s.id}><div>{s.kind==='hero'&&<small>EDITORIAL</small>}<h1>{s.title}</h1><p>{s.text}</p>{s.kind==='hero'&&<button>Explore collection</button>}{s.kind==='products'&&<EcommerceProducts/>}</div></section>)}</div>}

export function Preview(){const {templates,loading,error}=usePublishedLibrary();const {projectId='atlas'}=useParams();const projects=useStore(s=>s.projects);const nav=useNavigate();const isTemplate=projectId.startsWith('template-');const template=templates.find(t=>t.id===projectId.replace('template-',''));const project=isTemplate&&template?{id:'preview',name:template.name,templateId:template.id,updatedAt:'',published:false,sections:template.sections}:projects.find(p=>p.id===projectId);if(isTemplate&&(loading||error))return <LibraryStatus loading={loading} error={error} empty={false}/>;if(!project)return <Navigate to="/websites"/>;return <div className="previewPage"><header><b>{project.name}</b><div><button className="ghost" onClick={()=>nav(isTemplate?'/templates':`/builder/${projectId}`)}>Back to {isTemplate?'templates':'builder'}</button>{!isTemplate&&<button className="primary small" onClick={()=>{useStore.getState().publish(projectId);alert('Deployment provider not configured. Your project is marked ready to publish.')}}>Publish</button>}</div></header><RenderSite project={project}/></div>}
