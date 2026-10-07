import React, { useMemo, useState } from 'react';
import {
  Siren,
  MapPin,
  MessageCircle,
  BadgePoundSterling,
  CheckCircle2,
  Clock,
  Phone,
  Bell,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ServiceBooking } from '../types/bikeShop';
import {
  SOS_SURCHARGE,
  SosStatus,
  isSosBooking,
  sosStatusLabel,
  sosQuoteTotal,
  buildSosLocationRequestUrl,
  buildSosQuoteUrl,
} from '../utils/sosRepair';

const SOS_STATUS_STYLES: Record<SosStatus, string> = {
  requested: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  approved: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  location_requested: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  quoted: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  declined: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

/** Pull the "Fault:" line out of an SOS booking's notes. */
function faultFromNotes(notes?: string): string {
  if (!notes) return '';
  const line = notes.split('\n').find((l) => l.trim().toLowerCase().startsWith('fault:'));
  return line ? line.replace(/^fault:\s*/i, '').trim() : '';
}

function riderUseFromNotes(notes?: string): string {
  if (!notes) return '';
  const line = notes.split('\n').find((l) => l.trim().toLowerCase().startsWith('rider use:'));
  return line ? line.replace(/^rider use:\s*/i, '').trim() : '';
}

function riderLocationFromNotes(notes?: string): string {
  if (!notes) return '';
  const line = notes.split('\n').find((l) => l.trim().toLowerCase().startsWith('rider location:'));
  return line ? line.replace(/^rider location:\s*/i, '').trim() : '';
}

/**
 * SOS Emergency Repair — staff workflow.
 *
 * A priority call-out for couriers / delivery riders. This panel walks staff
 * through the four steps: approve → request the rider's WhatsApp live location →
 * send a quote → mark the price confirmed and set off. Every milestone also
 * fires an owner-only OneSignal push (handled in the ShopContext actions).
 */
export const StaffSosPanel: React.FC = () => {
  const {
    bookings,
    approveBooking,
    updateBookingQuote,
    requestSosLocation,
    confirmSosQuote,
    reminderOwnerEmail,
  } = useShop();

  const [feedback, setFeedback] = useState<{ id: string; message: string; tone: 'ok' | 'warn' } | null>(null);

  const sosJobs = useMemo(
    () =>
      bookings
        .filter((b) => isSosBooking(b) && b.status !== 'cancelled')
        .sort((a, b) => {
          const rank: Record<SosStatus, number> = {
            requested: 0,
            approved: 1,
            location_requested: 2,
            quoted: 3,
            confirmed: 4,
            declined: 5,
          };
          return rank[(a.sosStatus as SosStatus) || 'requested'] - rank[(b.sosStatus as SosStatus) || 'requested'];
        }),
    [bookings]
  );

  return (
    <div className="space-y-5 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-gradient-to-br from-rose-950/60 via-neutral-900 to-neutral-900 border border-rose-500/40 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30">
            <Siren className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">SOS Emergency Repairs</h3>
            <p className="text-xs text-neutral-300 mt-0.5">
              Priority call-outs that skip the queue. Approve, request the rider's WhatsApp live location, quote,
              then set off the moment they confirm the price. Owner pushes go to{' '}
              <span className="font-mono text-rose-300">{reminderOwnerEmail || 'no owner email set'}</span>.
            </p>
          </div>
          <span className="ml-auto shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-200 border border-rose-500/40">
            {sosJobs.filter((j) => (j.sosStatus || 'requested') !== 'confirmed').length} open
          </span>
        </div>
      </div>

      {sosJobs.length === 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-10 text-center text-neutral-400 text-sm">
          No SOS emergency requests right now. 🚴‍♂️
        </div>
      )}

      <div className="space-y-4">
        {sosJobs.map((job) => (
          <SosJobCard
            key={job.id}
            job={job}
            onApprove={async (price) => {
              const res = await approveBooking(job.id, 'SOS express call-out approved.', { quotedPrice: price });
              setFeedback({ id: job.id, message: res.message || 'Approved.', tone: res.success ? 'ok' : 'warn' });
            }}
            onRequestLocation={async () => {
              const res = await requestSosLocation(job.id);
              setFeedback({ id: job.id, message: res.message || 'Location requested.', tone: res.success ? 'ok' : 'warn' });
            }}
            onSendQuote={async (price) => {
              const res = await updateBookingQuote(job.id, { quotedPrice: price, quoteNote: 'SOS express quote' });
              setFeedback({ id: job.id, message: res.message || 'Quote saved.', tone: res.success ? 'ok' : 'warn' });
            }}
            onConfirm={async () => {
              const res = await confirmSosQuote(job.id);
              setFeedback({ id: job.id, message: res.message || 'Confirmed.', tone: res.success ? 'ok' : 'warn' });
            }}
            feedback={feedback && feedback.id === job.id ? feedback : null}
          />
        ))}
      </div>
    </div>
  );
};

interface SosJobCardProps {
  job: ServiceBooking;
  onApprove: (price: number) => Promise<void>;
  onRequestLocation: () => Promise<void>;
  onSendQuote: (price: number) => Promise<void>;
  onConfirm: () => Promise<void>;
  feedback: { message: string; tone: 'ok' | 'warn' } | null;
}

const SosJobCard: React.FC<SosJobCardProps> = ({
  job,
  onApprove,
  onRequestLocation,
  onSendQuote,
  onConfirm,
  feedback,
}) => {
  const status = (job.sosStatus as SosStatus) || 'requested';
  const suggested = sosQuoteTotal(job.quotedPrice ?? job.servicePrice ?? 0, SOS_SURCHARGE);
  const [price, setPrice] = useState<string>(job.quotedPrice ? String(job.quotedPrice) : '');
  const [busy, setBusy] = useState(false);

  const fault = faultFromNotes(job.notes) || 'Fault described in booking notes.';
  const riderUse = riderUseFromNotes(job.notes);
  const location = job.sosLocationNote || riderLocationFromNotes(job.notes);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const quoteValue = () => {
    const n = Number(price);
    return Number.isFinite(n) && n > 0 ? n : suggested;
  };

  return (
    <div className="bg-neutral-900 border border-rose-500/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm">{job.customerName}</span>
              <span className="text-[11px] text-neutral-500 font-mono">#{job.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SOS_STATUS_STYLES[status]}`}>
                {sosStatusLabel(status).toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {job.vehicleModel}
              {riderUse ? ` · ${riderUse}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`tel:${job.customerPhone}`}
            className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Fault reported</div>
          <div className="text-neutral-200 leading-relaxed">{fault}</div>
        </div>
        <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Rider location</div>
          <div className="text-neutral-200 leading-relaxed flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            {location || 'Not yet provided'}
          </div>
        </div>
      </div>

      {/* Workflow actions */}
      <div className="pt-3 border-t border-neutral-800 space-y-3">
        {status === 'requested' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Approved estimate (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={suggested.toFixed(2)}
                className="w-40 bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => onApprove(quoteValue()))}
              className="px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs cursor-pointer"
            >
              Approve SOS request
            </button>
            <span className="text-[11px] text-neutral-500">
              Suggested with surcharge: £{suggested.toFixed(2)} (£{SOS_SURCHARGE.toFixed(0)} express)
            </span>
          </div>
        )}

        {status === 'approved' && (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={buildSosLocationRequestUrl(job)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void run(onRequestLocation)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" /> Request live location on WhatsApp
            </a>
            <span className="text-[11px] text-neutral-400">Opens WhatsApp with the message pre-filled for {job.customerPhone}.</span>
          </div>
        )}

        {status === 'location_requested' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Express quote (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={suggested.toFixed(2)}
                className="w-40 bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <a
              href={buildSosQuoteUrl(job, quoteValue(), SOS_SURCHARGE)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void run(() => onSendQuote(quoteValue()))}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <BadgePoundSterling className="w-4 h-4" /> Send quote on WhatsApp
            </a>
            <span className="text-[11px] text-neutral-500">Total shown to the rider includes the £{SOS_SURCHARGE.toFixed(0)} surcharge.</span>
          </div>
        )}

        {status === 'quoted' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(onConfirm)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-black text-xs flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Price confirmed — set off now
            </button>
            <span className="text-[11px] text-neutral-400">
              Quoted £{(job.quotedPrice ?? 0).toFixed(2)}. Only tap once the rider has replied CONFIRM on WhatsApp.
            </span>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            SET OFF — price confirmed at £{(job.quotedPrice ?? 0).toFixed(2)}. Owner has been pushed.
          </div>
        )}

        {feedback && (
          <div
            className={`text-[11px] font-semibold ${feedback.tone === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {feedback.message}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <Bell className="w-3 h-3" />
          <span>OneSignal owner push fires on request, approval, quote and confirmation.</span>
        </div>
      </div>
    </div>
  );
};

export default StaffSosPanel;
