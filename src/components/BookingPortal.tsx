import React, { useMemo, useState } from 'react';
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
  Award,
  ShieldCheck,
  CircleDot,
  MessageCircle,
  Scale,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { VehicleCategory, BikeDetails } from '../types/bikeShop';
import { BIKE_CATEGORY_OPTIONS, FRIENDLY_SERVICE_OPTIONS, TIME_SLOT_OPTIONS } from '../data/bikeCatalog';
import { StakeysLogo } from './StakeysLogo';
import { LegalDisclaimerSections } from './LegalDisclaimers';
import { BikeIssuesChecklist } from './BikeIssuesChecklist';
import {
  BikeIdentityFields,
  BikeIdentityValue,
  EMPTY_BIKE_IDENTITY,
  toBikeDetails,
  resolveModel,
  isEbike,
} from './BikeIdentityFields';
import { ALL_BIKE_ISSUES_MAP, issueAppliesToVehicle } from '../data/bikeIssuesCatalog';
import { buildWhatsAppUrl, buildBookingQuoteMessage } from '../utils/whatsapp';
import {
  createBookingMailtoUrl,
  createCustomerMailtoUrl,
} from '../utils/notificationService';
import confetti from 'canvas-confetti';

interface BookingPortalProps {
  initialBikeId?: string;
  onGoToMyBikes?: () => void;
  onGoToBookings?: () => void;
}

export const BookingPortal: React.FC<BookingPortalProps> = ({ initialBikeId, onGoToMyBikes, onGoToBookings }) => {
  const { currentUser, createBooking, redeemServiceVoucher, ownerConfig } = useShop();

  // If user has saved bikes in profile, check if initialBikeId is set
  const savedBikes = currentUser?.bikes || [];
  const initialBike = savedBikes.find((b) => b.id === initialBikeId) || null;

  // Selected Category
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(
    initialBike ? initialBike.category : 'cycle'
  );

  // Structured bike identity (brand, model, year, colour, e-bike conversion…).
  const [bikeIdentity, setBikeIdentity] = useState<BikeIdentityValue>(() => ({
    ...EMPTY_BIKE_IDENTITY,
    category: initialBike ? initialBike.category : 'cycle',
    brand: initialBike ? initialBike.brand : 'Trek',
    model: initialBike ? initialBike.model : 'FX 1 / 2 / 3 (Hybrid Commuter)',
    colour: initialBike?.colour || '',
    year: initialBike?.year ? String(initialBike.year) : '',
    frameSize: initialBike?.frameSizeOrNotes || '',
    serialNumber: initialBike?.serialNumber || '',
    ebikeStatus: initialBike?.bikeDetails?.ebikeStatus || '',
    conversionSystem: initialBike?.bikeDetails?.conversionSystem || '',
    batteryPosition: initialBike?.bikeDetails?.batteryPosition || '',
    systemVoltage: initialBike?.bikeDetails?.systemVoltage || '',
    driveType: initialBike?.bikeDetails?.driveType || '',
    motorDetails: initialBike?.bikeDetails?.motorDetails || '',
  }));

  const patchBike = (patch: Partial<BikeIdentityValue>) =>
    setBikeIdentity((prev) => ({ ...prev, ...patch }));

  // Keep the category cards (step 01) and the identity object in lock-step.
  const chooseCategory = (category: VehicleCategory) => {
    setSelectedCategory(category);
    patchBike({ category });
    // Drop any selected symptoms that don't apply to the new vehicle type, so a
    // bike-specific fault can't linger on an e-scooter booking (and vice versa).
    setSelectedIssueIds((prev) => prev.filter((id) => issueAppliesToVehicle(id, category)));
  };

  // Structured Problem Checklist State (Choose all that apply)
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([
    'brakes-squeaky',
  ]);
  const [problemNotes, setProblemNotes] = useState<string>('');
  const [problemSelectionMode, setProblemSelectionMode] = useState<'checklist' | 'packages'>('checklist');

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
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>(TIME_SLOT_OPTIONS[0]);
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Collapsible step sections so the (long) form is quicker to scan on mobile.
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({
    vehicle: true,
    issues: true,
    schedule: true,
    contact: true,
  });
  const toggleStep = (id: string) =>
    setOpenSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  const goToStep = (id: string) => {
    setOpenSteps((prev) => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`booking-step-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resolvedModelName = resolveModel(bikeIdentity);

  // Puncture / flat-tyre jobs need the wheel size confirmed at booking so the
  // workshop can prep the right tube before the rider arrives.
  const isPunctureJob = useMemo(() => {
    if (problemSelectionMode === 'packages') {
      const p = FRIENDLY_SERVICE_OPTIONS.find((opt) => opt.id === selectedProblemId);
      return p?.serviceId === 'cycle-puncture' || p?.serviceId === 'scooter-tire';
    }
    return selectedIssueIds.includes('wheels-flat-puncture');
  }, [problemSelectionMode, selectedProblemId, selectedIssueIds]);
  const [wheelSize, setWheelSize] = useState<string>('');

  const bikeStepComplete = Boolean(bikeIdentity.brand && resolvedModelName);
  const issuesStepComplete = problemSelectionMode === 'packages'
    ? Boolean(selectedProblemId)
    : selectedIssueIds.length > 0 || problemNotes.trim().length > 0;
  const scheduleStepComplete = Boolean(preferredDate && preferredTimeSlot);
  const contactStepComplete = Boolean(customerName.trim() && customerPhone.trim());
  const wheelSizeStepComplete = !isPunctureJob || wheelSize.trim().length > 0;
  const bookingProgress = [bikeStepComplete, issuesStepComplete, scheduleStepComplete, contactStepComplete].filter(Boolean).length;

  // Pick an existing bike from profile garage
  const handleSelectSavedBike = (bikeId: string) => {
    const found = savedBikes.find((b) => b.id === bikeId);
    if (!found) return;
    setSelectedCategory(found.category);
    setBikeIdentity((prev) => ({
      ...prev,
      category: found.category,
      brand: found.brand,
      model: found.model,
      colour: found.colour || '',
      year: found.year ? String(found.year) : '',
      frameSize: found.frameSizeOrNotes || '',
      serialNumber: found.serialNumber || '',
      ebikeStatus: found.bikeDetails?.ebikeStatus || prev.ebikeStatus,
      conversionSystem: found.bikeDetails?.conversionSystem || '',
      batteryPosition: found.bikeDetails?.batteryPosition || '',
      systemVoltage: found.bikeDetails?.systemVoltage || '',
      driveType: found.bikeDetails?.driveType || '',
      motorDetails: found.bikeDetails?.motorDetails || '',
    }));
  };

  // Friendly quick-pick dates (today / tomorrow / +2 / +7) plus the native picker.
  const quickDates = useMemo(() => {
    const make = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    };
    return [
      { label: 'Today', value: make(0) },
      { label: 'Tomorrow', value: make(1) },
      { label: 'In 2 days', value: make(2) },
      { label: 'Next week', value: make(7) },
    ];
  }, []);

  const computedService = React.useMemo(() => {
    if (problemSelectionMode === 'packages') {
      const p =
        FRIENDLY_SERVICE_OPTIONS.find((opt) => opt.id === selectedProblemId) ||
        FRIENDLY_SERVICE_OPTIONS[0];
      return {
        serviceId: p.serviceId,
        headline: p.headline,
        estimatedPrice: 0,
        pricingLabel: 'Ask for a quote',
        duration: p.duration,
      };
    }

    // Checklist mode
    if (selectedIssueIds.length === 0) {
      if (problemNotes.trim()) {
        return {
          serviceId: 'cycle-tune',
          headline: 'Custom Workshop Diagnostic & Repair',
          estimatedPrice: 0,
          pricingLabel: 'Ask for a quote',
          duration: '30 mins',
        };
      }
      return {
        serviceId: 'cycle-tune',
        headline: 'General Workshop Diagnostic & Inspection',
        estimatedPrice: 0,
        pricingLabel: 'Ask for a quote',
        duration: '45 mins',
      };
    }

    if (selectedIssueIds.length === 1) {
      const item = ALL_BIKE_ISSUES_MAP.get(selectedIssueIds[0]);
      return {
        serviceId:
          selectedIssueIds[0] === 'wheels-flat-puncture' ? 'cycle-puncture' : 'cycle-tune',
        headline: item ? `${item.category}: ${item.label}` : 'Single Issue Repair',
        estimatedPrice: 0,
        pricingLabel: 'Ask for a quote',
        duration: '30 mins',
      };
    }

    // Multiple issues selected
    const categories = Array.from(
      new Set(
        selectedIssueIds
          .map((id) => ALL_BIKE_ISSUES_MAP.get(id)?.category)
          .filter(Boolean)
      )
    );
    const catStr = categories.slice(0, 2).join(' & ');
    return {
      serviceId: 'cycle-tune',
      headline: `${catStr} Repair (${selectedIssueIds.length} Symptoms Selected)`,
      estimatedPrice: 0,
      pricingLabel: 'Ask for a quote',
      duration: '45-60 mins',
    };
  }, [problemSelectionMode, selectedProblemId, selectedIssueIds, problemNotes]);

  // Mechanic notes are mandatory and pre-populated from the selected job. The
  // prefill only overwrites notes the rider has not edited, so their own words
  // are never lost when they change the service selection.
  const notesPrefill = useMemo(() => {
    const lines: string[] = [computedService.headline];
    const symptoms = selectedIssueIds
      .map((id) => ALL_BIKE_ISSUES_MAP.get(id))
      .filter(Boolean)
      .map((it) => `• [${it!.category}] ${it!.label}`);
    if (symptoms.length > 0) {
      lines.push('Reported symptoms:', ...symptoms);
    }
    if (problemNotes.trim()) {
      lines.push(`Rider description: ${problemNotes.trim()}`);
    }
    if (wheelSize.trim()) {
      lines.push(`Wheel size: ${wheelSize.trim()}`);
    }
    return lines.join('\n');
  }, [computedService.headline, selectedIssueIds, problemNotes, wheelSize]);

  const notesEditedRef = React.useRef(false);
  React.useEffect(() => {
    if (!notesEditedRef.current) {
      setNotes(notesPrefill);
    }
  }, [notesPrefill]);

  // Pre-filled WhatsApp link for bespoke jobs / custom quotes.
  const whatsappQuoteUrl = useMemo(
    () =>
      buildWhatsAppUrl(
        buildBookingQuoteMessage({
          vehicle: `${bikeIdentity.brand} ${resolvedModelName}`.trim(),
          service: computedService.headline,
          preferredDate,
          preferredTimeSlot,
        })
      ),
    [bikeIdentity.brand, resolvedModelName, computedService.headline, preferredDate, preferredTimeSlot]
  );

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

    if (
      problemSelectionMode === 'checklist' &&
      selectedIssueIds.length === 0 &&
      !problemNotes.trim()
    ) {
      setFormError('Please select at least one problem symptom or describe your issue.');
      return;
    }

    if (isPunctureJob && !wheelSize.trim()) {
      setFormError('Please confirm your wheel size — puncture repairs need the correct inner tube.');
      return;
    }

    if (!notes.trim()) {
      setFormError('Please add mechanic notes describing the job (these are pre-filled from your selection).');
      return;
    }

    // Determine final model string
    const finalModel = resolveModel(bikeIdentity);

    const formattedVehicleName = `${bikeIdentity.brand} - ${finalModel}${
      bikeIdentity.colour ? ` (${bikeIdentity.colour})` : ''
    }`;

    const bikeDetails: BikeDetails | undefined = toBikeDetails(bikeIdentity);

    const selectedVoucher =
      applyVoucher && availableServiceVouchers.length > 0 ? availableServiceVouchers[0] : null;
    const effectivePrice = 0; // Priced upon completion by staff quote/invoice

    setIsSubmitting(true);
    try {
      const voucherNote = selectedVoucher
        ? `Applied £40 Service Voucher: ${selectedVoucher.code} (To be credited on final repair invoice)`
        : '';

      const issueItems = selectedIssueIds
        .map((id) => ALL_BIKE_ISSUES_MAP.get(id))
        .filter(Boolean);

      const issuesBlock =
        issueItems.length > 0
          ? `Reported Symptoms (${issueItems.length}):\n` +
            issueItems.map((it) => `• [${it?.category}] ${it?.label}`).join('\n')
          : '';

      const ebikeLabel =
        bikeIdentity.ebikeStatus === 'factory'
          ? 'Factory e-bike'
          : bikeIdentity.ebikeStatus === 'converted'
          ? 'CONVERTED to e-bike (aftermarket kit)'
          : bikeIdentity.ebikeStatus === 'not_ebike'
          ? 'Not an e-bike'
          : bikeIdentity.ebikeStatus === 'unsure'
          ? 'E-bike status to be confirmed'
          : '';

      const bikeBlock = [
        `Bike: ${formattedVehicleName}`,
        bikeIdentity.year ? `Year: ${bikeIdentity.year}` : '',
        bikeIdentity.frameSize ? `Frame size: ${bikeIdentity.frameSize}` : '',
        bikeIdentity.serialNumber ? `Serial: ${bikeIdentity.serialNumber}` : '',
        ebikeLabel ? `E-Bike: ${ebikeLabel}` : '',
        bikeIdentity.conversionSystem ? `Motor/system: ${bikeIdentity.conversionSystem}` : '',
        bikeIdentity.batteryPosition ? `Battery: ${bikeIdentity.batteryPosition}` : '',
        bikeIdentity.systemVoltage ? `Voltage: ${bikeIdentity.systemVoltage}` : '',
        bikeIdentity.driveType ? `Drive: ${bikeIdentity.driveType}` : '',
        bikeIdentity.motorDetails ? `Motor notes: ${bikeIdentity.motorDetails}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const finalNotes = [
        bikeBlock,
        issuesBlock,
        isPunctureJob && wheelSize.trim() ? `Wheel size (confirmed): ${wheelSize.trim()}` : '',
        problemNotes.trim() ? `Other Issues / Symptoms: ${problemNotes.trim()}` : '',
        notes.trim() ? `Customer Instructions: ${notes.trim()}` : '',
        voucherNote,
      ]
        .filter(Boolean)
        .join('\n\n');

      const sanitizedEmail =
        customerEmail.trim() ||
        `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'guest'}-${customerPhone.replace(/[^0-9]/g, '').slice(-4) || 'quick'}@guest.stakeysbikes.co.uk`;

      const newBooking = await createBooking({
        customerName: customerName.trim(),
        customerEmail: sanitizedEmail,
        customerPhone: customerPhone.trim(),
        customerId: currentUser?.uid,
        membershipNumber: currentUser?.membershipNumber,
        vehicleCategory: bikeIdentity.category,
        vehicleModel: formattedVehicleName,
        bikeDetails,
        serviceId: computedService.serviceId,
        serviceTitle: selectedVoucher
          ? `${computedService.headline} (£40 Voucher Applied)`
          : computedService.headline,
        servicePrice: effectivePrice,
        preferredDate,
        preferredTimeSlot,
        notes: finalNotes,
        selectedIssues: selectedIssueIds,
        otherNotes: problemNotes.trim() || undefined,
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
    notesEditedRef.current = false;
    setWheelSize('');
    setNotes(notesPrefill);
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
            {submittedBooking.bikeDetails && (
              <div className="flex justify-between py-1 gap-3">
                <span className="text-neutral-400 shrink-0">Bike Details:</span>
                <span className="text-neutral-200 text-right">
                  {[
                    submittedBooking.bikeDetails.ebikeStatus === 'factory'
                      ? 'Factory e-bike'
                      : submittedBooking.bikeDetails.ebikeStatus === 'converted'
                      ? 'Converted e-bike'
                      : submittedBooking.bikeDetails.ebikeStatus === 'not_ebike'
                      ? 'Not an e-bike'
                      : '',
                    submittedBooking.bikeDetails.year && `Year ${submittedBooking.bikeDetails.year}`,
                    submittedBooking.bikeDetails.frameSize && `Frame ${submittedBooking.bikeDetails.frameSize}`,
                    submittedBooking.bikeDetails.conversionSystem,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Captured at booking'}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Service Package:</span>
              <span className="font-semibold text-emerald-400">{submittedBooking.serviceTitle}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Pricing / Quote:</span>
              <span className="font-mono text-emerald-400 font-bold">
                Ask for a quote (Itemized invoice sent upon repair completion)
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

            {/* Reported Symptoms Badges in Confirmation */}
            {submittedBooking.selectedIssues && submittedBooking.selectedIssues.length > 0 && (
              <div className="pt-2.5 mt-2 border-t border-neutral-800/80">
                <span className="text-neutral-400 block mb-1.5 font-medium text-[11px] uppercase tracking-wider font-mono">
                  Reported Issues / Symptoms ({submittedBooking.selectedIssues.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {submittedBooking.selectedIssues.map((id: string) => {
                    const it = ALL_BIKE_ISSUES_MAP.get(id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#05C147]" />
                        <span>{it ? it.label : id}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Email Confirmations Dispatched to Customer & Stakey's Cycles */}
          {(currentUser?.role === 'staff' || currentUser?.role === 'admin') && (() => {
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
            <div>Bring your bike to Stakey's Cycles during your selected time window. Our workshop mechanic will perform a safety check with you before beginning repairs.</div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 flex-wrap">
            {onGoToMyBikes && (
              <button
                type="button"
                onClick={onGoToMyBikes}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs cursor-pointer transition-colors"
              >
                View in My Garage
              </button>
            )}
            {onGoToBookings && (
              <button
                type="button"
                onClick={onGoToBookings}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/40 text-emerald-300 font-medium text-xs cursor-pointer transition-colors"
              >
                Track This Booking
              </button>
            )}
            <button
              type="button"
              onClick={handleBookAnother}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium text-xs cursor-pointer transition-colors"
            >
              Book Another Service
            </button>
            <a
              href="#customer"
              onClick={(e) => {
                e.preventDefault();
                (onGoToMyBikes ?? onGoToBookings)?.();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-neutral-400 hover:text-white font-medium text-xs cursor-pointer transition-colors text-center"
            >
              Back to Stakey&rsquo;s App
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Workshop Hero Banner with High-Resolution Photography */}
      <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-[#0d1015] shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_workshop_craftsmanship_1790159761910.jpg"
            alt="Stakey's workshop tools and repair bench"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-25 filter saturate-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#090b0e] via-[#090b0e]/85 to-[#090b0e]/40" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-2">
            <span className="text-emerald-400 font-semibold tracking-wider uppercase">
              Workshop
            </span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Workshop Mechanics</span>
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
                  bikeIdentity.brand === b.brand && bikeIdentity.model === b.model
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
        {/* Live summary — sticks to the top while the form scrolls. */}
        <div className="sticky top-2 z-20 bg-[#0d1015]/95 backdrop-blur border border-neutral-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs shadow-lg">
          <span className="flex items-center gap-1.5 text-white font-semibold">
            <Bike className="w-3.5 h-3.5 text-emerald-400" />
            {bikeIdentity.brand} {resolveModel(bikeIdentity) || '—'}
          </span>
          {isEbike(bikeIdentity) && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
              <Zap className="w-3 h-3" />
              {bikeIdentity.ebikeStatus === 'converted' ? 'Converted E-Bike' : 'E-Bike'}
            </span>
          )}
          <span className="text-neutral-500 hidden sm:inline">•</span>
          <span className="text-neutral-300 truncate max-w-[220px]">{computedService.headline}</span>
          <span className="text-neutral-500 hidden sm:inline">•</span>
          <span className="text-neutral-400">
            {preferredDate} · {preferredTimeSlot}
          </span>
          <span className="ml-auto text-emerald-400 font-semibold">Ask for a quote</span>
        </div>

        {/* Step progress — tap a step to jump to it. */}
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl px-3 sm:px-5 py-3.5">
          <div className="flex items-center justify-between gap-2">
            {[
              { id: 'vehicle', n: '01', label: 'Your Bike', done: bikeStepComplete },
              { id: 'issues', n: '02', label: 'Issues', done: issuesStepComplete },
              { id: 'schedule', n: '03', label: 'Drop-off', done: scheduleStepComplete },
              { id: 'contact', n: '04', label: 'Contact', done: contactStepComplete },
            ].map((step, i, arr) => (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className="flex flex-col items-center gap-1.5 flex-1 min-w-0 cursor-pointer group"
                  aria-label={`Go to step ${step.n}: ${step.label}`}
                >
                  <span
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-bold font-mono shrink-0 transition-colors ${
                      step.done
                        ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 group-hover:border-emerald-500/50'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
                  </span>
                  <span
                    className={`text-[10px] sm:text-[11px] font-medium truncate max-w-full ${
                      step.done ? 'text-emerald-300' : 'text-neutral-400 group-hover:text-neutral-200'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {i < arr.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full self-start mt-3.5 ${
                      step.done ? 'bg-emerald-500/60' : 'bg-neutral-800'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
            <span>
              {bookingProgress} of 4 steps ready
            </span>
            <span className="font-mono">{Math.round((bookingProgress / 4) * 100)}%</span>
          </div>
        </div>

        {/* STEP 1: Your bike (category + identity + e-bike conversion) */}
        <div id="booking-step-vehicle" className="scroll-mt-24 bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <button
            type="button"
            onClick={() => toggleStep('vehicle')}
            className="w-full flex items-center gap-3 text-left cursor-pointer"
          >
            <div className={`w-7 h-7 rounded-lg border font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
              bikeStepComplete
                ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                : 'bg-neutral-900 border-neutral-800 text-emerald-400'
            }`}>
              {bikeStepComplete ? <CheckCircle2 className="w-4 h-4" /> : '01'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-bold text-white">Your Bike</h3>
              <p className="text-xs text-neutral-400">
                {bikeStepComplete
                  ? `${bikeIdentity.brand} ${resolvedModelName}${isEbike(bikeIdentity) ? ' · e-bike' : ''}`
                  : 'Type, brand, model, year and e-bike conversion details.'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${
                openSteps.vehicle ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openSteps.vehicle && (
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BIKE_CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => chooseCategory(cat.id)}
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

              <BikeIdentityFields
                value={bikeIdentity}
                onChange={patchBike}
                showCategory={false}
                idPrefix="booking-bike"
              />
            </div>
          )}
        </div>

        {/* STEP 2: Problem Identification & Services */}
        <div id="booking-step-issues" className="scroll-mt-24 bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => toggleStep('issues')}
              className="flex items-center gap-3 text-left cursor-pointer flex-1 min-w-0"
            >
              <div className={`w-7 h-7 rounded-lg border font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                issuesStepComplete
                  ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                  : 'bg-neutral-900 border-neutral-800 text-emerald-400'
              }`}>
                {issuesStepComplete ? <CheckCircle2 className="w-4 h-4" /> : '02'}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  Identify Bike Issues &amp; Service
                  <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openSteps.issues ? 'rotate-180' : ''}`} />
                </h3>
                <p className="text-xs text-neutral-400 truncate">
                  {issuesStepComplete ? computedService.headline : 'Select specific symptoms or choose an all-inclusive service package.'}
                </p>
              </div>
            </button>

            {/* Mode Switcher Tabs */}
            <div className="inline-flex p-1 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setProblemSelectionMode('checklist')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  problemSelectionMode === 'checklist'
                    ? 'bg-[#05C147] text-neutral-950 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>Choose Symptoms (Checklist)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  problemSelectionMode === 'checklist' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  Popular
                </span>
              </button>
              <button
                type="button"
                onClick={() => setProblemSelectionMode('packages')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  problemSelectionMode === 'packages'
                    ? 'bg-[#05C147] text-neutral-950 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>Fixed Packages</span>
              </button>
            </div>
          </div>

          {openSteps.issues && (
          <>
          {/* Mode 1: Multi-Select Issues Checklist */}
          {problemSelectionMode === 'checklist' ? (
            <div className="space-y-4 pt-1">
              <BikeIssuesChecklist
                selectedIssueIds={selectedIssueIds}
                onChange={setSelectedIssueIds}
                otherNotes={problemNotes}
                onOtherNotesChange={setProblemNotes}
                vehicleCategory={selectedCategory}
              />
            </div>
          ) : (
            /* Mode 2: Fixed Service Packages */
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
                        Ask for a quote
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
          )}

          {/* Dynamic Workshop Diagnostic Summary Card */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-neutral-400 block text-[11px] font-mono uppercase tracking-wider">
                Intake Assessment Summary
              </span>
              <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                <span>{computedService.headline}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-400 font-normal">Est. Duration: {computedService.duration}</span>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-[10px] text-neutral-500 font-mono uppercase">Workshop Pricing</div>
              <div className="text-sm font-bold text-emerald-400">
                Ask for a quote (Quoted upon inspection)
              </div>
            </div>
          </div>

          {/* Mandatory wheel size for puncture / flat-tyre jobs */}
          {isPunctureJob && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <CircleDot className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <label htmlFor="booking-wheel-size" className="block text-xs font-bold text-white">
                    Confirm your wheel size <span className="text-rose-400">*</span>
                  </label>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    Puncture repairs need the correct tube. The size is printed on the tyre sidewall
                    (e.g. 26", 27.5", 29", 700c, or a scooter size like 8.5"). Leave a note if you’re unsure.
                  </p>
                </div>
              </div>
              <input
                id="booking-wheel-size"
                type="text"
                required
                value={wheelSize}
                onChange={(e) => setWheelSize(e.target.value)}
                placeholder='e.g. 27.5" x 2.10, 700x38c, or 8.5" scooter tyre'
                className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
          </>
          )}
        </div>

        {/* STEP 3: Choose Date, Time & Contact Info */}
        <div id="booking-step-schedule" className="scroll-mt-24 bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <button
            type="button"
            onClick={() => toggleStep('schedule')}
            className="w-full flex items-center gap-3 text-left cursor-pointer"
          >
            <div className={`w-7 h-7 rounded-lg border font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
              scheduleStepComplete
                ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                : 'bg-neutral-900 border-neutral-800 text-emerald-400'
            }`}>
              {scheduleStepComplete ? <CheckCircle2 className="w-4 h-4" /> : '03'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-bold text-white">Drop-Off Window</h3>
              <p className="text-xs text-neutral-400">
                {scheduleStepComplete ? `${preferredDate} · ${preferredTimeSlot}` : 'Choose your preferred drop-off date and time slot.'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${
                openSteps.schedule ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openSteps.schedule && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Preferred Drop-off Date
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quickDates.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setPreferredDate(q.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                      preferredDate === q.value
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
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
                  {TIME_SLOT_OPTIONS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Booked drop-offs run from 2:00 PM onwards. Workshop open Mon–Fri 09:00–18:00, Sat 09:30–13:00.
              </p>
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
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center justify-between">
              <span>
                Mechanic Notes <span className="text-rose-400">*</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">Pre-filled from your selection — edit if needed</span>
            </label>
            <textarea
              rows={4}
              required
              value={notes}
              onChange={(e) => {
                notesEditedRef.current = true;
                setNotes(e.target.value);
              }}
              placeholder="e.g. Rear brake feels spongy, or need back before Friday commute"
              className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          </>
          )}
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
                ✓ £40 Service Voucher will be credited directly against your final itemized repair invoice (Labour only, parts not included)
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
        <div className="pt-2 space-y-3">
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
                <span>Book Workshop Service</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <a
            href={whatsappQuoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5a] text-neutral-950 font-bold text-sm shadow-xl shadow-emerald-500/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Request a Quote on WhatsApp</span>
          </a>

          <div className="text-center text-xs text-neutral-400">
            No upfront payment required. Book online and our mechanic will evaluate your vehicle on drop-off, or send bespoke job details/photos straight to the workshop on WhatsApp for a quote.
          </div>

          {/* Legal disclaimers — mobile call-out, repairs, e-scooter use & storage */}
          <div className="pt-3 mt-1 border-t border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Legal Disclaimers &amp; Service Terms</span>
            </div>
            <LegalDisclaimerSections variant="accordion" idPrefix="booking-legal" />
          </div>
        </div>
      </form>
    </div>
  );
};
