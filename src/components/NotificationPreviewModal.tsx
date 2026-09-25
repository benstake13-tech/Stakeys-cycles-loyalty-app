import React, { useState } from 'react';
import { Mail, MessageSquare, X, CheckCircle2, Phone, Calendar, Clock, User, Shield, Sparkles, Send } from 'lucide-react';
import { ServiceBooking, OwnerNotificationConfig } from '../types/bikeShop';
import { StakeysLogo } from './StakeysLogo';

interface NotificationPreviewModalProps {
  booking: ServiceBooking | null;
  isOpen: boolean;
  onClose: () => void;
  ownerConfig: OwnerNotificationConfig;
}

export const NotificationPreviewModal: React.FC<NotificationPreviewModalProps> = ({
  booking,
  isOpen,
  onClose,
  ownerConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  if (!isOpen || !booking) return null;

  const emailLog = booking.notifications.find((n) => n.type === 'email');
  const smsLog = booking.notifications.find((n) => n.type === 'sms');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StakeysLogo className="w-9 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Owner Notification Dispatch
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DISPATCHED
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Live delivery confirmation to <strong>{ownerConfig.ownerEmail}</strong> &amp; <strong>{ownerConfig.ownerPhone}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'email'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Alert ({ownerConfig.ownerEmail})</span>
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
          </button>

          <button
            onClick={() => setActiveTab('sms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'sms'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>SMS Alert ({ownerConfig.ownerPhone})</span>
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-neutral-900/60">
          {activeTab === 'email' ? (
            <div className="space-y-4">
              {/* Delivery Meta */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>To: <strong className="text-white">{ownerConfig.ownerEmail}</strong></span>
                  <span className="text-emerald-400 font-mono text-[11px]">Status: 250 OK (Delivered)</span>
                </div>
                <div className="text-neutral-400">
                  Subject: <span className="text-neutral-200 font-semibold">{emailLog?.subject || `⚡ NEW BOOKING: ${booking.customerName}`}</span>
                </div>
                <div className="text-neutral-500 text-[11px] font-mono">
                  Timestamp: {emailLog ? new Date(emailLog.timestamp).toLocaleString() : new Date().toLocaleString()}
                </div>
              </div>

              {/* Email Client Visual Preview */}
              <div className="border border-neutral-700/80 rounded-2xl overflow-hidden bg-neutral-950 shadow-inner">
                {/* Email Client Mock Top Bar */}
                <div className="bg-neutral-900 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Stakey's Mail Notification Engine
                  </span>
                  <span className="font-mono">HTML Preview</span>
                </div>

                {/* Email Content Box */}
                <div className="p-6 max-w-xl mx-auto space-y-6 bg-neutral-900/90 rounded-2xl m-4 border border-neutral-800 text-neutral-100">
                  {/* Stakey's Shield Banner */}
                  <div className="bg-[#05C147] text-neutral-950 p-5 rounded-2xl text-center space-y-1 shadow-md">
                    <h2 className="text-2xl font-black tracking-widest uppercase">STAKEYS</h2>
                    <p className="text-xs font-bold tracking-wider uppercase opacity-90">CYCLES &amp; SCOOTER</p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                    ⚡ NEW CUSTOMER SERVICE BOOKING RECEIVED
                  </div>

                  {/* Booking Details Table */}
                  <div className="space-y-3 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 text-xs">
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Booking Ref:</span>
                      <span className="font-mono font-bold text-white">#{booking.id}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Service:</span>
                      <span className="font-bold text-[#05C147]">{booking.serviceTitle}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Vehicle:</span>
                      <span className="font-semibold text-white">
                        {booking.vehicleCategory.toUpperCase().replace('_', ' ')} • {booking.vehicleModel}
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Requested Time:</span>
                      <span className="text-white font-medium">
                        {booking.preferredDate} ({booking.preferredTimeSlot})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Estimated Cost:</span>
                      <span className="font-bold text-emerald-400">£{booking.servicePrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-2 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 text-xs">
                    <div className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">
                      Customer Contact
                    </div>
                    <div className="text-sm font-bold text-white">{booking.customerName}</div>
                    <div className="text-neutral-300">
                      Email: <a href={`mailto:${booking.customerEmail}`} className="text-emerald-400 hover:underline">{booking.customerEmail}</a>
                    </div>
                    <div className="text-neutral-300">
                      Phone: <a href={`tel:${booking.customerPhone}`} className="text-emerald-400 font-mono font-bold">{booking.customerPhone}</a>
                    </div>
                    {booking.membershipNumber && (
                      <div className="text-neutral-400 text-[11px]">
                        Loyalty ID: <span className="font-mono text-emerald-400 font-bold">{booking.membershipNumber}</span>
                      </div>
                    )}
                    {booking.notes && (
                      <div className="pt-2 text-neutral-300 italic bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                        "{booking.notes}"
                      </div>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex gap-2">
                    <a
                      href={`tel:${booking.customerPhone}`}
                      className="flex-1 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider text-center transition-all"
                    >
                      📞 Call Customer
                    </a>
                    <a
                      href={`mailto:${booking.customerEmail}`}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider text-center transition-all"
                    >
                      ✉️ Reply Email
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SMS Delivery Meta */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>To: <strong className="text-white">{ownerConfig.ownerPhone}</strong></span>
                  <span className="text-emerald-400 font-mono text-[11px]">Status: Delivered via SMS Gateway</span>
                </div>
                <div className="text-neutral-500 text-[11px] font-mono">
                  Timestamp: {smsLog ? new Date(smsLog.timestamp).toLocaleString() : new Date().toLocaleString()}
                </div>
              </div>

              {/* Smartphone SMS Simulator */}
              <div className="max-w-sm mx-auto bg-neutral-950 border-4 border-neutral-800 rounded-[36px] p-4 shadow-2xl relative overflow-hidden">
                {/* Phone Speaker Notch */}
                <div className="w-20 h-4 bg-neutral-800 rounded-full mx-auto mb-4" />

                <div className="text-center pb-3 border-b border-neutral-800/80 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-1">
                    <StakeysLogo className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-white">Stakey's Alerts</div>
                  <div className="text-[10px] text-neutral-400">SMS Notification Gateway</div>
                </div>

                {/* SMS Bubble */}
                <div className="space-y-3 pb-8">
                  <div className="text-center text-[10px] text-neutral-500 font-mono">Today • Just now</div>

                  <div className="bg-emerald-600/90 text-neutral-950 font-medium p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-lg">
                    <p className="font-bold text-black mb-1">[STAKEYS ALERT] New service booked!</p>
                    <p className="text-neutral-950 mb-1">
                      <strong>{booking.customerName}</strong> booked <strong>"{booking.serviceTitle}"</strong> on {booking.preferredDate} ({booking.preferredTimeSlot}).
                    </p>
                    <p className="text-neutral-950 text-[11px]">
                      Vehicle: {booking.vehicleModel} • Tel: {booking.customerPhone}
                    </p>
                    {booking.notes && (
                      <p className="text-neutral-900 text-[11px] mt-1 italic border-t border-black/15 pt-1">
                        Note: {booking.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom home indicator bar */}
                <div className="w-28 h-1 bg-neutral-700 rounded-full mx-auto mt-2" />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            Delivered to Stakey's Cycles &amp; Scooter Owner Notification Hub
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
