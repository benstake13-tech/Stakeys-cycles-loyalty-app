import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Scan, Layers, Menu, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { ShopProvider, useShop } from './shared/context/ShopContext';
import { StaffLoginScreen } from './components/StaffLoginScreen';
import { StaffPortal } from './components/StaffPortal';
import { DeliverablesViewer } from './components/DeliverablesViewer';
import { WinnerAnnouncementBanner } from './components/WinnerAnnouncementBanner';
import { StakeysLogo } from './components/StakeysLogo';
import { ServiceStatusBadge } from './components/ServiceStatusBadge';
import { NavTabId } from './components/Navigation3DDeck';
import { SHOP_SOCIAL_LINKS } from './shared/data/socialLinks';
import { ThemeToggle } from './components/ThemeToggle';
import { SeasonalThemeCanvas } from './components/SeasonalThemeCanvas';
import { SegmentedTabs, SegmentedTab } from './components/SegmentedTabs';
import { LegalDisclaimersButton } from './components/LegalDisclaimers';
import { Toaster } from 'react-hot-toast';
import { initOneSignal, linkUser, relinkUser, unlinkUser } from './shared/utils/pushNotifications';

/**
 * Staff-only build of the Stakey's Cycles app.
 *
 * This app intentionally ships none of the customer surfaces (customer portal,
 * bookings, promotions, registration, guest booking or password recovery). Every
 * visitor must sign in with an account whose Supabase role is `staff` or `admin`;
 * a customer account is rejected at the login step and never reaches the
 * terminal. The customer-facing app lives in a separate deployment.
 */
function AppContent() {
  const { currentUser, logoutUser, theme, bookings, seasonalTheme } = useShop();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<NavTabId>('staff');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
  const freshBookingsCount = isStaff
    ? bookings.filter((b) => b.status === 'pending' || b.approvalStatus === 'pending_approval').length
    : 0;

  // The terminal is the staff landing view; keep the destination valid if the
  // signed-in role ever changes without violating Hook rules.
  useEffect(() => {
    if (currentUser && !isStaff) return;
    if (activeTab !== 'staff' && activeTab !== 'deliverables') setActiveTab('staff');
  }, [currentUser?.role]);

  // Return to the top whenever the destination changes so each view starts fresh
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileMenuOpen(false);
  }, [activeTab]);

  // OneSignal: initialise once and target pushes at the signed-in user.
  // Auth restore is async, so on a cold load `currentUser` is briefly null —
  // we must NOT treat that as "signed out" and unlink the device, or every
  // reload would detach this phone from the admin profile and silently break
  // booking alerts. Only unlink after a user has actually been linked.
  const pushLinkedRef = useRef(false);
  useEffect(() => {
    void initOneSignal();
  }, []);

  useEffect(() => {
    if (currentUser) {
      pushLinkedRef.current = true;
      void linkUser(currentUser.uid, { role: currentUser.role || 'staff' });
    } else if (pushLinkedRef.current) {
      pushLinkedRef.current = false;
      void unlinkUser();
    }
  }, [currentUser?.uid, currentUser?.role]);

  // Self-heal: whenever the app regains focus and a user is signed in, re-apply
  // the profile id so a device that dropped its link reconnects automatically.
  useEffect(() => {
    const onFocus = () => {
      if (currentUser) void relinkUser();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [currentUser?.uid]);

  // Staff terminal destinations only — there are no customer tabs in this build.
  const navTabs: SegmentedTab<NavTabId>[] = [
    {
      id: 'staff',
      label: 'Staff Terminal',
      icon: Scan,
      tone: 'emerald',
      badge: freshBookingsCount > 0 ? `${freshBookingsCount} new` : undefined,
      hint: 'Workshop terminal',
    },
    { id: 'deliverables', label: 'Config', icon: Layers, tone: 'neutral', hint: 'Architecture & deliverables' },
  ];

  // 1. FIRST SCREEN: staff sign-in only. There is no customer entry point here.
  if (!currentUser) {
    return <StaffLoginScreen />;
  }

  // 2. A customer account can never reach the terminal. If one somehow has a
  //    session (e.g. an old customer token), deny access and offer a sign-out.
  if (!isStaff) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-50 text-neutral-900'} flex flex-col font-['Plus_Jakarta_Sans',sans-serif]`}>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className={`max-w-md w-full rounded-3xl border p-8 text-center space-y-4 ${isDark ? 'bg-[#0d1015] border-amber-500/40' : 'bg-white border-amber-400'}`}>
            <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Staff Access Only</h3>
            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              This app is the dedicated workshop terminal. Signed-in customers are not permitted here — please
              use the customer loyalty app instead.
            </p>
            <div className={`flex items-center justify-center gap-2 text-xs rounded-lg border px-3 py-2 ${isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-400' : 'border-neutral-200 bg-neutral-100 text-neutral-600'}`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{currentUser.email || currentUser.displayName}</span>
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className="pressable px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#090b0e] text-neutral-100' : 'bg-slate-50 text-neutral-900'} font-['Plus_Jakarta_Sans',sans-serif]`}>
      {/* Seasonal characters ride across the background of every screen */}
      <SeasonalThemeCanvas theme={seasonalTheme} />

      {/* Page content sits above the seasonal canvas (z-0) so the characters
          ride across the background of every screen, behind the UI. */}
      <div className="relative z-10 min-h-screen flex flex-col">
      {/* Broadcast Winner Announcement to Everybody */}
      <WinnerAnnouncementBanner />

      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          isDark ? 'bg-[#090b0e]/85 border-neutral-800/80 text-white' : 'bg-white/85 border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className="flex items-center gap-3 shrink-0 cursor-pointer group"
          >
            <div className={`p-1 rounded-xl border text-emerald-400 transition-transform group-hover:scale-105 ${isDark ? 'bg-neutral-900 border-emerald-500/30' : 'bg-neutral-100 border-emerald-500/30'}`}>
              <StakeysLogo className="w-7 h-7" />
            </div>
            <span className={`font-display font-extrabold text-lg tracking-tight flex items-baseline gap-1.5 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              STAKEY'S
              <span className="text-[#05C147] font-semibold text-xs tracking-wider uppercase font-sans">STAFF</span>
            </span>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden md:block">
            <SegmentedTabs tabs={navTabs} active={activeTab} onChange={setActiveTab} ariaLabel="Staff navigation" />
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle showLabel={false} />
            <ServiceStatusBadge variant="header" />

            <div className={`hidden lg:flex items-center gap-2 text-xs ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{currentUser.displayName}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                Staff Verified
              </span>
            </div>

            <button
              type="button"
              onClick={logoutUser}
              className={`pressable px-3 py-1.5 rounded-xl border transition-colors text-xs font-medium hidden sm:flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-rose-400'
                  : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700 hover:text-rose-600'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label="Open menu"
              className={`md:hidden pressable p-2 rounded-xl border cursor-pointer ${
                isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation sheet */}
        {mobileMenuOpen && (
          <div className={`md:hidden animate-slide-down border-t px-3 py-3 space-y-2 ${isDark ? 'border-neutral-800/70 bg-[#090b0e]' : 'border-neutral-200 bg-white'}`}>
            <div className="grid grid-cols-2 gap-2">
              {navTabs.map((tab) => {
                const Icon = tab.icon!;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`pressable flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-xs font-semibold cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-white'
                          : 'border-emerald-500/50 bg-emerald-50 text-emerald-900'
                        : isDark
                        ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className={`pressable w-full flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                isDark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:text-rose-400' : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:text-rose-600'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-8 space-y-8">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'staff' && <StaffPortal />}
          {activeTab === 'deliverables' && <DeliverablesViewer />}
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-6 text-center text-xs ${isDark ? 'border-neutral-900 bg-neutral-950 text-neutral-500' : 'border-neutral-200 bg-white text-neutral-500'}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className={`flex items-center gap-2.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            <StakeysLogo className="w-6 h-6" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Stakey's Cycles &amp; Scooter</span>
            <span className="hidden sm:inline">• Staff Terminal</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              {SHOP_SOCIAL_LINKS.map(({ id, label, handle, url, icon: Icon }) => (
                <a
                  key={id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} — ${handle}`}
                  title={`${label}: ${handle}`}
                  className={`p-1.5 rounded-lg border transition-colors ${isDark ? 'border-neutral-800 text-neutral-400 hover:text-white hover:border-emerald-500/50' : 'border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-emerald-500/50'}`}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Fast Turnaround</span>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Expert Mechanics</span>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Digital Stamp Rewards</span>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <LegalDisclaimersButton isDark={isDark} />
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ShopProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4500,
          style: {
            background: '#12161c',
            color: '#f3f4f6',
            border: '1px solid #262626',
            borderRadius: '14px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.6)',
          },
          success: {
            iconTheme: {
              primary: '#05C147',
              secondary: '#12161c',
            },
          },
        }}
      />
      <AppContent />
    </ShopProvider>
  );
}
