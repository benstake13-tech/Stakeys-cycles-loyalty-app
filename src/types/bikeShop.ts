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
  bikes?: CustomerBike[]; // Personal registered bikes in customer's garage
  serviceVouchers?: CollectedVoucher[]; // Collected rewards such as £40 service voucher
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
  type: 'email' | 'sms';
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
    | 'status_update';
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
  createdBy?: string;
}

/** A billable line on a counter sale. */
export interface SaleLineItem {
  id: string;
  description: string;
  category: 'Labour' | 'Part' | 'Consumable' | 'Diagnostic';
  quantity: number;
  unitPrice: number;
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
  invoice?: RepairInvoice;
  // Live workshop progress for the customer-facing repair tracker.
  repairStage?: RepairStageId;
  progressEvents?: RepairProgressEvent[];
  estimateReadyAt?: string | null;
}

export interface OwnerNotificationConfig {
  ownerEmail: string;
  ownerPhone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled?: boolean;
  businessName: string;
}

