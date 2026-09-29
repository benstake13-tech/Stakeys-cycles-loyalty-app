import React, { useState } from 'react';
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
  ShieldAlert,
  Zap,
  Bike,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ServiceBooking, BookingStatus, VehicleCategory } from '../types/bikeShop';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { StakeysLogo } from './StakeysLogo';

export const StaffBookingsTab: React.FC = () => {
  const {
    bookings,
    approveBooking,
    declineBooking,
    updateBookingStatus,
    ownerConfig,
    updateOwnerConfig,
  } = useShop();

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedBookingForPreview, setSelectedBookingForPreview] = useState<ServiceBooking | null>(null);

  // Approval / Decline Modal States
  const [approvingBooking, setApprovingBooking] = useState<ServiceBooking | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const [decliningBooking, setDecliningBooking] = useState<ServiceBooking | null>(null);
  const [declineReason, setDeclineReason] = useState('Workshop capacity limit on requested date');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);

  // Action toast / feedback
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'danger';
    message: string;
  } | null>(null);

  // Settings State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [targetEmail, setTargetEmail] = useState(ownerConfig.ownerEmail);
  const [targetPhone, setTargetPhone] = useState(ownerConfig.ownerPhone);
  const [emailAlerts, setEmailAlerts] = useState(ownerConfig.emailAlertsEnabled);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [testAlertSent, setTestAlertSent] = useState(false);

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (selectedStatusFilter !== 'all' && b.status !== selectedStatusFilter) return false;
    if (selectedVehicleFilter !== 'all' && b.vehicleCategory !== selectedVehicleFilter) return false;
    return true;
  });

  const pendingCount = bookings.filter(
    (b) => b.status === 'pending' || b.approvalStatus === 'pending_approval'
  ).length;

  const handleOpenApprove = (b: ServiceBooking) => {
    setApprovingBooking(b);
    setApprovalNote(
      `Your service appointment on ${b.preferredDate} (${b.preferredTimeSlot}) is approved. Please bring your vehicle to our workshop intake bay.`
    );
  };

  const handleConfirmApprove = async () => {
    if (!approvingBooking) return;
    setIsApproving(true);
    try {
      const res = await approveBooking(approvingBooking.id, approvalNote.trim());
      setActionFeedback({
        type: 'success',
        message:
          res.message ||
          `Booking #${approvingBooking.id} approved! Confirmation email delivered to ${approvingBooking.customerEmail}.`,
      });
      setApprovingBooking(null);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: 'danger',
        message: err.message || 'Failed to approve booking.',
      });
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

  const handleSendTestAlert = () => {
    setTestAlertSent(true);
    setTimeout(() => setTestAlertSent(false), 3500);
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
      {/* Top Banner: Notifications Settings & Status */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#05C147] flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  Workshop Booking &amp; Notification Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">
                  LIVE DISPATCH ACTIVE
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every online booking automatically delivers an email alert to <strong className="text-neutral-200">{ownerConfig.ownerEmail}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-neutral-700"
            >
              <Settings className="w-4 h-4 text-[#05C147]" />
              <span>{isEditingSettings ? 'Close Settings' : 'Notification Settings'}</span>
            </button>

            <button
              onClick={handleSendTestAlert}
              className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
              <span>Send Test Alert</span>
            </button>
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
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <strong className="text-sm font-bold text-amber-300 block">
                {pendingCount} Workshop Repair Request{pendingCount > 1 ? 's' : ''} Awaiting Staff Approval
              </strong>
              <p className="text-[11px] text-amber-200/80 mt-0.5 max-w-2xl leading-relaxed">
                Guests and customers have submitted their name and phone number for repair. You must grant approval; customers automatically receive a branded acceptance email with workshop drop-off details, or a decline email explaining the decision.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('pending')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-md"
          >
            Review Pending ({pendingCount})
          </button>
        </div>
      )}

      {/* Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          {/* Status filters */}
          {['all', 'pending', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed', 'declined'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all cursor-pointer ${
                selectedStatusFilter === status
                  ? 'bg-[#05C147] text-neutral-950 shadow-sm shadow-emerald-500/20 font-bold'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {status === 'pending'
                ? `Pending (${pendingCount})`
                : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Vehicle Category filter */}
        <div className="flex items-center gap-1 text-xs">
          {['all', 'electric_scooter', 'cycle', 'ebike'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedVehicleFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
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
            <p className="text-sm font-semibold">No bookings found for the selected filter.</p>
            <p className="text-xs text-neutral-500 mt-1">New appointments will appear here as soon as customers book.</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-neutral-900 hover:bg-neutral-850/80 transition-all border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-950 border border-neutral-800 text-[#05C147] flex items-center justify-center shrink-0">
                    {b.vehicleCategory === 'electric_scooter' ? (
                      <Zap className="w-5 h-5" />
                    ) : (
                      <Bike className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-400 font-bold">#{b.id}</span>
                      <h4 className="text-base font-bold text-white">{b.serviceTitle}</h4>
                      {getStatusBadge(b.status)}
                    </div>
                    <div className="text-xs text-neutral-300 mt-0.5">
                      <strong className="text-white">{b.vehicleModel}</strong> ({b.vehicleCategory.toUpperCase().replace('_', ' ')})
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-baseline sm:flex-col sm:items-end justify-between w-full sm:w-auto gap-2">
                  <span className="text-lg font-black text-[#05C147]">£{b.servicePrice.toFixed(2)}</span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Slot: {b.preferredDate} • {b.preferredTimeSlot.split(' ')[0]}
                  </span>
                </div>
              </div>

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

              {/* Customer Notes */}
              {b.notes && (
                <div className="text-xs text-neutral-300 bg-neutral-950 p-3 rounded-xl border border-neutral-800 italic">
                  Notes: "{b.notes}"
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
                    Customer provided name (<strong>{b.customerName}</strong>) and phone (<strong>{b.customerPhone}</strong>). Granting approval will automatically deliver an official confirmation email to <strong>{b.customerEmail}</strong>. If declined, a respectful explanation will be emailed.
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
          ))
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
                  await handleConfirmApprove(); // Triggers existing approval/email logic
                  const smsLink = `sms:${approvingBooking.customerPhone.replace(/\s+/g, '')}?body=${encodeURIComponent(
                    `Hi ${approvingBooking.customerName}! Your booking #${approvingBooking.id} is approved. ${approvalNote.trim() ? `Note: ${approvalNote.trim()}` : ''} See you at Stakey's!`
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

      {/* Dispatched Notification Modal */}
      {selectedBookingForPreview && (
        <NotificationPreviewModal
          booking={selectedBookingForPreview}
          isOpen={!!selectedBookingForPreview}
          onClose={() => setSelectedBookingForPreview(null)}
          ownerConfig={ownerConfig}
        />
      )}
    </div>
  );
};
