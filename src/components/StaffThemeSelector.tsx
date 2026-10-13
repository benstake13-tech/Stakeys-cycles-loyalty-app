import { useEffect, useMemo, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { HOLIDAY_THEME_IDS, SEASONAL_THEME_LABELS, activeHoliday, upcomingHolidays, windowLabel, type ThemeOverride } from '../utils/holidayCalendar';
import { ThemeWorld, ThemeMotionControl } from './theme/ThemeWorld';
import { ThemeArtwork } from './theme/ThemeArtwork';
import { worldFor, type WorldFamily } from './theme/worldCatalog';

export const StaffThemeSelector = () => {
 const {seasonalTheme,seasonalOverride,setSeasonalTheme}=useShop();
 const [selected,setSelected]=useState<ThemeOverride>(seasonalOverride);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[family,setFamily]=useState('all');
 useEffect(()=>setSelected(seasonalOverride),[seasonalOverride]);
 const now=useMemo(()=>new Date(),[]),active=activeHoliday(now),upcoming=upcomingHolidays(now,2);
 const preview=selected==='AUTO'||selected===null ? active?.theme||'none' : selected;
 const world=worldFor(preview),dirty=selected!==seasonalOverride;
 const themes=HOLIDAY_THEME_IDS.filter(id=>SEASONAL_THEME_LABELS[id].toLowerCase().includes(search.toLowerCase())&&(family==='all'||worldFor(id)?.family===family));
 const apply=async()=>{setBusy(true);setError('');try{const result=await setSeasonalTheme(selected);if(!result.success)throw new Error(result.message||'Theme could not be saved. Please retry.');}catch(e){setError(e instanceof Error?e.message:'Theme could not be saved. Please retry.');}finally{setBusy(false);}};
 return <section className="theme-studio" aria-label="Seasonal theme studio">
  <header className="theme-studio-header"><div><div className="theme-studio-kicker">Stakey’s • Atmosphere studio</div><h3>A world for every season.</h3><p>Live: {SEASONAL_THEME_LABELS[seasonalTheme]} · Preview a scene before applying it to all accounts.</p></div></header>
  <div className="theme-studio-preview">
   {world?<ThemeWorld theme={preview} preview/>:<div className="theme-studio-empty"><strong>Pure Stakey’s</strong><p>No seasonal scenery</p></div>}
   {world&&<div className="theme-studio-caption"><strong>{world.label}</strong><p>{world.description}</p></div>}
  </div>
  <ThemeMotionControl/>
  <button type="button" className="theme-auto" aria-pressed={selected==='AUTO'||selected===null} onClick={()=>setSelected('AUTO')}>Automatic holiday calendar · {active?active.name:'Between celebrations'}</button>
  <p className="mt-3 text-xs text-emerald-100/60">{upcoming.map(o=>`${o.name}: ${windowLabel(o)}`).join(' · ')}</p>
  <div className="theme-studio-controls"><input aria-label="Search themes" placeholder="Find a holiday or season…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Scene collection" value={family} onChange={e=>setFamily(e.target.value)}><option value="all">All collections</option>{(['winter','haunted','garden','coast','harvest','lantern','festival','cosmic','romance','remembrance'] as WorldFamily[]).map(f=><option key={f} value={f}>{f[0].toUpperCase()+f.slice(1)}</option>)}</select></div>
  <div className="theme-studio-grid"><button className="theme-studio-card" type="button" aria-pressed={selected==='none'} onClick={()=>setSelected('none')}><div className="theme-studio-card-art theme-studio-empty" style={{height:96}}>SC</div><span>No seasonal theme</span></button>{themes.map(id=><button key={id} type="button" className="theme-studio-card" aria-pressed={selected===id} onClick={()=>setSelected(id)}><div className="theme-studio-card-art"><ThemeArtwork world={worldFor(id)!}/></div><span>{SEASONAL_THEME_LABELS[id]}</span></button>)}</div>
  {!themes.length&&<p className="mt-3 text-sm">No themes match this search.</p>}
  <footer className="theme-studio-footer"><span className="text-xs text-emerald-100/60">{dirty?'Preview only — save to publish this theme.':'Current theme saved.'}</span><button type="button" onClick={apply} disabled={busy||!dirty}>{busy?'Saving theme…':dirty?'Apply theme to all accounts':'Theme applied'}</button></footer>
  {error&&<p role="alert" className="theme-studio-error">{error}</p>}
 </section>;
};
