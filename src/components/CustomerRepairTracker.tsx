import React, { useState, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Bike,
  Search,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  Calendar,
  Sparkles,
  ChevronRight,
  Check,
  Zap,
  Activity,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  MessageSquarePlus,
  Send,
  Loader2,
  User,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { ServiceBooking, BookingStatus } from '../shared/types/bikeShop';
import { ALL_BIKE_ISSUES_MAP } from '../shared/data/bikeIssuesCatalog';
import { RepairInvoiceModal } from './RepairInvoiceModal';
import {
  REPAIR_STAGES,
  deriveRepairStage,
  formatEstimate,
  matchesRepairQuery,
  repairProgressPercent,
  repairStageIndex,
} from '../shared/utils/repairProgress';

interface CustomerRepairTrackerProps {
  initialBookingId?: string;
  onGoToBooking?: () => void;
}

export const CustomerRepairTracker: React.FC<CustomerRepairTrackerProps> = ({
  initialBookingId,
  onGoToBooking,
}) => {
  const { bookings, currentUser, addRepairProgressNote } = useShop();

  const [searchQuery, setSearchQuery] = useState(initialBookingId || '');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialBookingId || null
  );
  const [viewingInvoice, setViewingInvoice] = useState<ServiceBooking | null>(null);
  const [requestText, setRequestText] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);

  // Relevant bookings for current user if logged in
  const userBookings = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) =>
        b.customerId === currentUser.uid ||
        b.customerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        (b.membershipNumber && b.membershipNumber === currentUser.membershipNumber)
    );
  }, [bookings, currentUser]);

  // Current active or selected booking
  const activeBooking = useMemo(() => {
    if (selectedBookingId) {
      const found = bookings.find((b) => matchesRepairQuery(b, selectedBookingId));
      if (found) return found;
    }

    if (searchQuery.trim()) {
      const found = bookings.find((b) => matchesRepairQuery(b, searchQuery));
      if (found) return found;
    }

    // Default to the logged-in customer's latest repair only. Never fall back to
    // a global booking, so a guest without a matching lookup sees nothing.
    if (userBookings.length > 0) {
      return userBookings[0];
    }

    return null;
  }, [selectedBookingId, searchQuery, bookings, userBookings]);

  // Live workshop position (staff-driven stages, fall back to coarse status).
  const currentStage = useMemo(
    () => (activeBooking ? deriveRepairStage(activeBooking) : 'received'),
    [activeBooking]
  );
  const currentStageIndex = repairStageIndex(currentStage);
  const progressPercent = repairProgressPercent(currentStage);
  const isPaused = currentStage === 'awaiting_approval' || currentStage === 'parts_ordered';
  const isComplete = currentStageIndex >= REPAIR_STAGES.length - 1;

  // Calculate ETA based on current stage
  const etaMessage = useMemo(() => {
    if (!activeBooking || currentStageIndex >= REPAIR_STAGES.length - 1) return 'Repair complete.';

    if (activeBooking.estimateReadyAt) {
      const d = new Date(activeBooking.estimateReadyAt);
      if (!Number.isNaN(d.getTime())) {
        return `Estimated ready: ${d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
      }
    }

    const remaining = REPAIR_STAGES.slice(currentStageIndex + 1);
    const totalMinutes = remaining.reduce((sum, stage) => {
      const match = stage.estimate.match(/[0-9]+/g);
      if (match) return sum + match.reduce((a, b) => a + parseInt(b), 0);
      return sum;
    }, 0);

    if (totalMinutes === 0) return 'Ready for final inspection shortly.';
    return `Estimated completion: within ${totalMinutes} mins`;
  }, [currentStageIndex, activeBooking]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const found = bookings.find((b) => matchesRepairQuery(b, searchQuery));
    if (found) {
      setSelectedBookingId(found.id);
    }
  };

  /** Customer asks the workshop to look at something extra, at any time. */
  const handleSendRequest = async () => {
    if (!activeBooking || !requestText.trim()) return;
    setRequestBusy(true);
    setRequestFeedback(null);
    try {
      const res = await addRepairProgressNote(activeBooking.id, requestText.trim(), {
        authorRole: 'customer',
        kind: 'customer_note',
        label: 'Customer request',
      });
      if (res.success) {
        setRequestText('');
        setRequestFeedback(res.message || 'Message sent to the workshop.');
      } else {
        setRequestFeedback(res.message || 'Could not send your message.');
      }
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-[#0d1015] shadow-2xl p-6 sm:p-10">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#05C147_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#05C147] animate-ping" />
              Live Workshop Telemetry
            </div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Customer Repair Progress Tracker
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Track your bicycle or e-scooter live on Stakey’s workshop stand. View inspection milestones, real-time parts fitted, and your itemized invoice.
            </p>
          </div>

          {/* Quick Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:w-80 bg-neutral-950/90 border border-neutral-800 p-2 rounded-2xl shadow-lg space-y-2"
          >
            <div className="text-[11px] font-mono text-neutral-400 font-bold uppercase px-2 pt-1">
              Look Up Any Repair
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Booking # (e.g. bk-1001), phone, or email"
                className="w-full bg-[#090b0e] border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <span>Track Live Status</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* User's active repairs pill tray if logged in */}
        {userBookings.length > 1 && (
          <div className="relative z-10 pt-6 mt-6 border-t border-neutral-800/80 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-mono text-neutral-400 shrink-0">Your Active Repairs:</span>
            {userBookings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBookingId(b.id);
                  setSearchQuery(b.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  activeBooking?.id === b.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                }`}
              >
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <span>#{b.id}</span>
                <span className="font-normal text-neutral-300">({b.vehicleModel.split(' ')[0]})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeBooking ? (
        <div className="space-y-8">
          {/* Main Status Spotlight Card */}
          <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
            {/* Ambient glow that follows the live stage colour */}
            <div
              className={`absolute -top-24 left-1/2 -translate-x-1/2 w-2/3 h-40 rounded-full blur-3xl pointer-events-none opacity-40 tracker-breathe ${
                isComplete
                  ? 'bg-emerald-500/40'
                  : isPaused
                  ? 'bg-amber-500/30'
                  : 'bg-purple-500/30'
              }`}
            />
            {/* Top Info Bar */}
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-[#05C147] shrink-0 font-black">
                  {activeBooking.vehicleCategory === 'electric_scooter' ? (
                    <Zap className="w-6 h-6" />
                  ) : (
                    <Bike className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Booking #{activeBooking.id}
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {activeBooking.vehicleModel}
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {activeBooking.serviceTitle} · Drop-off: {activeBooking.preferredDate} ({activeBooking.preferredTimeSlot})
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="sm:text-right">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800">
                  <span className={`w-2 h-2 rounded-full ${
                    activeBooking.status === 'ready_for_pickup' || activeBooking.status === 'completed'
                      ? 'bg-[#05C147]'
                      : activeBooking.status === 'in_progress'
                      ? 'bg-purple-400 animate-pulse'
                      : 'bg-amber-400 animate-pulse'
                  }`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {activeBooking.status === 'ready_for_pickup'
                      ? 'Ready for Collection'
                      : activeBooking.status === 'in_progress'
                      ? 'On Workshop Bench'
                      : activeBooking.status === 'confirmed'
                      ? 'Intake Scheduled'
                      : activeBooking.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE WORKSHOP PROGRESS TIMELINE */}
            <div className="relative space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400 font-mono">
                <span>
                  Workshop Progress: Stage {currentStageIndex + 1} of {REPAIR_STAGES.length} ·{' '}
                  <span className="text-white font-bold">{REPAIR_STAGES[currentStageIndex].title}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {activeBooking.estimateReadyAt ? formatEstimate(activeBooking.estimateReadyAt) : etaMessage}
                </span>
              </div>

              {/* Progress bar background */}
              <div className="relative w-full h-2.5 bg-neutral-900 rounded-full overflow-visible border border-neutral-800 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out progress-shimmer ${
                    isPaused
                      ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.6)]'
                      : 'bg-gradient-to-r from-emerald-500 to-[#05C147] shadow-[0_0_16px_rgba(5,193,71,0.65)]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
                {/* "You are here" marker with three bouncing dots leading the fill */}
                {!isComplete && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/70 tracker-glow"
                    style={{ left: `${progressPercent}%` }}
                  >
                    <span className="tracker-dot tracker-dot--bright" />
                    <span className="tracker-dot tracker-dot--bright" />
                    <span className="tracker-dot tracker-dot--bright" />
                  </div>
                )}
                {isComplete && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full bg-[#05C147] text-neutral-950 flex items-center justify-center tracker-glow-strong"
                    style={{ left: '100%' }}
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Timeline Step Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                {REPAIR_STAGES.map((stg, idx) => {
                  const isDone = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div
                      key={stg.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2 relative animate-rise ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-400/80 shadow-xl shadow-emerald-500/20 tracker-glow-strong scale-[1.02]'
                          : isDone
                          ? 'bg-neutral-950/70 border-neutral-800/90 text-neutral-300'
                          : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 opacity-60'
                      }`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      {/* "You are here" flag on the live stage */}
                      {isCurrent && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/40 whitespace-nowrap">
                          <span className="tracker-dot tracker-dot--dark" />
                          <span className="tracker-dot tracker-dot--dark" />
                          <span className="tracker-dot tracker-dot--dark" />
                          You are here
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isDone
                              ? 'bg-emerald-500 text-neutral-950'
                              : isCurrent
                              ? 'bg-[#05C147] text-neutral-950 animate-bounce'
                              : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>

                        {isCurrent && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                          </span>
                        )}
                      </div>

                      <div>
                        <div className={`text-xs font-bold leading-tight ${isCurrent ? 'text-white' : isDone ? 'text-neutral-200' : 'text-neutral-500'}`}>
                          {stg.title}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1 leading-snug line-clamp-2">
                          {stg.description}
                        </p>
                      </div>

                      <div className="pt-1.5 border-t border-neutral-800/80 font-mono text-[9px] text-neutral-500 flex items-center justify-between">
                        <span>{stg.estimate}</span>
                        {isCurrent && <span className="text-emerald-400 font-bold animate-pulse">● ACTIVE</span>}
                        {isDone && <span className="text-emerald-500">DONE</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ASK THE WORKSHOP — customers can message the bench at any time */}
            <div className="relative p-4 rounded-2xl bg-sky-500/5 border border-sky-500/30 space-y-3">
              <div className="flex items-center gap-2 text-sky-200 font-bold text-sm">
                <MessageSquarePlus className="w-4 h-4" />
                Ask the Workshop
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Spotted something else while you wait — a wobbly headset, a squeaky brake? Add a request
                here at any time and the mechanic will see it on the bench. They can reply with an update
                below.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  rows={2}
                  placeholder="e.g. Could you also check the wobbly headset while the bike is in?"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 resize-none"
                />
                <button
                  type="button"
                  disabled={requestBusy || !requestText.trim()}
                  onClick={handleSendRequest}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-stretch sm:self-end pressable"
                >
                  {requestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to bench
                </button>
              </div>
              {requestFeedback && (
                <p className="text-[11px] text-emerald-300 flex items-center gap-1.5 animate-pop">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {requestFeedback}
                </p>
              )}
            </div>

            {/* WORKSHOP TIMELINE — notes & updates from the bench and you */}
            {activeBooking.progressEvents && activeBooking.progressEvents.length > 0 && (
              <div className="relative space-y-2 pt-2">
                <div className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Workshop Updates ({activeBooking.progressEvents.length})
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {activeBooking.progressEvents.slice(0, 20).map((ev) => {
                    const isCustomer = ev.authorRole === 'customer';
                    const isEta = ev.kind === 'eta';
                    const isNote = ev.kind === 'note';
                    return (
                      <div
                        key={ev.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl border text-xs animate-rise ${
                          isCustomer
                            ? 'bg-sky-500/5 border-sky-500/25'
                            : isEta
                            ? 'bg-amber-500/5 border-amber-500/25'
                            : 'bg-neutral-950/80 border-neutral-800'
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg bg-neutral-900 shrink-0 ${
                            isCustomer ? 'text-sky-400' : isEta ? 'text-amber-400' : isNote ? 'text-sky-400' : 'text-[#05C147]'
                          }`}
                        >
                          {isCustomer ? (
                            <User className="w-3.5 h-3.5" />
                          ) : isEta ? (
                            <Calendar className="w-3.5 h-3.5" />
                          ) : isNote ? (
                            <MessageSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Wrench className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-neutral-100 flex items-center gap-1.5">
                              {ev.label}
                              {isCustomer && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[9px] text-neutral-500 shrink-0">
                              {ev.createdAt
                                ? new Date(ev.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                                : ''}
                            </span>
                          </div>
                          {ev.note && <p className="text-neutral-300 mt-0.5 whitespace-pre-line">{ev.note}</p>}
                          {ev.createdBy && <span className="text-[9px] text-neutral-600">by {ev.createdBy}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stage Callout Box */}
            <div className={`relative p-4 rounded-2xl border flex items-start gap-3.5 text-xs ${
              currentStage === 'ready_for_pickup' || currentStage === 'collected'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 tracker-glow'
                : isPaused
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200 tracker-breathe'
                : 'bg-purple-950/30 border-purple-500/40 text-purple-200 tracker-breathe'
            }`}>
              <div className="p-2 rounded-xl bg-neutral-900/90 shrink-0 text-emerald-400 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-white text-sm">
                  {currentStage === 'collected'
                    ? '🎉 Bike Collected — Thanks for Choosing Stakey’s!'
                    : currentStage === 'ready_for_pickup'
                    ? '🎉 Your Bike is Fully Serviced & Ready for Collection!'
                    : currentStage === 'awaiting_approval'
                    ? '📝 Quote Ready — We Need Your Approval'
                    : currentStage === 'parts_ordered'
                    ? '📦 Parts Ordered — Your Repair is Booked In'
                    : currentStage === 'on_the_bench'
                    ? '🛠️ Your Bike is Currently on the Workshop Stand'
                    : '📅 Your Repair is Logged In at the Workshop'}
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  {currentStage === 'collected'
                    ? `This repair is complete and your bike is back with you. A copy of your itemized invoice remains available below.`
                    : currentStage === 'ready_for_pickup'
                    ? `Our workshop mechanic has completed the repair and safety sign-off. Please collect your bike at Stakey's Cycles counter (14 High Street). You can view your itemized receipt below.`
                    : currentStage === 'awaiting_approval'
                    ? `We've inspected your bike and sent a quote. Please review and approve it so we can begin the work.`
                    : currentStage === 'parts_ordered'
                    ? `We've ordered the replacement components. We'll move your bike onto the bench as soon as they arrive.`
                    : currentStage === 'on_the_bench'
                    ? `Mechanics are currently replacing components, tensioning cables, and calibrating tolerances. Final road safety tests will follow.`
                    : currentStage === 'quality_check'
                    ? `Work is done and we're carrying out the final quality control and road test before handover.`
                    : `Your bike is booked in at Stakey's Cycles. ${activeBooking.preferredDate ? `Drop-off: ${activeBooking.preferredDate} (${activeBooking.preferredTimeSlot}).` : ''}`}
                </p>
              </div>
            </div>

            {/* DETAILS GRID: Symptoms Checklist & Invoiced Parts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Left Column: Customer Reported Symptoms & Checks */}
              <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                    Intake Symptoms Checklist
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {activeBooking.selectedIssues?.length || 0} issues monitored
                  </span>
                </div>

                {activeBooking.selectedIssues && activeBooking.selectedIssues.length > 0 ? (
                  <div className="space-y-2">
                    {activeBooking.selectedIssues.map((id) => {
                      const item = ALL_BIKE_ISSUES_MAP.get(id);
                      const isComplete = currentStageIndex >= 3;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              isComplete ? 'bg-emerald-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {isComplete ? '✓' : '•'}
                            </span>
                            <div>
                              <strong className="text-white block">{item?.label || id}</strong>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Category: {item?.category || 'Repair'}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isComplete
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isComplete ? 'Audited & Resolved' : 'Inspecting on Stand'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 italic py-2">
                    Standard comprehensive safety inspection and maintenance.
                  </div>
                )}

                {activeBooking.notes && (
                  <div className="mt-3 p-3 rounded-xl bg-[#090b0e] border border-neutral-800/80 text-xs text-neutral-300">
                    <span className="font-mono text-[10px] uppercase text-neutral-500 block mb-1">
                      Customer / Intake Instructions:
                    </span>
                    <p className="whitespace-pre-line text-neutral-300 italic text-[11px]">
                      {activeBooking.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Invoice & Parts Fitted Breakdown */}
              <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      Workshop Pricing &amp; Parts Fitted
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {activeBooking.invoice ? `Invoice #${activeBooking.invoice.invoiceNumber}` : 'Pricing Quote'}
                    </span>
                  </div>

                  {activeBooking.invoice ? (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {activeBooking.invoice.items.map((it, idx) => (
                          <div
                            key={it.id || idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs"
                          >
                            <div>
                              <span className="text-white font-medium block">{it.description}</span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                Qty: {it.quantity} @ £{it.unitPrice.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-mono text-emerald-400 font-bold">
                              £{it.total.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals Summary */}
                      <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1 text-xs">
                        <div className="flex justify-between text-neutral-400 text-[11px]">
                          <span>Labour Subtotal:</span>
                          <span className="font-mono text-white">£{activeBooking.invoice.labourSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400 text-[11px]">
                          <span>Parts &amp; Consumables:</span>
                          <span className="font-mono text-white">£{activeBooking.invoice.partsSubtotal.toFixed(2)}</span>
                        </div>
                        {activeBooking.invoice.voucherDiscount > 0 && (
                          <div className="flex justify-between text-emerald-400 text-[11px] font-bold">
                            <span>Voucher Credit Applied:</span>
                            <span className="font-mono">-£{activeBooking.invoice.voucherDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline font-bold">
                          <span className="text-white uppercase text-xs">Total Due:</span>
                          <span className="text-emerald-400 font-mono text-base">
                            £{activeBooking.invoice.grandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <Clock className="w-8 h-8 text-neutral-600 mx-auto" />
                      <div className="text-sm font-bold text-white">Ask for a Quote / Pending Sign-Off</div>
                      <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                        Our workshop mechanic is currently evaluating parts and labour. An itemized invoice will appear here as soon as repairs are priced and completed.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-neutral-800 flex flex-wrap gap-2">
                  {activeBooking.invoice && (
                    <button
                      type="button"
                      onClick={() => setViewingInvoice(activeBooking)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md shadow-emerald-500/20"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View &amp; Print Full Invoice</span>
                    </button>
                  )}

                  <a
                    href="tel:+447911882910"
                    className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Call Bench</span>
                  </a>

                  <a
                    href="https://maps.google.com/?q=Stakey's+Cycles+14+High+Street+Bideford"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Not Found State */
        <div className="p-12 rounded-3xl bg-[#0d1015] border border-neutral-800 text-center space-y-4">
          <Wrench className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="font-display text-lg font-bold text-white">No Repair Booking Found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Please enter your Booking ID (e.g. <code>bk-1001</code>), email address, or phone number to look up your workshop bench progress.
          </p>
          {onGoToBooking && (
            <button
              type="button"
              onClick={onGoToBooking}
              className="px-5 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs cursor-pointer transition-colors"
            >
              Book a New Repair Service
            </button>
          )}
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {viewingInvoice && viewingInvoice.invoice && (
        <RepairInvoiceModal
          invoice={viewingInvoice.invoice}
          booking={viewingInvoice}
          isOpen={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          isStaff={false}
        />
      )}
    </div>
  );
};
