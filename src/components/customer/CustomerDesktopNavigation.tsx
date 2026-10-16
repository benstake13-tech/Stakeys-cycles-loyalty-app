import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStaffDisplayMode } from '../../hooks/useStaffDisplayMode';
import { StakeysAppIcon, type StakeysIconName } from '../StakeysAppIcon';
import './CustomerDesktopNavigation.css';

type CustomerNavId = 'customer'|'booking'|'website'|'promotions';
const apps:Array<{id:CustomerNavId;label:string;icon:StakeysIconName}>=[
  {id:'customer',label:'My Garage',icon:'garage'}, {id:'booking',label:'Book a Repair',icon:'booking'},
  {id:'promotions',label:'Offers & Rewards',icon:'offers'}, {id:'website',label:'Visit Website',icon:'website'},
];
export const CustomerDesktopNavigation:React.FC<{active:CustomerNavId;onSelect:(id:CustomerNavId)=>void}>=({active,onSelect})=>{
  const mode=useStaffDisplayMode();const [open,setOpen]=useState(false);const [hovered,setHovered]=useState<number|null>(null);const refs=useRef<Array<HTMLButtonElement|null>>([]);
  useEffect(()=>{setOpen(false)},[active]);
  useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key)}},[open]);
  const choose=(id:CustomerNavId)=>{onSelect(id);setOpen(false)};
  const dock=<nav className={`stk-customer-dock stk-customer-dock--${mode}`} aria-label="Customer app navigation" onPointerLeave={()=>{setHovered(null);refs.current.forEach(b=>{b?.style.removeProperty('--dock-scale');b?.style.removeProperty('--dock-lift')})}} onPointerMove={e=>{if(mode!=='desktop'||e.pointerType!=='mouse')return;refs.current.forEach(b=>{if(!b)return;const r=b.getBoundingClientRect();const d=Math.abs(e.clientX-r.left-r.width/2);const s=1+.4*Math.exp(-(d*d)/(2*64**2));b.style.setProperty('--dock-scale',s.toFixed(3));b.style.setProperty('--dock-lift',`${-((s-1)*18).toFixed(1)}px`)})}}>
    <div>{apps.slice(0,mode==='desktop'?3:0).map((app,i)=><button key={app.id} ref={el=>{refs.current[i]=el}} type="button" aria-label={app.label} aria-current={active===app.id?'page':undefined} onPointerEnter={e=>{if(e.pointerType==='mouse')setHovered(i)}} onClick={()=>choose(app.id)}><span><StakeysAppIcon name={app.icon} size={29}/></span><b>{app.label}</b></button>)}<button type="button" aria-label="Open app drawer" aria-expanded={open} onClick={()=>setOpen(true)}><span><StakeysAppIcon name="apps" size={29}/></span><b>Apps</b></button></div>
    {hovered!==null&&<i className="sr-only" role="status">{apps[hovered]?.label}</i>}
  </nav>;
  return <>{mode==='desktop'?dock:createPortal(dock,document.body)}{open&&createPortal(<div className="stk-customer-drawer-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="stk-customer-drawer" role="dialog" aria-modal="true" aria-label="Customer app drawer"><header><div><small>STAKEY’S CYCLES</small><h2>Your apps</h2></div><button type="button" aria-label="Close app drawer" onClick={()=>setOpen(false)}>×</button></header><div>{apps.map(app=><button key={app.id} type="button" aria-current={active===app.id?'page':undefined} onClick={()=>choose(app.id)}><span><StakeysAppIcon name={app.icon} size={29}/></span><b>{app.label}</b></button>)}</div></section></div>,document.body)}</>;
};
