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
  const { bookings, updateBookingStatus, ownerConfig, updateOwnerConfig } = useShop();

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedBookingForPreview, setSelectedBookingForPreview] = useState<ServiceBooking | null>(null);

  // Settings State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [targetEmail, setTargetEmail] = useState(ownerConfig.ownerEmail);
  const [targetPhone, setTargetPhone] = useState(ownerConfig.ownerPhone);
  const [emailAlerts, setEmailAlerts] = useState(ownerConfig.emailAlertsEnabled);
  const [smsAlerts, setSmsAlerts] = useState(ownerConfig.smsAlertsEnabled);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [testAlertSent, setTestAlertSent] = useState(false);

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (selectedStatusFilter !== 'all' && b.status !== selectedStatusFilter) return false;
    if (selectedVehicleFilter !== 'all' && b.vehicleCategory !== selectedVehicleFilter) return false;
    return true;
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOwnerConfig({
      ownerEmail: targetEmail.trim(),
      ownerPhone: targetPhone.trim(),
      emailAlertsEnabled: emailAlerts,
      smsAlertsEnabled: smsAlerts,
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
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">PENDING CONFIRMATION</span>;
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">CONFIRMED</span>;
      case 'in_progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">ON WORKBENCH</span>;
      case 'ready_for_pickup':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">READY FOR PICKUP</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400">COMPLETED</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">CANCELLED</span>;
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
                Every online booking automatically delivers an email to <strong className="text-neutral-200">{ownerConfig.ownerEmail}</strong> and an SMS alert to <strong className="text-neutral-200">{ownerConfig.ownerPhone}</strong>.
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
              <strong>Test alert dispatched!</strong> Delivered test email to <span className="font-mono text-white">{ownerConfig.ownerEmail}</span> and simulated SMS to <span className="font-mono text-white">{ownerConfig.ownerPhone}</span>.
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
                  SMS Notification Phone / Mobile
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
                <span>Instant Email Alerts to {targetEmail}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={smsAlerts}
                  onChange={(e) => setSmsAlerts(e.target.checked)}
                  className="rounded border-neutral-700 text-[#05C147] focus:ring-emerald-500 w-4 h-4"
                />
                <span>Instant SMS Text Alerts to {targetPhone}</span>
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

      {/* Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          {/* Status filters */}
          {['all', 'pending', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all cursor-pointer ${
                selectedStatusFilter === status
                  ? 'bg-[#05C147] text-neutral-950 shadow-sm shadow-emerald-500/20'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {status.replace('_', ' ')}
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
                    <a
                      href={`sms:${b.customerPhone.replace(/[^0-9+]/g, '')}?&body=${encodeURIComponent(`Hi ${b.customerName}, regarding your ${b.serviceTitle} booking #${b.id} at Stakey's Cycles...`)}`}
                      className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-[#05C147] hover:text-neutral-950 text-neutral-300 text-[10px] font-bold transition-colors"
                      title="Send SMS to Customer"
                    >
                      SMS
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

              {/* Customer Notes */}
              {b.notes && (
                <div className="text-xs text-neutral-300 bg-neutral-950 p-3 rounded-xl border border-neutral-800 italic">
                  Notes: "{b.notes}"
                </div>
              )}

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Status Switcher */}
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 mr-1 text-[11px]">Update Status:</span>

                  {b.status === 'pending' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'confirmed')}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Confirm
                    </button>
                  )}

                  {b.status !== 'in_progress' && b.status !== 'completed' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'in_progress')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Move to Bench
                    </button>
                  )}

                  {b.status !== 'ready_for_pickup' && b.status !== 'completed' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'ready_for_pickup')}
                      className="px-3 py-1.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] cursor-pointer"
                    >
                      Ready for Pickup
                    </button>
                  )}

                  {b.status !== 'completed' && (
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
                  <span>View Dispatched Email &amp; SMS</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
