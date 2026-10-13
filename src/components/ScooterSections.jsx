import React,{useState} from 'react';
import './scooterGlass.css';
/** Each section renders into ONE shared detail slot. */
export default function ScooterSections({sections=[]}) {
 const [activeSectionId,setActiveSectionId]=useState(null);
 const selected=sections.find(s=>s.id===activeSectionId);
 return <section className="scooter-console">
  <div className="scooter-tile-grid">{sections.map(s=><button key={s.id} type="button"
   className={`scooter-glass-tile ${activeSectionId===s.id?'is-active':''}`}
   aria-expanded={activeSectionId===s.id} aria-controls="scooter-active-detail"
   onClick={()=>setActiveSectionId(id=>id===s.id?null:s.id)}>
   <span className="scooter-tile-icon" aria-hidden="true">{s.icon||'◈'}</span>
   <strong>{s.title}</strong><small>{s.description}</small>
  </button>)}</div>
  <div id="scooter-active-detail" className="scooter-detail-slot" aria-live="polite">
   {selected&&<div key={selected.id} className="scooter-glass-detail">
    <div className="scooter-detail-heading"><h3>{selected.title}</h3><button type="button" onClick={()=>setActiveSectionId(null)} aria-label="Close section">×</button></div>
    {typeof selected.render==='function'?selected.render():selected.content}
   </div>}
  </div>
 </section>;
}
