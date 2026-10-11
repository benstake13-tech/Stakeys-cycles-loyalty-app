import React, { useState } from 'react';
import { RefreshCw, Phone, Mail, Trash2, Inbox, CheckCircle2, Sparkles, Camera } from 'lucide-react';
import { useTradeInRequests, updateTradeInStatus, deleteTradeInRequest, setTradeInFinalOffer, TradeInRequest } from '../context/TradeInStore';

const STATUS_META: Record<TradeInRequest['status'], { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  contacted: { label: 'Contacted', className: 'bg-sky-500/15 border-sky-500/40 text-sky-300' },
  valued: { label: 'Valued', className: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  closed: { label: 'Closed', className: 'bg-neutral-700/40 border-neutral-600 text-neutral-300' },
};

const NEXT_STATUS: TradeInRequest['status'][] = ['new', 'contacted', 'valued', 'closed'];

/** Staff input for the confirmed offer that will be sent to the customer. */
const FinalOfferInput: React.FC<{ id: string; value?: number }> = ({ id, value }) => {
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const save = () => {
    const n = Number(draft);
    setTradeInFinalOffer(id, draft.trim() === '' || !Number.isFinite(n) ? undefined : Math.round(n));
  };
  return (
    <div className="flex items-center gap-2" data-testid={`final-offer-${id}`}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 shrink-0" htmlFor={`offer-${id}`}>
        Final offer £
      </label>
      <input
        id={`offer-${id}`}
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        placeholder="e.g. 180"
        className="w-28 surface-panel text-neutral-200 text-sm px-3 py-1.5 focus:border-emerald-500/50 outline-none"
      />
      <button
        type="button"
        onClick={save}
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
      >
        Save
      </button>
      {value != null && <span className="text-[11px] text-emerald-400 font-mono">saved £{value}</span>}
    </div>
  );
};

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
            <RefreshCw className="w-5 h-5 text-amber-400" /> Sell Your Bike — Leads
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Bikes customers want to sell. Review the photos and AI read, then confirm an offer.
          </p>
        </div>
        <span className="text-xs font-mono text-neutral-400">{requests.length} lead{requests.length === 1 ? '' : 's'}</span>
      </div>

      {requests.length === 0 ? (
        <div className="surface-panel p-10 text-center space-y-3">
          <Inbox className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">No sell-your-bike leads yet</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Requests submitted from the customer app will appear here for the workshop to value.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <li key={r.id} className="surface-panel p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt="Sell-your-bike photo" className="w-16 h-16 rounded-xl object-cover border border-neutral-800 shrink-0" />
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

                {/* Seven-angle photo set submitted by the customer. */}
                {r.photos && r.photos.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> {r.photos.length} photo{r.photos.length === 1 ? '' : 's'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.photos.map((p) => (
                        <a key={p.angle} href={p.dataUrl} target="_blank" rel="noreferrer" title={p.label}
                          className="block w-16 h-16 rounded-lg overflow-hidden border border-neutral-800 hover:border-emerald-500/50">
                          <img src={p.dataUrl} alt={p.label} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI identification + offer for staff to confirm. */}
                {r.offerEstimate != null && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> AI offer estimate
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-300">£{r.offerEstimate}</span>
                    </div>
                    {r.offerRationale?.length ? (
                      <ul className="text-[11px] text-neutral-400 space-y-0.5 list-disc pl-4">
                        {r.offerRationale.map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    ) : null}
                  </div>
                )}

                {/* Cosmetic damage the AI spotted in the photos. */}
                {(() => {
                  const ai = r.aiIdentification as { cosmeticIssues?: { type?: string; location?: string; severity?: string }[] } | undefined;
                  const issues = ai?.cosmeticIssues ?? [];
                  if (!issues.length) return null;
                  return (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 space-y-1.5" data-testid={`lead-damage-${r.id}`}>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300">Damage &amp; wear detected</div>
                      <ul className="text-[11px] text-neutral-300 space-y-0.5 list-disc pl-4">
                        {issues.map((c, i) => (
                          <li key={i}>
                            {c.type}
                            {c.location ? ` — ${c.location}` : ''}
                            {c.severity ? ` (${c.severity})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <FinalOfferInput id={r.id} value={r.finalOffer} />

                <div className="flex flex-wrap items-center gap-2">
                  {r.customerEmail && (
                    <a
                      href={`mailto:${r.customerEmail}?subject=${encodeURIComponent(`Your bike offer — ${r.brand} ${r.model}`)}`}
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
