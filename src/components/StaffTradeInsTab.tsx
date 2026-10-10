import React from 'react';
import { RefreshCw, Phone, Mail, Trash2, Inbox, CheckCircle2 } from 'lucide-react';
import { useTradeInRequests, updateTradeInStatus, deleteTradeInRequest, TradeInRequest } from '../context/TradeInStore';

const STATUS_META: Record<TradeInRequest['status'], { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  contacted: { label: 'Contacted', className: 'bg-sky-500/15 border-sky-500/40 text-sky-300' },
  valued: { label: 'Valued', className: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  closed: { label: 'Closed', className: 'bg-neutral-700/40 border-neutral-600 text-neutral-300' },
};

const NEXT_STATUS: TradeInRequest['status'][] = ['new', 'contacted', 'valued', 'closed'];

/**
 * Staff inbox for trade-in / part-exchange leads submitted by customers. Lets
 * the workshop work each lead through to a valuation and contact the rider.
 */
export const StaffTradeInsTab: React.FC = () => {
  const requests = useTradeInRequests();

  return (
    <div className="space-y-6" data-testid="staff-tradeins">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-400" /> Trade-In Leads
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Bikes customers want valued against a new purchase or workshop credit.
          </p>
        </div>
        <span className="text-xs font-mono text-neutral-400">{requests.length} lead{requests.length === 1 ? '' : 's'}</span>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
          <Inbox className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">No trade-in leads yet</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Requests submitted from the customer app will appear here for the workshop to value.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <li key={r.id} className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt="Trade-in bike" className="w-16 h-16 rounded-xl object-cover border border-neutral-800 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-6 h-6 text-neutral-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-display font-bold text-white">
                        {r.brand} {r.model} {r.year ? <span className="text-neutral-500 font-mono text-xs">({r.year})</span> : null}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {r.customerName} · condition: <span className="text-neutral-200 capitalize">{r.condition}</span>
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                {(r.notes || r.interestedIn) && (
                  <div className="text-xs text-neutral-300 space-y-1 bg-neutral-950/60 border border-neutral-800 rounded-xl p-3">
                    {r.notes && <div><span className="text-neutral-500 font-semibold">Notes:</span> {r.notes}</div>}
                    {r.interestedIn && <div><span className="text-neutral-500 font-semibold">Interested in:</span> {r.interestedIn}</div>}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {r.customerEmail && (
                    <a
                      href={`mailto:${r.customerEmail}?subject=${encodeURIComponent(`Your trade-in valuation — ${r.brand} ${r.model}`)}`}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                  {r.customerPhone && (
                    <a
                      href={`tel:${r.customerPhone}`}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    {NEXT_STATUS.filter((s) => s !== r.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateTradeInStatus(r.id, s)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-emerald-500/40 text-[11px] font-semibold capitalize cursor-pointer"
                      >
                        {s === 'closed' ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
                        Mark {s}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => deleteTradeInRequest(r.id)}
                      aria-label="Delete lead"
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StaffTradeInsTab;
