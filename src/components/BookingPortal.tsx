import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  MapPin,
  Gift,
  Siren,
  Truck,
  Tag,
  Plus,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { VehicleCategory, BikeDetails } from '../types/bikeShop';
import { BIKE_CATEGORY_OPTIONS, FRIENDLY_SERVICE_OPTIONS, TIME_SLOT_OPTIONS } from '../data/bikeCatalog';
import { SOS_SURCHARGE, SOS_NOTES_MARKER, isSosBooking } from '../utils/sosRepair';
import {
  EXPRESS_SOS_SURCHARGE,
  ExpressSosTileId,
  buildExpressSosNote,
  expressSosIssueIds,
  expressSosTileFor,
} from '../utils/expressSos';
import { ExpressSosMode, SosVehicleOption } from './ExpressSosMode';
import { StakeysLogo } from './StakeysLogo';
import { BikeIssuesChecklist } from './BikeIssuesChecklist';
import {
  BikeIdentityFields,
  BikeIdentityValue,
  EMPTY_BIKE_IDENTITY,
  toBikeDetails,
  resolveModel,
  isEbike,
} from './BikeIdentityFields';
import { ALL_BIKE_ISSUES_MAP } from '../data/bikeIssuesCatalog';
import { PolicyDisclaimers } from './PolicyDisclaimers';
import { BookingRidingWeather } from './weather/BookingRidingWeather';
import { BOOKING_POLICY_DISCLAIMERS } from '../utils/workshopPolicy';
import {
  referralCodeFromSearch,
  isFullService,
  describeFriendReward,
  FRIEND_REWARD,
} from '../utils/referral';
import {
  createBookingMailtoUrl,
  createCustomerMailtoUrl,
} from '../utils/notificationService';
import { findDiscountCode, validateDiscountCode } from '../utils/discountService';
import { websiteDiscountCatalogue, discountCodeFromSearch } from '../utils/websiteDiscounts';
import confetti from 'canvas-confetti';

interface BookingPortalProps {
  initialBikeId?: string;
  onGoToMyBikes?: () => void;
  /**
   * Called after a booking is submitted. The website surface uses this to send
   * the visitor back to the homepage once their confirmation has been shown.
   */
  onBookingComplete?: () => void;
}

const SOS_VEHICLE_USE_LABEL: Record<string, string> = {
  uber_eats: 'Uber Eats delivery rider',
  deliveroo: 'Deliveroo rider',
  just_eat: 'Just Eat rider',
  courier: 'Courier / parcel delivery',
  commuter: 'Commuter — needs it to get to work',
  other: 'Other (described below)',
};

export const BookingPortal: React.FC<BookingPortalProps> = ({ initialBikeId, onGoToMyBikes, onBookingComplete }) => {
  const { currentUser, createBooking, redeemServiceVoucher, ownerConfig, discountCodes } = useShop();
  const todayIso = new Date().toISOString().split('T')[0];

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
    driveType: initialBike?.bikeDetails?.driveType || '',
    motorDetails: initialBike?.bikeDetails?.motorDetails || '',
  }));

  const patchBike = (patch: Partial<BikeIdentityValue>) =>
    setBikeIdentity((prev) => ({ ...prev, ...patch }));

  // Keep the category cards (step 01) and the identity object in lock-step.
  const chooseCategory = (category: VehicleCategory) => {
    setSelectedCategory(category);
    patchBike({ category });
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

  // Optional discount code. Repairs are priced by staff on completion, so the
  // code is captured here and honoured on the final invoice (see the "Discount
  // code" note added to the booking notes) rather than taken off a £0 estimate.
  const [discountInput, setDiscountInput] = useState<string>(() => discountCodeFromSearch());
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; title: string } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const discountCatalogue = useMemo(() => websiteDiscountCatalogue(discountCodes), [discountCodes]);

  const applyDiscountCode = () => {
    setDiscountError(null);
    const found = findDiscountCode(discountInput, discountCatalogue);
    if (!found) {
      setDiscountError('That code was not recognised.');
      return;
    }
    const res = validateDiscountCode(found, {
      subtotal: 0,
      isMember: Boolean(currentUser),
      customerUid: currentUser?.uid,
      customerMembership: currentUser?.membershipNumber,
      categories: [bikeIdentity.category],
      skipSubtotalChecks: true,
    });
    if (!res.ok) {
      setDiscountError(res.reason || 'That code cannot be used on this booking.');
      return;
    }
    setAppliedDiscount({ code: found.code, title: found.title });
    setDiscountInput('');
  };

  const clearDiscountCode = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
    setDiscountInput('');
  };

  // Contact & Schedule
  const [customerName, setCustomerName] = useState<string>(currentUser?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phoneNumber || '');
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>(TIME_SLOT_OPTIONS[0]);
  const [notes, setNotes] = useState<string>('');

  // Optional extra detail. Everything here is OPTIONAL and folded into the
  // booking notes the workshop sees (staff card + owner email), so a customer
  // can tell us as much as they want without facing a wall of required fields.
  const [accessNotes, setAccessNotes] = useState<string>('');
  const [preferredContact, setPreferredContact] = useState<'call' | 'email'>('call');
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [showExtraDetails, setShowExtraDetails] = useState<boolean>(false);

  // Refer a Friend: prefilled from a ?ref= link, editable so staff can key a
  // code in for a walk-in, and shown as £15 off only when a full service is
  // chosen (see referral.isFullService).
  const [referralCode, setReferralCode] = useState<string>('');
  useEffect(() => {
    const fromLink = referralCodeFromSearch();
    if (fromLink) setReferralCode((prev) => prev || fromLink);
  }, []);

  // Service type: bring it to the workshop, or a mobile call-out at the rider's home.
  const [serviceType, setServiceType] = useState<'in_shop' | 'home_visit'>('in_shop');
  const [homeAddress, setHomeAddress] = useState<string>('');
  const [homeVisitTime, setHomeVisitTime] = useState<string>(TIME_SLOT_OPTIONS[0]);
  const [fixLocation, setFixLocation] = useState<'inside' | 'outside' | ''>('');

  // SOS emergency repair: a priority call-out for couriers / delivery riders
  // who can't be off the road. Still requested + described by the customer, but
  // it skips the queue and carries an express surcharge.
  const [isSos, setIsSos] = useState<boolean>(false);
  const [sosVehicleUse, setSosVehicleUse] = useState<'uber_eats' | 'deliveroo' | 'just_eat' | 'courier' | 'commuter' | 'other'>('uber_eats');
  const [sosIssue, setSosIssue] = useState<string>('');
  const [sosRiderLocation, setSosRiderLocation] = useState<string>('');

  // Express SOS mode — single-screen, icon-first 3-tap dispatch.
  const [sosMode, setSosMode] = useState<'classic' | 'express'>('classic');
  const [sosTile, setSosTile] = useState<ExpressSosTileId | ''>('');
  const [sosExpressFault, setSosExpressFault] = useState<string>('');
  const [sosPhotoUrl, setSosPhotoUrl] = useState<string | null>(null);
  const [sosVoiceUrl, setSosVoiceUrl] = useState<string | null>(null);
  const [sosExpressLocation, setSosExpressLocation] = useState<string>('');
  const [sosVehicleId, setSosVehicleId] = useState<string | null>(
    initialBike ? initialBike.id : savedBikes[0]?.id ?? null
  );

  // Saved bikes become the express vehicle picker so the rider's default is
  // pre-selected — one less decision mid-breakdown.
  const sosVehicles: SosVehicleOption[] = useMemo(
    () =>
      savedBikes.map((b) => ({
        id: b.id,
        label: `${b.brand} ${b.model}`.trim() || b.categoryLabel,
        category: b.category,
      })),
    [savedBikes]
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous guard so a double-tap can't create two bookings (and two emails).
  const isSubmittingRef = useRef(false);
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
  const bikeStepComplete = Boolean(bikeIdentity.brand && resolvedModelName);
  const issuesStepComplete = problemSelectionMode === 'packages'
    ? Boolean(selectedProblemId)
    : selectedIssueIds.length > 0 || problemNotes.trim().length > 0;
  const scheduleStepComplete = Boolean(
    serviceType === 'home_visit'
      ? homeAddress.trim() && homeVisitTime
      : preferredDate && preferredTimeSlot
  );
  const contactStepComplete = Boolean(customerName.trim() && customerPhone.trim());
  const bookingProgress = [bikeStepComplete, issuesStepComplete, scheduleStepComplete, contactStepComplete].filter(Boolean).length;

  // Express SOS replaces the whole four-step wizard with one icon-first screen.
  const expressSosActive = isSos && sosMode === 'express';

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

  // A referral code only unlocks the £15 friend reward on a full service.
  const referralIsFullService = isFullService(computedService.serviceId, computedService.headline);

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
    // Express SOS collects its own location field, so the classic call-out
    // address box (which never renders in express mode) must not block it.
    if (serviceType === 'home_visit' && !homeAddress.trim() && !(isSos && sosMode === 'express')) {
      setFormError('Please enter the address where we should meet you for the call-out.');
      return;
    }
    if (isSos && sosMode === 'express') {
      // Express SOS: the visual tile IS the description, so we only insist on a
      // category, a location and a way to reach the rider.
      if (!sosTile) {
        setFormError('Tap what is wrong with your bike so our SOS team knows what to bring.');
        return;
      }
      if (!sosExpressLocation.trim()) {
        setFormError('Tell us where you are (tap “Use My Current Location” or type a landmark).');
        return;
      }
      if (!customerName.trim() || !customerPhone.trim()) {
        setFormError('We need your name and mobile number to send the express quote on WhatsApp.');
        return;
      }
    } else if (isSos && !sosIssue.trim()) {
      setFormError('Please describe the fault so our SOS team can prepare to fix it on the spot.');
      return;
    } else if (isSos && !homeAddress.trim()) {
      setFormError('SOS is a roadside call-out — please tell us where you are (or the nearest landmark).');
      return;
    }
    if (serviceType === 'in_shop' && !preferredDate) {
      setFormError('Please choose a preferred drop-off date.');
      return;
    }

    if (
      !(isSos && sosMode === 'express') &&
      problemSelectionMode === 'checklist' &&
      selectedIssueIds.length === 0 &&
      !problemNotes.trim()
    ) {
      setFormError('Please select at least one problem symptom or describe your issue.');
      return;
    }

    const expressSos = isSos && sosMode === 'express';
    const expressVehicle = expressSos ? savedBikes.find((b) => b.id === sosVehicleId) || null : null;
    const effectiveCategory = expressVehicle ? expressVehicle.category : bikeIdentity.category;

    // Determine final model string. In express SOS the rider picked a saved bike
    // (or nothing), so we use its label rather than the hidden spec fields.
    const finalModel = expressVehicle ? expressVehicle.model : resolveModel(bikeIdentity);

    const formattedVehicleName = expressSos
      ? expressVehicle
        ? `${expressVehicle.brand} ${expressVehicle.model}`.trim()
        : 'Not specified — SOS call-out'
      : `${bikeIdentity.brand} - ${finalModel}${
          bikeIdentity.colour ? ` (${bikeIdentity.colour})` : ''
        }`;

    const bikeDetails: BikeDetails | undefined =
      expressSos && expressVehicle
        ? {
            ...(expressVehicle.bikeDetails || {}),
            brand: expressVehicle.brand,
            model: expressVehicle.model,
          }
        : expressSos
        ? undefined
        : toBikeDetails(bikeIdentity);

    const selectedVoucher =
      !expressSos && applyVoucher && availableServiceVouchers.length > 0
        ? availableServiceVouchers[0]
        : null;
    const effectivePrice = 0; // Priced upon completion by staff quote/invoice

    // A double-tap can fire handleSubmit twice before React disables the button,
    // so block re-entry synchronously before we create the booking.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const voucherNote = selectedVoucher
        ? `Applied £40 Service Voucher: ${selectedVoucher.code} (To be credited on final repair invoice)`
        : '';

      const discountNote = appliedDiscount
        ? `Discount code: ${appliedDiscount.code} (${appliedDiscount.title}) — to be honoured on the final repair invoice`
        : '';

      const issueIdsForNotes = expressSos ? expressSosIssueIds(sosTile || undefined) : selectedIssueIds;
      const issueItems = issueIdsForNotes
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
        bikeIdentity.driveType ? `Drive: ${bikeIdentity.driveType}` : '',
        bikeIdentity.motorDetails ? `Motor notes: ${bikeIdentity.motorDetails}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const serviceTypeBlock =
        expressSos
          ? [
              'SERVICE TYPE: Express SOS roadside call-out',
              `Rider location: ${(sosExpressLocation || homeAddress).trim()}`,
            ]
              .filter(Boolean)
              .join('\n')
          : serviceType === 'home_visit'
          ? [
              'SERVICE TYPE: Home visit / call-out',
              `Address: ${homeAddress.trim()}`,
              `Preferred visit time: ${homeVisitTime}`,
              fixLocation ? `Where to work: ${fixLocation === 'inside' ? 'Inside (garage/home)' : 'Outside (driveway/kerbside)'}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          : 'SERVICE TYPE: Drop off at workshop';

      const referralNote = referralCode.trim()
        ? `Refer a Friend code: ${referralCode.trim()}${
            referralIsFullService ? ' (£15 off full service to apply)' : ' (not a full service — reward not applicable)'
          }`
        : '';

      const sosNote = isSos
        ? sosMode === 'express' && sosTile
          ? buildExpressSosNote({
              tileId: sosTile,
              faultText: sosExpressFault.trim() || expressSosTileFor(sosTile)?.hint,
              location: (sosExpressLocation || homeAddress || sosRiderLocation).trim(),
              vehicleLabel: formattedVehicleName,
              photoAttached: Boolean(sosPhotoUrl),
              voiceAttached: Boolean(sosVoiceUrl),
              photoUrl: sosPhotoUrl,
              voiceUrl: sosVoiceUrl,
            })
          : [
              `🚨 ${SOS_NOTES_MARKER} — PRIORITY CALL-OUT (skips the workshop queue)`,
              `Rider use: ${SOS_VEHICLE_USE_LABEL[sosVehicleUse]}`,
              `Fault: ${sosIssue.trim()}`,
              `Rider location: ${(homeAddress || sosRiderLocation).trim()}`,
              `Express surcharge: £${SOS_SURCHARGE.toFixed(2)} (added to the confirmed quote)`,
            ].join('\n')
        : '';

      const extraDetailsBlock =
        [
          accessNotes.trim() ? `Access / drop-off notes: ${accessNotes.trim()}` : '',
          additionalDetails.trim() ? `Extra detail: ${additionalDetails.trim()}` : '',
          `Preferred contact: ${preferredContact === 'email' ? 'Email' : 'Phone call'}`,
        ]
          .filter(Boolean)
          .join('\n') || '';

      const finalNotes = [
        sosNote,
        serviceTypeBlock,
        bikeBlock,
        issuesBlock,
        problemNotes.trim() ? `Other Issues / Symptoms: ${problemNotes.trim()}` : '',
        notes.trim() ? `Customer Instructions: ${notes.trim()}` : '',
        extraDetailsBlock,
        voucherNote,
        discountNote,
        referralNote,
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
        vehicleCategory: effectiveCategory,
        vehicleModel: formattedVehicleName,
        bikeDetails,
        serviceId: expressSos ? 'sos-emergency' : computedService.serviceId,
        serviceTitle: expressSos
          ? `SOS Emergency Repair — ${expressSosTileFor(sosTile)?.tag || 'Breakdown'}`
          : selectedVoucher
          ? `${computedService.headline} (£40 Voucher Applied)`
          : computedService.headline,
        servicePrice: effectivePrice,
        preferredDate: serviceType === 'home_visit' || expressSos ? todayIso : preferredDate,
        preferredTimeSlot: serviceType === 'home_visit' || expressSos ? homeVisitTime : preferredTimeSlot,
        notes: finalNotes,
        referralCode: referralCode.trim() || undefined,
        selectedIssues: expressSos ? expressSosIssueIds(sosTile || undefined) : selectedIssueIds,
        otherNotes: (expressSos ? sosExpressFault : problemNotes).trim() || undefined,
        isSos: isSos || undefined,
        sosStatus: isSos ? 'requested' : undefined,
        sosLocationNote: isSos
          ? (sosMode === 'express' ? sosExpressLocation : homeAddress || sosRiderLocation).trim() || undefined
          : undefined,
        sosCategory: isSos && sosMode === 'express' && sosTile ? expressSosTileFor(sosTile)?.tag : undefined,
        sosPhotoUrl: isSos && sosMode === 'express' ? sosPhotoUrl || undefined : undefined,
        sosVoiceNoteUrl: isSos && sosMode === 'express' ? sosVoiceUrl || undefined : undefined,
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
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setSubmittedBooking(null);
    setNotes('');
    setReferralCode('');
    setSosTile('');
    setSosExpressFault('');
    setSosPhotoUrl(null);
    setSosVoiceUrl(null);
    setSosExpressLocation('');
  };

  // Website surface: after the confirmation is shown, send the visitor back to
  // the homepage automatically. Signed-in surfaces pass no callback, so their
  // confirmation screen (with "Book Another") is left untouched.
  useEffect(() => {
    if (!submittedBooking || !onBookingComplete) return;
    const timer = setTimeout(() => {
      onBookingComplete();
    }, 6000);
    return () => clearTimeout(timer);
  }, [submittedBooking, onBookingComplete]);

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
            {isSosBooking(submittedBooking) && (
              <div className="max-w-md mx-auto p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-left space-y-1.5">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                  <Siren className="w-4 h-4" />
                  SOS EMERGENCY REPAIR — priority call-out
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  You've jumped the workshop queue. Once our team approves it, we'll message you on WhatsApp
                  to get your <strong>live location</strong>, send your <strong>quote</strong> (includes the
                  £{SOS_SURCHARGE.toFixed(0)} express surcharge), and set off the moment you confirm the price.
                  Keep WhatsApp reachable on <strong className="text-neutral-100">{submittedBooking.customerPhone}</strong>.
                </p>
              </div>
            )}
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
              <span className="text-neutral-400">{serviceType === 'home_visit' ? 'Call-Out Schedule:' : 'Drop-off Schedule:'}</span>
              <span className="text-neutral-200">
                {serviceType === 'home_visit'
                  ? `${submittedBooking.preferredTimeSlot} · ${homeAddress}`
                  : `${submittedBooking.preferredDate} (${submittedBooking.preferredTimeSlot})`}
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
                    <div className="font-bold text-white mb-0.5">
                      {serviceType === 'home_visit' ? 'Call-Out Confirmation' : 'Automated 24-Hour Reminder Active'}
                    </div>
                    <div className="text-neutral-300 leading-relaxed text-[11px]">
                      {serviceType === 'home_visit'
                        ? `We'll contact you on your number to confirm the arrival slot for your call-out on ${submittedBooking.preferredDate} (${submittedBooking.preferredTimeSlot}).`
                        : `An automated reminder will be sent to your app 24 hours before your scheduled service slot on ${submittedBooking.preferredDate} (${submittedBooking.preferredTimeSlot}). Enable notifications so you don't miss it.`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* What to do next */}
          <div className="py-5 text-xs text-neutral-400 space-y-2">
            <div className="text-neutral-200 font-medium mb-1">
              {serviceType === 'home_visit' ? 'What happens next:' : 'Drop-off instructions:'}
            </div>
            <div>
              {serviceType === 'home_visit'
                ? "We'll text you to confirm the exact arrival slot for your mobile call-out. Please have your bike accessible and, for e-bikes and e-scooters, the battery key and charger ready."
                : "Bring your bike to Stakey's Cycles during your selected time window. Our workshop mechanic will perform a safety check with you before beginning repairs."}
            </div>
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
            {serviceType === 'home_visit' ? `Call-out · ${homeVisitTime}` : `${preferredDate} · ${preferredTimeSlot}`}
          </span>
          <span className="ml-auto text-emerald-400 font-semibold">Ask for a quote</span>
        </div>

        {/* Step progress — hidden in Express SOS, which uses its own 3-tap strip. */}
        {!expressSosActive && (
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
        )}

        {/* SOS EMERGENCY REPAIR — priority call-out for couriers / delivery riders */}
        <div className={`scroll-mt-24 rounded-2xl border p-6 sm:p-8 space-y-4 transition-colors ${
          isSos ? 'bg-rose-950/30 border-rose-500/50' : 'bg-[#0d1015] border-neutral-800'
        }`}>
          <button
            type="button"
            role="switch"
            aria-checked={isSos}
            aria-label="SOS Emergency Call-Out Mode"
            onClick={() => {
              const next = !isSos;
              setIsSos(next);
              if (next) {
                setServiceType('home_visit');
                setSosMode('express');
                setOpenSteps((prev) => ({ ...prev, schedule: true, issues: true }));
              }
            }}
            className="w-full flex items-start gap-3 text-left cursor-pointer"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isSos ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-neutral-900 border border-neutral-700 text-rose-400'
            }`}>
              <Siren className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-base font-bold text-white">SOS Emergency Repair</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Priority · Skips the queue
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                {isSos
                  ? 'Express mode: tap what is wrong, set your location, send. No long forms — help is on the way.'
                  : `Broken down mid-shift? For Uber Eats, Deliveroo, Just Eat and courier riders who can't be off the road. We jump you to the front of the queue and set off to you (£${SOS_SURCHARGE.toFixed(0)} express surcharge). Still a request: our team approves it first.`}
              </p>
            </div>
            <span className={`shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
              isSos ? 'border-rose-400 bg-rose-500/20 text-rose-200' : 'border-neutral-700 text-neutral-500'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isSos ? 'bg-rose-400' : 'bg-neutral-600'}`} />
              {isSos ? 'ON' : 'OFF'}
            </span>
          </button>

          {isSos && (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/60 p-1.5" role="tablist" aria-label="SOS mode">
              {([
                { id: 'express', label: '⚡ Express (3 taps)', hint: 'Icons only' },
                { id: 'classic', label: '📝 Describe it', hint: 'Full form' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={sosMode === m.id}
                  onClick={() => setSosMode(m.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors ${
                    sosMode === m.id ? 'bg-rose-500/20 text-rose-200' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {m.label} <span className="hidden sm:inline text-[10px] font-normal text-neutral-500">· {m.hint}</span>
                </button>
              ))}
            </div>
          )}

          {isSos && sosMode === 'classic' && (
            <div className="space-y-4 pt-2 border-t border-rose-500/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-rose-400" />
                    What do you use it for?
                  </label>
                  <select
                    value={sosVehicleUse}
                    onChange={(e) => setSosVehicleUse(e.target.value as typeof sosVehicleUse)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {Object.entries(SOS_VEHICLE_USE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    Where are you right now?
                  </label>
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder="Nearest landmark, or what3words"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Describe the fault <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={sosIssue}
                  onChange={(e) => setSosIssue(e.target.value)}
                  rows={3}
                  placeholder="e.g. Rear wheel won't turn, chain jammed — I'm stuck with an order waiting."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-rose-500/30 text-[11px] text-neutral-300 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                  <Clock className="w-4 h-4" />
                  How SOS works
                </div>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>You send this request with the fault described.</li>
                  <li>Our team approves it (we'll ping the workshop straight away).</li>
                  <li>We ask for your <strong>live location over WhatsApp</strong> so we can reach you.</li>
                  <li>We send you a <strong>quote</strong> — including the £{SOS_SURCHARGE.toFixed(0)} express surcharge.</li>
                  <li>You reply to <strong>confirm the price</strong>, and we set off immediately.</li>
                </ol>
                <p className="text-neutral-400">
                  Nothing is charged until you confirm the quote. Keep WhatsApp reachable on{' '}
                  <strong className="text-neutral-200">{customerPhone || 'your mobile'}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Express SOS: one icon-first screen replaces the whole wizard. */}
        {expressSosActive && (
          <div className="scroll-mt-24 rounded-2xl border border-rose-500/40 bg-[#0d1015] p-5 sm:p-7">
            <ExpressSosMode
              tileId={sosTile}
              onTile={setSosTile}
              faultText={sosExpressFault}
              onFaultText={setSosExpressFault}
              photoUrl={sosPhotoUrl}
              onPhotoUrl={setSosPhotoUrl}
              voiceUrl={sosVoiceUrl}
              onVoiceUrl={setSosVoiceUrl}
              location={sosExpressLocation}
              onLocation={setSosExpressLocation}
              vehicles={sosVehicles}
              selectedVehicleId={sosVehicleId}
              onSelectVehicle={setSosVehicleId}
              contactName={customerName}
              contactPhone={customerPhone}
              onContactName={setCustomerName}
              onContactPhone={setCustomerPhone}
              submitting={isSubmitting}
              error={formError}
              onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            />
          </div>
        )}

        {!expressSosActive && (<>
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
              <h3 className="font-display text-base font-bold text-white">
                {serviceType === 'home_visit' ? 'Mobile Call-Out' : 'Drop-Off Window'}
              </h3>
              <p className="text-xs text-neutral-400">
                {scheduleStepComplete
                  ? serviceType === 'home_visit'
                    ? `${homeVisitTime} · ${homeAddress}`
                    : `${preferredDate} · ${preferredTimeSlot}`
                  : 'Choose how you want us to fix it, then pick a time.'}
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
          {/* How would you like it fixed? */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              How would you like it fixed?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { id: 'in_shop', title: 'Drop off at workshop', desc: 'Bring it to us — fastest turnaround.' },
                { id: 'home_visit', title: 'Home visit / call-out', desc: 'We come to your address (mobile service).' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setServiceType(opt.id)}
                  className={`text-left rounded-xl border p-3 cursor-pointer transition-colors ${
                    serviceType === opt.id
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {opt.id === 'home_visit' ? (
                      <MapPin className={`w-4 h-4 ${serviceType === opt.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    ) : (
                      <Wrench className={`w-4 h-4 ${serviceType === opt.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    )}
                    <span className={`text-xs font-semibold ${serviceType === opt.id ? 'text-white' : 'text-neutral-300'}`}>
                      {opt.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {serviceType === 'home_visit' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Address for the call-out
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder="House number, street, postcode"
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Preferred arrival time
                </label>
                <div className="relative">
                  <select
                    value={homeVisitTime}
                    onChange={(e) => setHomeVisitTime(e.target.value)}
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
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Where can we work? (optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'inside', label: 'Inside' },
                    { id: 'outside', label: 'Outside' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFixLocation(fixLocation === opt.id ? '' : opt.id)}
                      className={`rounded-lg border px-3 py-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                        fixLocation === opt.id
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="sm:col-span-2 text-[11px] text-neutral-500">
                Call-out visits cover Salford and nearby areas. We'll confirm the exact slot by text before we set off.
              </p>
            </div>
          ) : (
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
                Workshop hours Mon–Fri 09:00–18:00, Sat 09:30–13:00.
              </p>
            </div>

            <div className="sm:col-span-2">
              <BookingRidingWeather date={preferredDate} />
            </div>
          </div>
          )}

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

          <PolicyDisclaimers
            items={BOOKING_POLICY_DISCLAIMERS}
            title="Workshop terms & policy"
            tone="amber"
          />

          {/* Refer a Friend code */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Refer a Friend Code <span className="text-neutral-500">(Optional)</span>
            </label>
            <div className="relative">
              <Gift className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="STK-REF-123456"
                className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm font-mono tracking-wider text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className={`text-[11px] mt-1 ${referralCode.trim() && !referralIsFullService ? 'text-amber-400' : 'text-neutral-500'}`}>
              {referralCode.trim()
                ? referralIsFullService
                  ? `✓ This booking qualifies for ${describeFriendReward()} — your friend's code will be credited once approved.`
                  : `The £${FRIEND_REWARD} referral reward only applies to a full service. Your code is still recorded for the referrer.`
                : `Been referred by a friend? Enter their code to get ${describeFriendReward()}.`}
            </p>
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

          {/* Optional detail, collapsed by default so the required form stays short */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40">
            <button
              type="button"
              onClick={() => setShowExtraDetails((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add more details for the mechanic
                <span className="text-[10px] font-normal text-neutral-500">Optional</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${showExtraDetails ? 'rotate-180' : ''}`} />
            </button>

            {showExtraDetails && (
              <div className="px-4 pb-4 space-y-4 border-t border-neutral-800 pt-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Access / drop-off notes <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={accessNotes}
                    onChange={(e) => setAccessNotes(e.target.value)}
                    placeholder="e.g. Gate code 1234, leave with the front desk, or the bike is in a shared garage"
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Anything else we should know? <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    placeholder="e.g. I only ride it at weekends, the last service was 8 months ago, or I'd like a quote before any parts are ordered"
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Best way to reach you <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    {(['call', 'email'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPreferredContact(mode)}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          preferredContact === mode
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        {mode === 'call' ? 'Phone call' : 'Email'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
        </>)}

        {/* Voucher Redemption Option */}
        {!expressSosActive && availableServiceVouchers.length > 0 && (
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

        {/* Optional discount code — hidden in Express SOS to prevent drop-off. */}
        {!expressSosActive && (
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>Have a discount code?</span>
          </div>
          {appliedDiscount ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-emerald-400">
                {appliedDiscount.code} applied — {appliedDiscount.title}
              </span>
              <button
                type="button"
                onClick={clearDiscountCode}
                className="text-[11px] font-semibold text-neutral-400 hover:text-rose-400 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                placeholder="Discount code"
                className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={applyDiscountCode}
                className="shrink-0 rounded-lg border border-emerald-500/50 px-3 py-2 text-xs font-bold text-emerald-500 cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
          {discountError && <p className="text-[10px] text-rose-400">{discountError}</p>}
          <p className="text-[10px] text-neutral-500">
            Applied to your final repair invoice — we&apos;ll confirm it when we send your quote.
          </p>
        </div>
        )}

        {/* Error Notice — the express screen shows its own inline error. */}
        {!expressSosActive && formError && (
          <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Submit Action — the express screen has its own one-tap SOS button. */}
        {!expressSosActive && (
        <div className="pt-2">
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
                <span>Book Workshop Service · Ask for a Quote</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="text-center text-xs text-neutral-400 mt-2">
            No upfront payment required. Our workshop mechanic will evaluate your bike upon drop-off, complete repairs, and provide an itemized quote/invoice.
          </div>
        </div>
        )}
      </form>
    </div>
  );
};
