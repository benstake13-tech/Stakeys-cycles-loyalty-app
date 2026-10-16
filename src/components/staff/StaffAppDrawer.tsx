import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Folder, LayoutGrid, Search, X, type LucideIcon } from 'lucide-react';
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
  if (['bookings', 'repair_guide', 'weather', 'ev_codes', 'hangers', 'ble_bench'].includes(app.id)) return 'Workshop';
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
  const [collapsed, setCollapsed] = useState<Record<AppFolder, boolean>>({
    Workspace: false,
    Workshop: false,
    'Sales & Growth': false,
    'Admin & System': false,
    Previews: true,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const visible = apps.filter(app => `${app.label} ${app.hint} ${app.keywords || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
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
        {folders.map(({ folder, apps: folderApps }) => {
          const expanded = !!query.trim() || !collapsed[folder];
          const contentId = `${titleId}-content-${folder}`;
          return <section key={folder} className="staff-app-folder" aria-labelledby={`${titleId}-${folder}`}>
          <button type="button" className="staff-app-folder-toggle" aria-expanded={expanded} aria-controls={contentId}
            onClick={() => setCollapsed(current => ({ ...current, [folder]: !current[folder] }))}>
            <span className="staff-app-folder-label"><Folder size={17} aria-hidden="true"/><span id={`${titleId}-${folder}`}>{folder}</span>
              <span className="staff-app-folder-count">{folderApps.length}</span></span>
            <ChevronDown size={17} className={expanded ? 'staff-app-folder-chevron is-open' : 'staff-app-folder-chevron'} aria-hidden="true" />
          </button>
          {expanded && <nav id={contentId} className="staff-app-library" aria-label={`${folder} apps`}>
            {folderApps.map(app => <button key={app.id} type="button" onClick={() => onSelect(app.id)} aria-label={app.label}
              aria-current={activeApp === app.id ? 'page' : undefined} title={app.hint}>
              <span className="staff-app-icon"><app.icon size={27} strokeWidth={1.65} aria-hidden="true" /></span>
              <span>{app.label}</span>
            </button>)}
          </nav>}
        </section>})}
      </div>
      {!visible.length && <div className="staff-app-empty"><LayoutGrid size={30} aria-hidden="true" /><p>No apps match “{query}”</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}
    </div>
  </div>, document.body);
};
