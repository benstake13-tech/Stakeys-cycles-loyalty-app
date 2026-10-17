import React from 'react';
import { Smartphone, ArrowUpRight } from 'lucide-react';
import { StakeysLogo } from './StakeysLogo';

/** Browser-only landing page. Authentication remains enforced by the backend. */
export function AppRequiredScreen({ audience }: { audience: 'staff' | 'customer' }) {
  const staff = audience === 'staff';
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16 font-['Plus_Jakarta_Sans',sans-serif]">
      <section className="w-full max-w-xl rounded-3xl border border-emerald-500/25 bg-neutral-950/80 p-7 sm:p-10 text-neutral-100 shadow-2xl backdrop-blur-xl" aria-labelledby="app-required-title">
        <StakeysLogo className="h-16 w-16 mb-8" />
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest"><Smartphone size={18} aria-hidden="true" /> {staff ? 'Staff workspace' : 'Your Stakey’s account'}</div>
        <h1 id="app-required-title" className="mt-4 text-3xl font-bold leading-tight">{staff ? 'Continue in the Stakey’s Staff app' : 'Your next ride starts in the Stakey’s Cycles app'}</h1>
        <p className="mt-5 text-neutral-300 leading-relaxed">{staff ? 'Please open the installed Stakey’s Staff app to sign in and access bookings, repairs and workshop records.' : 'Please open the Stakey’s Cycles app on your phone to sign in or create an account, manage your garage, and follow your repair updates.'}</p>
        <p className="mt-4 text-neutral-400 leading-relaxed">Account sign-in and registration are available through the installed app. This web address does not provide account access.</p>
        <div className="mt-7 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="font-semibold">Need the app?</h2>
          <p className="mt-2 text-sm text-neutral-300 leading-relaxed">{staff ? 'Contact your workshop administrator for the current Staff app installation link and help getting started.' : 'Contact Stakey’s Cycles for the current app installation link and help getting started.'}</p>
        </div>
        <a href="https://www.stakeys.co.uk" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-neutral-950 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">Visit our website <ArrowUpRight size={18} aria-hidden="true" /></a>
      </section>
    </main>
  );
}
