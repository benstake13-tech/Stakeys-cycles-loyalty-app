import React from 'react';
import './glassDock.css';

/** Eight fixed cells from the shared, transparent production artwork. Labels live on the buttons. */
export function GlassDockIcon({index}:{index:number}) {
  const cell=Math.max(0,Math.min(7,Math.round(index)));
  return <span aria-hidden="true" className="stakeys-glass-dock-icon" style={{backgroundPosition:`${cell*100/7}% 50%`}}/>;
}
