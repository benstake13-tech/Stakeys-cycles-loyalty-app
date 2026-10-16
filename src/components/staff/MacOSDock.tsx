import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import './MacOSDock.css';

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

interface MacOSDockProps {
  activeTab: DockTabId;
  onSelectTab: (id: DockTabId) => void;
  onOpenApps: () => void;
}

export const MacOSDock: React.FC<MacOSDockProps> = ({ activeTab, onSelectTab, onOpenApps }) => {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const navRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onSelectRef = useRef(onSelectTab);
  onSelectRef.current = onSelectTab;
  const openAppsRef = useRef(onOpenApps);
  openAppsRef.current = onOpenApps;
  const drawerId = useId();
  const reducedMotion = useReducedMotion();

  const activate = (index: number) => {
    refs.current[index]?.focus();
    setFocusIndex(index);
  };
  const select = (index: number) => {
    if (items[index].id === 'more') {
      openAppsRef.current();
    } else {
      onSelectRef.current(items[index].id);
    }
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      // Modal dialogs own the keyboard while open, even if they haven't moved focus yet.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.repeat) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!navRef.current?.contains(document.activeElement)) previousFocus.current = document.activeElement as HTMLElement;
        const index = items.findIndex(item => item.id === activeTab);
        activate(Math.max(0, index));
      } else if (/^[1-7]$/.test(event.key)) {
        event.preventDefault();
        if (!navRef.current?.contains(document.activeElement)) previousFocus.current = document.activeElement as HTMLElement;
        const index = Number(event.key) - 1;
        select(index);
        activate(index);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [activeTab]);

  const clearMagnification = () => {
    refs.current.forEach(button => {
      const icon = button?.querySelector<HTMLElement>('.stakeys-dock-icon');
      icon?.style.removeProperty('--dock-scale');
      icon?.style.removeProperty('--dock-lift');
    });
  };
  const magnifyAt = (clientX: number) => {
    if (reducedMotion) return;
    // Read all button centres before writing styles; the icon transforms don't
    // move these hit targets. Gaussian falloff gives continuous macOS-like motion.
    const centres = refs.current.map(button => {
      const rect = button?.getBoundingClientRect();
      return rect ? rect.left + rect.width / 2 : null;
    });
    refs.current.forEach((button, index) => {
      const centre = centres[index];
      const icon = button?.querySelector<HTMLElement>('.stakeys-dock-icon');
      if (!icon || centre === null) return;
      const scale = 1 + 0.55 * Math.exp(-((clientX - centre) ** 2) / (2 * 68 ** 2));
      icon.style.setProperty('--dock-scale', scale.toFixed(3));
      icon.style.setProperty('--dock-lift', `${-((scale - 1) * 24).toFixed(2)}px`);
    });
  };

  const highlighted = hoverIndex ?? focusIndex;
  // Render above the workspace so page visibility, transforms and scrolling
  // cannot hide or reposition the fixed navigation. Staff modals remain above it.
  return createPortal(
    <nav ref={navRef} className="stakeys-macos-dock" aria-label="Staff dock" onMouseLeave={() => { setHoverIndex(null); clearMagnification(); }}
      onMouseMove={event => magnifyAt(event.clientX)}
      onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        setFocusIndex(null);
        setHoverIndex(null);
        clearMagnification();
        (document.activeElement as HTMLElement)?.blur();
        previousFocus.current?.focus();
      }}>
      <div className="stakeys-dock-items">{items.map((item, index) => {
        const distance = highlighted === null ? 99 : Math.abs(highlighted - index);
        const selected = activeTab === item.id;
        return <div key={item.id} className="stakeys-dock-slot" data-highlight-distance={Math.min(distance, 2)}>
          <div id={`${drawerId}-tip-${index}`} role="tooltip" className="stakeys-dock-tooltip">{item.label}<span>⌘ / Ctrl {index + 1}</span></div>
          <button ref={el => { refs.current[index] = el; }} type="button" aria-label={item.label}
            aria-describedby={highlighted === index ? `${drawerId}-tip-${index}` : undefined}
            aria-current={selected ? 'page' : undefined} aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
            aria-haspopup={item.id === 'more' ? 'dialog' : undefined} data-staff-app-trigger={item.id === 'more' ? true : undefined}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setHoverIndex(index); }}
            onFocus={() => { clearMagnification(); setFocusIndex(index); }} onBlur={() => setFocusIndex(null)} onClick={() => select(index)}
            onKeyDown={event => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                activate((index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length);
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault(); activate(event.key === 'Home' ? 0 : items.length - 1);
              } else if (item.id === 'more' && event.key === 'ArrowDown') {
                event.preventDefault();
                openAppsRef.current();
              }
            }}>
            <span className={`stakeys-dock-icon stakeys-dock-icon--${item.id}`}><DockIcon id={item.id} active={!reducedMotion && distance === 0} /></span>
            <span className="stakeys-dock-active" aria-hidden="true" />
          </button>
        </div>;
      })}</div>
    </nav>, document.body,
  );
};
export default MacOSDock;
