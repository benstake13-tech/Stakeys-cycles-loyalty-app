import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
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
const EASTER_HUNT_EVENT = 'easter-hunt-2027';
const EASTER_HUNT_TARGET = 75;
type EasterHuntRow = { tap_count: number; completed: boolean; discount_code: string | null };
export function ThemeWorld({ theme, preview=false, motion:requested, huntEnabled=false, huntUserId, onEggTap }: {theme:string;preview?:boolean;motion?:ThemeMotion;huntEnabled?:boolean;huntUserId?:string;onEggTap?:()=>void}) {
 const world=worldFor(theme),[saved]=useThemeMotion();
 const [hidden,setHidden]=useState(false),[ready,setReady]=useState(false),[reaction,setReaction]=useState(0),[open,setOpen]=useState(false),[reduced,setReduced]=useState(false);
 const [eggTaps,setEggTaps]=useState(0),[eggCode,setEggCode]=useState(''),[eggMessage,setEggMessage]=useState(''),[eggBusy,setEggBusy]=useState(false),[eggCopied,setEggCopied]=useState(false),[celebrating,setCelebrating]=useState(false);
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  setEggTaps(0);setEggCode('');setEggMessage('');
  if(!huntEnabled||!huntUserId||theme!=='easter')return;
  let active=true;
  void supabase.rpc('get_easter_hunt_progress',{p_event_id:EASTER_HUNT_EVENT}).then(({data,error})=>{
   if(!active)return;
   if(error){setEggMessage('Your Easter hunt progress could not be loaded. Please try again.');return;}
   const row=(Array.isArray(data)?data[0]:data) as EasterHuntRow|null;
   if(row){setEggTaps(Number(row.tap_count)||0);setEggCode(row.discount_code||'');}
  });
  return()=>{active=false;};
 },[huntEnabled,huntUserId,theme]);
 const recordBunnyTap=useCallback(async()=>{
  if(!huntEnabled||!huntUserId||theme!=='easter'||eggCode)return;
  setEggBusy(true);setEggMessage('');
  try{
   const {data,error}=await supabase.rpc('tap_easter_bunny',{p_event_id:EASTER_HUNT_EVENT});
   if(error)throw error;
   const row=(Array.isArray(data)?data[0]:data) as EasterHuntRow|null;
   if(!row)throw new Error('The hunt did not return progress.');
   setEggTaps(current=>Math.max(current,Number(row.tap_count)||0));
   if(row.completed&&row.discount_code){setEggCode(row.discount_code);setEggMessage('You found the Easter Bunny! Your rewards are ready.');setCelebrating(true);}
  }catch(error){console.error('[EASTER HUNT] Could not record bunny tap:',error);setEggMessage('We could not save that tap. Check your connection and try again.');}
  finally{setEggBusy(false);}
 },[huntEnabled,huntUserId,theme,eggCode]);
 const handleCharacterTap=useCallback((index:number)=>{
  if(index===0)void (onEggTap||recordBunnyTap)();
 },[onEggTap,recordBunnyTap]);
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
   {preview&&<Theme3DCanvas world={world} motion={motion} preview reaction={reaction} onReady={setReady} onCharacterTap={theme==='easter'?handleCharacterTap:undefined}/>}
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
     <ThemeWorld theme={theme} preview motion={motion} onEggTap={recordBunnyTap} />
     {huntEnabled&&theme==='easter'&&<section className="easter-hunt" aria-label="Easter egg hunt">
      <div className="easter-hunt-heading"><div><span>HIDDEN EASTER EGG</span><h3>Find the bunny’s surprise</h3></div><strong>{eggCode?'FOUND!':`${eggTaps}/${EASTER_HUNT_TARGET}`}</strong></div>
      {huntUserId?<>
       <p>{eggCode?'You’ve earned 1 stamp, 50 points, 2 prize draw entries and a personal £5 discount code.':`Tap the left-hand Easter Bunny ${EASTER_HUNT_TARGET} times to unlock 1 stamp, 50 points, 2 prize draw entries and a personal £5 discount code.`}</p>
       <div className="easter-hunt-progress" role="progressbar" aria-label="Easter Bunny taps" aria-valuemin={0} aria-valuemax={EASTER_HUNT_TARGET} aria-valuenow={Math.min(eggTaps,EASTER_HUNT_TARGET)}><i style={{width:`${Math.min(100,eggTaps/EASTER_HUNT_TARGET*100)}%`}}/></div>
       {!eggCode&&<button type="button" className="easter-hunt-tap" onClick={()=>{setReaction(n=>n+1);void recordBunnyTap();}} disabled={eggBusy||eggTaps>=EASTER_HUNT_TARGET}>Tap the bunny {eggBusy?'…':'🐇'}</button>}
       {eggCode&&<div className="easter-hunt-code"><span>{eggCode}</span><button type="button" onClick={()=>{void navigator.clipboard?.writeText(eggCode).then(()=>{setEggCopied(true);window.setTimeout(()=>setEggCopied(false),1800);}).catch(()=>setEggMessage('Select and copy the code above.'));}}>{eggCopied?'Copied':'Copy code'}</button><small>£5 off • one use • valid for 90 days</small></div>}
      </>:<p>Sign in to the customer app to track your hunt and collect the rewards.</p>}
      <p className="easter-hunt-status" aria-live="polite">{eggMessage}</p>
     </section>}
     <div className="theme-scene-dialog-footer"><p>{motion==='still'?'A quiet view of the seasonal world.':'Tap a character and watch it tumble, then recover.'}</p><ThemeMotionControl/></div>
    </div>
    {celebrating&&<div className="easter-celebration" role="dialog" aria-modal="true" aria-labelledby="easter-celebration-title">
     <div className="easter-celebration-card">
      <button type="button" className="easter-celebration-close" aria-label="Close Easter reward" onClick={()=>setCelebrating(false)}>×</button>
      <div className="easter-celebration-character"><ThemeWorld theme="easter" preview motion={reduced?'gentle':'full'}/></div>
      <span className="easter-celebration-kicker">A LITTLE EASTER MAGIC</span>
      <h2 id="easter-celebration-title">Happy Easter!</h2>
      <p className="easter-celebration-quote">“Hey, you curious bunny! You found me. Here’s an Easter treat!”</p>
      <p>Your account has been given <strong>1 stamp, 50 points and 2 prize draw entries.</strong></p>
      <div className="easter-celebration-offer"><span>Your treat</span><strong>£5 off</strong><p>Use your personal code on your next Stakey’s Cycles purchase. One use, no minimum spend, valid for 90 days.</p><code>{eggCode}</code></div>
      <button type="button" className="easter-celebration-done" onClick={()=>setCelebrating(false)}>Enjoy your treat</button>
     </div>
    </div>}
   </div>}
  </>,document.body)}
 </>;
}
export function ThemeMotionControl() {
 const [motion,setMotion]=useThemeMotion();
 return <fieldset className="theme-motion-control"><legend>Effects on this device</legend><div>{(['still','gentle','full'] as const).map(value=><button key={value} type="button" aria-pressed={motion===value} onClick={()=>setMotion(value)}>{value==='still'?'Still image':value==='gentle'?'Gentle motion':'Full effects'}</button>)}</div><p>Your phone’s reduced-motion setting always takes priority.</p></fieldset>;
}
