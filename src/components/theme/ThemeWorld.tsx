import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ThemeArtwork } from './ThemeArtwork';
import { worldFor } from './worldCatalog';
import { Theme3DCanvas } from './Theme3DCanvas';
import { characterLabel } from './seasonal3d';
import './themeWorld.css';
export type ThemeMotion = 'full' | 'gentle' | 'still';
const MOTION_KEY = 'stakeys.theme.motion.v2';
export function useThemeMotion() {
 const read = ():ThemeMotion => { try { const v = localStorage.getItem(MOTION_KEY); return v==='full'||v==='still'?v:'gentle'; } catch { return 'gentle'; } };
 const [motion,setMotion] = useState<ThemeMotion>(read);
 useEffect(()=>{ const sync=()=>setMotion(read()); window.addEventListener('stakeys-theme-motion',sync); window.addEventListener('storage',sync); return ()=>{window.removeEventListener('stakeys-theme-motion',sync);window.removeEventListener('storage',sync);}; },[]);
 const update=(value:ThemeMotion)=>{setMotion(value);try {localStorage.setItem(MOTION_KEY,value);}catch{/* preferences can be session-only */}window.dispatchEvent(new Event('stakeys-theme-motion'));};
 return [motion,update] as const;
}
export function ThemeWorld({ theme, preview=false, motion:requested }: {theme:string;preview?:boolean;motion?:ThemeMotion}) {
 const world=worldFor(theme),[saved]=useThemeMotion();
 const [hidden,setHidden]=useState(false),[ready,setReady]=useState(false),[reaction,setReaction]=useState(0),[open,setOpen]=useState(false),[reduced,setReduced]=useState(false);
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const sync=()=>setHidden(document.hidden);sync();document.addEventListener('visibilitychange',sync);
  const mq=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const motionChanged=()=>setReduced(Boolean(mq?.matches));motionChanged();mq?.addEventListener?.('change',motionChanged);
  return()=>{document.removeEventListener('visibilitychange',sync);mq?.removeEventListener?.('change',motionChanged);};
 },[]);
 useEffect(()=>{setReaction(0);setOpen(false);},[theme]);
 useEffect(()=>{
  if(!open)return;
  const focus=document.activeElement as HTMLElement|null,old=document.body.style.overflow;document.body.style.overflow='hidden';
  const controls=()=>Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,[tabindex="0"]')||[]);
  controls()[0]?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setOpen(false);
   if(event.key==='Tab'){const list=controls(),first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);focus?.focus();};
 },[open]);
 if(!world)return null;
 const motion:ThemeMotion=reduced||theme==='remembranceday'?'still':requested||saved;
 return <>
  <div className={'theme-world '+(preview?'theme-world-preview':'theme-world-background')} data-motion={motion} data-paused={hidden} data-renderer={ready?'webgl':'artwork'} aria-hidden={preview?undefined:true} style={{'--world-accent':world.accent,'--world-sky':world.sky,'--world-horizon':world.horizon} as CSSProperties}>
   <ThemeArtwork world={world}/>
   <Theme3DCanvas world={world} motion={open?'still':motion} preview={preview} reaction={reaction} onReady={setReady}/>
   <div className="theme-atmosphere"/>
   {world.effect!=='none'&&<div className={'theme-particles theme-particles-'+world.effect}>
    {Array.from({length:motion==='full'?32:16},(_,i)=><i key={i} style={{'--x':((i*37+11)%100)+'%','--duration':(9+i%7*2)+'s','--delay':(-i*1.7)+'s','--size':(3+i%4*2)+'px','--drift':((i%2?1:-1)*(35+i%4*12))+'px','--twist':(i*47)+'deg'} as CSSProperties}/>)}
   </div>}
   {preview&&ready&&theme!=='remembranceday'&&<div className="theme-scene-tools"><span>{motion==='still'?'Still scene':'Tap a character'}</span><button type="button" disabled={motion==='still'} onClick={()=>setReaction(n=>n+1)} aria-label="Play character reaction">Play reaction</button></div>}
  </div>
  {!preview&&typeof document!=='undefined'&&createPortal(<>
   <button type="button" className="theme-scene-launcher" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={'Explore '+world.label+' seasonal scene'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 3L21 8V17L12 22L3 17V8Z M3 8L12 13L21 8M12 13V22"/></svg>Seasonal scene</button>
   {open&&<div className="theme-scene-overlay" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={world.label+' seasonal scene'} className="theme-scene-dialog">
     <header><div><small>STAKEY'S SEASONAL WORLDS</small><h2>{world.label}</h2><p>{characterLabel(theme)}</p></div><button type="button" aria-label="Close seasonal scene" onClick={()=>setOpen(false)}>×</button></header>
     <ThemeWorld theme={theme} preview motion={motion}/>
     <div className="theme-scene-dialog-footer"><p>{motion==='still'?'A quiet view of the seasonal world.':'Tap a character and watch it tumble, then recover.'}</p><ThemeMotionControl/></div>
    </div>
   </div>}
  </>,document.body)}
 </>;
}
export function ThemeMotionControl() {
 const [motion,setMotion]=useThemeMotion();
 return <fieldset className="theme-motion-control"><legend>Effects on this device</legend><div>{(['still','gentle','full'] as const).map(value=><button key={value} type="button" aria-pressed={motion===value} onClick={()=>setMotion(value)}>{value==='still'?'Still image':value==='gentle'?'Gentle motion':'Full effects'}</button>)}</div><p>Your phone’s reduced-motion setting always takes priority.</p></fieldset>;
}
