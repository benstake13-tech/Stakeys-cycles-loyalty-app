import React, { useEffect, useRef, useState } from 'react';
import { Bike, Home, MapPin, Settings2, ShoppingBag, Tag, Wrench, X } from 'lucide-react';
import type { WebsitePageId } from '../types/websiteContent';
import './WebsiteDock.css';

type DockDestination = Extract<WebsitePageId, 'home' | 'shop' | 'repairs' | 'sell' | 'offers' | 'visit'>;
type DockSettings = { magnification: number; spacing: number; labels: boolean };

const DEFAULT_SETTINGS: DockSettings = { magnification: 100, spacing: 26, labels: true };
const SETTINGS_KEY = 'stakeys.website-dock.settings.v1';
const destinations: Array<{ id: DockDestination; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'repairs', label: 'Repairs', icon: Wrench },
  { id: 'sell', label: 'Sell', icon: Bike },
  { id: 'offers', label: 'Offers', icon: Tag },
  { id: 'visit', label: 'Visit', icon: MapPin },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function WebsiteDock({ activePage, onNavigate }: {
  activePage: WebsitePageId;
  onNavigate: (page: WebsitePageId) => void;
}) {
  const [settings, setSettings] = useState<DockSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pointerX = useRef<number | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scales = useRef<number[]>(Array(7).fill(1));
  const targets = useRef<number[]>(Array(7).fill(1));
  const frame = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DockSettings>;
        setSettings({
          magnification: clamp(parsed.magnification ?? 100, 0, 100),
          spacing: clamp(parsed.spacing ?? 26, 8, 26),
          labels: typeof parsed.labels === 'boolean' ? parsed.labels : true,
        });
      }
    } catch { /* defaults remain available when storage is blocked */ }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = query.matches;
    const updateMotion = () => { reducedMotion.current = query.matches; if (query.matches) resetScale(); };
    query.addEventListener?.('change', updateMotion);
    return () => {
      query.removeEventListener?.('change', updateMotion);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private browsing */ }
  }, [settings]);

  useEffect(() => {
    if (pointerX.current !== null) magnify(pointerX.current);
  }, [settings.magnification]);

  function resetScale() {
    targets.current.fill(1);
    scales.current.fill(1);
    itemRefs.current.forEach(button => {
      const icon = button?.querySelector<HTMLElement>('.website-dock-glyph');
      if (icon) icon.style.transform = '';
    });
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }
  function animate() {
    let moving = false;
    itemRefs.current.forEach((button, index) => {
      const icon = button?.querySelector<HTMLElement>('.website-dock-glyph');
      if (!icon) return;
      const current = scales.current[index] ?? 1;
      const target = targets.current[index] ?? 1;
      const next = Math.abs(target - current) < 0.003 ? target : current + (target - current) * 0.24;
      scales.current[index] = next;
      icon.style.transform = `translate3d(0, ${(-18 * (next - 1)).toFixed(2)}px, 0) scale(${next.toFixed(3)})`;
      if (next !== target) moving = true;
    });
    frame.current = moving ? requestAnimationFrame(animate) : null;
  }
  function magnify(clientX: number) {
    if (reducedMotion.current || settings.magnification === 0) return resetScale();
    targets.current = itemRefs.current.map(button => {
      if (!button) return 1;
      const rect = button.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      const influence = Math.exp(-((clientX - centre) ** 2) / (2 * 76 ** 2));
      return 1 + (settings.magnification / 100) * influence;
    });
    if (frame.current === null) frame.current = requestAnimationFrame(animate);
  }
  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return;
    pointerX.current = event.clientX;
    magnify(event.clientX);
  }
  function handlePointerLeave() {
    pointerX.current = null;
    targets.current.fill(1);
    if (!reducedMotion.current && frame.current === null) frame.current = requestAnimationFrame(animate);
    else if (reducedMotion.current) resetScale();
  }
  const cssVars = {
    '--website-dock-gap': `${settings.spacing}px`,
    '--website-dock-label-opacity': settings.labels ? 1 : 0,
  } as React.CSSProperties;

  return (
    <div className="website-dock-layer" style={cssVars}>
      {settingsOpen && (
        <section className="website-dock-settings" aria-label="Dock settings">
          <div className="website-dock-settings-heading">
            <div><span className="website-dock-kicker">Personalise</span><h2>Dock settings</h2></div>
            <button type="button" className="website-dock-close" onClick={() => setSettingsOpen(false)} aria-label="Close dock settings"><X size={17} /></button>
          </div>
          <label className="website-dock-slider-label" htmlFor="website-dock-magnification"><span>Icon magnification</span><output>{settings.magnification}%</output></label>
          <input id="website-dock-magnification" type="range" min="0" max="100" step="5" value={settings.magnification}
            onChange={event => setSettings(s => ({ ...s, magnification: Number(event.target.value) }))} />
          <label className="website-dock-slider-label" htmlFor="website-dock-spacing"><span>Icon spacing</span><output>{settings.spacing}px</output></label>
          <input id="website-dock-spacing" type="range" min="8" max="26" step="1" value={settings.spacing}
            onChange={event => setSettings(s => ({ ...s, spacing: Number(event.target.value) }))} />
          <label className="website-dock-label-toggle"><input type="checkbox" checked={settings.labels}
            onChange={event => setSettings(s => ({ ...s, labels: event.target.checked }))} /><span>Show icon labels</span></label>
          <button type="button" className="website-dock-reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset to premium defaults</button>
          <p>Settings are saved on this device. Pointer effects respect your reduced-motion preference.</p>
        </section>
      )}
      <nav className="website-dock" aria-label="Quick website navigation" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        <span className="website-dock-sheen" aria-hidden="true" />
        {destinations.map((item, index) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return <button key={item.id} ref={element => { itemRefs.current[index] = element; }} type="button"
            className="website-dock-item" aria-current={active ? 'page' : undefined}
            aria-label={item.label} onClick={() => onNavigate(item.id)}>
            <span className="website-dock-glyph"><Icon size={23} strokeWidth={1.8} /></span>
            <span className="website-dock-label">{item.label}</span>
            <span className="website-dock-active-dot" aria-hidden="true" />
          </button>;
        })}
        <button ref={element => { itemRefs.current[6] = element; }} type="button" className={`website-dock-item website-dock-settings-trigger ${settingsOpen ? 'is-open' : ''}`}
          aria-label="Dock settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>
          <span className="website-dock-glyph"><Settings2 size={22} strokeWidth={1.8} /></span>
          <span className="website-dock-label">Settings</span>
          <span className="website-dock-active-dot" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
