import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ShoppingBag,Trash2,X} from 'lucide-react';

type CartItem={projectId?:string;title:string;kind?:string;client?:string};
function readCart():CartItem[]{try{const value=JSON.parse(localStorage.getItem('component-cart')||'[]');return Array.isArray(value)?value:[]}catch{return []}}

export default function ProjectCartDrawer(){
 const nav=useNavigate();
 const [open,setOpen]=useState(false);
 const [items,setItems]=useState<CartItem[]>(readCart);
 useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
 const toggle=()=>{if(!open)setItems(readCart());setOpen(value=>!value)};
 const remove=(index:number)=>{const next=items.filter((_,itemIndex)=>itemIndex!==index);localStorage.setItem('component-cart',JSON.stringify(next));setItems(next)};
 return <>
  <button className="projectCartToggle" type="button" aria-label={open?'Close cart sidebar':'Open cart sidebar'} aria-expanded={open} aria-controls="projectCartSidebar" onClick={toggle}><ShoppingBag size={19}/>{items.length>0&&<span>{items.length}</span>}</button>
  {open&&<aside id="projectCartSidebar" className="projectCartSidebar" aria-label="Cart sidebar"><div className="projectCartSidebarHead"><h2>Cart</h2><button type="button" aria-label="Close cart sidebar" onClick={toggle}><X size={18}/></button></div>{items.length?<div className="projectCartSidebarItems">{items.map((item,index)=><article key={`${item.projectId||item.title}-${index}`}><div><b>{item.title}</b><small>{item.kind||'Item'}{item.client?` · ${item.client}`:''}</small></div><div className="projectCartSidebarItemActions"><button type="button" onClick={()=>nav(item.projectId?`/code/${item.projectId}`:'/cart')}>Open</button><button type="button" aria-label={`Remove ${item.title} from cart`} onClick={()=>remove(index)}><Trash2 size={15}/></button></div></article>)}</div>:<p className="projectCartSidebarEmpty">Your cart is empty.</p>}<button className="projectCartSidebarView" type="button" onClick={()=>nav('/cart')}>View full cart</button></aside>}
 </>
}
