/**
 * Stakey's Cycles - Data Models and Type Definitions
 */

export type UserRole = 'customer' | 'staff' | 'admin';

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
  frameSizeOrNotes?: string;
  addedAt: any;
  lastServiceDate?: string;
  lastServiceTitle?: string;
  healthStatus?: 'healthy' | 'due_service' | 'in_workshop';
  stockSpecsScraped?: boolean;
  scrapedData?: BikeScrapeResult;
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
  merits?: number; // Store loyalty merits / bonus points
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
  rewardType?: 'ticket' | 'discount' | 'merch' | 'service' | 'stamp' | 'merit';
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
  action: 'add_stamp' | 'redeem_reward' | 'manual_merit_adjustment' | 'edit_profile';
  stampsBefore?: number;
  stampsAfter?: number;
  ticketsAwarded?: number;
  ticketsBefore?: number;
  ticketsAfter?: number;
  meritsBefore?: number;
  meritsAfter?: number;
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
  serviceId: string;
  serviceTitle: string;
  servicePrice: number;
  preferredDate: string; // YYYY-MM-DD
  preferredTimeSlot: string;
  notes?: string;
  status: BookingStatus;
  approvalStatus?: 'pending_approval' | 'approved' | 'declined';
  approvedAt?: any;
  approvedBy?: string;
  declineReason?: string;
  declinedAt?: any;
  staffNotes?: string;
  createdAt: any;
  notifications: BookingNotificationLog[];
  reminder24hSent?: boolean;
  reminder24hSentAt?: any;
  reminder24hDeliveryStatus?: 'scheduled' | 'sent' | 'delivered';
}

export interface OwnerNotificationConfig {
  ownerEmail: string;
  ownerPhone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  businessName: string;
}

