import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Shield,
  Layers,
  LogOut,
  Scan,
  Wrench,
  KeyRound,
  X,
  ShieldCheck,
  AlertCircle,
  Tag,
  Menu,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { ShopProvider, useShop } from './shared/context/ShopContext';
import { LoginScreen } from './components/LoginScreen';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { CustomerPortal } from './components/CustomerPortal';
import { AvatarModel } from './components/AvatarModel';
import { StaffPortal } from './components/StaffPortal';
import { BookingPortal } from './components/BookingPortal';
import { DeliverablesViewer } from './components/DeliverablesViewer';
import { WinnerAnnouncementBanner } from './components/WinnerAnnouncementBanner';
import { StakeysLogo } from './components/StakeysLogo';
import { ServiceStatusBadge } from './components/ServiceStatusBadge';
import { NavTabId } from './components/Navigation3DDeck';
import { SHOP_SOCIAL_LINKS } from './shared/data/socialLinks';
import AppSwitcherButton from './shared/components/AppSwitcherButton';
import { ThemeToggle } from './components/ThemeToggle';
import { SeasonalThemeCanvas } from './components/SeasonalThemeCanvas';
import { PromotionsCarousel } from './components/PromotionsCarousel';
import { SegmentedTab } from './components/SegmentedTabs';
import { LegalDisclaimersButton } from './components/LegalDisclaimers';
import { Toaster } from 'react-hot-toast';
import { initOneSignal, linkUser, relinkUser, unlinkUser } from './shared/utils/pushNotifications';

function AppContent() {
  const { currentUser, logoutUser, loginStaff, theme, bookings, seasonalTheme } = useShop();
  const isDark = theme === 'dark';
  const [showGuestBooking, setShowGuestBooking] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTabId>('customer');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secure staff unlock modal (Supabase email + password, role verified server-side)
  const [showStaffPinModal, setShowStaffPinModal] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
  const freshBookingsCount = isStaff
    ? bookings.filter((b) => b.status === 'pending' || b.approvalStatus === 'pending_approval').length
    : 0;

  // Keep activeTab in sync with user role changes without violating Hook rules
  useEffect(() => {
    if (currentUser) {
      const isStaffUser = currentUser.role === 'staff' || currentUser.role === 'admin';
      setActiveTab(isStaffUser ? 'staff' : 'customer');
    }
  }, [currentUser?.role, currentUser?.uid]);

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
      void linkUser(currentUser.uid, { role: currentUser.role || 'customer' });
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

  const openStaffUnlock = () => {
    setStaffError(null);
    setStaffEmail('');
    setStaffPassword('');
    setShowStaffPassword(false);
    setShowStaffPinModal(true);
  };

  const handleStaffUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);

    if (!staffEmail.trim() || !staffPassword) {
      setStaffError('Enter your workshop email and password.');
      return;
    }

    setStaffSubmitting(true);
    try {
      const res = await loginStaff(staffEmail.trim(), staffPassword);
      if (res.success) {
        setShowStaffPinModal(false);
        setStaffPassword('');
        setActiveTab('staff');
      } else {
        setStaffError(res.message || 'Access denied. Authorized workshop personnel only.');
      }
    } catch {
      setStaffError('An unexpected error occurred. Please try again.');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const goToTab = (tab: NavTabId) => {
    if (tab === 'staff' && !isStaff) {
      openStaffUnlock();
      return;
    }
    setActiveTab(tab);
  };

  // Primary destinations, shared by the desktop nav, mobile sheet and bottom bar
  const navTabs: SegmentedTab<NavTabId>[] = [
    {
      id: 'customer',
      label: isStaff ? 'Customer Preview' : 'My Garage & Pass',
      icon: User,
      tone: 'emerald',
      hint: 'Your bikes, loyalty pass and bookings',
    },
    { id: 'booking', label: 'Book Service', icon: Wrench, tone: 'emerald', hint: 'Book a workshop slot' },
    { id: 'promotions', label: 'Promotions', icon: Tag, tone: 'amber', hint: 'Current offers and rewards' },
  ];

  if (isStaff) {
    navTabs.push({
      id: 'staff',
      label: 'Staff Terminal',
      icon: Scan,
      tone: 'emerald',
      badge: freshBookingsCount > 0 ? `${freshBookingsCount} new` : undefined,
      hint: 'Workshop terminal',
    });
    navTabs.push({ id: 'deliverables', label: 'Config', icon: Layers, tone: 'neutral', hint: 'Architecture & deliverables' });
  }
  // No "Staff Station" entry for customers: the workshop terminal is an
  // administrative view and must not be advertised in the public interface.
  // Staff still sign in from the login screen's Staff Station tab.

  // 1. FIRST SCREEN: If user is not authenticated, show LoginScreen or Guest Booking
  if (!currentUser) {
    // Password-recovery email lands on /reset-password — show the set-password
    // page before the login screen so the recovery session can be used.
    if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/reset-password') {
      return <ResetPasswordPage />;
    }
    if (showGuestBooking) {
      return (
        <div className={`min-h-screen ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-50 text-neutral-900'} flex flex-col font-['Plus_Jakarta_Sans',sans-serif]`}>
          <header className={`sticky top-0 z-40 ${isDark ? 'bg-neutral-950/90 border-neutral-800' : 'bg-white/90 border-neutral-200'} backdrop-blur-md border-b`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-1 rounded-2xl ${isDark ? 'bg-neutral-900 border-emerald-500/40' : 'bg-white border-emerald-500/40'} border shadow-lg shadow-emerald-500/10 shrink-0`}>
                  <StakeysLogo className="w-9 h-9" />
                </div>
                <div>
                  <span className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'} flex items-center gap-1.5`}>
                    STAKEYS
                    <span className="text-[12px] font-bold text-[#05C147] tracking-normal uppercase">
                      Cycles &amp; Scooter
                    </span>
                  </span>
                  <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-600'} font-mono`}>Workshop Service Booking</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle showLabel={false} />
                <button
                  onClick={() => setShowGuestBooking(false)}
                  className={`pressable px-4 py-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900'} text-xs font-semibold cursor-pointer`}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <BookingPortal onGoToMyBikes={() => setShowGuestBooking(false)} />
          </main>
        </div>
      );
    }
    return <LoginScreen onGoToBooking={() => setShowGuestBooking(true)} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#090b0e] text-neutral-100' : 'bg-slate-50 text-neutral-900'} font-['Plus_Jakarta_Sans',sans-serif]`}>
      {/* Seasonal characters ride across the background of every screen. The
          customer's own avatar leads the pack. */}
      <SeasonalThemeCanvas theme={seasonalTheme} avatar={currentUser?.avatar} />

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
            onClick={() => setActiveTab(isStaff ? 'staff' : 'customer')}
            className="flex items-center gap-3 shrink-0 cursor-pointer group"
          >
            <div className={`p-1 rounded-xl border text-emerald-400 transition-transform group-hover:scale-105 ${isDark ? 'bg-neutral-900 border-emerald-500/30' : 'bg-neutral-100 border-emerald-500/30'}`}>
              <StakeysLogo className="w-7 h-7" />
            </div>
            <span className={`font-display font-extrabold text-lg tracking-tight flex items-baseline gap-1.5 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              STAKEY'S
              <span className="text-[#05C147] font-semibold text-xs tracking-wider uppercase font-sans">CYCLES</span>
            </span>
          </button>

          {/* Navigation is hamburger-only on every screen size — see the
              toggle button and sheet below. No desktop tab strip. */}

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cross-app switcher: jumps to the public website and (for staff)
                the workshop terminal, so the three apps stay one click apart.
                The staff entry stays concealed from customers. */}
            <AppSwitcherButton current="customer" compact showStaff={isStaff} />
            <ThemeToggle showLabel={false} />
            {/* Backend/Supabase diagnostics are an operator concern — only show
                the status chip in the staff terminal, not to customers. */}
            {isStaff && <ServiceStatusBadge variant="header" />}

            <div className={`hidden lg:flex items-center gap-2 text-xs ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
              {!isStaff && (currentUser.avatarImage ? (
                <img src={currentUser.avatarImage.dataUrl} alt={`${currentUser.displayName}'s avatar`} className="w-7 h-7 rounded-full shrink-0 object-cover" />
              ) : (
                <AvatarModel config={currentUser.avatar} size={28} title={`${currentUser.displayName}'s avatar`} className="rounded-full shrink-0 overflow-hidden" />
              ))}
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{currentUser.displayName}</span>
              {isStaff ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Staff Verified
                </span>
              ) : (
                <span className={`font-mono text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{currentUser.membershipNumber}</span>
              )}
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

            {/* Navigation menu toggle — the only navigation control, shown at
                every breakpoint (desktop strip and mobile bottom bar removed). */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className={`pressable p-2 rounded-xl border cursor-pointer ${
                isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Navigation sheet — the hamburger dropdown, available at every
            breakpoint. */}
        {mobileMenuOpen && (
          <div className={`animate-slide-down border-t px-3 py-3 space-y-2 ${isDark ? 'border-neutral-800/70 bg-[#090b0e]' : 'border-neutral-200 bg-white'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {navTabs.map((tab) => {
                const Icon = tab.icon!;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => goToTab(tab.id)}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'customer' && <CustomerPortal />}
          {activeTab === 'booking' && <BookingPortal />}
          {activeTab === 'promotions' && <PromotionsCarousel />}
          {activeTab === 'staff' &&
            (isStaff ? (
              <StaffPortal />
            ) : (
              <div className={`max-w-md mx-auto rounded-3xl border p-8 text-center space-y-4 ${isDark ? 'bg-[#0d1015] border-amber-500/40' : 'bg-white border-amber-400'}`}>
                <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Staff Terminal Locked</h3>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  The Workshop Terminal requires an authorized staff sign-in.
                </p>
                <button
                  type="button"
                  onClick={openStaffUnlock}
                  className="pressable px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Staff Sign In
                </button>
              </div>
            ))}
          {activeTab === 'deliverables' && isStaff && <DeliverablesViewer />}
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-6 text-center text-xs ${isDark ? 'border-neutral-900 bg-neutral-950 text-neutral-500' : 'border-neutral-200 bg-white text-neutral-500'}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className={`flex items-center gap-2.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            <StakeysLogo className="w-6 h-6" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Stakey's Cycles &amp; Scooter</span>
            <span className="hidden sm:inline">• Workshop Repairs &amp; Customer Loyalty</span>
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

      {/* Secure staff sign-in modal */}
      {showStaffPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleStaffUnlock}
            className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl animate-pop ${
              isDark ? 'bg-[#0d1015] border-neutral-800' : 'bg-white border-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`font-display text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                <KeyRound className="w-5 h-5 text-amber-400" />
                Staff Terminal Access
              </h3>
              <button
                type="button"
                onClick={() => setShowStaffPinModal(false)}
                aria-label="Close"
                className={`pressable p-1.5 rounded-lg cursor-pointer ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Sign in with your authorized workshop account. Access is verified against your staff role in Supabase.
            </p>

            {staffError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className={`flex items-center gap-2 rounded-xl border px-3 ${isDark ? 'bg-[#090b0e] border-neutral-800' : 'bg-neutral-50 border-neutral-300'}`}>
                <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
                <input
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="staff@stakeyscycles.co.uk"
                  className={`w-full bg-transparent py-3 text-sm focus:outline-none ${isDark ? 'text-white' : 'text-neutral-900'}`}
                />
              </div>

              <div className={`flex items-center gap-2 rounded-xl border px-3 ${isDark ? 'bg-[#090b0e] border-neutral-800' : 'bg-neutral-50 border-neutral-300'}`}>
                <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                <input
                  type={showStaffPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Password"
                  className={`w-full bg-transparent py-3 text-sm focus:outline-none ${isDark ? 'text-white' : 'text-neutral-900'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword((v) => !v)}
                  aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                  className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowStaffPinModal(false)}
                className={`pressable flex-1 rounded-xl border px-4 py-2.5 text-xs font-semibold cursor-pointer ${
                  isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300' : 'border-neutral-300 bg-neutral-100 text-neutral-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={staffSubmitting}
                className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-950 cursor-pointer disabled:opacity-60"
              >
                {staffSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{staffSubmitting ? 'Verifying' : 'Unlock'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
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
