/**
 * Stakey's Cycles - Data Models and Type Definitions
 */

export type ThemeMode = 'dark' | 'light';

export type UserRole = 'customer' | 'staff' | 'admin';

export type StaffRole =
  | 'Shift Supervisor'
  | 'Store Manager'
  | 'Admin'
  | 'Mechanic';

export type StaffWorkStatus = 'Active' | 'On Leave' | 'Inactive';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: StaffWorkStatus;
  joinedDate: string;
  certificationLevel?: string;
  avatarColor?: string;
  notes?: string;
}

export interface ShopPromotion {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discountPercentage?: number;
  discountAmount?: number;
  badgeText: string;
  status: 'active' | 'upcoming' | 'expired';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  termsAndConditions: string[];
  eligibleCategories: VehicleCategory[];
  bgGradient: string;
  featured?: boolean;
  imageUrl?: string;
}

export interface TrustedBikeRecommendation {
  id: string;
  name: string;
  brand: string;
  category: 'Commuter' | 'Gravel' | 'Mountain' | 'Road' | 'Hybrid';
  price: number; // £500 - £1200
  retailer: 'Halfords' | 'Evans Cycles' | 'Leisure Lakes Bikes';
  retailerUrl: string;
  imageUrl: string;
  mechanicRating: number; // 1.0 - 5.0
  frameMaterial: 'Alloy 6061' | 'Alloy with Carbon Fork' | 'Double-Butted Chromoly' | 'Lightweight Aluminum' | 'Alpha Gold Aluminum' | string;
  groupset: string;
  brakes: string;
  keyStrengths: string[];
  watchOuts: string[];
  mechanicVerdict: string;
  bestFor: string;
}

export interface DerailleurHangerItem {
  id: string;
  code: string;
  name: string;
  brand: string;
  compatibleModels: string[];
  compatibleYears: number[];
  frameMaterials: ('Carbon' | 'Alloy' | 'Titanium' | 'Steel')[];
  axleStandard:
    | '12x142mm Thru-Axle'
    | '12x148mm Boost'
    | 'QR 135mm'
    | '12x100mm Thru-Axle'
    | 'Speed Release';
  fastenerType: string;
  torqueSpecNm: number;
  oemPartNumbers: string[];
  wheelsMfgEquivalent?: string;
  piloEquivalent?: string;
  sramUdhCompatible: boolean;
  directMountAvailable: boolean;
  diagramShape: 'two_bolt_tang' | 'single_counterbore' | 'conical_axle' | 'sram_udh' | 'direct_mount_link';
  notes?: string;
}

export interface BikeComponentSpec {
  id: string;
  category: 'Drivetrain' | 'Brakes' | 'Suspension / Fork' | 'Wheels & Tires' | 'Cockpit & Controls' | 'Electrical / Battery';
  componentName: string;
  stockOEM: string;
  currentPart: string;
  isUpgraded: boolean;
  upgradeBrand?: string;
  estimatedUpgradeValue?: number;
  condition?: 'excellent' | 'good' | 'worn' | 'needs_attention';
  mechanicNotes?: string;
  /** Taxonomy system this part belongs to (e.g. 'wheels', 'drivetrain'). */
  systemId?: string;
  /** Exact taxonomy component id (e.g. 'rear-tyre'). */
  componentId?: string;
  /** Measured dimension/size/spec, e.g. '700x32c', '11-34T', '160mm rotor'. */
  specValue?: string;
  /** Visible brand of the fitted part. */
  brand?: string;
  /** Visible model of the fitted part. */
  model?: string;
  /** How well the part could be seen: visible | partial | assumed | not_visible. */
  visibility?: 'visible' | 'partial' | 'assumed' | 'not_visible';
  /** 0-1 confidence in this component's assessment. */
  confidence?: number;
}

export interface BikeScrapeResult {
  brand: string;
  model: string;
  year?: string | number;
  category: VehicleCategory;
  msrpOriginal?: string;
  frameMaterial?: string;
  components: BikeComponentSpec[];
  detectedUpgradesCount: number;
  totalEstimatedUpgradeValue: number;
  sourceUrl?: string;
  scrapedAt: string;
  /** Raw AI identification payload (rich, taxonomy-based). */
  aiIdentification?: any;
  /** Component names the AI could not assess from the photos. */
  notVisible?: string[];
  /** 0-1 AI estimate of how much of the bike was assessed. */
  coverage?: number;
}

export interface CustomerBike {
  id: string;
  category: VehicleCategory;
  categoryLabel: string;
  brand: string;
  model: string;
  year?: string | number;
  colour?: string;
  color?: string;
  serialNumber?: string;
  frameSizeOrNotes?: string;
  addedAt: any;
  lastServiceDate?: string;
  lastServiceTitle?: string;
  healthStatus?: 'healthy' | 'due_service' | 'in_workshop';
  stockSpecsScraped?: boolean;
  scrapedData?: BikeScrapeResult;
  bikeDetails?: BikeDetails;
}

/**
 * Rich, workshop-relevant identity captured for every bike, whether it is added
 * to a garage or booked in for repair. All fields are optional so older rows and
 * quick bookings keep working.
 */
export interface BikeDetails {
  /** Whether the bike left the factory as an e-bike or was converted afterwards. */
  ebikeStatus?: 'factory' | 'converted' | 'not_ebike' | 'unsure';
  /** Motor system when known (e.g. Bosch Performance Line, Bafang BBS02). */
  conversionSystem?: string;
  /** Where the battery sits: frame-integrated, rack, downtube, seat-tube… */
  batteryPosition?: string;
  /** How the motor drives the wheel. */
  driveType?: string;
  /** Free-text motor/battery details the customer wants the mechanic to know. */
  motorDetails?: string;
  serialNumber?: string;
  frameSize?: string;
  year?: string;
  mileage?: string;
  /** Any extra notes captured alongside the structured fields. */
  notes?: string;
}

export interface CollectedVoucher {
  id: string;
  code: string;
  title: string;
  description: string;
  value: number; // e.g., 40
  type: 'service_credit' | 'discount' | 'merch';
  terms: string; // 'Labour only, parts not included'
  claimedAt: any;
  status: 'available' | 'redeemed';
  redeemedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  membershipNumber: string; // e.g., 'STK-839201'
  stamps: number; // 0 to 10
  tickets: number; // entries for periodic prize draws
  points?: number; // Loyalty points / bonus balance
  createdAt: any; // Timestamp
  lastStampedAt?: any; // Timestamp of last visit stamp for 1-per-day rate limiting
  lastSpunAt?: any; // Timestamp of last wheel spin for 1-per-week rate limiting
  phoneNumber?: string;
  avatarColor?: string; // High-quality SVG FaceAvatar configuration
  bikes?: CustomerBike[]; // Personal registered bikes in customer's garage
  serviceVouchers?: CollectedVoucher[]; // Collected rewards such as £40 service voucher
  /** Refer a Friend code used when this customer signed up, if any. */
  referredByCode?: string;
  /** The customer's own Refer a Friend code (generated on first visit). */
  referralCode?: string;
  /** £5 credits earned from successful referrals. */
  referralRewards?: ReferralReward[];
}

export interface PrizeWheelSegment {
  id?: string;
  label: string;
  color: string;
  probability: number; // 0.0 - 1.0 (or percentage)
  prizeId: string;
  rewardType?: 'ticket' | 'discount' | 'merch' | 'service' | 'stamp' | 'points';
  rewardValue?: string;
  stampsAmount?: number; // e.g., 1, 2, 3
}

export interface PrizeWheel {
  id: string;
  title: string;
  active: boolean;
  ticketCost?: number; // Tickets required per spin (defaults to 1)
  segments: PrizeWheelSegment[];
  createdAt?: any;
  updatedAt?: any;
}

export interface PrizeDraw {
  id: string;
  title: string;
  drawDate: any; // Timestamp
  prizeDescription: string;
  status: 'upcoming' | 'completed';
  winnerUid: string | null;
  winnerName?: string | null;
  completedAt?: any;
}

export interface WinnerAnnouncement {
  id: string;
  drawId: string;
  drawTitle: string;
  prizeDescription: string;
  winnerUid: string;
  winnerName: string;
  winnerMembershipNumber?: string;
  completedAt: any;
  announcedAt: any;
}

export interface StampLog {
  id: string;
  customerId: string;
  customerName?: string;
  membershipNumber?: string;
  staffId: string;
  staffName?: string;
  action: 'add_stamp' | 'redeem_reward' | 'manual_points_adjustment' | 'edit_profile' | 'sale_completed';
  stampsBefore?: number;
  stampsAfter?: number;
  ticketsAwarded?: number;
  ticketsBefore?: number;
  ticketsAfter?: number;
  pointsBefore?: number;
  pointsAfter?: number;
  timestamp: any;
  note?: string;
}

export type VehicleCategory = 'cycle' | 'electric_scooter' | 'ebike' | 'cargo';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'
  | 'declined';

/**
 * Fine-grained workshop progress, richer than `BookingStatus`. Customers watch
 * these stages advance live; staff move a booking through them from the bench.
 */
export type RepairStageId =
  | 'received'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'parts_ordered'
  | 'on_the_bench'
  | 'quality_check'
  | 'ready_for_pickup'
  | 'collected';

export type RepairEventKind = 'stage' | 'note' | 'photo';

export interface RepairProgressEvent {
  id: string;
  kind: RepairEventKind;
  stage?: RepairStageId;
  label: string;
  note?: string;
  photoUrl?: string;
  createdBy?: string;
  createdAt: string;
}

export interface BookingNotificationLog {
  id: string;
  type: 'email' | 'sms' | 'push';
  recipient: string;
  recipientRole?: 'customer' | 'owner' | 'workshop';
  subject?: string;
  content: string;
  timestamp: any;
  status: 'delivered' | 'simulated_sent' | 'pending';
  category?:
    | 'booking_confirmation'
    | 'booking_approved'
    | 'booking_declined'
    | 'reminder_24h'
    | 'sos_emergency'
    | 'status_update';
}

/**
 * Bilingual booking form payload — the exact schema the staff app renders.
 *
 * The customer fills in the booking form in their own language; on submit the
 * free-text fields are machine-translated to English for the workshop. This
 * object keeps BOTH sides so the mechanic can read the English job sheet and,
 * if a nuance is ever in doubt, expand the original native text. Legacy
 * bookings (pre-dating this field) simply have no payload — the staff card
 * falls back to the English `notes` block they already carry.
 */
export interface BookingTranslationPayload {
  /** The language the booking form was presented in (e.g. 'pl'). */
  customer_language: string;
  /** The language the *typed text* was detected to actually be, if different from UI. */
  language_detected?: string;
  /** English values the workshop reads. */
  translated_payload_en: {
    customer_name: string;
    contact_info: string;
    booking_date_time: string;
    service_type: string;
    issue_description: string;
    additional_notes: string;
  };
  /** The original native text the customer typed, for verification. */
  original_payload_native: {
    service_type: string;
    issue_description: string;
    additional_notes: string;
  };
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: 'Labour' | 'Part' | 'Consumable' | 'Diagnostic';
  quantity: number;
  unitPrice: number;
  total: number; // auto-calculated qty * unitPrice
  partNumber?: string;
}

export interface RepairChecklistItem {
  id: string;
  label: string;
  category: 'Safety' | 'Brakes' | 'Drivetrain' | 'Wheels' | 'Final Inspection';
  completed: boolean;
  notes?: string;
}

export type DiscountCodeType = 'percent' | 'fixed';

export type DiscountCodeStatus = 'active' | 'disabled' | 'expired';

/**
 * Who a code is for. Loyalty members get the richer set; `public` codes are the
 * lighter offers handed to unregistered website visitors. A `member` code is
 * refused when the basket has no signed-in member.
 */
export type DiscountAudience = 'member' | 'public';

/**
 * A staff-managed discount code. Codes can be tied to a specific member
 * (`assignedToUid`) or open to anyone, and can restrict the vehicle categories
 * they apply to. Codes are scanned at the till or typed in manually.
 */
export interface DiscountCode {
  id: string;
  code: string; // e.g. STK-10OFF
  title: string;
  description?: string;
  type: DiscountCodeType;
  value: number; // percent (0-100) when type='percent', else £ amount
  status: DiscountCodeStatus;
  createdAt: any;
  expiresAt?: any;
  usageLimit?: number; // undefined / 0 = unlimited
  timesUsed: number;
  assignedToUid?: string; // restrict to one member; undefined = open to all
  assignedToMembership?: string;
  assignedToName?: string;
  eligibleCategories: VehicleCategory[]; // empty = all categories
  minimumSpend?: number; // £ subtotal required before discount applies
  /** Loyalty-member set vs open-to-everyone website set. Undefined = open. */
  audience?: DiscountAudience;
  createdBy?: string;
}

/**
 * A customer review / feedback entry. Collected from the website "Leave a
 * Review" section or the app, and shown back on the marketing surfaces once a
 * staff member publishes it.
 */
export interface CustomerReview {
  id: string;
  /** Signed-in author uid when known; anonymous website reviews omit it. */
  customerUid?: string;
  customerName: string;
  membershipNumber?: string;
  /** Star rating 1-5. */
  rating: number;
  title?: string;
  comment: string;
  status: 'pending' | 'published' | 'hidden';
  /** Which surface the review came from. */
  source: 'website' | 'app' | 'in_store';
  createdAt: any;
}


/** The £15-off-a-full-service reward a referred friend books with. */
export interface ReferralFriendReward {
  code: string;
  discount: number;
  status: 'issued' | 'redeemed';
  issuedAt: string;
  redeemedAt?: string;
}

/** The £5 thank-you credit a referrer earns once a friend's booking is approved. */
export interface ReferralReward {
  id: string;
  amount: number;
  status: 'pending' | 'earned' | 'redeemed';
  friendName: string;
  earnedAt: string;
  redeemedAt?: string;
}

/**
 * A "Refer a Friend" record: one row per customer. The owner's code is shared
 * with friends; a friend who signs up and books with it gets £15 off a full
 * service, and the referrer earns a £5 credit once that booking is approved.
 */
export interface ReferralRecord {
  id: string;
  /** The customer who owns the shareable code (and earns the £5). */
  ownerUid: string;
  ownerName: string;
  ownerMembership?: string;
  code: string;
  /** The referral link customers copy/share, e.g. https://…/?ref=STK-REF-123456 */
  link: string;
  timesShared: number;
  rewardsEarned: number;
  /** £5 credits the referrer has earned. */
  rewards: ReferralReward[];
  /** Friends who signed up with this code and their booking reward status. */
  referredFriends: Array<{
    friendUid?: string;
    friendName: string;
    friendEmail?: string;
    joinedAt: string;
    bookingId?: string;
    bookingApproved: boolean;
    rewardGranted: boolean;
    friendReward?: ReferralFriendReward;
  }>;
  createdAt: any;
}

/** A billable line on a counter sale. */
export interface SaleLineItem {
  id: string;
  description: string;
  category: 'Labour' | 'Part' | 'Consumable' | 'Diagnostic';
  quantity: number;
  unitPrice: number;
  /** Set when the line came from live shop stock, so payment can decrement it. */
  productId?: string;
}

export interface SaleDiscountState {
  code: string;
  label: string;
  type: DiscountCodeType;
  value: number;
  amountOff: number;
  discountCodeId?: string;
  source: 'discount_code' | 'voucher' | 'promotion';
  voucherId?: string;
}

export type SalePaymentMethod = 'card' | 'cash' | 'online' | 'unpaid';

/**
 * A counter sale moves through a quote step before it is processed, mirroring
 * the workshop booking flow: staff build the basket, send the customer a quote,
 * and only once the customer is happy is the sale taken to payment.
 */
export type SaleStatus = 'quote' | 'approved' | 'completed' | 'declined';

export interface SaleQuote {
  amount: number;
  note?: string;
  sentAt: any;
  sentBy?: string;
}

/** A counter sale (parts, accessories, labour) — quoted, then processed. */
export interface SaleTransaction {
  id: string;
  saleNumber: string; // e.g. SALE-2026-0042
  customerId?: string;
  membershipNumber?: string;
  customerName: string;
  items: SaleLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  discount: number;
  discountCode?: string;
  discountLabel?: string;
  /** Where the discount came from, so the right reward is consumed on payment. */
  discountSource?: SaleDiscountState['source'];
  discountVoucherId?: string;
  grandTotal: number;
  paymentMethod: SalePaymentMethod;
  staffUid?: string;
  staffName?: string;
  createdAt: any;
  /** Quote → approval → completion lifecycle. Defaults to 'completed'. */
  status?: SaleStatus;
  quote?: SaleQuote;
  approvedAt?: any;
  approvedBy?: string;
  declinedAt?: any;
  declineReason?: string;
}

export interface RepairInvoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-0842
  bookingId: string;
  issuedAt: any;
  completedAt: any;
  leadMechanic: string;
  mechanicCertification?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  membershipNumber?: string;
  vehicleModel: string;
  vehicleCategory: VehicleCategory;
  items: InvoiceLineItem[];
  checklistSignoff: RepairChecklistItem[];
  /** Symptoms the customer reported at intake, copied onto the invoice so the bill can be audited against the job. */
  reportedSymptoms?: string[];
  labourSubtotal: number;
  partsSubtotal: number;
  subtotal: number;
  vatRate: number; // e.g. 0.20 or 0
  vatAmount: number;
  voucherDiscount: number;
  voucherCode?: string;
  discountCode?: string;
  discountLabel?: string;
  grandTotal: number;
  paymentStatus: 'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online';
  paymentDate?: any;
  mechanicNotes?: string;
  warrantyPeriod: string; // e.g. '30-Day Stakey Workshop Warranty'
}

export interface ServiceBooking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerId?: string;
  membershipNumber?: string;
  isGuest?: boolean;
  vehicleCategory: VehicleCategory;
  vehicleModel: string;
  /** Structured identity + e-bike conversion details captured at booking time. */
  bikeDetails?: BikeDetails;
  serviceId: string;
  serviceTitle: string;
  servicePrice: number;
  quotedPrice?: number;
  quoteRequestedAt?: any;
  quoteSentAt?: any;
  quoteNote?: string;
  preferredDate: string; // YYYY-MM-DD
  preferredTimeSlot: string;
  notes?: string;
  selectedIssues?: string[];
  otherNotes?: string;
  /** Bilingual form data (free text in the rider's language + English for the workshop). */
  translationPayload?: BookingTranslationPayload;
  /** Refer a Friend code used at booking time, if any (friend's £15 reward). */
  referralCode?: string;
  status: BookingStatus;
  approvalStatus?: 'pending_approval' | 'approved' | 'declined';
  approvedAt?: any;
  approvedBy?: string;
  declineReason?: string;
  declinedAt?: any;
  staffNotes?: string;
  createdAt: any;
  notifications: BookingNotificationLog[];
  /** Populated when a booking notification could not actually be delivered. */
  notificationFailures?: string[];
  reminder24hSent?: boolean;
  reminder24hSentAt?: any;
  reminder24hDeliveryStatus?: 'scheduled' | 'sent' | 'delivered';
  /** How many reminders have been dispatched for this booking. */
  reminderCount?: number;
  /** When the most recent reminder went out (repeat scheduling anchor). */
  reminderLastSentAt?: any;
  invoice?: RepairInvoice;
  // Live workshop progress for the customer-facing repair tracker.
  repairStage?: RepairStageId;
  progressEvents?: RepairProgressEvent[];
  estimateReadyAt?: string | null;
  // SOS emergency repair (priority call-out for couriers / delivery riders).
  isSos?: boolean;
  sosStatus?: 'requested' | 'approved' | 'location_requested' | 'quoted' | 'confirmed' | 'declined';
  sosLocationRequestedAt?: any;
  sosLocationNote?: string;
  sosConfirmedAt?: any;
  /** Express SOS mode: the single visual category the rider tapped. */
  sosCategory?: string;
  /** A photo of the broken part, captured in the app (data URL / storage URL). */
  sosPhotoUrl?: string;
  /** A short voice note from the rider, captured in the app. */
  sosVoiceNoteUrl?: string;
}

export interface OwnerNotificationConfig {
  ownerEmail: string;
  ownerPhone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled?: boolean;
  businessName: string;
}

/** How a reminder reaches the customer / workshop. */
export type ReminderChannel = 'push' | 'email' | 'both';
/** Which parties a reminder is sent to. */
export type ReminderRecipients = 'both' | 'customer' | 'owner';

/**
 * Workshop-configurable reminder behaviour. Controls *how* reminders are sent
 * (channel + recipients), *how long before* the slot the first one goes out,
 * *how often* to repeat until the slot, and the quiet window during which no
 * reminders are ever dispatched.
 */
export interface ReminderSettings {
  /** Push, email, or both. */
  channel: ReminderChannel;
  /** Customer, workshop, or both. */
  recipients: ReminderRecipients;
  /** Hours before the appointment slot to send the first reminder. */
  leadHours: number;
  /** Hours between repeats; 0 = send once. */
  repeatHours: number;
  /** No reminders sent between these hours (local time, 24h clock). */
  quietStartHour: number;
  quietEndHour: number;
  /** Master switch for quiet hours. */
  quietHoursEnabled: boolean;
  /** Which email's devices receive the workshop push. */
  ownerEmail: string;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  channel: 'push',
  recipients: 'both',
  leadHours: 24,
  repeatHours: 0,
  quietStartHour: 21,
  quietEndHour: 8,
  quietHoursEnabled: true,
  ownerEmail: 'stakeyscycle95@gmail.com',
};

/** Clamps a numeric setting into a safe range with a fallback default. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

