import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, LayoutGrid, Search, X, type LucideIcon } from 'lucide-react';
import './StaffNavigation.css';

export interface StaffApp {
  id: string;
  label: string;
  hint: string;
  keywords?: string;
  icon: LucideIcon;
}

type AppFolder = 'Workspace' | 'Workshop' | 'Sales & Growth' | 'Admin & System' | 'Previews';
const FOLDER_ORDER: AppFolder[] = ['Workspace', 'Workshop', 'Sales & Growth', 'Admin & System', 'Previews'];
const folderFor = (app: StaffApp): AppFolder => {
  if (app.id.startsWith('surface:')) return 'Previews';
  if (['bookings', 'till', 'repair_guide', 'weather', 'ev_codes', 'ble_bench'].includes(app.id)) return 'Workshop';
  if (['promotions', 'discount_codes', 'referrals', 'tradeins', 'marketplace', 'offer_prices', 'reviews'].includes(app.id)) return 'Sales & Growth';
  if (['settings', 'backend', 'logs', 'staff_roster', 'google_business', 'website_cms', 'targets', 'accounts'].includes(app.id)) return 'Admin & System';
  return 'Workspace';
};

/** One searchable app library for desktop Launchpad and the phone app drawer. */
export const StaffAppDrawer: React.FC<{
  apps: StaffApp[];
  activeApp: string;
  mode: 'desktop' | 'phone';
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ apps, activeApp, mode, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  // Keep the working tools in view on opening; preview surfaces stay tucked away.
  const [openFolders, setOpenFolders] = useState<Set<AppFolder>>(() => new Set(FOLDER_ORDER.filter(folder => folder !== 'Previews')));
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const searchQuery = query.trim().toLowerCase();
  const visible = apps.filter(app => app.id !== 'hangers' && `${app.label} ${app.hint} ${app.keywords || ''}`.toLowerCase().includes(searchQuery));
  const folders = FOLDER_ORDER.map(folder => ({ folder, apps: visible.filter(app => folderFor(app) === folder) })).filter(group => group.apps.length);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keep the keyboard closed when opening on a phone; search is one tap away.
    if (mode === 'desktop') searchRef.current?.focus();
    else dialogRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') || []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', key);
    return () => {
      dialog?.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      // A resize can replace the triggering dock with the phone launcher.
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLButtonElement>('[data-staff-app-trigger]')?.focus();
    };
  }, []);

  return createPortal(<div className={`staff-app-drawer-backdrop staff-app-drawer-backdrop--${mode}`} onPointerDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className={`staff-app-drawer staff-app-drawer--${mode}`} data-testid="staff-app-drawer">
      <header className="staff-app-drawer-header">
        <div><span>STAKEY’S CYCLES</span><h2 id={titleId}>All apps</h2></div>
        <button type="button" onClick={onClose} aria-label="Close app drawer"><X size={22} /></button>
      </header>
      <label className="staff-app-search"><Search size={18} aria-hidden="true" />
        <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an app…" aria-label="Search staff apps" autoComplete="off" />
        {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear app search"><X size={16} /></button>}
      </label>
      <p className="staff-app-count" role="status">{visible.length} app{visible.length === 1 ? '' : 's'}{query ? ' found' : ' available'}{!query && folders.length ? ` · ${folders.length} folders` : ''}</p>
      <div className="staff-app-folders">
        {folders.map(({ folder, apps: folderApps }) => <section key={folder} className="staff-app-folder" aria-labelledby={`${titleId}-${folder}`}>
          <h3 id={`${titleId}-${folder}`} aria-label={folder}>
            <button type="button" className="staff-app-folder-toggle" aria-expanded={Boolean(searchQuery) || openFolders.has(folder)} aria-controls={`${titleId}-${folder}-apps`}
              onClick={() => setOpenFolders(current => {
                const next = new Set(current);
                if (next.has(folder)) next.delete(folder); else next.add(folder);
                return next;
              })}>
              <span className="staff-app-folder-label">{folder}<small className="staff-app-folder-count">{folderApps.length}</small></span>
              <ChevronDown size={17} className={`staff-app-folder-chevron ${searchQuery || openFolders.has(folder) ? 'is-open' : ''}`} aria-hidden="true" />
            </button>
          </h3>
          {(searchQuery || openFolders.has(folder)) && <nav id={`${titleId}-${folder}-apps`} className="staff-app-library" aria-label={`${folder} apps`}>
            {folderApps.map(app => <button key={app.id} type="button" onClick={() => onSelect(app.id)} aria-label={app.label}
              aria-current={activeApp === app.id ? 'page' : undefined} title={app.hint}>
              <span className="staff-app-icon"><app.icon size={27} strokeWidth={1.65} aria-hidden="true" /></span>
              <span className="staff-app-description"><strong>{app.label}</strong><small>{app.hint}</small></span>
            </button>)}
          </nav>}
        </section>)}
      </div>
      {!visible.length && <div className="staff-app-empty"><LayoutGrid size={30} aria-hidden="true" /><p>No apps match “{query}”</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}
    </div>
  </div>, document.body);
};
