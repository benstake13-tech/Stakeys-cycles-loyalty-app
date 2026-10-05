import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, Shield, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { StakeysLogo } from './StakeysLogo';
import { ThemeToggle } from './ThemeToggle';

/**
 * Dedicated sign-in for the staff-only build. There is deliberately no customer
 * sign-in, registration, guest booking or password-recovery path here: this app
 * is the workshop terminal only, and every visitor must sign in with an account
 * that resolves to a verified staff/admin role in Supabase.
 */
export const StaffLoginScreen: React.FC = () => {
  const { loginStaff } = useShop();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your workshop email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginStaff(cleanEmail, password);
      if (!res.success) {
        setError(res.message || 'Access denied. Authorized workshop personnel only.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090b0e] text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-[#090b0e]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-xl border border-emerald-500/30 bg-neutral-900 text-emerald-400">
              <StakeysLogo className="w-7 h-7" />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight flex items-baseline gap-1.5 text-white">
              STAKEY'S
              <span className="text-[#05C147] font-semibold text-xs tracking-wider uppercase font-sans">
                Staff Station
              </span>
            </span>
          </div>
          <ThemeToggle showLabel={false} />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl border border-emerald-500/40 bg-neutral-900 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Workshop Staff Access
            </h1>
            <p className="text-xs text-neutral-400 mt-2 max-w-sm mx-auto">
              This is the dedicated staff terminal. Sign in with your authorized workshop account to manage
              bookings, the till, customers and loyalty.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Workshop Staff Station</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-emerald-400 border border-neutral-700">
                  Supabase Secured
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Authorized workshop staff only. Access to the workshop booking scheduler, stamp terminal, prize
                draws and bike specs.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">Staff Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="username"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@stakeyscycles.com"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>Verifying…</span>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Unlock Staff Terminal</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-start gap-2 pt-1 border-t border-neutral-800 text-[11px] text-neutral-500">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-600" />
              <span>
                Access is verified against your staff role in Supabase. Customers sign in on the separate
                loyalty app — this build is for workshop personnel only.
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 py-4 text-center text-[11px] text-neutral-600">
        Stakey's Cycles &amp; Scooter · Staff Station
      </footer>
    </div>
  );
};
