import React, { useState } from 'react';
import { Mail, X, CheckCircle2, Wrench, User, Calendar, Clock } from 'lucide-react';
import { ServiceBooking, OwnerNotificationConfig } from '../shared/types/bikeShop';
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
  const [activeTab, setActiveTab] = useState<'owner_email' | 'customer_email'>('owner_email');

  if (!isOpen || !booking) return null;

  const ownerEmailLog = booking.notifications.find(
    (n) => n.recipientRole === 'owner' || (n.type === 'email' && n.recipient === ownerConfig.ownerEmail)
  ) || booking.notifications.find((n) => n.type === 'email');

  const customerEmailLog = booking.notifications.find(
    (n) => n.recipientRole === 'customer' || (n.type === 'email' && n.recipient === booking.customerEmail)
  );

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
                  Dispatched Email Notifications
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  EXCLUSIVELY EMAIL
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Delivered to Workshop <strong>({ownerConfig.ownerEmail})</strong> &amp; Customer <strong>({booking.customerEmail})</strong>
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
            onClick={() => setActiveTab('owner_email')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'owner_email'
                ? 'bg-[#05C147] text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Workshop Alert ({ownerConfig.ownerEmail})</span>
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
          </button>

          <button
            onClick={() => setActiveTab('customer_email')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'customer_email'
                ? 'bg-[#05C147] text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Customer Confirmation ({booking.customerEmail})</span>
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-neutral-900/60">
          {activeTab === 'owner_email' ? (
            <div className="space-y-4">
              {/* Delivery Meta */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>To: <strong className="text-white">{ownerConfig.ownerEmail}</strong></span>
                  <span className="text-emerald-400 font-mono text-[11px]">Status: 250 OK (Email Delivered)</span>
                </div>
                <div className="text-neutral-400">
                  Subject: <span className="text-neutral-200 font-semibold">{ownerEmailLog?.subject || `⚡ NEW BOOKING: ${booking.customerName} - ${booking.serviceTitle}`}</span>
                </div>
                <div className="text-neutral-500 text-[11px] font-mono">
                  Timestamp: {ownerEmailLog ? new Date(ownerEmailLog.timestamp).toLocaleString() : new Date().toLocaleString()}
                </div>
              </div>

              {/* Email Visual Preview */}
              <div className="border border-neutral-700/80 rounded-2xl overflow-hidden bg-neutral-950 shadow-inner">
                <div className="bg-neutral-900 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Stakey's Workshop Dispatch Email
                  </span>
                  <span className="font-mono text-emerald-400">Workshop Notification</span>
                </div>

                <div className="p-6 max-w-xl mx-auto space-y-6 bg-neutral-900/90 rounded-2xl m-4 border border-neutral-800 text-neutral-100">
                  {/* Stakey's Banner */}
                  <div className="bg-[#05C147] text-neutral-950 p-5 rounded-2xl text-center space-y-1 shadow-md">
                    <h2 className="text-2xl font-black tracking-widest uppercase">STAKEYS</h2>
                    <p className="text-xs font-bold tracking-wider uppercase opacity-90">CYCLES &amp; SCOOTER WORKSHOP</p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                    ⚡ NEW REPAIR BOOKING RECEIVED FOR WORKSHOP INTAKE
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
                      href={`mailto:${booking.customerEmail}?subject=${encodeURIComponent(`Regarding Your Stakey's Cycles Booking #${booking.id}`)}`}
                      className="flex-1 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider text-center transition-all"
                    >
                      ✉️ Reply to Customer via Email
                    </a>
                    <a
                      href={`tel:${booking.customerPhone}`}
                      className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs text-center transition-all"
                    >
                      📞 Call Phone
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Customer Delivery Meta */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>To: <strong className="text-white">{booking.customerEmail}</strong></span>
                  <span className="text-emerald-400 font-mono text-[11px]">Status: 250 OK (Email Delivered)</span>
                </div>
                <div className="text-neutral-400">
                  Subject: <span className="text-neutral-200 font-semibold">{customerEmailLog?.subject || `📋 Repair Request Received: ${booking.serviceTitle} (#${booking.id}) - Stakey's Cycles`}</span>
                </div>
                <div className="text-neutral-500 text-[11px] font-mono">
                  Timestamp: {customerEmailLog ? new Date(customerEmailLog.timestamp).toLocaleString() : new Date().toLocaleString()}
                </div>
              </div>

              {/* Customer Email Visual Preview */}
              <div className="border border-neutral-700/80 rounded-2xl overflow-hidden bg-neutral-950 shadow-inner">
                <div className="bg-neutral-900 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Customer Inbox View
                  </span>
                  <span className="font-mono text-emerald-400">Client Confirmation Email</span>
                </div>

                <div className="p-6 max-w-xl mx-auto space-y-6 bg-neutral-900/90 rounded-2xl m-4 border border-neutral-800 text-neutral-100">
                  {/* Stakey's Banner */}
                  <div className="bg-[#05C147] text-neutral-950 p-5 rounded-2xl text-center space-y-1 shadow-md">
                    <h2 className="text-2xl font-black tracking-widest uppercase">STAKEY'S</h2>
                    <p className="text-xs font-bold tracking-wider uppercase opacity-90">CYCLES &amp; SCOOTER</p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                    📋 REPAIR BOOKING CONFIRMATION &amp; INTAKE INSTRUCTIONS
                  </div>

                  <div className="text-xs text-neutral-300 leading-relaxed">
                    Hello <strong className="text-white">{booking.customerName}</strong>, thank you for booking your workshop service at Stakey's Cycles &amp; Scooter. Below are your booking details:
                  </div>

                  {/* Summary Card */}
                  <div className="space-y-3 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 text-xs">
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Booking Number:</span>
                      <span className="font-mono font-bold text-white">#{booking.id}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Service:</span>
                      <span className="font-bold text-[#05C147]">{booking.serviceTitle}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Bike / Vehicle:</span>
                      <span className="text-white font-medium">{booking.vehicleModel}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-800">
                      <span className="text-neutral-400">Scheduled Date:</span>
                      <span className="text-emerald-400 font-bold">
                        {booking.preferredDate} ({booking.preferredTimeSlot})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Approval Status:</span>
                      <span className="text-amber-300 font-bold">
                        {booking.approvalStatus === 'approved' ? 'Approved & Confirmed' : 'Pending Staff Review'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs space-y-1.5 text-neutral-300">
                    <div className="font-bold text-white">Workshop Drop-Off Location:</div>
                    <div>Stakey's Cycles &amp; Scooter Workshop Bay, Main Street</div>
                    <div className="text-neutral-400 text-[11px]">
                      Drop off your vehicle during your selected time window. Our workshop mechanic will conduct a safety check on arrival.
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={`mailto:${ownerConfig.ownerEmail}?subject=${encodeURIComponent(`Query regarding Booking #${booking.id}`)}`}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider text-center transition-all"
                    >
                      ✉️ Email Stakey's Workshop
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            Automated notification dispatch powered exclusively by Stakey's Email Engine
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
