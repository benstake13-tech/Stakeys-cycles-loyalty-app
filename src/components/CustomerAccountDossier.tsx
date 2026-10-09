import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  User,
  Bike,
  Wrench,
  Calendar,
  Award,
  Sparkles,
  Ticket,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  Copy,
  Check,
  Edit3,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  Scan,
  Flame,
  Plus,
  FileText,
  Sliders,
  Save,
  RefreshCw,
  Gift,
  Trophy,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, CustomerBike, ServiceBooking, VehicleCategory } from '../types/bikeShop';
import { canCustomerReceiveStampToday } from '../api/firebaseService';
import { wheelAudio } from '../utils/wheelAudio';
import { BIKE_CATEGORY_OPTIONS } from '../data/bikeCatalog';
import { AiBikeIdentifier } from './AiBikeIdentifier';
import { EditBikeModal } from './EditBikeModal';

interface CustomerAccountDossierProps {
  customer: UserProfile;
  onBack: () => void;
  onScanAnother: () => void;
  onOpenScraper?: (customer: UserProfile) => void;
}

export const CustomerAccountDossier: React.FC<CustomerAccountDossierProps> = ({
  customer,
  onBack,
  onScanAnother,
  onOpenScraper,
}) => {
  const {
    currentUser,
    users,
    bookings,
    draws,
    stampLogs,
    addStamp,
    redeemReward,
    updateCustomerPoints,
    addCustomerBikeForUser,
    refreshCustomerGarageForStaff,
    updateCustomerBikeIdentity,
    updateBookingStatus,
  } = useShop();

  const [activeAccountTab, setActiveAccountTab] = useState<'garage' | 'bookings' | 'stamps' | 'rewards' | 'notes'>(
    'garage'
  );
  const [bypassRateLimit, setBypassRateLimit] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Staff note editing state
  const [staffNote, setStaffNote] = useState((customer as any).staffNotes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Add bike modal state
  const [isAddBikeOpen, setIsAddBikeOpen] = useState(false);
  const [isAiBikeOpen, setIsAiBikeOpen] = useState(false);
  const [newBikeCategory, setNewBikeCategory] = useState<VehicleCategory>('cycle');
  const [newBikeBrand, setNewBikeBrand] = useState('Trek');
  const [newBikeModel, setNewBikeModel] = useState('');
  const [newBikeColour, setNewBikeColour] = useState('');
  const [newBikeNotes, setNewBikeNotes] = useState('');
  const [isSavingBike, setIsSavingBike] = useState(false);
  const [isFixingGarage, setIsFixingGarage] = useState(false);
  const [garageFixNote, setGarageFixNote] = useState<string | null>(null);
  // The bike whose details a staff member is editing by hand.
  const [editingBike, setEditingBike] = useState<CustomerBike | null>(null);

  // Get freshest customer data from users array
  const currentCustomer = users.find((u) => u.uid === customer.uid) || customer;
  const staffId = currentUser?.uid || 'staff-ben-001';

  // Customer's bookings & logs
  const customerBookings = bookings.filter(
    (b) =>
      b.customerId === currentCustomer.uid ||
      b.customerEmail?.toLowerCase() === currentCustomer.email?.toLowerCase() ||
      (b.membershipNumber && b.membershipNumber === currentCustomer.membershipNumber)
  );

  const customerLogs = stampLogs.filter((l) => l.customerId === currentCustomer.uid);
  const rateLimitStatus = canCustomerReceiveStampToday(currentCustomer);
  const stamps = currentCustomer.stamps || 0;
  const tickets = currentCustomer.tickets || 0;
  const points = currentCustomer.points || 0;
  const bikes = currentCustomer.bikes || [];
  const isRewardReady = stamps >= 10;

  // Prizes this member holds: collected service vouchers plus any prize draws
  // they have won. Both are shown on the account so staff see the full picture.
  const serviceVouchers = currentCustomer.serviceVouchers || [];
  const prizeWins = (draws || []).filter((d) => d.winnerUid === currentCustomer.uid);
  const prizeCount = serviceVouchers.length + prizeWins.length;

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentCustomer.membershipNumber);
    setCopiedId(true);
    wheelAudio.playScannerBeep();
    setTimeout(() => setCopiedId(false), 2000);
  };

  /**
   * "Fix My Garage" — repairs the persistent "bikes exist but are not showing"
   * case for THIS customer. Re-homes legacy membership-keyed rows to the profile
   * UUID, re-reads strictly by UUID, drops anything that is not theirs, and
   * refreshes the roster. Reports exactly what was found/removed/re-homed, or
   * the raw RLS/query error so the cause is visible.
   */
  const handleFixGarage = async () => {
    setIsFixingGarage(true);
    setGarageFixNote(null);
    try {
      // An explicit staff "Fix" is the one place allowed to drop rows that are
      // not this customer's, so opt into the destructive cleanup here.
      const res = await refreshCustomerGarageForStaff(currentCustomer.uid, {
        expectedMin: bikes.length,
        deleteStale: true,
      });
      if (res.error) {
        setGarageFixNote(`Could not fully repair — ${res.error}`);
      } else {
        const bits = [`${res.found} bike${res.found === 1 ? '' : 's'} loaded`];
        if (res.reassigned) bits.push(`${res.reassigned} re-homed`);
        if (res.removed) bits.push(`${res.removed} removed`);
        setGarageFixNote(`Garage repaired — ${bits.join(', ')}.`);
      }
    } catch (e: any) {
      setGarageFixNote(`Repair failed — ${e?.message || 'unknown error'}`);
    } finally {
      setIsFixingGarage(false);
    }
  };

  // The roster never loads bikes for anyone but the signed-in account, so a
  // dossier opened for another customer (e.g. Chloe) always showed an empty
  // garage even when the rows existed. Load this customer's garage from the
  // database once when the dossier opens — read-only, no destructive cleanup.
  const garageLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    const uid = currentCustomer.uid;
    if (!uid || garageLoadedFor.current === uid) return;
    garageLoadedFor.current = uid;
    setIsFixingGarage(true);
    refreshCustomerGarageForStaff(uid, { deleteStale: false })
      .catch(() => {})
      .finally(() => setIsFixingGarage(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCustomer.uid]);

  // Add Stamp Action
  const handleApplyStamp = async () => {
    wheelAudio.playScannerBeep();
    const res = await addStamp(currentCustomer.uid, staffId, bypassRateLimit);
    setFeedback({ success: res.success, message: res.message });

    if (res.success) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#05C147', '#10b981', '#34d399', '#ffffff'],
        });
      } catch {}
    }
  };

  // Redeem Reward Action
  const handleRedeemReward = async () => {
    const res = await redeemReward(
      currentCustomer.uid,
      staffId,
      '£40 Full Workshop Service Voucher (Labour Credit)'
    );
    setFeedback({ success: res.success, message: res.message });

    if (res.success) {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#a855f7', '#05C147', '#f59e0b', '#ffffff'],
        });
      } catch {}
    }
  };

  // Award Ticket Action
  const handleAwardTicket = async () => {
    const res = await updateCustomerPoints(currentCustomer.uid, staffId, {
      tickets: tickets + 1,
      staffNote: 'Prize draw ticket awarded at front till',
    });
    setFeedback({ success: res.success, message: res.message });
  };

  // Save Staff Note
  const handleSaveStaffNote = async () => {
    setIsSavingNote(true);
    try {
      const res = await updateCustomerPoints(currentCustomer.uid, staffId, {
        staffNote: staffNote.trim(),
      });
      setFeedback({ success: res.success, message: 'Customer workshop notes saved.' });
    } finally {
      setIsSavingNote(false);
    }
  };

  // Add Bike to customer's account
  const handleCreateBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBikeBrand || !newBikeModel.trim()) return;

    setIsSavingBike(true);
    try {
      const catObj = BIKE_CATEGORY_OPTIONS.find((c) => c.id === newBikeCategory);
      await addCustomerBikeForUser(currentCustomer.uid, {
        category: newBikeCategory,
        categoryLabel: catObj ? catObj.title.split(' ')[0] : 'Bicycle',
        brand: newBikeBrand,
        model: newBikeModel.trim(),
        colour: newBikeColour.trim() || undefined,
        frameSizeOrNotes: newBikeNotes.trim() || undefined,
        healthStatus: 'healthy',
      });

      setFeedback({
        success: true,
        message: `Registered ${newBikeBrand} ${newBikeModel} to ${currentCustomer.displayName}'s garage.`,
      });
      setIsAddBikeOpen(false);
      setNewBikeModel('');
      setNewBikeColour('');
      setNewBikeNotes('');
    } catch {
      setFeedback({ success: false, message: 'Failed to add bike to customer garage.' });
    } finally {
      setIsSavingBike(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. TOP NAVIGATION / RETURN BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0d1015] p-3.5 sm:p-4 rounded-2xl border border-neutral-800 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-800"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Till / Back</span>
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          <div className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">CUSTOMER ACCOUNT DOSSIER</span>
            <span>•</span>
            <span className="text-white">{currentCustomer.displayName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onScanAnother}
          className="px-4 py-1.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/15"
        >
          <Scan className="w-4 h-4" />
          <span>Scan Next Barcode</span>
        </button>
      </div>

      {/* 2. CUSTOMER IDENTITY HERO CARD */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-500/40 bg-gradient-to-r from-[#0d1015] via-[#11161d] to-[#0d1015] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Customer Info */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#05C147] to-emerald-400 flex items-center justify-center font-display font-extrabold text-2xl text-neutral-950 shadow-xl shadow-emerald-500/20 shrink-0">
              {currentCustomer.displayName.charAt(0)}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {currentCustomer.displayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Verified Member
                </span>
              </div>

              {/* Contact info & Member ID */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300 font-mono">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="bg-neutral-900/90 hover:bg-neutral-800 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Copy Member ID"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span className="font-bold">{currentCustomer.membershipNumber}</span>
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-400/60" />}
                </button>

                <span className="flex items-center gap-1 text-neutral-400">
                  <Mail className="w-3.5 h-3.5 text-neutral-500" />
                  {currentCustomer.email}
                </span>

                {currentCustomer.phoneNumber && (
                  <span className="flex items-center gap-1 text-neutral-400">
                    <Phone className="w-3.5 h-3.5 text-neutral-500" />
                    {currentCustomer.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Key Balances Counters */}
          <div className="flex items-center gap-3 sm:gap-4 bg-neutral-950/80 p-4 rounded-2xl border border-neutral-800 shrink-0">
            <div className="text-center px-2">
              <div className="text-[10px] uppercase font-mono font-bold text-neutral-400">
                Visit Stamps
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-black text-[#05C147] tabular-nums mt-0.5">
                {stamps}
                <span className="text-xs text-neutral-500 font-normal">/10</span>
              </div>
            </div>

            <div className="w-px h-10 bg-neutral-800" />

            <div className="text-center px-2">
              <div className="text-[10px] uppercase font-mono font-bold text-neutral-400 flex items-center justify-center gap-1">
                <Ticket className="w-3 h-3 text-amber-400" />
                <span>Draw Tickets</span>
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tabular-nums mt-0.5">
                {tickets}
              </div>
            </div>

            <div className="w-px h-10 bg-neutral-800" />

            <div className="text-center px-2">
              <div className="text-[10px] uppercase font-mono font-bold text-neutral-400">
                Garage Rides
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                {bikes.length}
              </div>
            </div>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs animate-fade-in ${
              feedback.success
                ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-600 text-rose-200'
            }`}
          >
            {feedback.success ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* 3. DIRECT FRONT-DESK / TILL ACTIONS BAR */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#05C147]" />
              Front-Desk Till Actions &amp; Stamp Terminal
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Issue daily visit stamps, redeem reward vouchers, or schedule service for {currentCustomer.displayName}.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <input
              type="checkbox"
              checked={bypassRateLimit}
              onChange={(e) => setBypassRateLimit(e.target.checked)}
              className="rounded border-neutral-700 text-emerald-500 focus:ring-0 bg-neutral-950"
            />
            <span>Staff Override (Bypass 1-stamp/day limit)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: Apply +1 Stamp */}
          <button
            type="button"
            onClick={handleApplyStamp}
            disabled={!rateLimitStatus.allowed && !bypassRateLimit}
            className={`p-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md ${
              rateLimitStatus.allowed || bypassRateLimit
                ? 'bg-[#05C147] hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20 active:scale-95 cursor-pointer'
                : 'bg-neutral-850 text-neutral-500 border border-neutral-800 cursor-not-allowed'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply +1 Visit Stamp</span>
          </button>

          {/* Action 2: Redeem Reward (Active if 10/10) */}
          <button
            type="button"
            onClick={handleRedeemReward}
            disabled={!isRewardReady}
            className={`p-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md ${
              isRewardReady
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25 active:scale-95 cursor-pointer ring-2 ring-purple-400/50'
                : 'bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{isRewardReady ? 'Redeem £40 Service' : 'Reward (10 Stamps Needed)'}</span>
          </button>

          {/* Action 3: Award Prize Ticket */}
          <button
            type="button"
            onClick={handleAwardTicket}
            className="p-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Ticket className="w-4 h-4 text-amber-400" />
            <span>+1 Draw Ticket</span>
          </button>

          {/* Action 4: Register Bike */}
          <button
            type="button"
            onClick={() => setIsAddBikeOpen(true)}
            className="p-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Bike className="w-4 h-4 text-emerald-400" />
            <span>Add Bike to Garage</span>
          </button>
        </div>

        {/* Rate limit status info strip */}
        <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
          <div>
            {rateLimitStatus.allowed ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Customer is eligible to receive today's visit stamp.
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Stamp already received today ({new Date(currentCustomer.lastStampedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Use override checkbox if authorized.
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-neutral-500">Till Operator: {staffId}</span>
        </div>
      </div>

      {/* 4. ACCOUNT SECTIONS TABS */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0b0e13] rounded-2xl border border-neutral-800/90 overflow-x-auto shadow-md">
        <button
          type="button"
          onClick={() => setActiveAccountTab('garage')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeAccountTab === 'garage'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Bike className="w-4 h-4 text-emerald-400" />
          <span>Registered Garage ({bikes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAccountTab('bookings')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeAccountTab === 'bookings'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-400" />
          <span>Workshop Bookings ({customerBookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAccountTab('stamps')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeAccountTab === 'stamps'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-400" />
          <span>Loyalty Pass &amp; Audit ({stamps}/10)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAccountTab('rewards')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeAccountTab === 'rewards'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Gift className="w-4 h-4 text-amber-400" />
          <span>Rewards &amp; Prizes ({prizeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAccountTab('notes')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeAccountTab === 'notes'
              ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Mechanic Notes &amp; Specs</span>
        </button>
      </div>

      {/* 5. TAB CONTENT */}

      {/* TAB A: REGISTERED GARAGE */}
      {activeAccountTab === 'garage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400" />
              <span>Customer's Garage &amp; Registered Rides</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFixGarage}
                disabled={isFixingGarage}
                data-testid="fix-my-garage"
                title="Re-fetch this customer's bikes, re-home legacy rows and clear anything that isn't theirs"
                className="pressable px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isFixingGarage ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" />
                )}
                <span>{isFixingGarage ? 'Fixing…' : 'Fix My Garage'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAiBikeOpen(true)}
                className="pressable px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Identify with AI</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddBikeOpen(true)}
                className="pressable px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Vehicle</span>
              </button>
            </div>
          </div>

          {garageFixNote && (
            <div
              data-testid="garage-fix-note"
              className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{garageFixNote}</span>
            </div>
          )}

          {bikes.length === 0 ? (
            <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-10 text-center space-y-3">
              <Bike className="w-10 h-10 text-neutral-600 mx-auto" />
              <div className="text-sm font-bold text-white">No Bikes Registered Yet</div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Add this customer's bike or scooter to track workshop history, OEM parts, and service schedules.
              </p>
              <button
                type="button"
                onClick={() => setIsAddBikeOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs cursor-pointer"
              >
                Register First Bike
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bikes.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#0e1217] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 space-y-3 transition-all shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400">
                        {b.categoryLabel || 'Bicycle'}
                      </div>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {b.brand} {b.model}
                      </h4>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-emerald-300 border border-neutral-800">
                      {b.healthStatus || 'Healthy'}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400 space-y-1 font-mono">
                    {b.colour && <div>Colour: <span className="text-neutral-200">{b.colour}</span></div>}
                    {b.frameSizeOrNotes && <div>Notes: <span className="text-neutral-300">{b.frameSizeOrNotes}</span></div>}
                  </div>

                  {b.stockSpecsScraped && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>OEM Specs Scraped ({b.scrapedData?.components.length || 0} parts)</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingBike(b)}
                      data-testid={`dossier-edit-bike-${b.id}`}
                      className="flex-1 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Edit Details</span>
                    </button>
                    {onOpenScraper && (
                      <button
                        type="button"
                        onClick={() => onOpenScraper(currentCustomer)}
                        className="flex-1 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Inspect OEM Parts</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB B: WORKSHOP BOOKINGS */}
      {activeAccountTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>Workshop Bookings &amp; Service History</span>
            </h3>
          </div>

          {customerBookings.length === 0 ? (
            <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-10 text-center text-neutral-400 text-xs">
              No service bookings on record for this customer.
            </div>
          ) : (
            <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl divide-y divide-neutral-800/80 overflow-hidden shadow-xl">
              {customerBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-mono text-emerald-400 font-bold">#{b.id}</span>
                      <span>•</span>
                      <span className="text-white font-medium">{b.vehicleModel}</span>
                    </div>

                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{b.serviceTitle}</span>
                      <span className="font-mono text-emerald-400">£{b.servicePrice}</span>
                    </div>

                    <div className="text-xs text-neutral-400 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        {b.preferredDate} ({b.preferredTimeSlot})
                      </span>
                    </div>
                  </div>

                  {/* Booking Status & Quick Update */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-900 text-emerald-300 border border-neutral-700">
                      {b.status}
                    </span>

                    {b.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => updateBookingStatus(b.id, 'confirmed')}
                        className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer"
                      >
                        Confirm
                      </button>
                    )}

                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => updateBookingStatus(b.id, 'in_progress')}
                        className="px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold cursor-pointer"
                      >
                        Start Work
                      </button>
                    )}

                    {b.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => updateBookingStatus(b.id, 'ready_for_collection' as any)}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs cursor-pointer"
                      >
                        Ready for Collection
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB C: LOYALTY PASS & AUDIT LOGS */}
      {activeAccountTab === 'stamps' && (
        <div className="space-y-4">
          <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div>
                <h4 className="text-base font-bold text-white">Digital Pass Stamp Tracker</h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  10 visit stamps unlock a £40 Workshop Labour Credit.
                </p>
              </div>
              <span className="font-mono text-lg font-black text-[#05C147]">
                {stamps} / 10
              </span>
            </div>

            {/* 10-stamp visual tracker */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-12 rounded-xl flex items-center justify-center font-mono font-bold transition-all ${
                    i < stamps
                      ? stamps >= 10
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-[#05C147] text-neutral-950 shadow-md shadow-emerald-500/25'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-600'
                  }`}
                >
                  {i < stamps ? <Check className="w-5 h-5 stroke-[3]" /> : i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Timestamped Visit &amp; Stamp Audit Log</span>
            </h4>

            {customerLogs.length === 0 ? (
              <div className="text-neutral-500 text-xs py-4 text-center">
                No previous stamp events recorded for this customer.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80">
                {customerLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-white font-semibold capitalize">{log.action.replace('_', ' ')}</span>
                      {log.note && <span className="text-neutral-400 ml-2">({log.note})</span>}
                    </div>
                    <div className="text-neutral-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB C2: REWARDS & PRIZES — vouchers held and prize draws won */}
      {activeAccountTab === 'rewards' && (
        <div className="space-y-4">
          {/* Service vouchers */}
          <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>Service Vouchers &amp; Rewards</span>
              </h4>
              <span className="font-mono text-sm text-neutral-400">{serviceVouchers.length} held</span>
            </div>

            {serviceVouchers.length === 0 ? (
              <div className="text-neutral-500 text-xs py-6 text-center">
                No service vouchers on this account yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {serviceVouchers.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{v.title || v.code}</span>
                      <span className="font-mono text-lg font-black text-amber-300">£{v.value}</span>
                    </div>
                    {v.description && <p className="text-[11px] text-neutral-400">{v.description}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-neutral-500">{v.code}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          v.status === 'redeemed'
                            ? 'bg-neutral-900 border-neutral-700 text-neutral-500'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prize draws won */}
          <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Prize Draw Wins</span>
              </h4>
              <span className="font-mono text-sm text-neutral-400">{prizeWins.length} won</span>
            </div>

            {prizeWins.length === 0 ? (
              <div className="text-neutral-500 text-xs py-6 text-center">
                {currentCustomer.displayName} has not won a prize draw yet.
              </div>
            ) : (
              <div className="space-y-2">
                {prizeWins.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-emerald-500/30 bg-neutral-950 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{d.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate">{d.prizeDescription}</div>
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500 shrink-0">
                      {d.completedAt ? new Date(d.completedAt).toLocaleDateString() : 'Won'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB D: MECHANIC NOTES & SPECS */}
      {activeAccountTab === 'notes' && (
        <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Internal Workshop Notes &amp; Rider Preferences</span>
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Staff notes visible only to workshop mechanics (e.g. suspension PSI, tubeless sealant date, favourite tire pressure).
              </p>
            </div>
          </div>

          <textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            rows={5}
            placeholder="e.g. Commutes on FX 3 daily (20km). Prefers Finish Line Ceramic Wet Lube. Dropper post cable replaced Sept 2026..."
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveStaffNote}
              disabled={isSavingNote}
              className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingNote ? 'Saving...' : 'Save Workshop Notes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ADD BIKE MODAL FOR STAFF */}
      {isAddBikeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-emerald-400" />
                <span>Add Bike for {currentCustomer.displayName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddBikeOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBike} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Category
                </label>
                <select
                  value={newBikeCategory}
                  onChange={(e) => setNewBikeCategory(e.target.value as VehicleCategory)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="cycle">Bicycle / Cycle</option>
                  <option value="electric_scooter">Electric Scooter</option>
                  <option value="cargo_bike">Cargo Bike</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Brand <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBikeBrand}
                  onChange={(e) => setNewBikeBrand(e.target.value)}
                  placeholder="e.g. Trek, Specialized, Giant, Xiaomi"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Model <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBikeModel}
                  onChange={(e) => setNewBikeModel(e.target.value)}
                  placeholder="e.g. FX 3 Disc, Pro 2, Allez"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Colour
                </label>
                <input
                  type="text"
                  value={newBikeColour}
                  onChange={(e) => setNewBikeColour(e.target.value)}
                  placeholder="e.g. Matte Black, Viper Red"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Frame Size or Mechanic Notes
                </label>
                <input
                  type="text"
                  value={newBikeNotes}
                  onChange={(e) => setNewBikeNotes(e.target.value)}
                  placeholder="e.g. Size M (54cm), tubeless setup"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBikeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBike}
                  className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  {isSavingBike ? 'Saving...' : 'Add to Garage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual edit of one of this customer's bikes */}
      {editingBike && (
        <EditBikeModal
          bike={editingBike}
          title="Edit customer bike details"
          subtitle={`Correct the make, model, colour, serial and e-bike conversion details for ${currentCustomer.displayName}'s bike. Saved to the workshop record.`}
          onSave={async (patch) => {
            const res = await updateCustomerBikeIdentity(editingBike.id, patch, currentCustomer.uid);
            if (res.success) {
              setFeedback({ success: true, message: 'Bike details updated.' });
              return true;
            }
            return false;
          }}
          onClose={() => setEditingBike(null)}
        />
      )}

      {/* AI Bike Identifier — adds straight to this customer's garage */}
      <AiBikeIdentifier
        user={currentCustomer}
        isOpen={isAiBikeOpen}
        onClose={() => setIsAiBikeOpen(false)}
        addBike={(bike: CustomerBike) => addCustomerBikeForUser(currentCustomer.uid, bike)}
        onAdded={(bike: CustomerBike) =>
          setFeedback({
            success: true,
            message: `AI identified and registered ${bike.brand} ${bike.model} to ${currentCustomer.displayName}'s garage.`,
          })
        }
      />
    </div>
  );
};
