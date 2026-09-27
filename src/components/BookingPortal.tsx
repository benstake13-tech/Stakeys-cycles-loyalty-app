import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  User,
  ArrowRight,
  Bike,
  Zap,
  ChevronDown,
  Sparkles,
  Award,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { VehicleCategory } from '../types/bikeShop';
import {
  BIKE_CATEGORY_OPTIONS,
  POPULAR_BIKE_BRANDS,
  BRAND_MODELS_MAP,
  FRIENDLY_SERVICE_OPTIONS,
} from '../data/bikeCatalog';
import { StakeysLogo } from './StakeysLogo';
import {
  createBookingMailtoUrl,
  createCustomerMailtoUrl,
} from '../utils/notificationService';
import confetti from 'canvas-confetti';

interface BookingPortalProps {
  initialBikeId?: string;
  onGoToMyBikes?: () => void;
}

export const BookingPortal: React.FC<BookingPortalProps> = ({ initialBikeId, onGoToMyBikes }) => {
  const { currentUser, createBooking, redeemServiceVoucher, ownerConfig } = useShop();

  // If user has saved bikes in profile, check if initialBikeId is set
  const savedBikes = currentUser?.bikes || [];
  const initialBike = savedBikes.find((b) => b.id === initialBikeId) || null;

  // Selected Category
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(
    initialBike ? initialBike.category : 'cycle'
  );

  // Selected Brand & Model dropdowns
  const [selectedBrand, setSelectedBrand] = useState<string>(
    initialBike ? initialBike.brand : 'Trek'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    initialBike ? initialBike.model : 'Marlin (Mountain)'
  );
  const [customModelText, setCustomModelText] = useState<string>('');
  const [bikeColour, setBikeColour] = useState<string>(initialBike?.colour || '');

  // Selected Friendly Problem / Service
  const [selectedProblemId, setSelectedProblemId] = useState<string>('opt-general-tune');

  // Available service vouchers (e.g. £40 service voucher for full stamps)
  const availableServiceVouchers = (currentUser?.serviceVouchers || []).filter(
    (v) => v.status === 'available' && v.type === 'service_credit'
  );
  const [applyVoucher, setApplyVoucher] = useState<boolean>(availableServiceVouchers.length > 0);

  // Contact & Schedule
  const [customerName, setCustomerName] = useState<string>(currentUser?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phoneNumber || '+44 7911 882910');
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('Morning (09:00 - 12:00)');
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Available models for currently chosen brand
  const brandModels = BRAND_MODELS_MAP[selectedBrand] || [
    'Standard Model',
    'Other Model',
    'I Don’t Know My Model',
  ];

  // Pick an existing bike from profile garage
  const handleSelectSavedBike = (bikeId: string) => {
    const found = savedBikes.find((b) => b.id === bikeId);
    if (!found) return;
    setSelectedCategory(found.category);
    setSelectedBrand(found.brand);
    setSelectedModel(found.model);
    setBikeColour(found.colour || '');
  };

  const currentProblem =
    FRIENDLY_SERVICE_OPTIONS.find((p) => p.id === selectedProblemId) ||
    FRIENDLY_SERVICE_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Please enter your phone number so our workshop team can contact you.');
      return;
    }
    if (customerEmail.trim() && !customerEmail.includes('@')) {
      setFormError('Please enter a valid email address or leave it blank to be notified via phone.');
      return;
    }
    if (!preferredDate) {
      setFormError('Please choose a preferred drop-off date.');
      return;
    }

    // Determine final model string
    const finalModel =
      selectedModel.includes('Other')
        ? customModelText.trim() || `${selectedBrand} (Model to be verified in shop)`
        : selectedModel;

    const formattedVehicleName = `${selectedBrand} - ${finalModel}${bikeColour ? ` (${bikeColour})` : ''}`;

    const selectedVoucher =
      applyVoucher && availableServiceVouchers.length > 0 ? availableServiceVouchers[0] : null;
    const voucherDiscount = selectedVoucher
      ? Math.min(currentProblem.estimatedPrice, selectedVoucher.value)
      : 0;
    const effectivePrice = Math.max(0, currentProblem.estimatedPrice - voucherDiscount);

    setIsSubmitting(true);
    try {
      const voucherNote = selectedVoucher
        ? `Applied £40 Service Voucher: ${selectedVoucher.code} (Labour only, parts not included - £${voucherDiscount} applied)`
        : '';
      const finalNotes = [notes.trim(), voucherNote, bikeColour ? `Colour: ${bikeColour}` : '']
        .filter(Boolean)
        .join(' • ');

      const sanitizedEmail =
        customerEmail.trim() ||
        `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'guest'}-${customerPhone.replace(/[^0-9]/g, '').slice(-4) || 'quick'}@guest.stakeysbikes.co.uk`;

      const newBooking = await createBooking({
        customerName: customerName.trim(),
        customerEmail: sanitizedEmail,
        customerPhone: customerPhone.trim(),
        customerId: currentUser?.uid,
        membershipNumber: currentUser?.membershipNumber,
        vehicleCategory: selectedCategory,
        vehicleModel: formattedVehicleName,
        serviceId: currentProblem.serviceId,
        serviceTitle: selectedVoucher
          ? `${currentProblem.headline} (£40 Voucher Applied)`
          : currentProblem.headline,
        servicePrice: effectivePrice,
        preferredDate,
        preferredTimeSlot,
        notes: finalNotes,
      });

      if (selectedVoucher && currentUser) {
        await redeemServiceVoucher(currentUser.uid, selectedVoucher.code);
      }

      setSubmittedBooking(newBooking);

      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#05C147', '#10b981', '#34d399', '#ffffff'],
        });
      } catch {
        // ignore
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setSubmittedBooking(null);
    setNotes('');
  };

  // SUCCESS CONFIRMATION VOUCHER
  if (submittedBooking) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="text-center space-y-3 pb-6 border-b border-neutral-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-xs text-neutral-400 font-mono">
              Reference #{submittedBooking.id} <span aria-hidden="true" className="text-neutral-600">·</span> Confirmation Sent to {submittedBooking.customerEmail}
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Workshop Repair Request Submitted
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting Mechanic Review &amp; Approval</span>
            </div>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Staff will contact you and evaluate bench capacity. An automated email notification will be dispatched to inform you immediately once approved or declined.
            </p>
          </div>

          {/* Ticket Summary Details */}
          <div className="py-6 space-y-3 text-xs border-b border-neutral-800/80">
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Bike / Vehicle:</span>
              <span className="font-semibold text-white">{submittedBooking.vehicleModel}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Service Package:</span>
              <span className="font-semibold text-emerald-400">{submittedBooking.serviceTitle}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Estimated Price:</span>
              <span className="font-mono text-white font-bold tabular-nums">
                {submittedBooking.servicePrice === 0 ? 'Free Inspection' : `£${submittedBooking.servicePrice}`}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Drop-off Schedule:</span>
              <span className="text-neutral-200">
                {submittedBooking.preferredDate} ({submittedBooking.preferredTimeSlot})
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Customer Contact:</span>
              <span className="text-neutral-300 font-mono">{submittedBooking.customerEmail}</span>
            </div>
          </div>

          {/* Email Confirmations Dispatched to Customer & Stakey's Cycles */}
          {(() => {
            return (
              <div className="py-5 space-y-4 border-b border-neutral-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Mail className="w-4 h-4 text-[#05C147]" />
                    <span>Email Confirmations Dispatched</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    2 / 2 EMAILS SENT
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Customer Email */}
                  <div className="bg-neutral-950/90 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        <span>Customer Email</span>
                      </span>
                      <span className="font-mono text-white text-[11px] truncate max-w-[150px]">{submittedBooking.customerEmail}</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-relaxed font-mono bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800">
                      "Repair request #{submittedBooking.id} received for {submittedBooking.serviceTitle}. Confirmation sent to your inbox."
                    </p>
                    <a
                      href={createCustomerMailtoUrl(submittedBooking)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Open Customer Email Draft</span>
                    </a>
                  </div>

                  {/* Stakey's Cycles Workshop Email */}
                  <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-[#05C147]" />
                        <span>Workshop Intake</span>
                      </span>
                      <span className="font-mono text-neutral-300 text-[11px] truncate max-w-[150px]">{ownerConfig.ownerEmail}</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-relaxed font-mono bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800">
                      "New booking #{submittedBooking.id} assigned to intake queue at {ownerConfig.ownerEmail}."
                    </p>
                    <a
                      href={createBookingMailtoUrl(submittedBooking, ownerConfig)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Open Workshop Email Alert</span>
                    </a>
                  </div>
                </div>

                {/* 24-Hour Reminder Notice */}
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-xs">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white mb-0.5">Automated 24-Hour Email Reminder Active</div>
                    <div className="text-neutral-300 leading-relaxed text-[11px]">
                      An automated reminder email will be delivered to your inbox (<strong>{submittedBooking.customerEmail}</strong>) 24 hours prior to your scheduled service slot on <strong>{submittedBooking.preferredDate}</strong> ({submittedBooking.preferredTimeSlot}).
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* What to do next */}
          <div className="py-5 text-xs text-neutral-400 space-y-2">
            <div className="text-neutral-200 font-medium mb-1">Drop-off instructions:</div>
            <div>Bring your bike to Stakey's Cycles during your selected time window. Our Cytech mechanic will perform a safety check with you before beginning repairs.</div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onGoToMyBikes && (
              <button
                type="button"
                onClick={onGoToMyBikes}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs cursor-pointer transition-colors"
              >
                View in My Garage
              </button>
            )}
            <button
              type="button"
              onClick={handleBookAnother}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium text-xs cursor-pointer transition-colors"
            >
              Book Another Service
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Atelier Hero Banner with High-Resolution Photography */}
      <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-[#0d1015] shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_workshop_craftsmanship_1790159761910.jpg"
            alt="Stakey's workshop atelier tools and repair bench"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-25 filter saturate-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#090b0e] via-[#090b0e]/85 to-[#090b0e]/40" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-2">
            <span className="text-emerald-400 font-semibold tracking-wider uppercase">
              Workshop Atelier
            </span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Cytech Certified Mechanics</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Genuine Parts Guarantee</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight text-balance">
            Book Your Cycle Service
          </h1>
          <p className="text-sm text-neutral-300 mt-2 max-w-xl leading-relaxed">
            Fast, transparent cycle &amp; e-scooter maintenance. Pick your brand, describe what you need, and drop it off at our workshop.
          </p>
        </div>
      </div>

      {/* QUICK PRE-FILL FROM SAVED BIKES (if logged in and has bikes) */}
      {savedBikes.length > 0 && (
        <div className="bg-[#0d1015] border border-neutral-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-white flex items-center gap-2">
              <Bike className="w-3.5 h-3.5 text-emerald-400" />
              Pre-fill from Your Garage
            </span>
            <span className="text-neutral-400 font-mono text-[11px]">1-Click Auto Fill</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedBikes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectSavedBike(b.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedBrand === b.brand && selectedModel === b.model
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                }`}
              >
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <span>{b.brand} {b.model}</span>
                {b.colour && <span className="text-neutral-400">({b.colour})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: What type of ride do you have? */}
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
              01
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Select Vehicle Type</h3>
              <p className="text-xs text-neutral-400">Choose the category matching your bike or scooter.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {BIKE_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedCategory === cat.id
                    ? 'bg-neutral-900 border-emerald-500/60 shadow-sm'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 text-neutral-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    {cat.id === 'electric_scooter' || cat.id === 'ebike' ? (
                      <Zap className={`w-4 h-4 ${selectedCategory === cat.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    ) : (
                      <Bike className={`w-4 h-4 ${selectedCategory === cat.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    )}
                    {selectedCategory === cat.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </div>
                  <div className={`text-xs font-semibold ${selectedCategory === cat.id ? 'text-white' : 'text-neutral-300'}`}>
                    {cat.title}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {cat.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* STEP 2: Brand and Model Dropdowns */}
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
              02
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Brand &amp; Model</h3>
              <p className="text-xs text-neutral-400">Select your bike's maker and model, or pick "I Don't Know" and we'll check it in store.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Brand Dropdown */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Manufacturer / Brand
              </label>
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    const newBrand = e.target.value;
                    setSelectedBrand(newBrand);
                    const models = BRAND_MODELS_MAP[newBrand];
                    if (models && models.length > 0) {
                      setSelectedModel(models[0]);
                    } else {
                      setSelectedModel('Standard Model');
                    }
                  }}
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  {POPULAR_BIKE_BRANDS.map((brand) => (
                    <option key={brand} value={brand} className="bg-neutral-950 text-white">
                      {brand}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Model Dropdown */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Model (or Closest Match)
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  {brandModels.map((m) => (
                    <option key={m} value={m} className="bg-neutral-950 text-white">
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Custom model text */}
          {(selectedModel.includes('Other') || selectedBrand === 'Other / Not Listed') && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Specify Model (Optional)
              </label>
              <input
                type="text"
                value={customModelText}
                onChange={(e) => setCustomModelText(e.target.value)}
                placeholder="e.g. Vintage Sprint, Dual Hardtail"
                className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Bike Colour */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center justify-between">
              <span>Bike Colour (Optional)</span>
              <span className="text-[11px] text-neutral-500">Assists our technicians at drop-off</span>
            </label>
            <input
              type="text"
              value={bikeColour}
              onChange={(e) => setBikeColour(e.target.value)}
              placeholder="e.g. Matte Black, Deep Blue, Emerald Green"
              className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* STEP 3: What do you need help with? */}
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
              03
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Select Service Package</h3>
              <p className="text-xs text-neutral-400">Written in plain language — no technical cycling jargon.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {FRIENDLY_SERVICE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedProblemId(opt.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedProblemId === opt.id
                    ? 'bg-neutral-900 border-emerald-500/60 shadow-sm'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-xs font-semibold ${selectedProblemId === opt.id ? 'text-white' : 'text-neutral-200'}`}>
                      {opt.headline}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                      {opt.estimatedPrice === 0 ? 'Free' : `£${opt.estimatedPrice}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {opt.symptom}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                  <span>Est. {opt.duration}</span>
                  {selectedProblemId === opt.id && (
                    <span className="text-emerald-400 font-bold">Selected</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* STEP 4: Choose Date, Time & Contact Info */}
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
              04
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Drop-Off Window &amp; Contact</h3>
              <p className="text-xs text-neutral-400">Choose your preferred date, time slot, and notification phone number.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Preferred Drop-off Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={preferredDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Time Window
              </label>
              <div className="relative">
                <select
                  value={preferredTimeSlot}
                  onChange={(e) => setPreferredTimeSlot(e.target.value)}
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  <option value="Morning (09:00 - 12:00)">Morning (09:00 - 12:00)</option>
                  <option value="Midday (12:00 - 15:00)">Midday (12:00 - 15:00)</option>
                  <option value="Afternoon (15:00 - 18:00)">Afternoon (15:00 - 18:00)</option>
                  <option value="Saturday Morning (09:30 - 13:00)">Saturday Morning (09:30 - 13:00)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Contact Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+44 7911 123456"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>Email Address (for notifications)</span>
                <span className="text-[10px] text-neutral-500 font-normal">Required for confirmations</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Repair Booking Policy: </span>
              All bookings are submitted as <em>Pending Staff Approval</em>. Once reviewed, you receive an automated confirmation email notifying you if the booking has been accepted or declined.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Mechanic Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rear brake feels spongy, or need back before Friday commute"
              className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* Voucher Redemption Option */}
        {availableServiceVouchers.length > 0 && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>£40 Service Voucher Available!</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={applyVoucher}
                  onChange={(e) => setApplyVoucher(e.target.checked)}
                  className="rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Apply Voucher to this booking</span>
              </label>
            </div>
            <p className="text-xs text-neutral-300">
              {availableServiceVouchers[0].description ||
                'Eligible for £40 service (labour only, parts not included)'}
              <span className="font-mono text-emerald-400 font-bold block mt-0.5">
                Voucher Code: {availableServiceVouchers[0].code}
              </span>
            </p>
            {applyVoucher && (
              <div className="text-[11px] text-emerald-300 font-semibold bg-emerald-500/20 px-2.5 py-1 rounded-md inline-block">
                ✓ £{Math.min(currentProblem.estimatedPrice, 40)} labour credit will be applied at till (Labour only, parts not included)
              </div>
            )}
          </div>
        )}

        {/* Error Notice */}
        {formError && (
          <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2">
          {(() => {
            const selectedVoucher =
              applyVoucher && availableServiceVouchers.length > 0 ? availableServiceVouchers[0] : null;
            const voucherDiscount = selectedVoucher
              ? Math.min(currentProblem.estimatedPrice, selectedVoucher.value)
              : 0;
            const effectivePrice = Math.max(0, currentProblem.estimatedPrice - voucherDiscount);

            return (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-sm shadow-xl shadow-emerald-500/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Confirming Your Workshop Booking...</span>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>
                      Confirm Service Booking ·{' '}
                      {effectivePrice === 0 ? 'Free Service' : `£${effectivePrice}`}
                      {voucherDiscount > 0 ? ' (£40 Labour Credit Applied)' : ''}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            );
          })()}
          <div className="text-center text-xs text-neutral-400 mt-2">
            No upfront payment required. You only pay after your cycle has been serviced and inspected.
          </div>
        </div>
      </form>
    </div>
  );
};
