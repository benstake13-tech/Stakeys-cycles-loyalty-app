import React, { useMemo, useState } from 'react';
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';

/**
 * Launch prep tool: lets staff wipe the whole service-bookings list in one go.
 * Deletes every row from the live `service_bookings` table as well as the local
 * state, behind a typed confirmation so it can't be triggered by a stray click.
 */
export const ClearBookingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { bookings, clearAllBookings } = useShop();

  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const count = bookings.length;
  const statusBreakdown = useMemo(() => {
    const tally = new Map<string, number>();
    for (const b of bookings) {
      const key = b.approvalStatus === 'pending_approval' ? 'awaiting approval' : b.status;
      tally.set(key, (tally.get(key) || 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [bookings]);

  const canClear = confirmText.trim().toUpperCase() === 'CLEAR' && count > 0 && !working;

  const handleClear = async () => {
    if (!canClear) return;
    setWorking(true);
    try {
      const res = await clearAllBookings();
      setResult({
        ok: res.success,
        text:
          res.message ||
          `Cleared ${res.deleted} booking${res.deleted === 1 ? '' : 's'}.`,
      });
      if (res.success) setConfirmText('');
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Failed to clear bookings.' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-lg bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Clear All Bookings</h3>
              <p className="text-xs text-neutral-400">
                Wipe the workshop booking list ready for launch.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 rounded-2xl border bg-[#141820] border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            <span>
              {count} booking{count === 1 ? '' : 's'} currently stored
            </span>
          </div>
          {count > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {statusBreakdown.map(([label, n]) => (
                <span
                  key={label}
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700"
                >
                  {n} {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border bg-rose-950/25 border-rose-600/40 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-100/90 leading-relaxed space-y-1">
            <p className="font-bold text-rose-200">This permanently deletes every booking.</p>
            <p>
              All rows are removed from the live <span className="font-mono">service_bookings</span> table and
              from this device. Customers, bikes, stamps and loyalty data are untouched. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="clear-bookings-confirm" className="text-xs font-semibold text-neutral-300">
            Type <span className="font-mono text-rose-300">CLEAR</span> to confirm
          </label>
          <input
            id="clear-bookings-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="CLEAR"
            autoComplete="off"
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 focus:border-rose-500 outline-none text-sm font-mono tracking-widest"
          />
        </div>

        {result && (
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              result.ok
                ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-600/40 text-amber-200'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{result.text}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold cursor-pointer"
          >
            {result?.ok ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!canClear}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{working ? 'Clearing…' : `Clear ${count} Booking${count === 1 ? '' : 's'}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
