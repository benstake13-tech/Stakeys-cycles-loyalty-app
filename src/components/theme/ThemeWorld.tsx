import { useEffect, useState, type CSSProperties } from 'react';
import { ThemeArtwork } from './ThemeArtwork';
import { worldFor } from './worldCatalog';
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
 const world = worldFor(theme);
 const [saved] = useThemeMotion();
 const [hidden,setHidden] = useState(false);
 useEffect(()=>{const sync=()=>setHidden(document.hidden);sync();document.addEventListener('visibilitychange',sync);return ()=>document.removeEventListener('visibilitychange',sync);},[]);
 if(!world) return null;
 const motion=requested||saved;
 return <div className={`theme-world ${preview?'theme-world-preview':'theme-world-background'}`} data-motion={motion} data-paused={hidden} aria-hidden="true" style={{'--world-accent':world.accent} as CSSProperties}>
  <ThemeArtwork world={world}/>
  <div className="theme-atmosphere"/>
  {world.effect!=='none' && <div className={`theme-particles theme-particles-${world.effect}`}>
   {Array.from({length:motion==='full'?32:16},(_,i)=><i key={i} style={{'--x':`${(i*37+11)%100}%`,'--duration':`${9+i%7*2}s`,'--delay':`${-i*1.7}s`,'--size':`${3+i%4*2}px`,'--drift':`${(i%2?1:-1)*(35+i%4*12)}px`,'--twist':`${i*47}deg`} as CSSProperties}/>)}
  </div>}
 </div>;
}
export function ThemeMotionControl() {
 const [motion,setMotion]=useThemeMotion();
 return <fieldset className="theme-motion-control"><legend>Effects on this device</legend><div>{(['still','gentle','full'] as const).map(value=><button key={value} type="button" aria-pressed={motion===value} onClick={()=>setMotion(value)}>{value==='still'?'Still image':value==='gentle'?'Gentle motion':'Full effects'}</button>)}</div><p>Your phone’s reduced-motion setting always takes priority.</p></fieldset>;
}
