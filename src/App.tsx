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
import { POCKETBASE_URL } from './pocketbase';

function AppContent() {
  const { currentUser, logoutUser, loginStaffWithPin } = useShop();
  const [showGuestBooking, setShowGuestBooking] = useState(false);
  const [activeTab, setActiveTab] = useState<'customer' | 'booking' | 'staff' | 'deliverables'>('customer');

  // Quick Staff Terminal PIN modal state for quick shop switching
  const [showStaffPinModal, setShowStaffPinModal] = useState(false);
  const [modalPinInput, setModalPinInput] = useState('');
  const [modalPinError, setModalPinError] = useState<string | null>(null);

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';

  // Keep activeTab in sync with user role changes without violating Hook rules
  React.useEffect(() => {
    if (currentUser) {
      const isStaffUser = currentUser.role === 'staff' || currentUser.role === 'admin';
      setActiveTab(isStaffUser ? 'staff' : 'customer');
    }
  }, [currentUser?.role, currentUser?.uid]);

  const handleUnlockStaffWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalPinError(null);
    const clean = modalPinInput.trim();
    if (clean !== STAFF_MASTER_PIN) {
      setModalPinError('Access Denied: Incorrect Security PIN.');
      return;
    }

    const res = await loginStaffWithPin('staff-ben-001', clean);
    if (res.success) {
      setShowStaffPinModal(false);
      setModalPinInput('');
      setActiveTab('staff');
    } else {
      setModalPinError(res.message || 'Staff authentication failed');
    }
  };

  // 1. FIRST SCREEN: If user is not authenticated, show LoginScreen or Guest Booking
  if (!currentUser) {
    if (showGuestBooking) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
          <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-2xl bg-neutral-900 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 shrink-0">
                  <StakeysLogo className="w-10 h-10" />
                </div>
                <div>
                  <span className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                    STAKEYS
                    <span className="text-[12px] font-bold text-[#05C147] tracking-normal uppercase">
                      Cycles &amp; Scooter
                    </span>
                  </span>
                  <div className="text-[11px] text-neutral-400 font-mono">Workshop Service Booking</div>
                </div>
              </div>
              <button
                onClick={() => setShowGuestBooking(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
              >
                Back to Sign In
              </button>
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Broadcast Winner Announcement to Everybody */}
      <WinnerAnnouncementBanner />

      {/* Top Navigation Bar: Strict 3-zone contract */}
      <header className="sticky top-0 z-40 bg-[#090b0e]/95 backdrop-blur-md border-b border-neutral-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand title, single element */}
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-xl bg-neutral-900 border border-emerald-500/30 text-emerald-400 shrink-0">
              <StakeysLogo className="w-7 h-7" />
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(isStaff ? 'staff' : 'customer');
              }}
              className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-baseline gap-1.5"
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'customer'
                  ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isStaff ? 'Customer Preview' : 'My Garage & Pass'}</span>
            </button>

            {/* Book Workshop Service Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('booking')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'booking'
                  ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Book Service</span>
            </button>

            {/* Staff Terminal: visible & accessible to staff, or prompt PIN for customer sessions */}
            {isStaff ? (
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'staff'
                    ? 'bg-emerald-950/80 text-emerald-300 shadow-sm border border-emerald-500/50'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Scan className="w-3.5 h-3.5 text-emerald-400" />
                <span>Staff Terminal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setModalPinError(null);
                  setModalPinInput('');
                  setShowStaffPinModal(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-neutral-900 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'deliverables'
                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Config</span>
              </button>
            )}
          </nav>

          {/* Zone 3: Primary actions & User status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live PocketBase Service Connection Indicator */}
            <ServiceStatusBadge variant="header" />

            <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-300">
              <span className="font-semibold text-white">{currentUser.displayName}</span>
              {isStaff ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Staff Verified
                </span>
              ) : (
                <>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className="text-neutral-400 font-mono text-[11px]">{currentUser.membershipNumber}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={logoutUser}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-rose-400 transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className="md:hidden flex items-center gap-1 px-4 py-2 border-t border-neutral-800/60 overflow-x-auto bg-[#090b0e]">
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isStaff ? 'Customer' : 'My Garage'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('booking')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'booking'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Book Service</span>
          </button>
          {isStaff ? (
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'staff'
                  ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/50'
                  : 'text-neutral-400 hover:text-white'
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
              <span>Staff Station</span>
            </button>
          )}
          {isStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('deliverables')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'deliverables'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Config</span>
            </button>
          )}
        </div>
      </header>

      {/* Quick Staff Terminal Master PIN Modal */}
      {showStaffPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Unlock Workshop Staff Terminal</span>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffPinModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              Enter the Cytech Workshop Security PIN to switch to the Staff Terminal.
            </p>

            {modalPinError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalPinError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockStaffWithPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Staff Security PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  maxLength={6}
                  value={modalPinInput}
                  onChange={(e) => {
                    setModalPinInput(e.target.value.replace(/\D/g, ''));
                    setModalPinError(null);
                  }}
                  placeholder="••••••"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Quick keypad */}
              <div className="grid grid-cols-3 gap-1.5 text-sm font-mono">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (modalPinInput.length < 6) {
                        setModalPinInput((p) => p + digit);
                        setModalPinError(null);
                      }
                    }}
                    className="py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold text-center cursor-pointer active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setModalPinInput('')}
                  className="py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 text-xs font-sans cursor-pointer active:scale-95"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (modalPinInput.length < 6) {
                      setModalPinInput((p) => p + '0');
                      setModalPinError(null);
                    }
                  }}
                  className="py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold text-center cursor-pointer active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setModalPinInput((p) => p.slice(0, -1))}
                  className="py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 text-xs font-sans cursor-pointer active:scale-95"
                >
                  ⌫
                </button>
              </div>

              <button
                type="submit"
                disabled={modalPinInput.length === 0}
                className="w-full py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Terminal</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'customer' && <CustomerPortal />}
        {activeTab === 'booking' && <BookingPortal />}
        {activeTab === 'staff' && isStaff && <StaffPortal />}
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
      <AppContent />
    </ShopProvider>
  );
}
