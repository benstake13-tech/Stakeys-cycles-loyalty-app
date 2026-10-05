import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Globe, ShoppingBag, Smartphone, Wrench } from 'lucide-react';
import { STAKEY_APPS, type AppId } from '../data/appLinks';

/**
 * Shared cross-app switcher. Both the customer app and the staff terminal
 * render this so staff can jump between the three Stakey's Cycles apps:
 * the public website, the customer app and this workshop terminal.
 *
 * It lives in `src/shared/` on purpose. This is the one small piece of UI the
 * two builds genuinely share, and the `sync-shared` workflow copies
 * `src/shared/` from the customer branch to the staff branch, so the button
 * can never drift between them.
 */
const ICONS: Record<AppId, typeof Globe> = {
  website: Globe,
  customer: Smartphone,
  staff: Wrench,
};

export interface AppSwitcherButtonProps {
  /** The app currently rendering the button. It is excluded from the menu. */
  current: AppId;
  /** Optional override for the button label. */
  label?: string;
  /** Compact style for tight header rows. */
  compact?: boolean;
  /**
   * Whether to offer the staff terminal. The customer app keeps the staff
   * entry concealed from customers, so it passes `isStaff` here. Defaults to
   * true, which is what the staff terminal itself wants.
   */
  showStaff?: boolean;
}

export default function AppSwitcherButton({
  current,
  label,
  compact,
  showStaff = true,
}: AppSwitcherButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const others = (Object.keys(STAKEY_APPS) as AppId[]).filter(
    (id) => id !== current && (showStaff || id !== 'staff'),
  );
  const currentApp = STAKEY_APPS[current];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Open another Stakey's Cycles app (you are in the ${currentApp.label})`}
        className={`inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
        }`}
      >
        <ShoppingBag className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span>{label ?? 'Open another app'}</span>
        <ChevronDown
          className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-neutral-800 bg-[#0e1217] p-1.5 shadow-2xl"
        >
          {others.map((id) => {
            const app = STAKEY_APPS[id];
            const Icon = ICONS[id];
            return (
              <a
                key={id}
                role="menuitem"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-neutral-800/70 transition-colors"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    {app.label}
                    <ExternalLink className="h-3 w-3 text-neutral-500" />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-400">
                    {app.description}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
