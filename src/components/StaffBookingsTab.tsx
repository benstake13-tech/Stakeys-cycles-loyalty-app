import React, { useEffect, useRef, useState } from 'react';
import {
  Wrench,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Calendar,
  Phone,
  User,
  AlertCircle,
  Eye,
  Settings,
  Send,
  Filter,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Zap,
  Bike,
  Volume2,
  VolumeX,
  Bell,
  FileText,
  AlertTriangle,
  Trash2,
  Siren,
  RefreshCw,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ServiceBooking, BookingStatus, VehicleCategory, RepairInvoice, ReminderChannel, ReminderRecipients, DEFAULT_REMINDER_SETTINGS, clampNumber } from '../types/bikeShop';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { StakeysLogo } from './StakeysLogo';
import { FaceAvatar } from './FaceAvatar';
import { findCustomerForBooking } from '../utils/bookingCustomer';
import { ALL_BIKE_ISSUES_MAP } from '../data/bikeIssuesCatalog';
import { dispatchTestEmail } from '../utils/notificationService';
import { vehicleNouns } from '../utils/vehicleType';
import { RepairCompletionModal } from './RepairCompletionModal';
import { RepairInvoiceModal } from './RepairInvoiceModal';
import { StaffRepairProgressPanel } from './StaffRepairProgressPanel';
import { ClearBookingsModal } from './ClearBookingsModal';
import { PhoneBookingPanel } from './PhoneBookingPanel';
import { StaffSosPanel } from './StaffSosPanel';
import { isSosBooking } from '../utils/sosRepair';

interface StaffBookingsTabProps {
  /** Booking id to scroll to and highlight after a notification tap. */
  focusBookingId?: string | null;
  /** Called once the focus request has been consumed. */
  onFocusHandled?: () => void;
}

/**
 * A collapsed-by-default accordion panel used for the top-level system tools.
 * The header stays visible (with its status badges); the body is unmounted
 * while closed and slides in on open.
 */
interface CollapsiblePanelProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** Status pills kept visible on the header even when collapsed. */
  badges?: React.ReactNode;
  /** Actions always visible in the header (e.g. quick toggles). */
  headerActions?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  icon,
  title,
  subtitle,
  badges,
  headerActions,
  isOpen,
  onToggle,
  children,
}) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl overflow-hidden">
    <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex items-center gap-4 text-left min-w-0 flex-1 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#05C147] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">{title}</h3>
            {badges}
          </div>
          {subtitle && <div className="text-xs text-neutral-400 mt-0.5">{subtitle}</div>}
        </div>
      </button>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {headerActions}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
    {isOpen && (
      <div className="overflow-hidden">
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 animate-slide-down">{children}</div>
      </div>
    )}
  </div>
);

export const StaffBookingsTab: React.FC<StaffBookingsTabProps> = ({ focusBookingId, onFocusHandled }) => {
  const {
    bookings,
    approveBooking,
    declineBooking,
    updateBookingStatus,
    setRepairStage,
    addRepairProgressNote,
    updateBookingQuote,
    saveRepairInvoice,
    updateInvoicePaymentStatus,
    currentUser,
    ownerConfig,
    updateOwnerConfig,
    automatedRemindersEnabled,
    setAutomatedRemindersEnabled,
    reminderSettings,
    setReminderSettings,
    bookingsDueIn24h,
    dispatch24hReminderForBooking,
    isStaffBookingSoundEnabled,
    toggleStaffBookingSound,
    playStaffBookingAlertPing,
    workshopAudioVolume,
    cycleWorkshopAudioVolume,
    requestPushNotificationPermission,
    repairBookingsLedger,
    users,
  } = useShop();

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  // Completed/cancelled jobs are hidden from the default feed so a busy
  // workshop isn't cluttered; they live behind the "Completed" toggle.
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [bookingView, setBookingView] = useState<'queue' | 'sos' | 'phone'>('queue');
  const [selectedBookingForPreview, setSelectedBookingForPreview] = useState<ServiceBooking | null>(null);

  // "Fix Bookings" repair state + result note.
  const [isFixingBookings, setIsFixingBookings] = useState(false);
  const [bookingsFixNote, setBookingsFixNote] = useState<string | null>(null);

  // Resolve the roster profile behind a booking so we show the customer's real
  // customised avatar on the correct card (guests fall back to a seeded face).
  const findCustomerProfile = (b: ServiceBooking) => findCustomerForBooking(b, users);

  // Highlighted booking from a notification deep link (auto-clears).
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  // Invoice & Repair Completion Modal States
  const [completingBooking, setCompletingBooking] = useState<ServiceBooking | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<{ invoice: RepairInvoice; booking: ServiceBooking } | null>(null);

  // Approval / Decline Modal States
  const [approvingBooking, setApprovingBooking] = useState<ServiceBooking | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [estimatePrice, setEstimatePrice] = useState('');
  const [estimateNote, setEstimateNote] = useState('');
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const [decliningBooking, setDecliningBooking] = useState<ServiceBooking | null>(null);
  const [declineReason, setDeclineReason] = useState('Workshop capacity limit on requested date');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);

  const [quotingBooking, setQuotingBooking] = useState<ServiceBooking | null>(null);
  const [quotedPrice, setQuotedPrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [isQuoting, setIsQuoting] = useState(false);

  // Launch prep: wipe the whole booking list
  const [isClearBookingsOpen, setIsClearBookingsOpen] = useState(false);

  // Action toast / feedback
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'warning' | 'danger';
    message: string;
  } | null>(null);

  // Settings State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [targetEmail, setTargetEmail] = useState(ownerConfig.ownerEmail);
  const [targetPhone, setTargetPhone] = useState(ownerConfig.ownerPhone);
  const [emailAlerts, setEmailAlerts] = useState(ownerConfig.emailAlertsEnabled);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [testAlertSent, setTestAlertSent] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Progressive disclosure: every system tool starts collapsed, and each booking
  // card expands individually so the feed stays scannable on a phone.
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});
  const togglePanel = (id: string) => setOpenPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleBooking = (id: string) => setExpandedBookings((prev) => ({ ...prev, [id]: !prev[id] }));

  // "Finished" jobs = completed or cancelled. They are split out of the active
  // feed so a busy workshop stays uncluttered.
  const isFinished = (b: ServiceBooking) => b.status === 'completed' || b.status === 'cancelled';

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (selectedStatusFilter !== 'all' && b.status !== selectedStatusFilter) return false;
    if (selectedVehicleFilter !== 'all' && b.vehicleCategory !== selectedVehicleFilter) return false;
    // Active/Completed is a hard split: the active feed never shows finished
    // jobs and the completed feed never shows active ones. A specific status
    // pill (e.g. "completed") takes precedence.
    if (selectedStatusFilter === 'all' && showCompleted !== isFinished(b)) return false;
    return true;
  });

  const pendingCount = bookings.filter(
    (b) => b.status === 'pending' || b.approvalStatus === 'pending_approval'
  ).length;

  const completedCount = bookings.filter(isFinished).length;

  // Notification deep link: reveal the target booking regardless of the active
  // filters, scroll it into view and flash a highlight so staff spot it.
  useEffect(() => {
    if (!focusBookingId) return;
    const target = bookings.find((b) => b.id === focusBookingId);
    if (!target) return;
    setSelectedStatusFilter('all');
    setSelectedVehicleFilter('all');
    // Reveal finished jobs too, otherwise a deep link to a completed booking
    // would land on a feed that hides it.
    if (isFinished(target)) setShowCompleted(true);
    setBookingView('queue');
    setHighlightedBookingId(focusBookingId);
    const scroll = setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    const clear = setTimeout(() => setHighlightedBookingId(null), 6000);
    onFocusHandled?.();
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [focusBookingId, bookings]);

  // SOS jobs still needing action (anything not yet confirmed).
  const sosOpenCount = bookings.filter(
    (b) => isSosBooking(b) && b.status !== 'cancelled' && (b.sosStatus || 'requested') !== 'confirmed'
  ).length;

  /**
   * "Fix Bookings" — re-syncs the ledger and re-pushes any booking that only
   * exists on this device (its insert was rejected), then reports the outcome.
   */
  const handleFixBookings = async () => {
    setIsFixingBookings(true);
    setBookingsFixNote(null);
    try {
      const res = await repairBookingsLedger();
      const bits = [`${res.found} in the workshop ledger`];
      if (res.reuploaded) bits.push(`${res.reuploaded} restored`);
      if (res.failed) bits.push(`${res.failed} could not be restored`);
      setBookingsFixNote(
        res.error
          ? `Bookings re-synced — ${bits.join(', ')}. (Ledger read error: ${res.error})`
          : `Bookings repaired — ${bits.join(', ')}.`
      );
    } catch (e: any) {
      setBookingsFixNote(`Repair failed — ${e?.message || 'unknown error'}`);
    } finally {
      setIsFixingBookings(false);
    }
  };

  const handleOpenApprove = (b: ServiceBooking) => {
    setApprovingBooking(b);
    setApprovalNote(
      `Your service appointment on ${b.preferredDate} (${b.preferredTimeSlot}) is approved. Please bring your ${vehicleNouns(b.vehicleCategory).noun} to our workshop.`
    );
    setEstimatePrice(b.quotedPrice != null ? b.quotedPrice.toString() : '');
    setEstimateNote(
      b.quoteNote ||
        `Estimated cost to complete the ${b.serviceTitle} on your ${vehicleNouns(b.vehicleCategory).noun}. This is an estimate only — the final price is confirmed once we inspect it.`
    );
    setApproveError(null);
  };

  const handleConfirmApprove = async (): Promise<boolean> => {
    if (!approvingBooking) return false;

    // The estimate is mandatory: it is what the customer sees in the
    // confirmation email, so approval must not go out without it.
    const price = parseFloat(estimatePrice);
    if (!Number.isFinite(price) || price < 0) {
      setApproveError('Enter an estimated quote before approving — it is included in the customer confirmation.');
      return false;
    }

    setApproveError(null);
    setIsApproving(true);
    try {
      const res = await approveBooking(approvingBooking.id, approvalNote.trim(), {
        quotedPrice: price,
        quoteNote: estimateNote.trim(),
      });
      const emailWarned = /NOT sent|not sent|failed/i.test(res.message || '');
      setActionFeedback({
        type: emailWarned ? 'warning' : 'success',
        message:
          res.message ||
          `Booking #${approvingBooking.id} approved! Confirmation with the £${price.toFixed(2)} estimate delivered to ${approvingBooking.customerEmail}.`,
      });
      setApprovingBooking(null);
      setTimeout(() => setActionFeedback(null), 5000);
      return res.success;
    } catch (err: any) {
      setActionFeedback({
        type: 'danger',
        message: err.message || 'Failed to approve booking.',
      });
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenDecline = (b: ServiceBooking) => {
    setDecliningBooking(b);
    setDeclineReason('Workshop capacity limit on requested date');
    setCustomDeclineReason('');
  };

  const handleConfirmDecline = async () => {
    if (!decliningBooking) return;
    setIsDeclining(true);
    const finalReason =
      declineReason === 'Other'
        ? customDeclineReason.trim() || 'Workshop capacity limit'
        : declineReason;
    try {
      const res = await declineBooking(decliningBooking.id, finalReason);
      setActionFeedback({
        type: 'success',
        message:
          res.message ||
          `Booking #${decliningBooking.id} declined. Notification email dispatched to ${decliningBooking.customerEmail}.`,
      });
      setDecliningBooking(null);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: 'danger',
        message: err.message || 'Failed to decline booking.',
      });
    } finally {
      setIsDeclining(false);
    }
  };

  const handleOpenQuote = (b: ServiceBooking) => {
    setQuotingBooking(b);
    setQuotedPrice(b.quotedPrice ? b.quotedPrice.toString() : '');
    setQuoteNote(b.quoteNote || `Hello ${b.customerName}, here is your estimated quote for your repair. Please contact us via WhatsApp if you have questions or wish to share photos of your ${vehicleNouns(b.vehicleCategory).noun}'s condition.`);
  };

  const handleConfirmQuote = async () => {
    if (!quotingBooking) return;
    const price = parseFloat(quotedPrice);
    if (!Number.isFinite(price) || price < 0) {
      setActionFeedback({ type: 'danger', message: 'Enter a valid quote amount before saving.' });
      return;
    }
    setIsQuoting(true);
    try {
      const res = await updateBookingQuote(quotingBooking.id, {
        quotedPrice: price,
        quoteNote,
      });
      if (!res.success) {
        setActionFeedback({
          type: 'danger',
          message: res.message || 'Failed to save the quote.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: res.message || `Quote for booking #${quotingBooking.id} saved!`,
      });
      setQuotingBooking(null);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: 'danger',
        message: err.message || 'Failed to update quote.',
      });
    } finally {
      setIsQuoting(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOwnerConfig({
      ownerEmail: targetEmail.trim(),
      ownerPhone: targetPhone.trim(),
      emailAlertsEnabled: emailAlerts,
      smsAlertsEnabled: false,
    });
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 3000);
    setIsEditingSettings(false);
  };

  const handleSendTestAlert = async () => {
    setIsSendingTest(true);
    const result = await dispatchTestEmail(ownerConfig);
    setIsSendingTest(false);
    setTestAlertSent(true);
    setTimeout(() => setTestAlertSent(false), 4000);
    if (!result.success && result.message) {
      alert(result.message);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            AWAITING STAFF APPROVAL
          </span>
        );
      case 'confirmed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            APPROVED &amp; CONFIRMED
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            ON WORKBENCH
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            READY FOR PICKUP
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400">
            COMPLETED
          </span>
        );
      case 'declined':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            DECLINED
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400">
            CANCELLED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* View switcher: online/workshop queue vs SOS priority vs staff-logged phone bookings */}
      <div className="inline-flex p-1 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setBookingView('queue')}
          className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
            bookingView === 'queue' ? 'bg-[#05C147] text-neutral-950 font-bold shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Workshop Queue
        </button>
        <button
          type="button"
          onClick={() => setBookingView('sos')}
          className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
            bookingView === 'sos' ? 'bg-rose-500 text-white font-bold shadow-sm' : 'text-rose-300 hover:text-white'
          }`}
        >
          <Siren className="w-3.5 h-3.5" />
          SOS Priority
          {sosOpenCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-neutral-950/70 text-rose-200">
              {sosOpenCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setBookingView('phone')}
          className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
            bookingView === 'phone' ? 'bg-[#05C147] text-neutral-950 font-bold shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          Phone Bookings
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleFixBookings}
          disabled={isFixingBookings}
          data-testid="fix-bookings"
          title="Re-sync the booking ledger and re-push any booking that only exists on this device"
          className="pressable px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          {isFixingBookings ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5" />
          )}
          <span>{isFixingBookings ? 'Fixing…' : 'Fix Bookings'}</span>
        </button>
      </div>

      {bookingsFixNote && (
        <div
          data-testid="bookings-fix-note"
          className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{bookingsFixNote}</span>
        </div>
      )}

      {bookingView === 'sos' && <StaffSosPanel />}

      {bookingView === 'phone' && <PhoneBookingPanel />}

      {bookingView === 'queue' && (
      <>
      {/* System Controls — collapsed by default so the job feed owns the screen */}
      <CollapsiblePanel
        icon={<Mail className="w-6 h-6" />}
        title="Workshop Booking & Notification Manager"
        subtitle={<>Every online booking automatically delivers an email alert to <strong className="text-neutral-200">{ownerConfig.ownerEmail}</strong>.</>}
        badges={
          <>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#05C147] animate-pulse" />
              LIVE DISPATCH
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              isStaffBookingSoundEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {isStaffBookingSoundEnabled ? '🔔 LOUD PING ARMED' : '🔕 MUTED'}
            </span>
          </>
        }
        headerActions={
          <>
            <button
              onClick={() => setIsClearBookingsOpen(true)}
              disabled={bookings.length === 0}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-rose-950/70 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-rose-900/70"
              title="Permanently remove every booking (launch prep)"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Bookings{bookings.length > 0 ? ` (${bookings.length})` : ''}</span>
            </button>

            <button
              onClick={() => {
                setOpenPanels((prev) => ({ ...prev, notifications: true }));
                setIsEditingSettings(!isEditingSettings);
              }}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-neutral-700"
            >
              <Settings className="w-4 h-4 text-[#05C147]" />
              <span>{isEditingSettings ? 'Close Settings' : 'Notification Settings'}</span>
            </button>

            <button
              onClick={handleSendTestAlert}
              disabled={isSendingTest}
              className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-wait text-neutral-950 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingTest ? 'Sending…' : 'Send Test Email'}</span>
            </button>
          </>
        }
        isOpen={!!openPanels.notifications}
        onToggle={() => togglePanel('notifications')}
      >
        {/* Workshop Sound & Realtime Push Alert Bar */}
        <div className="mt-4 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-950/40 p-3.5 rounded-2xl border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
              isStaffBookingSoundEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-400'
            }`}>
              {isStaffBookingSoundEnabled ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Workshop Loud Booking Ping
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isStaffBookingSoundEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isStaffBookingSoundEnabled ? '🔔 LOUD PING ARMED' : '🔕 MUTED'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Staff terminals ping loudly as soon as a customer submits a repair booking. Customers never hear it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isStaffBookingSoundEnabled && (
              <button
                type="button"
                onClick={cycleWorkshopAudioVolume}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-400 font-mono text-xs font-bold border border-amber-500/30 transition-colors cursor-pointer"
                title="Cycle loudness boost"
              >
                🔊 {workshopAudioVolume === 'max_workshop' ? 'MAX BOOST (220% LOUD)' : workshopAudioVolume === 'loud' ? 'LOUD (160%)' : 'NORMAL (100%)'}
              </button>
            )}

            <button
              type="button"
              onClick={playStaffBookingAlertPing}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/40 shadow-sm"
              title="Test the loud workshop alert ping sound"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test Loud Ping</span>
            </button>

            <button
              type="button"
              onClick={toggleStaffBookingSound}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-700"
            >
              {isStaffBookingSoundEnabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isStaffBookingSoundEnabled ? 'Mute' : 'Unmute'}</span>
            </button>

            {'Notification' in window && Notification.permission !== 'granted' && (
              <button
                type="button"
                onClick={requestPushNotificationPermission}
                className="px-3 py-1.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-sky-500/40"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>Enable Desktop Push</span>
              </button>
            )}
          </div>
        </div>

        {/* Test Alert Confirmation Toast */}
        {testAlertSent && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#05C147] shrink-0" />
            <span>
              <strong>Test alert dispatched!</strong> Delivered test email to <span className="font-mono text-white">{ownerConfig.ownerEmail}</span>.
            </span>
          </div>
        )}

        {/* Settings Panel Accordion */}
        {isEditingSettings && (
          <form onSubmit={handleSaveSettings} className="mt-6 pt-6 border-t border-neutral-800 space-y-4 animate-fade-in">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#05C147]" />
              <span>Configure Booking Notification Recipients</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Manager / Owner Email (Notification Recipient)
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono text-xs focus:outline-none focus:border-[#05C147]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Workshop Contact Phone (General shop line)
                </label>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono text-xs focus:outline-none focus:border-[#05C147]"
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="rounded border-neutral-700 text-[#05C147] focus:ring-emerald-500 w-4 h-4"
                />
                <span>Instant Email Alerts to {targetEmail} (Exclusively Email Mode)</span>
              </label>
            </div>
            <p className="text-[11px] text-neutral-500 -mt-1">
              This controls the <span className="text-neutral-300">workshop's own</span> booking alert. Customers always receive their own confirmation email, whether this is on or off.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Save Recipient Settings
              </button>
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </CollapsiblePanel>

      {/* 24-Hour Reminder Manager — collapsed by default */}
      <CollapsiblePanel
        icon={<Bell className="w-6 h-6" />}
        title="24-Hour Reminder Manager"
        subtitle={
          automatedRemindersEnabled
            ? <>Sends a <strong className="text-neutral-200">{reminderSettings.channel === 'both' ? 'push + email' : reminderSettings.channel}</strong> reminder to <strong className="text-neutral-200">{reminderSettings.recipients === 'both' ? 'customer & workshop' : reminderSettings.recipients}</strong> {reminderSettings.leadHours}h before the slot{reminderSettings.repeatHours > 0 ? `, repeating every ${reminderSettings.repeatHours}h` : ''}{reminderSettings.quietHoursEnabled ? `, but never between ${String(reminderSettings.quietStartHour).padStart(2, '0')}:00 and ${String(reminderSettings.quietEndHour).padStart(2, '0')}:00` : ''}.</>
            : <>Automated reminders are paused — nothing will send until you resume.</>
        }
        badges={
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
            automatedRemindersEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            {automatedRemindersEnabled ? 'ACTIVE' : 'PAUSED'}
          </span>
        }
        headerActions={
          <>
            <button
              type="button"
              onClick={() => setAutomatedRemindersEnabled(!automatedRemindersEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                automatedRemindersEnabled
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                  : 'bg-[#05C147] hover:bg-emerald-400 text-neutral-950 border-emerald-400'
              }`}
            >
              {automatedRemindersEnabled ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{automatedRemindersEnabled ? 'Pause Reminders' : 'Resume Reminders'}</span>
            </button>

            <button
              type="button"
              onClick={requestPushNotificationPermission}
              className="px-4 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-sky-500/40"
              title="Allow this device to receive reminder push notifications"
            >
              <Zap className="w-4 h-4 text-sky-400" />
              <span>Enable Push On This Device</span>
            </button>
          </>
        }
        isOpen={!!openPanels.reminders}
        onToggle={() => togglePanel('reminders')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Delivery method</label>
            <select
              value={reminderSettings.channel}
              onChange={(e) => setReminderSettings({ channel: e.target.value as ReminderChannel })}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147] cursor-pointer"
            >
              <option value="push">Push notification</option>
              <option value="email">Email</option>
              <option value="both">Push + email</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Send reminders to</label>
            <select
              value={reminderSettings.recipients}
              onChange={(e) => setReminderSettings({ recipients: e.target.value as ReminderRecipients })}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147] cursor-pointer"
            >
              <option value="both">Customer &amp; workshop</option>
              <option value="customer">Customer only</option>
              <option value="owner">Workshop only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Devices attached to this email receive the workshop reminder
            </label>
            <input
              type="email"
              value={reminderSettings.ownerEmail}
              onChange={(e) => setReminderSettings({ ownerEmail: e.target.value })}
              placeholder="stakeyscycle95@gmail.com"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono text-xs focus:outline-none focus:border-[#05C147]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              First reminder (hours before slot)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={reminderSettings.leadHours}
              onChange={(e) => setReminderSettings({ leadHours: clampNumber(e.target.value, 1, 168, 24) })}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Repeat every (hours · 0 = send once)
            </label>
            <input
              type="number"
              min={0}
              max={168}
              value={reminderSettings.repeatHours}
              onChange={(e) => setReminderSettings({ repeatHours: clampNumber(e.target.value, 0, 168, 0) })}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Reminders due window</label>
            <div className="px-3 py-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-300">
              <span className="font-bold text-white">{bookingsDueIn24h.length}</span> booking
              {bookingsDueIn24h.length === 1 ? '' : 's'} due in the next {reminderSettings.leadHours}h
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-800/80">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reminderSettings.quietHoursEnabled}
              onChange={(e) => setReminderSettings({ quietHoursEnabled: e.target.checked })}
              className="rounded border-neutral-700 text-[#05C147] focus:ring-emerald-500 w-4 h-4"
            />
            <span className="text-xs font-bold text-white">Quiet hours — never remind during this window</span>
          </label>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">From</label>
              <select
                value={reminderSettings.quietStartHour}
                disabled={!reminderSettings.quietHoursEnabled}
                onChange={(e) => setReminderSettings({ quietStartHour: clampNumber(e.target.value, 0, 23, 21) })}
                className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147] disabled:opacity-40 cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Until</label>
              <select
                value={reminderSettings.quietEndHour}
                disabled={!reminderSettings.quietHoursEnabled}
                onChange={(e) => setReminderSettings({ quietEndHour: clampNumber(e.target.value, 0, 23, 8) })}
                className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#05C147] disabled:opacity-40 cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() =>
                  setReminderSettings({
                    channel: DEFAULT_REMINDER_SETTINGS.channel,
                    recipients: DEFAULT_REMINDER_SETTINGS.recipients,
                    leadHours: DEFAULT_REMINDER_SETTINGS.leadHours,
                    repeatHours: DEFAULT_REMINDER_SETTINGS.repeatHours,
                    quietStartHour: DEFAULT_REMINDER_SETTINGS.quietStartHour,
                    quietEndHour: DEFAULT_REMINDER_SETTINGS.quietEndHour,
                    quietHoursEnabled: DEFAULT_REMINDER_SETTINGS.quietHoursEnabled,
                  })
                }
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 transition-colors cursor-pointer"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </div>

        {bookingsDueIn24h.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Upcoming (next {reminderSettings.leadHours} hours)
            </div>
            {bookingsDueIn24h.map((b: ServiceBooking) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-950/50 border border-neutral-800 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {b.customerName} • {b.serviceTitle}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {b.preferredDate} ({b.preferredTimeSlot}) {b.reminder24hSent ? `• ${b.reminderCount || 1} reminder(s) sent` : '• reminder pending'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch24hReminderForBooking(b.id)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition-colors cursor-pointer"
                >
                  Send now
                </button>
              </div>
            ))}
          </div>
        )}
      </CollapsiblePanel>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : actionFeedback.type === 'warning'
              ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : actionFeedback.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-neutral-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Repair Requests Banner */}
      {pendingCount > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-neutral-900 border-2 border-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.4)] animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-neutral-950 shrink-0 border border-amber-300 flex items-center justify-center font-black shadow-lg shadow-amber-400/40 animate-bounce">
              <Clock className="w-6 h-6 text-neutral-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-neutral-950 uppercase tracking-wider flex items-center gap-1 border border-amber-300 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  ACTION REQUIRED
                </span>
                <strong className="text-sm sm:text-base font-extrabold text-amber-300 block">
                  {pendingCount} Fresh Workshop Request{pendingCount > 1 ? 's' : ''} Awaiting Review
                </strong>
              </div>
              <p className="text-[11px] text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                Guests and loyalty riders have submitted intake bookings. Approve to allocate bench slots and deliver customer confirmations, or decline with feedback.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCompleted(false);
              setSelectedStatusFilter('pending');
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-lg shadow-amber-400/30 border border-amber-300 transition-all hover:scale-[1.02]"
          >
            Review Fresh Jobs ({pendingCount})
          </button>
        </div>
      )}

      {/* Filter and Stats Bar — sticky so the pills stay reachable while scrolling the feed */}
      <div className="sticky top-0 z-30 flex flex-col gap-2 bg-neutral-900/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-800 shadow-lg shadow-black/40">
        {/* Active / Completed split — keeps finished jobs out of the way */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-950 border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setShowCompleted(false);
              if (selectedStatusFilter === 'completed' || selectedStatusFilter === 'cancelled') {
                setSelectedStatusFilter('all');
              }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              !showCompleted ? 'bg-[#05C147] text-neutral-950 shadow-sm shadow-emerald-500/20' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Active Jobs
            <span className={`px-1.5 rounded-full text-[10px] font-black ${!showCompleted ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-300'}`}>
              {bookings.length - completedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowCompleted(true)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              showCompleted ? 'bg-[#05C147] text-neutral-950 shadow-sm shadow-emerald-500/20' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
            <span className={`px-1.5 rounded-full text-[10px] font-black ${showCompleted ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-300'}`}>
              {completedCount}
            </span>
          </button>
        </div>

        {/* Status filters — touch-friendly horizontal scroll on mobile */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-neutral-400 font-semibold mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          {/* Status filters */}
          {['all', 'pending', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed', 'declined'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setSelectedStatusFilter(status);
                // Keep the Active/Completed split in step with the status pill.
                setShowCompleted(status === 'completed' || status === 'cancelled');
              }}
              className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                selectedStatusFilter === status
                  ? 'bg-[#05C147] text-neutral-950 shadow-sm shadow-emerald-500/20 font-bold'
                  : status === 'pending' && pendingCount > 0
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60 font-bold'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {status === 'pending' ? (
                <span className="flex items-center gap-1.5">
                  <span>Pending</span>
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-neutral-950 animate-pulse border border-amber-300">
                      ⚡ {pendingCount} FRESH
                    </span>
                  )}
                </span>
              ) : (
                status.replace('_', ' ')
              )}
            </button>
          ))}
        </div>

        {/* Vehicle Category filter — horizontal scroll pill bar */}
        <div className="flex items-center gap-1 text-xs overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['all', 'electric_scooter', 'cycle', 'ebike'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedVehicleFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                selectedVehicleFilter === cat
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {cat === 'all' ? 'All Vehicles' : cat === 'electric_scooter' ? 'Scooters' : cat === 'cycle' ? 'Bicycles' : 'E-Bikes'}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center text-neutral-500">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">
              {showCompleted && selectedStatusFilter === 'all'
                ? 'No completed jobs yet.'
                : 'No bookings found for the selected filter.'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {showCompleted && selectedStatusFilter === 'all'
                ? 'Jobs move here once they are marked completed.'
                : 'New appointments will appear here as soon as customers book.'}
            </p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const isFresh = b.status === 'pending' || b.approvalStatus === 'pending_approval';
            const isHighlighted = highlightedBookingId === b.id;
            const isExpanded = !!expandedBookings[b.id];
            const primaryIssue =
              b.selectedIssues && b.selectedIssues.length > 0
                ? ALL_BIKE_ISSUES_MAP.get(b.selectedIssues[0])
                : undefined;
            const whatsappHref = `https://wa.me/${b.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hi ${b.customerName}, regarding your booking #${b.id} at Stakey's Cycles. Could you please provide more details about the issue and send a picture? Thank you!`
            )}`;
            return (
              <div
                key={b.id}
                ref={isHighlighted ? focusRef : undefined}
                className={`transition-all rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 relative ${
                  isHighlighted
                    ? 'bg-[#0b1a2e] border-2 border-sky-400 ring-4 ring-sky-400/40 shadow-[0_0_35px_rgba(56,189,248,0.55)]'
                    : isFresh
                    ? 'bg-[#12100d] border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                    : 'bg-neutral-900 hover:bg-neutral-850/80 border border-neutral-800'
                }`}
              >
                {/* Tier 1 — compact summary row (tap anywhere to expand) */}
                <button
                  type="button"
                  onClick={() => toggleBooking(b.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    {/* Customer avatar — their real customised face when we can
                        resolve the roster profile, otherwise a seeded one. */}
                    <FaceAvatar
                      seed={b.customerName}
                      configString={findCustomerProfile(b)?.avatarColor}
                      size={40}
                      className="w-10 h-10 rounded-2xl shrink-0"
                    />
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isFresh
                        ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-md shadow-amber-400/30 font-black'
                        : 'bg-neutral-950 border-neutral-800 text-[#05C147]'
                    }`}>
                      {b.vehicleCategory === 'electric_scooter' ? <Zap className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Left: booking id + status badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-neutral-400 font-bold">#{b.id}</span>
                        {getStatusBadge(b.status)}
                        {isFresh && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 animate-pulse border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                            ⚡ FRESH INCOMING
                          </span>
                        )}
                        {isSosBooking(b) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white border border-rose-300 flex items-center gap-1">
                            <Siren className="w-3 h-3" />
                            SOS PRIORITY
                          </span>
                        )}
                      </div>

                      {/* Centre: customer name + vehicle model/type badge */}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white group-hover:text-emerald-200 transition-colors">{b.customerName}</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-200 border border-neutral-700">
                          {b.vehicleModel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          b.vehicleCategory === 'electric_scooter'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : b.vehicleCategory === 'ebike'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {b.vehicleCategory === 'electric_scooter' ? 'Scooter' : b.vehicleCategory === 'ebike' ? 'E-Bike' : 'Cycle'}
                        </span>
                      </div>

                      {/* Sub-bar: time slot + primary symptom summary */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-neutral-400 font-mono">Slot: {b.preferredDate} • {b.preferredTimeSlot.split(' ')[0]}</span>
                        {primaryIssue && (
                          <span className="text-neutral-300 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-[#05C147]" />
                            <strong className="text-emerald-400 font-mono">[{primaryIssue.category}]</strong>
                            <span className="truncate max-w-[16rem]">{primaryIssue.label}</span>
                            {b.selectedIssues && b.selectedIssues.length > 1 && (
                              <span className="text-neutral-500">+{b.selectedIssues.length - 1} more</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: price / quote */}
                    <div className="text-right shrink-0">
                      {b.invoice ? (
                        <>
                          <span className="block text-base font-black text-[#05C147]">£{b.invoice.grandTotal.toFixed(2)}</span>
                          <span className="block text-[10px] text-emerald-400 font-mono font-bold uppercase">#{b.invoice.invoiceNumber}</span>
                        </>
                      ) : (
                        <>
                          <span className="block text-xs font-bold text-amber-400 font-mono">Quote Pending</span>
                          <span className="block text-[10px] text-neutral-500 font-mono">Priced on completion</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                {/* Quick-action dock — usable without expanding the card */}
                <div className="flex flex-wrap items-center gap-2">
                  {isFresh ? (
                    <button
                      type="button"
                      onClick={() => handleOpenApprove(b)}
                      className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept &amp; Approve</span>
                    </button>
                  ) : b.status === 'in_progress' ? (
                    <button
                      type="button"
                      onClick={() => updateBookingStatus(b.id, 'ready_for_pickup')}
                      className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready for Pickup</span>
                    </button>
                  ) : b.status === 'confirmed' ? (
                    <button
                      type="button"
                      onClick={() => updateBookingStatus(b.id, 'in_progress')}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Move to Bench</span>
                    </button>
                  ) : null}

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`WhatsApp ${b.customerName}`}
                    aria-label={`WhatsApp ${b.customerName}`}
                    className="p-2 rounded-xl bg-[#05C147]/20 hover:bg-[#05C147] text-[#05C147] hover:text-neutral-950 border border-[#05C147]/30 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                  <a
                    href={`tel:${b.customerPhone}`}
                    title={`Call ${b.customerPhone}`}
                    aria-label={`Call ${b.customerPhone}`}
                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-emerald-400 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </a>

                  <button
                    type="button"
                    onClick={() => toggleBooking(b.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Hide booking details' : 'Show booking details'}
                    className="ml-auto px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>{isExpanded ? 'Hide' : 'Details'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Tier 2 — full detail body, revealed on tap */}
                {isExpanded && (
                  <div className="overflow-hidden">
                    <div className="space-y-4 pt-3 animate-slide-down">
              {/* Customer and Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-950/70 p-3.5 rounded-2xl border border-neutral-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-500 shrink-0" />
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Customer</span>
                    <span className="font-bold text-white">{b.customerName}</span>
                    {b.membershipNumber && (
                      <span className="text-[10px] text-[#05C147] font-mono ml-1.5 font-bold">({b.membershipNumber})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-neutral-500 shrink-0" />
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Phone</span>
                      <a href={`tel:${b.customerPhone}`} className="text-emerald-400 hover:underline font-mono font-bold">
                        {b.customerPhone}
                      </a>
                    </div>
                    <a
                      href={`https://wa.me/${b.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${b.customerName}, regarding your booking #${b.id} at Stakey's Cycles. Could you please provide more details about the issue and send a picture? Thank you!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 rounded-lg bg-[#05C147]/20 text-[#05C147] hover:bg-[#05C147] hover:text-neutral-950 text-[10px] font-bold transition-colors"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Email</span>
                      <a href={`mailto:${b.customerEmail}`} className="text-neutral-300 hover:text-white">
                        {b.customerEmail}
                      </a>
                    </div>
                    <a
                      href={`mailto:${b.customerEmail}?subject=${encodeURIComponent(`Update on your Stakey's Workshop Booking #${b.id}`)}`}
                      className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-[#05C147] hover:text-neutral-950 text-neutral-300 text-[10px] font-bold transition-colors"
                      title="Send Email to Customer"
                    >
                      Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Reported Issues / Symptoms Checklist */}
              {b.selectedIssues && b.selectedIssues.length > 0 && (
                <div className="bg-neutral-950/90 p-3.5 rounded-2xl border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 font-mono uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-[#05C147]" />
                      Reported Bike Issues Checklist ({b.selectedIssues.length})
                    </span>
                    <span className="text-[10px] text-neutral-400 font-normal normal-case">workshop intake inspection</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.selectedIssues.map((id) => {
                      const item = ALL_BIKE_ISSUES_MAP.get(id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#05C147]" />
                          <strong className="text-emerald-400 font-mono text-[10px]">[{item?.category || 'Issue'}]</strong>
                          <span>{item?.label || id}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Notes */}
              {b.notes && (
                <div className="text-xs text-neutral-300 bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 whitespace-pre-line leading-relaxed font-mono">
                  <span className="text-neutral-500 font-mono text-[10px] uppercase block mb-1">Customer / Diagnostic Notes</span>
                  {b.notes}
                </div>
              )}

              {/* PENDING APPROVAL WORKFLOW CALLOUT */}
              {b.status === 'pending' && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 shadow-lg space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                      <span>
                        ACTION REQUIRED: Repair Request Needs Staff Review &amp; Decision
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {b.isGuest ? 'Guest Direct Booking' : 'Registered Member'}
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Customer provided name (<strong>{b.customerName}</strong>) and phone (<strong>{b.customerPhone}</strong>). Approving asks you to confirm the estimated quote, which is included in the official confirmation email sent to <strong>{b.customerEmail}</strong>. If declined, a respectful explanation will be emailed.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenApprove(b)}
                      className="px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept &amp; Approve Booking</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenQuote(b)}
                      className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all border border-neutral-600"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Send Quote / Info Request</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDecline(b)}
                      className="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Decline Booking</span>
                    </button>

                    <a
                      href={`tel:${b.customerPhone}`}
                      className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call Customer</span>
                    </a>
                    <a
                      href={`https://wa.me/${b.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${b.customerName}, regarding your booking #${b.id} at Stakey's Cycles. Could you please provide more details about the issue and send a picture? Thank you!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#05C147]/20 hover:bg-[#05C147] text-[#05C147] hover:text-neutral-950 border border-[#05C147]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Request</span>
                    </a>
                  </div>
                </div>
              )}

              {/* DECLINED NOTICE */}
              {b.status === 'declined' && (
                <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong>Booking Request Declined:</strong> {b.declineReason || 'Workshop capacity limit'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400/80">
                    Email Delivered to {b.customerEmail}
                  </span>
                </div>
              )}

              {/* REPAIR INVOICE & WORKSHOP COMPLETION WORKFLOW */}
              <div className="p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-[#05C147]" />
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {b.invoice ? `Official Invoice: ${b.invoice.invoiceNumber}` : 'Repair Completion & Invoice'}
                      </span>
                      {b.invoice ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Total: £{b.invoice.grandTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Quote Pending
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {b.invoice
                        ? `${b.invoice.items.length} parts/labour line items · ${b.invoice.paymentStatus.toUpperCase().replace('_', ' ')} · Lead: ${b.invoice.leadMechanic}`
                        : 'Sign off completion checklist, price up parts & labour manually, and build customer invoice.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {b.invoice ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingInvoice({ invoice: b.invoice!, booking: b })}
                          className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-emerald-500/30 hover:border-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>View &amp; Print Invoice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletingBooking(b)}
                          className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Edit Line Items & Checklist"
                        >
                          <span>Edit Invoice</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCompletingBooking(b)}
                        className="px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Wrench className="w-4 h-4" />
                        <span>Complete Repairs &amp; Build Invoice</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* LIVE CUSTOMER REPAIR PROGRESS TRACKER */}
              {b.status !== 'declined' && b.status !== 'cancelled' && (
                <StaffRepairProgressPanel
                  booking={b}
                  onSetStage={(stage, options) => setRepairStage(b.id, stage, options)}
                  onAddNote={(note) => addRepairProgressNote(b.id, note)}
                />
              )}

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Status Switcher (for approved / active bookings) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 mr-1 text-[11px]">Update Status:</span>

                  {b.status !== 'in_progress' && b.status !== 'completed' && b.status !== 'declined' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'in_progress')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Move to Bench
                    </button>
                  )}

                  {b.status !== 'ready_for_pickup' && b.status !== 'completed' && b.status !== 'declined' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'ready_for_pickup')}
                      className="px-3 py-1.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] cursor-pointer"
                    >
                      Ready for Pickup
                    </button>
                  )}

                  {b.status !== 'completed' && b.status !== 'declined' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'completed')}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold text-[11px] cursor-pointer"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>

                {/* Inspect Notifications Button */}
                <button
                  onClick={() => setSelectedBookingForPreview(b)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Dispatched Emails</span>
                </button>
              </div>
                    </div>
                  </div>
                )}
            </div>
          );
        })
      )}
      </div>

      {/* APPROVAL MODAL */}
      {approvingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-neutral-900 border border-emerald-500/50 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-[#05C147] border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Approve Workshop Booking</h3>
                  <p className="text-xs text-neutral-400">
                    Booking #{approvingBooking.id} • {approvingBooking.customerName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setApprovingBooking(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Vehicle:</span>
                <span className="font-semibold text-white">{approvingBooking.vehicleModel}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Requested Slot:</span>
                <span className="font-semibold text-white">
                  {approvingBooking.preferredDate} ({approvingBooking.preferredTimeSlot})
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Service Price:</span>
                <span className="font-bold text-emerald-400">£{approvingBooking.servicePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Customer Email:</span>
                <span className="font-mono text-neutral-200">{approvingBooking.customerEmail}</span>
              </div>
            </div>

            {/* Mandatory estimate — this is what the customer's confirmation shows */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-700/50 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <FileText className="w-4 h-4" />
                <span>Estimated Quote (included in the customer confirmation)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Estimated Price (£)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatePrice}
                  onChange={(e) => setEstimatePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Estimate Note</label>
                <textarea
                  rows={3}
                  value={estimateNote}
                  onChange={(e) => setEstimateNote(e.target.value)}
                  placeholder="Explain what the estimate covers..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Workshop Mechanic Drop-Off Instructions / SMS Note */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Workshop Mechanic Drop-Off Instructions / SMS Note (Optional)
              </label>
              <textarea
                rows={3}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Add special instructions, bay assignment, or notes for the customer..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#05C147]"
              />
              <span className="text-[11px] text-neutral-400 mt-1 block">
                This note will be formatted prominently in the official approval SMS delivered to {approvingBooking.customerPhone}.
              </span>
            </div>

            {approveError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{approveError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setApprovingBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isApproving}
                onClick={async () => {
                  const approved = await handleConfirmApprove(); // Dispatch email with the estimate
                  if (!approved) return; // Estimate missing/invalid — do not open SMS
                  const estimate = parseFloat(estimatePrice);
                  const smsLink = `sms:${approvingBooking.customerPhone.replace(/\s+/g, '')}?body=${encodeURIComponent(
                    `Hi ${approvingBooking.customerName}! Your booking #${approvingBooking.id} is approved. Estimated quote: £${estimate.toFixed(2)}. ${approvalNote.trim() ? `Note: ${approvalNote.trim()} ` : ''}See you at Stakey's!`
                  )}`;
                  window.location.href = smsLink; // Redirects to device SMS app
                }}
                className="px-5 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isApproving ? 'Processing...' : 'Confirm, Dispatch Email & SMS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE MODAL */}
      {decliningBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-neutral-900 border border-rose-800/60 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Decline Booking Request</h3>
                  <p className="text-xs text-neutral-400">
                    Booking #{decliningBooking.id} • {decliningBooking.customerName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDecliningBooking(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Select a reason for declining this request. An official explanation email will be dispatched to <strong>{decliningBooking.customerEmail}</strong> with alternative dates and workshop contact details.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">
                Reason for Declining:
              </label>
              {[
                'Workshop capacity limit on requested date',
                'Specialist replacement parts currently out of stock',
                'Requested service falls outside workshop mechanical scope',
                'Staff holiday / Reduced workshop hours',
                'Other',
              ].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 cursor-pointer text-xs"
                >
                  <input
                    type="radio"
                    name="declineReason"
                    value={reason}
                    checked={declineReason === reason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="text-[#05C147] focus:ring-0"
                  />
                  <span className="text-neutral-200">{reason}</span>
                </label>
              ))}

              {declineReason === 'Other' && (
                <textarea
                  rows={2}
                  value={customDeclineReason}
                  onChange={(e) => setCustomDeclineReason(e.target.value)}
                  placeholder="Provide brief custom reason to include in customer notification..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 mt-2"
                />
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDecliningBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeclining}
                onClick={handleConfirmDecline}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{isDeclining ? 'Sending Decline Email...' : 'Confirm & Dispatch Decline Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUOTING MODAL */}
      {quotingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-neutral-900 border border-emerald-800/60 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Send Estimate Quote</h3>
                  <p className="text-xs text-neutral-400">
                    Booking #{quotingBooking.id} • {quotingBooking.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuotingBooking(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Estimated Price (£)</label>
                <input
                  type="number"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Quote Note</label>
                <textarea
                  rows={4}
                  value={quoteNote}
                  onChange={(e) => setQuoteNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setQuotingBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isQuoting}
                onClick={handleConfirmQuote}
                className="px-5 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <span>{isQuoting ? 'Saving...' : 'Save Estimate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Notification Modal */}
      {selectedBookingForPreview && (
        <NotificationPreviewModal
          booking={selectedBookingForPreview}
          isOpen={!!selectedBookingForPreview}
          onClose={() => setSelectedBookingForPreview(null)}
          ownerConfig={ownerConfig}
        />
      )}

      {/* Repair Completion & Pricing Builder Modal */}
      {completingBooking && (
        <RepairCompletionModal
          booking={completingBooking}
          isOpen={!!completingBooking}
          onClose={() => setCompletingBooking(null)}
          onSaveInvoice={async (invoice) => {
            await saveRepairInvoice(completingBooking.id, invoice);
            setViewingInvoice({ invoice, booking: completingBooking });
            setCompletingBooking(null);
          }}
          currentStaffName={currentUser?.displayName || 'Ben Stake - Lead Mechanic'}
        />
      )}

      {/* Professional High-Detailed Invoice Document Modal */}
      {viewingInvoice && (
        <RepairInvoiceModal
          invoice={viewingInvoice.invoice}
          booking={viewingInvoice.booking}
          isOpen={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onUpdatePaymentStatus={async (status) => {
            await updateInvoicePaymentStatus(viewingInvoice.booking.id, status);
            setViewingInvoice((prev) =>
              prev ? { ...prev, invoice: { ...prev.invoice, paymentStatus: status } } : null
            );
          }}
          isStaff={true}
        />
      )}

      {/* Launch prep: clear every booking */}
      {isClearBookingsOpen && (
        <ClearBookingsModal onClose={() => setIsClearBookingsOpen(false)} />
      )}
      </>
      )}
    </div>
  );
};
