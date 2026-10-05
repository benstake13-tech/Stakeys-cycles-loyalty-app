import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { StakeysLogo } from './StakeysLogo';
import { supabase } from '../shared/lib/supabase';

/**
 * Landing page for the password-recovery email link.
 *
 * Supabase parses the recovery token out of the URL on load (detectSessionInUrl)
 * and emits a PASSWORD_RECOVERY / SIGNED_IN event with a short-lived session.
 * That session is what authorises `supabase.auth.updateUser({ password })`.
 */
export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useShop();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // If the auth client already consumed the link we have a session now;
    // otherwise wait for the PASSWORD_RECOVERY event.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setReady(true);
      }
    });

    // Give the client a beat to process the URL hash, then stop blocking the form.
    const t = setTimeout(() => setReady(true), 1200);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim().length < 6) {
      setError('Choose a password of at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await updatePassword(password);
      if (res.success) {
        setDone(true);
        // Drop the recovery session so the next visit starts at the login screen.
        await supabase.auth.signOut().catch(() => {});
      } else {
        setError(res.message || 'Could not update your password.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090b0e]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <StakeysLogo className="w-16 h-16 mb-3" />
          <h1 className="font-display text-xl font-extrabold text-white tracking-tight">
            Stakey's Cycles
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Set a new password for your account</p>
        </div>

        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h2 className="font-display text-lg font-bold text-white">Password updated</h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Your new password is saved. Head back to the app and sign in with it.
              </p>
              <a
                href="/"
                className="w-full py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="font-display text-sm font-bold text-white">Choose a new password</span>
              </div>

              {!ready && (
                <p className="text-[11px] text-neutral-400">Verifying your reset link…</p>
              )}

              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={show ? 'text' : 'password'}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <span>Save New Password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
