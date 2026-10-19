import React from 'react';
import { GlassDockIcon } from '../navigation/GlassDockIcon';
import type { DockTabId } from './MacOSDock';

/** A single 24px grid and stroke system for the seven staff destinations. */
export function StaffDockIcon({ id }: { id: DockTabId }) {
  const details: Record<DockTabId, React.ReactNode> = {
    home: <><rect x="2.75" y="3.25" width="18.5" height="17.5" rx="3"/><path d="M3 8.5h18"/><path className="dock-icon-accent" d="M7 16.75v-3.5m3.5 3.5v-5m3.5 5v-2.5"/><path d="M17.5 12.25v4.5"/></>,
    sync: <><ellipse cx="9" cy="5.5" rx="5.75" ry="2.25"/><path d="M3.25 5.5v9c0 1.25 2.57 2.25 5.75 2.25 1.1 0 2.12-.12 3-.35M3.25 10c0 1.25 2.57 2.25 5.75 2.25"/><path className="dock-icon-accent" d="M15.5 11.5a5 5 0 0 1 5 5m0 0v-3m0 3h-3M19 20a5 5 0 0 1-6.5-2.5m0 0v3m0-3h3"/></>,
    till: <><path d="M5 10.5h14l1.5 8.25a1.7 1.7 0 0 1-1.67 2H5.17a1.7 1.7 0 0 1-1.67-2L5 10.5Z"/><path d="M7 10.5V4.75A1.75 1.75 0 0 1 8.75 3h6.5A1.75 1.75 0 0 1 17 4.75v5.75M8 7.25h6"/><path className="dock-icon-accent" d="M9 15h6m-3 0v3"/><path d="M5 18.75h14"/></>,
    workshop: <><circle cx="7.25" cy="17" r="4"/><path d="M7.25 13v4l2.9 2.6M11.5 17h3"/><path className="dock-icon-accent" d="M20.5 3.5a4 4 0 0 0-4.7 5.15l-5.9 5.9 2.55 2.55 5.9-5.9a4 4 0 0 0 5.15-4.7l-2.4 2.4-2.5-.5-.5-2.5 2.4-2.4Z"/></>,
    stock: <><path d="m3 7 5.5-3 5.5 3v6l-5.5 3L3 13V7Z"/><path d="m3 7 5.5 3 5.5-3M8.5 10v6"/><path className="dock-icon-accent" d="m14 11 4-2 4 2v7l-4 2-4-2v-7Z"/><path d="m14 11 4 2 4-2m-4 4.5 4 2 4-2M18 13v7"/></>,
    sales: <><path d="M3.5 4h8.2l9.05 9.05a2 2 0 0 1 0 2.83l-4.87 4.87a2 2 0 0 1-2.83 0L4 11.7V4.5a.5.5 0 0 1 .5-.5Z"/><circle cx="8" cy="8" r="1.15"/><path className="dock-icon-accent" d="m12 17 5-5m-5 0h.01m5 5h.01" strokeWidth="2.4"/></>,
    more: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.7"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.7"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.7"/><rect className="dock-icon-accent" x="13.5" y="13.5" width="7.5" height="7.5" rx="1.7"/></>,
  };
  const artwork: Partial<Record<DockTabId,number>>={home:0,stock:1,sales:2,workshop:6};
  if(artwork[id]!==undefined)return <GlassDockIcon index={artwork[id]!}/>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{details[id]}</svg>;
}
