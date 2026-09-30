import React, { useState } from 'react';
import {
  Bike,
  User,
  Shield,
  Layers,
  LogOut,
  Scan,
  Server,
  Sparkles,
  Wrench,
  KeyRound,
  X,
  ShieldCheck,
  AlertCircle,
  Tag,
  Search,
} from 'lucide-react';
import { ShopProvider, useShop, STAFF_MASTER_PIN } from './context/ShopContext';
import { LoginScreen } from './components/LoginScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { StaffPortal } from './components/StaffPortal';
import { BookingPortal } from './components/BookingPortal';
import { DeliverablesViewer } from './components/DeliverablesViewer';
import { WinnerAnnouncementBanner } from './components/WinnerAnnouncementBanner';
import { StakeysLogo } from './components/StakeysLogo';
import { ServiceStatusBadge } from './components/ServiceStatusBadge';
import { Navigation3DDeck, NavTabId } from './components/Navigation3DDeck';
import { ThemeToggle } from './components/ThemeToggle';
import { PromotionsCarousel } from './components/PromotionsCarousel';
import { Toaster } from 'react-hot-toast';

function AppContent() {
  const { currentUser, logoutUser, theme, bookings } = useShop();
  const isDark = theme === 'dark';
  const [showGuestBooking, setShowGuestBooking] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTabId>('customer');

  // Quick Staff Terminal PIN modal state for quick shop switching
  const [showStaffPinModal, setShowStaffPinModal] = useState(false);
  const [modalPinInput, setModalPinInput] = useState('');
  const [modalPinError, setModalPinError] = useState<string | null>(null);

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
  const freshBookingsCount = isStaff
    ? bookings.filter((b) => b.status === 'pending' || b.approvalStatus === 'pending_approval').length
    : 0;

  // Keep activeTab in sync with user role changes without violating Hook rules
  React.useEffect(() => {
    if (currentUser) {
      const isStaffUser = currentUser.role === 'staff' || currentUser.role === 'admin';
      setActiveTab(isStaffUser ? 'staff' : 'customer');
    }
  }, [currentUser?.role, currentUser?.uid]);

  // 1. FIRST SCREEN: If user is not authenticated, show LoginScreen or Guest Booking
  if (!currentUser) {
    if (showGuestBooking) {
      return (
        <div className={`min-h-screen ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-50 text-neutral-900'} flex flex-col font-['Plus_Jakarta_Sans',sans-serif]`}>
          <header className={`sticky top-0 z-40 ${isDark ? 'bg-neutral-950/90 border-neutral-800' : 'bg-white/90 border-neutral-200'} backdrop-blur-md border-b`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-1 rounded-2xl ${isDark ? 'bg-neutral-900 border-emerald-500/40' : 'bg-white border-emerald-500/40'} border shadow-lg shadow-emerald-500/10 shrink-0`}>
                  <StakeysLogo className="w-10 h-10" />
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
                  className={`px-4 py-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900'} text-xs font-semibold cursor-pointer`}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <BookingPortal />
          </main>
        </div>
      );
    }
    return <LoginScreen onGoToBooking={() => setShowGuestBooking(true)} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#090b0e] text-neutral-100' : 'bg-slate-50 text-neutral-900'} flex flex-col font-['Plus_Jakarta_Sans',sans-serif]`}>
      {/* Broadcast Winner Announcement to Everybody */}
      <WinnerAnnouncementBanner />

      {/* Top Navigation Bar: Strict 3-zone contract */}
      <header className={`sticky top-0 z-40 ${isDark ? 'bg-[#090b0e]/95 border-neutral-800/80 text-white' : 'bg-white/95 border-neutral-200 text-neutral-900'} backdrop-blur-md border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand title, single element */}
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-xl ${isDark ? 'bg-neutral-900 border-emerald-500/30' : 'bg-neutral-100 border-emerald-500/30'} border text-emerald-400 shrink-0`}>
              <StakeysLogo className="w-7 h-7" />
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(isStaff ? 'staff' : 'customer');
              }}
              className={`font-display font-extrabold text-lg sm:text-xl tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'} flex items-baseline gap-1.5`}
            >
              STAKEY'S
              <span className="text-[#05C147] font-semibold text-xs tracking-wider uppercase font-sans">
                CYCLES
              </span>
            </a>
          </div>

          {/* Zone 2: Clean single-line nav links with hover underlines and active state */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-sm font-medium">
            {/* Customer Portal: available to all logged-in accounts */}
            <button
              type="button"
              onClick={() => setActiveTab('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'customer'
                  ? isDark ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60' : 'bg-white text-neutral-900 shadow-sm border border-neutral-300'
                  : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isStaff ? 'Customer Preview' : 'My Garage & Pass'}</span>
            </button>

            {/* Book Workshop Service Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('booking')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'booking'
                  ? isDark ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60' : 'bg-white text-neutral-900 shadow-sm border border-neutral-300'
                  : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Book Service</span>
            </button>

            {/* Promotions Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('promotions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'promotions'
                  ? isDark ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60' : 'bg-white text-neutral-900 shadow-sm border border-neutral-300'
                  : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Promotions</span>
            </button>

            {/* Staff Terminal: visible & accessible to staff, or prompt PIN for customer sessions */}
            {isStaff ? (
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'staff'
                    ? 'bg-emerald-950/80 text-emerald-300 shadow-sm border border-emerald-500/50'
                    : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Scan className="w-3.5 h-3.5 text-emerald-400" />
                <span>Staff Terminal</span>
                {freshBookingsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.9)] flex items-center gap-1 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                    {freshBookingsCount} NEW
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setModalPinError(null);
                  setModalPinInput('');
                  setShowStaffPinModal(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-neutral-900/60 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                title="Unlock Staff Terminal"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Staff Station</span>
              </button>
            )}

            {/* Deliverables / Architecture Tab (Staff/Admin ONLY) */}
            {isStaff && (
              <button
                type="button"
                onClick={() => setActiveTab('deliverables')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'deliverables'
                    ? isDark ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60' : 'bg-white text-neutral-900 shadow-sm border border-neutral-300'
                    : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Config</span>
              </button>
            )}
          </nav>

          {/* Zone 3: Primary actions & User status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <ThemeToggle showLabel={false} />

            {/* Live PocketBase Service Connection Indicator */}
            <ServiceStatusBadge variant="header" />

            <div className={`hidden sm:flex items-center gap-2 text-xs ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{currentUser.displayName}</span>
              {isStaff ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Staff Verified
                </span>
              ) : (
                <>
                  <span aria-hidden="true" className={isDark ? 'text-neutral-600' : 'text-neutral-400'}>·</span>
                  <span className={`font-mono text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{currentUser.membershipNumber}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={logoutUser}
              className={`px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-rose-400'
                  : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700 hover:text-rose-600'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className={`md:hidden flex items-center gap-1 px-4 py-2 border-t overflow-x-auto ${isDark ? 'border-neutral-800/60 bg-[#090b0e]' : 'border-neutral-200 bg-white'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-900'
                : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isStaff ? 'Customer' : 'Garage'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('booking')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'booking'
                ? isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-900'
                : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Book</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('promotions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'promotions'
                ? isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-900'
                : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Promos</span>
          </button>

          {isStaff ? (
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'staff'
                  ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/50'
                  : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Scan className="w-3.5 h-3.5 text-emerald-400" />
              <span>Terminal</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setModalPinError(null);
                setModalPinInput('');
                setShowStaffPinModal(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 text-amber-400 border border-amber-500/30"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Staff</span>
            </button>
          )}
        </div>
      </header>

      {/* Main App Content */}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Tab Views */}
        {activeTab === 'customer' && <CustomerPortal />}
        {activeTab === 'booking' && <BookingPortal />}
        {activeTab === 'promotions' && <PromotionsCarousel />}
        {activeTab === 'staff' && (
          isStaff ? (
            <StaffPortal />
          ) : (
            <div className="bg-[#0d1015] border border-amber-500/40 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto">
              <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Staff Terminal Locked</h3>
              <p className="text-xs text-neutral-400">
                The Cytech Workshop Terminal requires staff authentication with the master PIN.
              </p>
              <button
                type="button"
                onClick={() => {
                  setModalPinError(null);
                  setModalPinInput('');
                  setShowStaffPinModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Enter Staff PIN
              </button>
            </div>
          )
        )}
        {activeTab === 'deliverables' && isStaff && <DeliverablesViewer />}
      </main>

      {/* Footer with Stakey's Shield Logo */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-neutral-400">
            <StakeysLogo className="w-6 h-6" />
            <span className="font-bold text-white">Stakey's Cycles &amp; Scooter</span> • Workshop Repairs &amp; Customer Loyalty
          </div>
          <div className="flex items-center gap-4 text-neutral-500 text-[11px]">
            <span>Fast Turnaround</span>
            <span>•</span>
            <span>Expert Mechanics</span>
            <span>•</span>
            <span>Digital Stamp Rewards</span>
          </div>
        </div>
      </footer>
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
