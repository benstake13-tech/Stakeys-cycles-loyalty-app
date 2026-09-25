import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Search,
  Scan,
  UserCheck,
  PlusCircle,
  Award,
  Sparkles,
  Trophy,
  History,
  Settings,
  Plus,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Dices,
  Bike,
  Edit3,
  Megaphone,
  Wrench,
  Users,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  Ticket,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, PrizeWheelSegment } from '../types/bikeShop';
import { BarcodeVisual } from './BarcodeVisual';
import { PrizeWheelModal } from './PrizeWheelModal';
import { WheelEditorModal } from './WheelEditorModal';
import { StaffBookingsTab } from './StaffBookingsTab';
import { CustomerDatabaseTab } from './CustomerDatabaseTab';
import { BikeScraperTab } from './BikeScraperTab';
import { ServiceStatusBadge } from './ServiceStatusBadge';
import { canCustomerReceiveStampToday } from '../api/firebaseService';

export const StaffPortal: React.FC = () => {
  const {
    currentUser,
    users,
    prizeWheels,
    draws,
    stampLogs,
    bookings,
    addStamp,
    redeemReward,
    updateWheel,
    executePrizeDraw,
    createDraw,
  } = useShop();

  const [staffTab, setStaffTab] = useState<
    'bookings' | 'scraper' | 'scanner' | 'customers' | 'draws' | 'logs'
  >('bookings');

  const [searchQuery, setSearchQuery] = useState('STK-839201');
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(() => {
    return users.find((u) => u.membershipNumber === 'STK-839201') || null;
  });

  const [bypassRateLimit, setBypassRateLimit] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    success?: boolean;
    message: string;
  } | null>(null);

  // Prize draw runner state
  const [runningDrawId, setRunningDrawId] = useState<string | null>(null);
  const [drawWinnerModal, setDrawWinnerModal] = useState<any | null>(null);

  // New Draw form state
  const [showNewDrawModal, setShowNewDrawModal] = useState(false);
  const [newDrawTitle, setNewDrawTitle] = useState('');
  const [newDrawPrize, setNewDrawPrize] = useState('');

  // Wheel preview & editor
  const [previewWheel, setPreviewWheel] = useState<any | null>(null);
  const [isEditingWheel, setIsEditingWheel] = useState(false);

  // Log filter
  const [logFilterAction, setLogFilterAction] = useState<string>('all');

  if (!currentUser) return null;

  const activeWheel = prizeWheels[0] || null;

  // Search logic
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim().toUpperCase();
    const found = users.find(
      (u) =>
        u.role === 'customer' &&
        (u.membershipNumber.toUpperCase() === clean ||
          u.uid.toUpperCase() === clean ||
          u.displayName.toUpperCase().includes(clean) ||
          u.email.toUpperCase().includes(clean))
    );

    if (found) {
      setSelectedCustomer(found);
      setActionFeedback(null);
    } else {
      setActionFeedback({
        success: false,
        message: `No customer record found matching "${searchQuery}".`,
      });
    }
  };

  // Quick select customer
  const handleSelectCustomer = (cust: UserProfile) => {
    setSelectedCustomer(cust);
    setSearchQuery(cust.membershipNumber);
    setActionFeedback(null);
  };

  // Add Stamp Action
  const handleAddStamp = async () => {
    if (!selectedCustomer) return;
    const res = await addStamp(selectedCustomer.uid, currentUser.uid, bypassRateLimit);
    setActionFeedback({ success: res.success, message: res.message });

    // Refresh selected customer state
    const refreshed = users.find((u) => u.uid === selectedCustomer.uid);
    if (refreshed) {
      setSelectedCustomer(refreshed);
    }
  };

  // Redeem Reward Action
  const handleRedeemTuneUp = async () => {
    if (!selectedCustomer) return;
    const res = await redeemReward(
      selectedCustomer.uid,
      currentUser.uid,
      'Complimentary Pro Drivetrain Clean & Safety Tune'
    );
    setActionFeedback({ success: res.success, message: res.message });
  };

  // Trigger Prize Draw Execution
  const handleRunDraw = async (drawId: string) => {
    setRunningDrawId(drawId);
    try {
      const res = await executePrizeDraw(drawId);
      if (res.success) {
        setDrawWinnerModal(res);
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ffffff'],
        });
      } else {
        setActionFeedback({ success: false, message: res.message });
      }
    } finally {
      setRunningDrawId(null);
    }
  };

  // Save new Draw
  const handleCreateDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrawTitle || !newDrawPrize) return;

    await createDraw(
      newDrawTitle,
      newDrawPrize,
      new Date(Date.now() + 14 * 24 * 3600 * 1000)
    );
    setNewDrawTitle('');
    setNewDrawPrize('');
    setShowNewDrawModal(false);
    setActionFeedback({
      success: true,
      message: 'New periodic prize draw announced and scheduled!',
    });
  };

  // Toggle active wheel
  const handleToggleWheelActive = async () => {
    if (!activeWheel) return;
    await updateWheel(activeWheel.id, { active: !activeWheel.active });
  };

  // Rate limit status for current selected customer
  const rateLimitStatus = selectedCustomer
    ? canCustomerReceiveStampToday(selectedCustomer)
    : { allowed: true };

  const eligibleTicketHolders = users.filter(
    (u) => u.role === 'customer' && (u.tickets || 0) > 0
  );

  const customerList = users.filter((u) => u.role === 'customer');
  const rewardReadyCount = customerList.filter((u) => (u.stamps || 0) >= 10).length;
  const activeBookingsCount = bookings.filter(
    (b) => b.status !== 'completed' && b.status !== 'cancelled'
  ).length;

  return (
    <div className="space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. TOP COMMAND BAR: Online Service Status & Diagnostics */}
      <ServiceStatusBadge variant="full" />

      {/* 2. STATION OVERVIEW & METRICS BAR */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
              <span className="text-emerald-400 font-semibold tracking-wider uppercase">
                Staff Command Station
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>Operator: {currentUser.displayName}</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="text-neutral-500 font-mono text-[11px]">{currentUser.membershipNumber}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Workshop Terminal &amp; Front Desk
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Organized workshop management: manage service bookings, inspect customer bikes &amp; OEM specs, stamp loyalty cards, and manage prize wheels.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setStaffTab('bookings')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Workshop Jobs
              </div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {activeBookingsCount}{' '}
                <span className="text-xs text-neutral-500 font-normal">Active</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStaffTab('customers')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Reward Ready
              </div>
              <div className="text-xl font-black text-amber-400 mt-0.5">
                {rewardReadyCount}{' '}
                <span className="text-xs text-neutral-500 font-normal">Riders</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStaffTab('customers')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Total Riders
              </div>
              <div className="text-xl font-black text-white mt-0.5">
                {customerList.length}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStaffTab('draws')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Draw Pool
              </div>
              <div className="text-xl font-black text-emerald-300 mt-0.5">
                {eligibleTicketHolders.length}{' '}
                <span className="text-xs text-neutral-500 font-normal">Entries</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 3. WORKSTATION NAVIGATOR: Clean, High-Affordance Switcher */}
      <div className="bg-[#0b0e13] border border-neutral-800/90 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto shadow-md">
        <button
          type="button"
          onClick={() => setStaffTab('bookings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'bookings'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-400" />
          <span>Workshop Bookings &amp; Intake</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {bookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('scraper')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'scraper'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Bike className="w-4 h-4 text-emerald-400" />
          <span>Bike Stock Scraper &amp; Upgrades</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            OEM Intel
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('scanner')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'scanner'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Scan className="w-4 h-4 text-emerald-400" />
          <span>Loyalty Till &amp; Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('customers')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'customers'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Customer Roster &amp; Garage</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {customerList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('draws')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'draws'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Trophy className="w-4 h-4 text-emerald-400" />
          <span>Prize Draws &amp; Wheel Hub</span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'logs'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>Stamp Audit History</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {stampLogs.length}
          </span>
        </button>
      </div>

      {/* 4. WORKSTATION VIEWS */}

      {/* VIEW 1: Service Bookings Management */}
      {staffTab === 'bookings' && <StaffBookingsTab />}

      {/* VIEW 2: Bike OEM Stock Parts Scraper & Upgrade Inspector */}
      {staffTab === 'scraper' && <BikeScraperTab initialCustomer={selectedCustomer} />}

      {/* VIEW 3: Customer Database Roster */}
      {staffTab === 'customers' && (
        <CustomerDatabaseTab
          onSelectForScanner={(cust) => {
            handleSelectCustomer(cust);
            setStaffTab('scanner');
          }}
        />
      )}

      {/* VIEW 4: Loyalty Till & Scanner */}
      {staffTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Quick Lookup & Barcode Search (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-500" />
                Member Barcode Scan &amp; Till Search
              </h3>

              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Scan barcode or type STK-839201..."
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  Find
                </button>
              </form>

              {/* Quick Select Pill Strip */}
              <div className="mt-4 pt-3 border-t border-neutral-800/80">
                <span className="text-[11px] text-neutral-400 font-mono block mb-2">
                  Quick Select Active Riders:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {customerList.slice(0, 6).map((cust) => (
                    <button
                      key={cust.uid}
                      type="button"
                      onClick={() => handleSelectCustomer(cust)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        selectedCustomer?.uid === cust.uid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                      }`}
                    >
                      {cust.displayName.split(' ')[0]}{' '}
                      <span className="font-mono text-[10px] opacity-75">
                        ({cust.membershipNumber})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Customer Card */}
            {selectedCustomer ? (
              <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-600 flex items-center justify-center font-bold text-neutral-950 text-lg shadow-md">
                      {selectedCustomer.displayName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">
                        {selectedCustomer.displayName}
                      </h4>
                      <div className="text-xs text-neutral-400 font-mono">
                        {selectedCustomer.membershipNumber}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    VERIFIED MEMBER
                  </span>
                </div>

                {/* Stats Counters */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                    <div className="text-[11px] font-semibold text-neutral-400 uppercase">
                      Active Stamps
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      {selectedCustomer.stamps || 0}{' '}
                      <span className="text-xs text-neutral-500 font-normal">/ 10</span>
                    </div>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                    <div className="text-[11px] font-semibold text-neutral-400 uppercase">
                      Draw Tickets
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      {selectedCustomer.tickets || 0}{' '}
                      <span className="text-xs text-neutral-500 font-normal">Entries</span>
                    </div>
                  </div>
                </div>

                {/* Rate limit status pill */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                  {rateLimitStatus.allowed ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Eligible for today's visit stamp.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400 font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span className="leading-tight">
                        Stamp already added today (
                        {new Date(selectedCustomer.lastStampedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        ).
                      </span>
                    </div>
                  )}
                </div>

                {/* Staff Action Buttons */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bypassRateLimit}
                        onChange={(e) => setBypassRateLimit(e.target.checked)}
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0 bg-neutral-950"
                      />
                      <span>Staff Override (Bypass 1-stamp/day limit)</span>
                    </label>
                  </div>

                  <button
                    onClick={handleAddStamp}
                    disabled={!rateLimitStatus.allowed && !bypassRateLimit}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      rateLimitStatus.allowed || bypassRateLimit
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Apply +1 Visit Stamp to Customer
                  </button>

                  <button
                    onClick={handleRedeemTuneUp}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-neutral-700 transition-all cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-emerald-400" />
                    Redeem Perk (Safety Check / Tune)
                  </button>
                </div>

                {/* Action feedback */}
                {actionFeedback && (
                  <div
                    className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs animate-fade-in ${
                      actionFeedback.success
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                        : 'bg-rose-950/80 border border-rose-700 text-rose-200'
                    }`}
                  >
                    {actionFeedback.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{actionFeedback.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-8 text-center text-neutral-500">
                <Scan className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
                <p className="text-sm">Scan a barcode or search a customer to begin.</p>
              </div>
            )}
          </div>

          {/* Right Column: Customer Garage & Quick Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedCustomer ? (
              <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2 text-white font-bold text-base">
                    <Bike className="w-5 h-5 text-emerald-500" />
                    Rider's Registered Garage &amp; Bikes
                  </div>
                  <button
                    type="button"
                    onClick={() => setStaffTab('scraper')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Scrape Stock Specs</span>
                  </button>
                </div>

                {selectedCustomer.bikes && selectedCustomer.bikes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCustomer.bikes.map((bike) => (
                      <div
                        key={bike.id}
                        className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">
                            {bike.brand} {bike.model}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-900 text-emerald-400 border border-neutral-800 font-mono">
                            {bike.categoryLabel}
                          </span>
                        </div>
                        {bike.colour && (
                          <div className="text-xs text-neutral-400 font-mono">
                            Colour: {bike.colour}
                          </div>
                        )}
                        {bike.stockSpecsScraped && (
                          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>OEM Specs Verified ({bike.scrapedData?.components.length || 0} parts)</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setStaffTab('scraper')}
                          className="w-full py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer border border-neutral-800"
                        >
                          <span>Inspect Parts &amp; Upgrades</span>
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-800 text-center text-neutral-500 text-xs">
                    No bikes currently registered in customer garage.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-8 text-center text-neutral-500">
                <Users className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
                <p className="text-sm">Select a member to view garage bikes and fast rewards.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 5: Prize Draws & Wheel Hub */}
      {staffTab === 'draws' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Draws List (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div>
                  <div className="flex items-center gap-2 text-white font-bold text-base">
                    <Trophy className="w-5 h-5 text-emerald-500" />
                    Periodic Customer Prize Draws
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Eligible: {eligibleTicketHolders.length} riders with active ticket entries.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewDrawModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Schedule Draw
                </button>
              </div>

              <div className="space-y-3">
                {draws.map((draw) => {
                  const isUpcoming = draw.status === 'upcoming';
                  return (
                    <div
                      key={draw.id}
                      className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{draw.title}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isUpcoming
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}
                        >
                          {draw.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">{draw.prizeDescription}</p>
                      {draw.winnerName && (
                        <div className="text-xs text-emerald-400 font-semibold pt-1 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" />
                          Winner: {draw.winnerName}
                        </div>
                      )}
                      {isUpcoming && (
                        <button
                          type="button"
                          onClick={() => handleRunDraw(draw.id)}
                          disabled={runningDrawId === draw.id}
                          className="w-full mt-2 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          <Dices className="w-4 h-4" />
                          {runningDrawId === draw.id ? 'Executing Draw...' : 'Execute Draw Now'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Wheel Configuration (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {activeWheel && (
              <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div>
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                      Prize Wheel Slices &amp; Odds
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Wheel: <strong className="text-neutral-200">{activeWheel.title}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingWheel(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Odds</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewWheel(activeWheel)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs border border-neutral-700 cursor-pointer"
                    >
                      Test Spin
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleWheelActive}
                      className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                      title="Toggle active status"
                    >
                      {activeWheel.active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeWheel.segments.map((seg, idx) => (
                    <div
                      key={seg.id || idx}
                      className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-semibold text-neutral-200">{seg.label}</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold bg-neutral-900 px-2 py-0.5 rounded text-[11px]">
                        {Math.round((seg.probability || 0.1) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 6: Stamp Audit History */}
      {staffTab === 'logs' && (
        <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <History className="w-5 h-5 text-emerald-500" />
                Live Staff Stamp &amp; Reward Audit Trail
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Full chronological ledger of visit stamps, merit adjustments, and perks redeemed across all workshop stations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logFilterAction}
                onChange={(e) => setLogFilterAction(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Actions ({stampLogs.length})</option>
                <option value="add_stamp">Visit Stamps Only</option>
                <option value="redeem_reward">Reward Redemptions</option>
                <option value="manual_merit_adjustment">Merit Adjustments</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950">
            {stampLogs
              .filter((l) => logFilterAction === 'all' || l.action === logFilterAction)
              .map((log) => (
                <div
                  key={log.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-neutral-900/40 transition-colors text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {log.customerName}
                      </span>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        ({log.membershipNumber || log.customerId})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-800 text-neutral-300">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-neutral-400 text-[11px]">
                      {log.note || 'Stamp updated'} • Handled by Staff ID:{' '}
                      <span className="text-neutral-300 font-mono">{log.staffName || log.staffId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400 text-xs">
                        {log.stampsAfter !== undefined ? `${log.stampsAfter}/10 Stamps` : ''}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Winner Celebration Modal */}
      {drawWinnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
              Winner Declared!
            </div>
            <h3 className="text-2xl font-black text-white">{drawWinnerModal.winner?.displayName}</h3>
            <p className="text-xs font-mono text-neutral-400 mt-0.5">
              Membership: {drawWinnerModal.winner?.membershipNumber}
            </p>

            <div className="my-5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Prize Package:</span>
                <span className="text-white font-bold">{drawWinnerModal.prizeTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Entries in Pool:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {drawWinnerModal.totalEntries} entries
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Participants:</span>
                <span className="text-neutral-300 font-mono">
                  {drawWinnerModal.uniqueParticipants} riders
                </span>
              </div>
            </div>

            <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2 text-xs text-emerald-300 font-semibold">
              <Megaphone className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>Broadcast Announcement sent to all riders and customer portals!</span>
            </div>

            <button
              onClick={() => setDrawWinnerModal(null)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Close &amp; Notify Winner
            </button>
          </div>
        </div>
      )}

      {/* Schedule Draw Modal */}
      {showNewDrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-white shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-500" />
              Schedule Periodic Prize Draw
            </h3>

            <form onSubmit={handleCreateDraw} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Draw Title / Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Winter Tubeless Upgrade Package"
                  value={newDrawTitle}
                  onChange={(e) => setNewDrawTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Prize Package Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. $300 store credit, carbon cage, and premium tune-up..."
                  value={newDrawPrize}
                  onChange={(e) => setNewDrawPrize(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDrawModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold uppercase text-[11px] cursor-pointer"
                >
                  Schedule Draw
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Spin Modal for Staff */}
      {previewWheel && (
        <PrizeWheelModal
          wheel={previewWheel}
          isOpen={true}
          onClose={() => setPreviewWheel(null)}
          onPrizeWon={(seg) => {
            setActionFeedback({
              success: true,
              message: `Staff preview spin completed: landed on "${seg.label}".`,
            });
          }}
          canSpin={true}
        />
      )}

      {/* Wheel Editor Modal for Staff */}
      {activeWheel && (
        <WheelEditorModal
          wheel={activeWheel}
          isOpen={isEditingWheel}
          onClose={() => setIsEditingWheel(false)}
          onSave={(updated) => {
            updateWheel(activeWheel.id, updated);
            setActionFeedback({
              success: true,
              message: 'Prize Wheel updated successfully!',
            });
          }}
        />
      )}
    </div>
  );
};
