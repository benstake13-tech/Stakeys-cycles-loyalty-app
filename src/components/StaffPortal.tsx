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
  Tag,
  UserPlus,
  Trash2,
  Sliders,
  Volume2,
  VolumeX,
  Bell,
  RefreshCcw,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, PrizeWheelSegment, PrizeDraw } from '../types/bikeShop';

import { PrizeWheelModal } from './PrizeWheelModal';
import { WheelEditorModal } from './WheelEditorModal';
import { StaffBookingsTab } from './StaffBookingsTab';
import { CustomerDatabaseTab } from './CustomerDatabaseTab';
import { StaffManagementTab } from './StaffManagementTab';
import { PromotionsManagerTab } from './PromotionsManagerTab';
import { ServiceStatusBadge } from './ServiceStatusBadge';
import { AdminDashboard } from './AdminDashboard';

import { GoogleBusinessTab } from './GoogleBusinessTab';
import { FinancialReportingTab } from './FinancialReportingTab';
import { StaffThemeSelector } from './StaffThemeSelector';
import { canCustomerReceiveStampToday } from '../api/firebaseService';

export const StaffPortal: React.FC = () => {
  const {
    currentUser,
    users = [], // Default to empty array
    prizeWheels,
    draws,
    stampLogs,
    bookings,
    staffMembers,
    promotions,
    addStamp,
    redeemReward,
    updateWheel,
    executePrizeDraw,
    createDraw,
    updateDraw,
    deleteDraw,
    isStaffBookingSoundEnabled,
    toggleStaffBookingSound,
    playStaffBookingAlertPing,
    workshopAudioVolume,
    cycleWorkshopAudioVolume,
    hardResetApp,
  } = useShop();

  const [staffTab, setStaffTab] = useState<
    | 'dashboard'
    | 'bookings'
    | 'staff_roster'
    | 'promotions'
    | 'customers'
    | 'draws'
    | 'logs'
    | 'financials'
    | 'google_business'
  >('dashboard');

  const [searchQuery, setSearchQuery] = useState('STK-839201');
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(() => {
    return users?.find((u) => u.membershipNumber === 'STK-839201') || null;
  });

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
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
  const [newDrawDate, setNewDrawDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Edit Draw form state
  const [editingDraw, setEditingDraw] = useState<PrizeDraw | null>(null);
  const [editDrawTitle, setEditDrawTitle] = useState('');
  const [editDrawPrize, setEditDrawPrize] = useState('');
  const [editDrawDate, setEditDrawDate] = useState('');

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
      newDrawTitle.trim(),
      newDrawPrize.trim(),
      newDrawDate ? new Date(newDrawDate) : new Date(Date.now() + 14 * 24 * 3600 * 1000)
    );
    setNewDrawTitle('');
    setNewDrawPrize('');
    setShowNewDrawModal(false);
    setActionFeedback({
      success: true,
      message: 'New periodic prize draw announced and scheduled!',
    });
  };

  const handleOpenEditDraw = (draw: PrizeDraw) => {
    setEditingDraw(draw);
    setEditDrawTitle(draw.title);
    setEditDrawPrize(draw.prizeDescription);
    setEditDrawDate(
      draw.drawDate ? new Date(draw.drawDate).toISOString().split('T')[0] : ''
    );
  };

  const handleSaveEditDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraw || !editDrawTitle.trim()) return;

    await updateDraw(editingDraw.id, {
      title: editDrawTitle.trim(),
      prizeDescription: editDrawPrize.trim(),
      drawDate: editDrawDate ? new Date(editDrawDate) : new Date(editingDraw.drawDate),
    });
    setEditingDraw(null);
    setActionFeedback({
      success: true,
      message: `Prize draw entry "${editDrawTitle}" updated successfully!`,
    });
  };

  const handleDeleteDraw = async (drawId: string, title: string) => {
    if (confirm(`Are you sure you want to delete prize draw "${title}"?`)) {
      await deleteDraw(drawId);
      setActionFeedback({
        success: true,
        message: `Prize draw "${title}" removed from schedule.`,
      });
    }
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

  // Fresh, unreviewed repair bookings requiring workshop bench intake
  const freshBookings = bookings.filter(
    (b) => b.status === 'pending' || b.approvalStatus === 'pending_approval'
  );
  const latestFresh = freshBookings[0] || null;

  return (
    <div className="space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. TOP COMMAND BAR: Online Service Status & Diagnostics */}
      <ServiceStatusBadge variant="full" />

      {/* 1B. UNMISSABLE BRIGHT VISUAL ALERT: FRESH & UNREVIEWED WORKSHOP BOOKINGS */}
      {freshBookings.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-emerald-500/25 border-2 border-amber-400 p-5 sm:p-6 shadow-[0_0_35px_rgba(245,158,11,0.45)] animate-fade-in text-white">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/50 shrink-0 animate-bounce">
                <Bell className="w-6 h-6 text-neutral-950" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-neutral-950 tracking-wider uppercase shadow-sm flex items-center gap-1.5 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                    NEW BOOKING ALERT
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    ⚡ {freshBookings.length} Fresh Request{freshBookings.length > 1 ? 's' : ''} Awaiting Bench Capacity Review
                  </span>
                </div>
                {latestFresh && (
                  <p className="text-xs sm:text-sm font-semibold text-white mt-1.5">
                    Latest Request: <strong className="text-amber-300 font-extrabold">{latestFresh.customerName}</strong> (<span className="text-neutral-200">{latestFresh.vehicleModel}</span> • <span className="text-emerald-400 font-bold">{latestFresh.serviceTitle}</span>) scheduled for <strong className="text-white font-mono">{latestFresh.preferredDate}</strong> ({latestFresh.preferredTimeSlot})
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStaffTab('bookings')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-400/40 flex items-center justify-center gap-2 cursor-pointer border border-amber-300 hover:scale-[1.02]"
              >
                <Wrench className="w-4 h-4 text-neutral-950" />
                <span>Review {freshBookings.length} Fresh Booking{freshBookings.length > 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs shadow-inner">
                <span className={`w-2 h-2 rounded-full ${isStaffBookingSoundEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                <span className="text-neutral-400 text-[11px] font-medium">Audio Alert:</span>
                <span className={`font-mono text-[11px] font-bold ${isStaffBookingSoundEnabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {isStaffBookingSoundEnabled ? 'LOUD PING ACTIVE' : 'MUTED'}
                </span>

                {isStaffBookingSoundEnabled && (
                  <button
                    type="button"
                    onClick={cycleWorkshopAudioVolume}
                    className="px-2 py-0.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30 transition-colors cursor-pointer"
                    title="Toggle loudness boost"
                  >
                    🔊 {workshopAudioVolume === 'max_workshop' ? 'MAX (220%)' : workshopAudioVolume === 'loud' ? 'LOUD (160%)' : 'NORMAL (100%)'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={playStaffBookingAlertPing}
                  className="ml-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-[10px] tracking-wide uppercase transition-colors cursor-pointer border border-emerald-500/30 flex items-center gap-1"
                  title="Test loud workshop bell ping sound"
                >
                  <Bell className="w-3 h-3 text-emerald-400" />
                  <span>Test Loud Ping</span>
                </button>
                <button
                  type="button"
                  onClick={toggleStaffBookingSound}
                  className="px-1.5 py-0.5 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title={isStaffBookingSoundEnabled ? 'Mute booking ping' : 'Unmute booking ping'}
                >
                  {isStaffBookingSoundEnabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {isStaff && (
                <div className="mt-4">
                  <StaffThemeSelector />
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setStaffTab('bookings')}
              className={`p-3 rounded-xl bg-neutral-950 border text-left transition-all cursor-pointer relative overflow-hidden ${
                freshBookings.length > 0
                  ? 'border-amber-400/90 shadow-[0_0_18px_rgba(245,158,11,0.3)] hover:border-amber-300'
                  : 'border-neutral-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Workshop Jobs
                </div>
                {freshBookings.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 animate-pulse border border-amber-300 shadow-sm flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-600 animate-ping" />
                    {freshBookings.length} NEW
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {activeBookingsCount}{' '}
                <span className="text-xs text-neutral-500 font-normal">Active</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStaffTab('staff_roster')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Staff Roster
              </div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {staffMembers.length}{' '}
                <span className="text-xs text-neutral-500 font-normal">Active</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStaffTab('promotions')}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Promotions
              </div>
              <div className="text-xl font-black text-amber-400 mt-0.5">
                {promotions.filter((p) => p.status === 'active').length}{' '}
                <span className="text-xs text-neutral-500 font-normal">Live</span>
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
          onClick={() => setStaffTab('dashboard')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'dashboard'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('bookings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'bookings'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-400" />
          <span>Workshop Bookings</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {bookings.length}
          </span>
          {freshBookings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 animate-pulse border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
              ⚡ {freshBookings.length} NEW
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('staff_roster')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'staff_roster'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Staff Management</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {staffMembers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('promotions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'promotions'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Tag className="w-4 h-4 text-amber-400" />
          <span>Promotions Manager</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {promotions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('customers')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'customers'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Loyalty Members</span>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            {customerList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('draws')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
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
          onClick={() => setStaffTab('scanner')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'scanner'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Scan className="w-4 h-4 text-emerald-400" />
          <span>Barcode Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'logs'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>Audit Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setStaffTab('financials')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'financials'
              ? 'bg-emerald-950 text-emerald-300 shadow-md border border-emerald-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Financial Reports</span>
        </button>

        <div className="w-px h-6 bg-neutral-800 mx-2" />

        <button
          type="button"
          onClick={() => setStaffTab('google_business')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            staffTab === 'google_business'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Are you absolutely sure you want to clean the slate? This will clear all local app data and reload the page.')) {
              hardResetApp();
            }
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer text-rose-400 hover:text-white hover:bg-rose-950/60 border border-rose-900"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>Clean Slate</span>
        </button>
      </div>

      {/* 4. WORKSTATION VIEWS */}

      {/* VIEW 0: Workshop Metrics & Loyalty Admin Dashboard */}
      {staffTab === 'dashboard' && <AdminDashboard />}

      {/* VIEW 1: Service Bookings Management */}
      {staffTab === 'bookings' && <StaffBookingsTab />}

      {/* VIEW 1B: Staff Management Module (Full CRUD) */}
      {staffTab === 'staff_roster' && <StaffManagementTab />}

      {/* VIEW 1C: Promotions Manager (Full CRUD) */}
      {staffTab === 'promotions' && <PromotionsManagerTab />}

      {/* VIEW 1D: Derailleur Hanger Identifier Module */}
      {/* Removed */}

      {/* VIEW 2: Bike OEM Stock Parts Scraper & Upgrade Inspector */}
      {/* Removed */}

      {/* VIEW 3: Financial Reporting Tab */}
      {staffTab === 'financials' && <FinancialReportingTab />}

      {/* VIEW 7: Google Business Profile Tab */}
      {staffTab === 'google_business' && <GoogleBusinessTab />}

      {/* VIEW 3: Customer Database Roster */}
      {staffTab === 'customers' && (
        <CustomerDatabaseTab
          onSelectForScanner={(cust) => {
            handleSelectCustomer(cust);
            setStaffTab('scanner');
          }}
        />
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
                  const formattedDate = draw.drawDate
                    ? new Date(draw.drawDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Scheduled';

                  return (
                    <div
                      key={draw.id}
                      className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2.5 hover:border-neutral-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{draw.title}</span>
                          <span className="text-[11px] font-mono text-neutral-400">
                            • {formattedDate}
                          </span>
                        </div>
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

                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {draw.prizeDescription}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                        <Ticket className="w-3.5 h-3.5 text-amber-400" />
                        <span>Requires: 1 Prize Draw Ticket (Earned via 10-stamp full card)</span>
                      </div>

                      {draw.winnerName && (
                        <div className="text-xs text-emerald-400 font-semibold pt-1 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" />
                          Winner: {draw.winnerName}
                        </div>
                      )}

                      {/* Staff CRUD & Execution Toolbar */}
                      <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDraw(draw)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3 h-3 text-emerald-400" />
                            <span>Edit Entry</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDraw(draw.id, draw.title)}
                            className="p-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 hover:text-rose-200 text-[11px] cursor-pointer transition-colors"
                            title="Delete prize draw entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isUpcoming && (
                          <button
                            type="button"
                            onClick={() => handleRunDraw(draw.id)}
                            disabled={runningDrawId === draw.id}
                            className="py-1.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                          >
                            <Dices className="w-3.5 h-3.5" />
                            <span>{runningDrawId === draw.id ? 'Running...' : 'Execute Draw'}</span>
                          </button>
                        )}
                      </div>
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

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Draw Scheduled End Date
                </label>
                <input
                  type="date"
                  required
                  value={newDrawDate}
                  onChange={(e) => setNewDrawDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
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

      {/* Edit Draw Entry Modal */}
      {editingDraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-500" />
              Edit Prize Draw Entry
            </h3>

            <form onSubmit={handleSaveEditDraw} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Draw Title / Event Name
                </label>
                <input
                  type="text"
                  required
                  value={editDrawTitle}
                  onChange={(e) => setEditDrawTitle(e.target.value)}
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
                  value={editDrawPrize}
                  onChange={(e) => setEditDrawPrize(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Draw Scheduled End Date
                </label>
                <input
                  type="date"
                  required
                  value={editDrawDate}
                  onChange={(e) => setEditDrawDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDraw(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold uppercase text-[11px] cursor-pointer"
                >
                  Save Changes
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
