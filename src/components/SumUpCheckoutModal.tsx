import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, X, Loader2, CheckCircle2, XCircle, ExternalLink, Smartphone, RefreshCw, PoundSterling } from 'lucide-react';
import {
  getSumupConfig,
  createSumupCheckout,
  pollSumupCheckout,
  listSumupReaders,
  sendToSumupReader,
  getSumupReaderStatus,
  terminateSumupReaderCheckout,
  type SumupConfig,
  type SumupReader,
} from '../utils/sumupPayments';

interface SumUpCheckoutModalProps {
  amount: number;
  description?: string;
  isDark?: boolean;
  onPaid: (info: { reference: string; checkoutId: string }) => void;
  onClose: () => void;
}

type Phase = 'loading' | 'unconfigured' | 'ready' | 'pending' | 'reader' | 'paid' | 'failed';

const POLL_MS = 2500;

/**
 * High-tech SumUp terminal. Staff pick how the customer pays — a hosted online
 * checkout (link/QR the customer completes on their own phone) or a paired
 * physical card reader — and the modal drives the whole flow: create the
 * checkout, wait for the money, and hand back to the till only on PAID.
 */
export const SumUpCheckoutModal: React.FC<SumUpCheckoutModalProps> = ({
  amount,
  description,
  isDark = true,
  onPaid,
  onClose,
}) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [config, setConfig] = useState<SumupConfig | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [readers, setReaders] = useState<SumupReader[]>([]);
  const [selectedReader, setSelectedReader] = useState<string>('');
  const [readerStatus, setReaderStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  const panel = isDark
    ? 'bg-neutral-950 border-neutral-800 text-neutral-100'
    : 'bg-white border-neutral-200 text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      const cfg = await getSumupConfig();
      if (cancelled.current) return;
      setConfig(cfg);
      setPhase(cfg.configured ? 'ready' : 'unconfigured');
    })();
    return () => {
      cancelled.current = true;
    };
  }, []);

  const startCheckout = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await createSumupCheckout({
        amount,
        description,
        redirectUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      if (cancelled.current) return;
      setCheckoutId(res.checkoutId);
      setReference(res.reference);
      setHostedUrl(res.hostedCheckoutUrl);
      setPhase('pending');
      if (res.hostedCheckoutUrl && typeof window !== 'undefined') {
        window.open(res.hostedCheckoutUrl, '_blank', 'noopener');
      }
      void watchCheckout(res.checkoutId);
    } catch (err: any) {
      setMessage(err?.message || 'Could not start the SumUp checkout.');
      setPhase('failed');
    } finally {
      setBusy(false);
    }
  };

  const watchCheckout = async (id: string) => {
    try {
      const final = await pollSumupCheckout(id, {
        intervalMs: POLL_MS,
        onTick: (s) => {
          if (!cancelled.current) setMessage(`Waiting for payment… (${s})`);
        },
      });
      if (cancelled.current) return;
      if (final === 'PAID') {
        setPhase('paid');
        onPaid({ reference: reference || id, checkoutId: id });
      } else {
        setPhase('failed');
        setMessage(`Payment ${final.toLowerCase()}.`);
      }
    } catch (err: any) {
      if (!cancelled.current) {
        setPhase('failed');
        setMessage(err?.message || 'Lost contact while waiting for payment.');
      }
    }
  };

  const loadReaders = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const list = await listSumupReaders();
      setReaders(list);
      if (list.length > 0 && !selectedReader) setSelectedReader(list[0].id);
      setPhase('reader');
    } catch (err: any) {
      setMessage(err?.message || 'Could not list SumUp readers.');
    } finally {
      setBusy(false);
    }
  };

  const chargeReader = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await sendToSumupReader({ readerId: selectedReader || undefined, amount, description });
      setMessage('Sent to the reader — ask the customer to tap or insert their card.');
      const st = await getSumupReaderStatus(selectedReader || undefined);
      setReaderStatus(st?.status || null);
    } catch (err: any) {
      setMessage(err?.message || 'Could not send the amount to the reader.');
    } finally {
      setBusy(false);
    }
  };

  const stopReader = async () => {
    setBusy(true);
    try {
      await terminateSumupReaderCheckout(selectedReader || undefined);
      setMessage('Reader transaction cancelled.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not cancel the reader transaction.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`rounded-3xl border max-w-md w-full p-6 shadow-2xl space-y-4 ${panel}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-500" /> SumUp Payment
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SumUp payment"
            className={`${muted} hover:text-emerald-500 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-right">
          <div className={`text-[10px] uppercase tracking-wider ${muted}`}>
            {description || 'Counter sale'}
          </div>
          <div className="font-mono text-3xl font-black text-emerald-400">£{amount.toFixed(2)}</div>
        </div>

        {phase === 'loading' && (
          <div className={`flex items-center gap-2 text-sm ${muted}`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Checking SumUp configuration…
          </div>
        )}

        {phase === 'unconfigured' && (
          <div className="rounded-xl border border-amber-800 bg-amber-950/40 px-3 py-3 text-xs text-amber-300 space-y-1">
            <div className="font-bold">SumUp is not configured on this deployment.</div>
            <div>Set <span className="font-mono">SUMUP_API_KEY</span> and <span className="font-mono">SUMUP_MERCHANT_CODE</span> in Vercel, then redeploy.</div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={startCheckout}
              disabled={busy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              <Smartphone className="w-4 h-4" /> Take payment online
            </button>
            <button
              type="button"
              onClick={loadReaders}
              disabled={busy || !config?.hasReader}
              title={config?.hasReader ? 'Send to a paired card reader' : 'No reader configured (SUMUP_READER_ID)'}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 py-3 text-sm font-bold text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" /> Send to card reader
            </button>
            <p className={`text-center text-[10px] ${muted}`}>
              Online checkout opens a secure SumUp page the customer completes on their phone.
            </p>
          </div>
        )}

        {phase === 'pending' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Waiting for the customer to pay…
            </div>
            {hostedUrl && (
              <a
                href={hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-950/40 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-950/70"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Reopen the payment page
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => checkoutId && watchCheckout(checkoutId)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 py-2 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check now
              </button>
              <button
                type="button"
                onClick={() => setPhase('failed')}
                className="rounded-xl border border-neutral-700 py-2 text-[11px] font-semibold text-neutral-400 hover:bg-neutral-800"
              >
                Stop waiting
              </button>
            </div>
          </div>
        )}

        {phase === 'reader' && (
          <div className="space-y-3">
            {readers.length === 0 ? (
              <div className={`text-xs ${muted}`}>No paired readers found on this account.</div>
            ) : (
              <>
                <label className={`block text-[10px] uppercase tracking-wider ${muted}`}>Reader</label>
                <select
                  value={selectedReader}
                  onChange={(e) => setSelectedReader(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {readers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.id} {r.status ? `· ${r.status}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={chargeReader}
                  disabled={busy}
                  className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <PoundSterling className="w-4 h-4" /> Charge £{amount.toFixed(2)} on reader
                </button>
                <button
                  type="button"
                  onClick={stopReader}
                  disabled={busy}
                  className="w-full rounded-xl border border-rose-800 bg-rose-950/40 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-950/70"
                >
                  Cancel reader transaction
                </button>
                {readerStatus && (
                  <div className={`text-[10px] ${muted}`}>Reader status: {readerStatus}</div>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'paid' && (
          <div className="flex flex-col items-center gap-2 py-2 text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
            <div className="text-sm font-black">Payment received</div>
            {reference && <div className={`font-mono text-[11px] ${muted}`}>{reference}</div>}
          </div>
        )}

        {phase === 'failed' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-rose-300">
              <XCircle className="w-4 h-4" /> Payment not completed
            </div>
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setPhase('ready');
              }}
              className="w-full rounded-xl border border-neutral-700 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              Try again
            </button>
          </div>
        )}

        {message && phase !== 'paid' && (
          <p className={`text-center text-[11px] ${phase === 'failed' ? 'text-rose-300' : muted}`}>{message}</p>
        )}

        {phase === 'paid' && (
          <button
            type="button"
            onClick={onClose}
            className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4" /> Done — close the till
          </button>
        )}
      </div>
    </div>
  );
};
