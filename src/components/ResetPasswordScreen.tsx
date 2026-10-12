import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { supabase } from '../lib/supabase';
import { StakeysLogo } from './StakeysLogo';

/**
 * Landing page for the password-reset email link (`/reset-password`).
 *
 * Supabase's `detectSessionInUrl` consumes the recovery tokens in the URL and
 * signs the user in with a short-lived session; this screen then sets the new
 * password with `updateUser`. Without this screen the reset link was a dead
 * end — the email pointed at a route the app never handled.
 */
export const ResetPasswordScreen: React.FC = () => {
  const { completePasswordReset } = useShop();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Wait a tick so the auth client has processed the URL tokens.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(Boolean(data.session));
    };
    const t = setTimeout(check, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (password.length < 6) {
      setStatus({ kind: 'error', text: 'Choose a password of at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ kind: 'error', text: 'The two passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      const res = await completePasswordReset(password);
      setStatus({ kind: res.success ? 'ok' : 'error', text: res.message || (res.success ? 'Password updated.' : 'Could not update the password.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f15] text-neutral-100 flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-neutral-950 border border-emerald-500/40 shadow-lg">
            <StakeysLogo className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight">Reset your password</h1>
            <p className="text-xs text-neutral-400">Stakey&apos;s Cycles &amp; Scooter</p>
          </div>
        </div>

        {hasSession === false && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This reset link has expired or was already used. Go back to the sign-in screen and tap
              &ldquo;Forgot password?&rdquo; to request a fresh link.
            </span>
          </div>
        )}

        {status && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              status.kind === 'ok'
                ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-600/30 text-rose-200'
            }`}
          >
            {status.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{status.text}</span>
          </div>
        )}

        {status?.kind !== 'ok' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-200 mb-1.5">New password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-200 mb-1.5">Confirm new password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter the password"
                  className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? <span>Updating…</span> : (<><span>Set new password</span><ArrowRight className="w-3.5 h-3.5" /></>)}
            </button>
          </form>
        )}

        {status?.kind === 'ok' && (
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Continue to sign in
          </button>
        )}

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            className="text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
