import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

export type DockTabId = 'home' | 'sync' | 'till' | 'workshop' | 'stock' | 'sales' | 'more';

const items: Array<{ id: DockTabId; label: string }> = [
  { id: 'home', label: 'Home' }, { id: 'sync', label: 'Sync Workspace' },
  { id: 'till', label: 'Till' }, { id: 'workshop', label: 'Workshop Tools' },
  { id: 'stock', label: 'Stock & Inventory' }, { id: 'sales', label: 'Sales & Offers' },
  { id: 'more', label: 'More Apps' },
];

const DockIcon = ({ id, active }: { id: DockTabId; active: boolean }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'home') return <svg viewBox="0 0 24 24" {...common}><motion.path animate={{ y: active ? -2 : 0 }} d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/><motion.circle animate={active ? { scale:[1,1.4,1] } : {scale:1}} transition={{repeat:Infinity,duration:1.5}} cx="12" cy="17" r="1"/></svg>;
  if (id === 'sync') return <motion.svg viewBox="0 0 24 24" {...common} animate={{rotate:active?180:0}} transition={{duration:.5}}><path d="M20 7h-6V1"/><path d="M4 17h6v6"/><path d="M5.1 9A8 8 0 0 1 20 7M18.9 15A8 8 0 0 1 4 17"/></motion.svg>;
  if (id === 'till') return <svg viewBox="0 0 24 24" {...common}><path d="M3 4h2l2 11h11l2-7H7"/><motion.g animate={active?{x:[0,2,0]}:{x:0}}><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></motion.g></svg>;
  if (id === 'workshop') return <motion.svg viewBox="0 0 24 24" {...common} animate={active?{rotate:[0,-15,15,0]}:{rotate:0}}><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z"/></motion.svg>;
  if (id === 'stock') return <svg viewBox="0 0 24 24" {...common}><path d="m3 7 9 5 9-5-9-5-9 5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/><motion.path d="m3 7 9-5 9 5" animate={active?{y:-2}:{y:0}}/></svg>;
  if (id === 'sales') return <motion.svg viewBox="0 0 24 24" {...common} animate={{scale:active?1.1:1,filter:active?'drop-shadow(0 0 4px #34d399)':'none'}}><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.5"/></motion.svg>;
  return <svg viewBox="0 0 24 24" {...common}>{[6,12,18].map((cx,i)=><motion.circle key={cx} cx={cx} cy="12" r="1.7" fill="currentColor" animate={active?{scale:[1,1.45,1]}:{scale:1}} transition={{delay:i*.05,duration:.45}}/>)}</svg>;
};

export const MacOSDock: React.FC<{ activeTab: DockTabId; onSelectTab: (id: DockTabId) => void; moreApps?: Array<{id:string;label:string}>; onSelectApp?: (id:string)=>void }> = ({ activeTab, onSelectTab, moreApps = [], onSelectApp }) => {
  const [focusIndex,setFocusIndex]=useState<number|null>(null);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);
  const [moreOpen,setMoreOpen]=useState(false);
  const refs=useRef<Array<HTMLButtonElement|null>>([]);
  const activate=(index:number)=>{ setFocusIndex(index); refs.current[index]?.focus(); };
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{
    if (!(e.metaKey||e.ctrlKey)) return;
    if(e.key.toLowerCase()==='k'){e.preventDefault();activate(0);}
    const n=Number(e.key); if(n>=1&&n<=7){e.preventDefault();onSelectTab(items[n-1].id);activate(n-1);}
  }; window.addEventListener('keydown',key); return()=>window.removeEventListener('keydown',key); },[onSelectTab]);
  const highlighted=hoverIndex??focusIndex;
  return <nav className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-500/20 bg-gray-950/80 px-2 py-2 shadow-2xl backdrop-blur-2xl" aria-label="Staff dock" onMouseLeave={()=>setHoverIndex(null)}>
    {moreOpen && <div className="absolute bottom-[calc(100%+10px)] right-0 grid w-56 grid-cols-2 gap-2 rounded-2xl border border-emerald-500/20 bg-gray-950/95 p-3 shadow-2xl" aria-label="More apps drawer">{moreApps.map(app=><button key={app.id} type="button" onClick={()=>{onSelectApp?.(app.id);setMoreOpen(false)}} className="rounded-xl border border-white/10 bg-gray-900 p-2 text-left text-[11px] font-semibold text-white hover:border-emerald-400/50">{app.label}</button>)}</div>}
    <div className="flex items-end gap-1">{items.map((item,index)=>{const distance=highlighted===null?99:Math.abs(highlighted-index); const scale=distance===0?1.4:distance===1?1.15:1; const selected=activeTab===item.id; return <div key={item.id} className="relative flex w-11 justify-center sm:w-14">
      {(highlighted===index)&&<div role="tooltip" className="absolute -top-11 whitespace-nowrap rounded-lg border border-emerald-500/20 bg-gray-950/95 px-2 py-1 text-[10px] font-semibold text-white shadow-xl">{item.label}</div>}
      <motion.button ref={el=>{refs.current[index]=el}} type="button" aria-label={item.label} aria-current={selected?'page':undefined} animate={{scale}} whileTap={{scale:.95}} transition={{type:'spring',stiffness:360,damping:24}} onMouseEnter={()=>setHoverIndex(index)} onFocus={()=>setFocusIndex(index)} onBlur={()=>setFocusIndex(null)} onClick={()=>{if(item.id==='more')setMoreOpen(v=>!v);onSelectTab(item.id)}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();activate((index+(e.key==='ArrowRight'?1:-1)+items.length)%items.length);} if(e.key==='Escape'){e.preventDefault();setMoreOpen(false);setFocusIndex(null);refs.current[index]?.blur();document.body.focus();}}} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gray-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"><span className="h-6 w-6"><DockIcon id={item.id} active={distance===0}/></span>{selected&&<motion.span layoutId="activeDot" className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"/>}</motion.button>
    </div>})}</div>
  </nav>;
};
export default MacOSDock;
