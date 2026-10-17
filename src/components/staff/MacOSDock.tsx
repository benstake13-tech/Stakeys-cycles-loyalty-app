import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { StaffDockIcon } from './StaffDockIcons';
import './MacOSDock.css';

export type DockTabId = 'home' | 'sync' | 'till' | 'workshop' | 'stock' | 'sales' | 'more';

const items: Array<{ id: DockTabId; label: string; shortLabel: string }> = [
  { id: 'home', label: 'Home', shortLabel: 'Home' }, { id: 'sync', label: 'Sync Workspace', shortLabel: 'Sync' },
  { id: 'till', label: 'Till', shortLabel: 'Till' }, { id: 'workshop', label: 'Workshop Tools', shortLabel: 'Workshop' },
  { id: 'stock', label: 'Stock & Inventory', shortLabel: 'Stock' }, { id: 'sales', label: 'Sales & Offers', shortLabel: 'Offers' },
  { id: 'more', label: 'More Apps', shortLabel: 'Apps' },
];

interface MacOSDockProps {
  activeTab: DockTabId;
  onSelectTab: (id: DockTabId) => void;
  onOpenApps: () => void;
}

export const MacOSDock: React.FC<MacOSDockProps> = ({ activeTab, onSelectTab, onOpenApps }) => {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const iconRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const centres = useRef<number[]>([]);
  const currentScales = useRef<number[]>(items.map(() => 1));
  const targetScales = useRef<number[]>(items.map(() => 1));
  const frame = useRef<number | null>(null);
  const lastFrame = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onSelectRef = useRef(onSelectTab);
  onSelectRef.current = onSelectTab;
  const openAppsRef = useRef(onOpenApps);
  openAppsRef.current = onOpenApps;
  const drawerId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  useEffect(() => {
    if (!reducedMotion) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    targetScales.current.fill(1);
    currentScales.current.fill(1);
    iconRefs.current.forEach(icon => { if (icon) icon.style.transform = ''; });
  }, [reducedMotion]);
  useEffect(() => {
    const invalidate = () => { centres.current = []; };
    window.addEventListener('resize', invalidate);
    return () => window.removeEventListener('resize', invalidate);
  }, []);

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

  const animateMagnification = (time: number) => {
    const delta = lastFrame.current ? Math.min(40, time - lastFrame.current) : 16;
    lastFrame.current = time;
    const amount = 1 - Math.exp(-delta / 30);
    let moving = false;
    iconRefs.current.forEach((icon, index) => {
      if (!icon) return;
      const target = targetScales.current[index];
      const current = currentScales.current[index];
      const next = Math.abs(target - current) < .003 ? target : current + (target - current) * amount;
      currentScales.current[index] = next;
      icon.style.transform = `translate3d(0, ${(-24 * (next - 1)).toFixed(2)}px, 0) scale(${next.toFixed(3)})`;
      if (next !== target) moving = true;
    });
    frame.current = moving ? requestAnimationFrame(animateMagnification) : null;
  };
  const scheduleMagnification = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(animateMagnification);
  };
  const clearMagnification = () => {
    targetScales.current.fill(1);
    if (!reducedMotion) scheduleMagnification();
  };
  const measureCentres = () => {
    centres.current = refs.current.map(button => {
      const rect = button?.getBoundingClientRect();
      return rect ? rect.left + rect.width / 2 : 0;
    });
  };
  const magnifyAt = (clientX: number) => {
    if (reducedMotion) return;
    if (!centres.current.length) measureCentres();
    targetScales.current = centres.current.map(centre => 1 + .55 * Math.exp(-((clientX - centre) ** 2) / (2 * 68 ** 2)));
    scheduleMagnification();
  };

  const highlighted = hoverIndex ?? focusIndex;
  // Render above the workspace so page visibility, transforms and scrolling
  // cannot hide or reposition the fixed navigation. Staff modals remain above it.
  return createPortal(
    <nav ref={navRef} className="stakeys-macos-dock" aria-label="Staff dock" onMouseEnter={measureCentres} onMouseLeave={() => { setHoverIndex(null); clearMagnification(); }}
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
            onFocus={() => setFocusIndex(index)} onBlur={() => setFocusIndex(null)} onClick={() => select(index)}
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
            <span ref={el => { iconRefs.current[index] = el; }} className={`stakeys-dock-icon stakeys-dock-icon--${item.id}`}><StaffDockIcon id={item.id} /></span>
            <span className="stakeys-dock-label" aria-hidden="true">{item.shortLabel}</span>
            <span className="stakeys-dock-active" aria-hidden="true" />
          </button>
        </div>;
      })}</div>
    </nav>, document.body,
  );
};
export default MacOSDock;
