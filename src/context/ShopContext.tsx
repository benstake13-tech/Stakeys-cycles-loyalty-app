import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  UserProfile,
  CustomerBike,
  PrizeWheel,
  PrizeWheelSegment,
  PrizeDraw,
  StampLog,
  WinnerAnnouncement,
  ServiceBooking,
  OwnerNotificationConfig,
  BookingStatus,
  CollectedVoucher,
  BikeScrapeResult,
  BikeComponentSpec,
  ThemeMode,
  StaffMember,
  ShopPromotion,
  RepairInvoice,
  DiscountCode,
  SaleTransaction,
  SalePaymentMethod,
  RepairStageId,
  RepairProgressEvent,
  ReferralRecord,
  ReferralReward,
} from '../types/bikeShop';
import { evaluatePromotionsExpiry } from '../utils/promotionUtils';
import {
  SeasonalThemeId,
  ThemeOverride,
  SEASONAL_THEME_LABELS,
  isSeasonalThemeId,
  resolveTheme,
} from '../utils/holidayCalendar';
import {
  makeRepairEvent,
  repairStageIndex,
  repairStageLabel,
  stageForStatus,
  statusForStage,
} from '../utils/repairProgress';
import { DEFAULT_PRIZE_WHEEL } from '../utils/prizeWheelHelper';
import { roundMoney } from '../utils/discountService';
import {
  REFERRER_REWARD,
  FRIEND_REWARD,
  buildReferralCode,
  buildReferralLink,
  normaliseReferralCode,
  findReferralByCode,
  findReferralByOwner,
  isFullService,
  applyReferralReward,
} from '../utils/referral';
import { resolveCustomer } from '../utils/membershipCode';
import {
  dispatchBookingNotifications,
  dispatch24hReminderNotification,
  dispatchBookingApprovalNotification,
  dispatchBookingDeclinedNotification,
  dispatchSosNotification,
  isBookingDueIn24Hours,
} from '../utils/notificationService';
import { rehydrateBookingEmailLedger } from '../utils/bookingEmailLedger';
import { staffBookingAudio, WorkshopAudioVolume } from '../utils/staffAlertAudio';
import { sendPushToUser, requestPushPermission, getPushPermission } from '../utils/pushNotifications';
import { isSosBooking, sosStatusOf } from '../utils/sosRepair';
import { isStaffSurface, isFullSurface } from '../config/surface';
import { generateMembershipNumber } from '../api/firebaseService';
import {
  STAMPS_PER_CARD,
  stampEligibility,
  addVisitStamp,
  adjustStamps,
  collectFullCard,
  buildServiceVoucher,
} from '../utils/loyaltyCard';
import { getSupabaseClient, getStoredSupabaseUrl, saveSupabaseConfig } from '../supabase';
import { supabase, AUTH_LINK_ON_LOAD } from '../lib/supabase';
import {
  fetchCustomerBikesFromDb,
  insertCustomerBikeToDb,
  deleteCustomerBikeFromDb,
  updateCustomerBikeSpecsInDb,
  fetchServiceBookingsFromDb,
  insertServiceBookingToDb,
  updateServiceBookingInDb,
  deleteServiceBookingFromDb,
  deleteAllServiceBookingsFromDb,
  fetchStampLogsFromDb,
  insertStampLogToDb,
  updateUserProfileInDb,
  fetchUserProfileFromDb,
  fetchAllProfilesFromDb,
  fetchAllProfilesFromDbDetailed,
  subscribeToDatabaseChanges,
  ensureProfileRowInDb,
  fetchPrizeWheelsFromDb,
  upsertPrizeWheelToDb,
  fetchPrizeDrawsFromDb,
  upsertPrizeDrawToDb,
  fetchVouchersForCustomerFromDb,
  insertVoucherToDb,
  updateVoucherStatusInDb,
  fetchDiscountCodesFromDb,
  upsertDiscountCodeToDb,
  deleteDiscountCodeFromDb,
  incrementDiscountUsageInDb,
  fetchReferralsFromDb,
  upsertReferralToDb,
  fetchCounterSalesFromDb,
  insertCounterSaleToDb,
  updateCounterSaleInDb,
  fetchStaffMembersFromDb,
  upsertStaffMemberToDb,
  deleteStaffMemberFromDb,
  fetchStaffAccountsFromDb,
  createStaffAccountViaRpc,
  setStaffRoleViaRpc,
  StaffAccount,
  StaffAccountRole,
  fetchPromotionsFromDb,
  upsertPromotionToDb,
  deletePromotionFromDb,
  fetchAppSettingsFromDb,
  upsertAppSettingsToDb,
} from '../api/backendDataService';

interface ShopContextType {
  currentUser: UserProfile | null;
  users: UserProfile[];
  prizeWheels: PrizeWheel[];
  draws: PrizeDraw[];
  stampLogs: StampLog[];
  activeWheel: PrizeWheel | null;
  latestAnnouncement: WinnerAnnouncement | null;
  bookings: ServiceBooking[];
  ownerConfig: OwnerNotificationConfig;
  latestDispatchedBooking: ServiceBooking | null;
  clearLatestDispatchedBooking: () => void;
  // Database Synchronization Status
  refreshDatabaseState: () => Promise<void>;
  isDatabaseSyncing: boolean;
  // Service Health & Target URL
  serviceStatus: any;
  checkServiceHealth: (customUrl?: string) => Promise<any>;
  updatePocketBaseTargetUrl: (newUrl: string) => Promise<any>;
  // Bike Specs & Upgrades Scraper
  saveBikeScrapedSpecs: (customerId: string, bikeId: string, result: BikeScrapeResult) => Promise<void>;
  updateBikeComponent: (customerId: string, bikeId: string, componentId: string, updates: Partial<BikeComponentSpec>) => Promise<void>;
  // 24-Hour Reminder & SMS Actions
  automatedRemindersEnabled: boolean;
  setAutomatedRemindersEnabled: (enabled: boolean) => void;
  /** When true (default) reminders go out as push, not email. */
  remindersPushOnly: boolean;
  setRemindersPushOnly: (enabled: boolean) => void;
  /** Email whose devices receive the workshop reminder push. */
  reminderOwnerEmail: string;
  setReminderOwnerEmail: (email: string) => void;
  bookingsDueIn24h: ServiceBooking[];
  dispatch24hReminderForBooking: (bookingId: string) => Promise<boolean>;
  latestSmsAlert: {
    title: string;
    message: string;
    recipient: string;
    time: string;
    recipientType: 'customer' | 'owner' | 'both';
  } | null;
  clearLatestSmsAlert: () => void;
  // Auth actions
  loginWithCredentials: (email: string, password?: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  loginStaff: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  registerCustomerAccount: (email: string, password: string, name: string, phoneNumber?: string, referralCode?: string) => Promise<{ success: boolean; message?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => void;
  // Staff login accounts (admin-only; backed by SECURITY DEFINER RPCs)
  staffAccounts: StaffAccount[];
  refreshStaffAccounts: () => Promise<void>;
  createStaffAccount: (
    email: string,
    password: string,
    displayName: string,
    role: StaffAccountRole
  ) => Promise<{ success: boolean; message?: string }>;
  updateStaffAccountRole: (
    userId: string,
    role: 'customer' | StaffAccountRole
  ) => Promise<{ success: boolean; message?: string }>;
  // Bike actions
  addCustomerBike: (bike: Omit<CustomerBike, 'id' | 'addedAt'>) => Promise<CustomerBike>;
  addCustomerBikeForUser: (
    userId: string,
    bike: Omit<CustomerBike, 'id' | 'addedAt'>
  ) => Promise<CustomerBike>;
  removeCustomerBike: (bikeId: string) => Promise<void>;
  // Core actions
  addStamp: (customerId: string, staffId: string, bypassLimit?: boolean) => Promise<{ success: boolean; message: string }>;
  redeemReward: (customerId: string, staffId: string, rewardDescription: string) => Promise<{ success: boolean; message: string }>;
  updateCustomerAvatar: (avatarColor: string) => Promise<void>;
  updateCustomerPoints: (
    customerId: string,
    staffId: string,
    updates: {
      stamps?: number;
      tickets?: number;
      points?: number;
      displayName?: string;
      email?: string;
      phoneNumber?: string;
      resetDailyRateLimit?: boolean;
      resetSpinCooldown?: boolean;
      staffNote?: string;
    }
  ) => Promise<{ success: boolean; message: string; customer?: UserProfile }>;
  createCustomerByStaff: (
    customerData: {
      displayName: string;
      email: string;
      phoneNumber?: string;
      stamps?: number;
      tickets?: number;
      points?: number;
    },
    staffId: string
  ) => Promise<{ success: boolean; message: string; customer?: UserProfile }>;
  updateWheel: (wheelId: string, updatedData: Partial<PrizeWheel>) => Promise<void>;
  executePrizeDraw: (drawId: string) => Promise<{ success: boolean; winner: any; message: string }>;
  createDraw: (title: string, prizeDescription: string, drawDate: Date) => Promise<void>;
  awardPrizeToUser: (userId: string, prizeTitle: string, extraTickets?: number) => void;
  awardWeeklyWheelPrize: (
    userId: string,
    segment: PrizeWheelSegment
  ) => Promise<{
    success: boolean;
    message: string;
    stampsAwarded?: number;
    isFull?: boolean;
    voucher?: CollectedVoucher;
  }>;
  collectFullCardReward: (
    userId: string
  ) => Promise<{ success: boolean; voucher?: CollectedVoucher; message: string }>;
  redeemServiceVoucher: (
    customerId: string,
    voucherCode: string,
    staffId?: string
  ) => Promise<{ success: boolean; message: string }>;
  resetUserSpinCooldown: (userId: string) => void;
  dismissAnnouncement: () => void;
  // Theme state
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  /** Seasonal holiday theme applied to every account (stored in Supabase). */
  seasonalTheme: SeasonalThemeId;
  /** Manual override: 'AUTO' follows the calendar, a theme id forces it, null = AUTO. */
  seasonalOverride: ThemeOverride;
  /** Apply/refresh the seasonal theme from Supabase (used on mount + realtime). */
  refreshSeasonalTheme: () => Promise<void>;
  /** Persist a seasonal override so all accounts pick it up seamlessly. */
  setSeasonalTheme: (theme: ThemeOverride) => Promise<{ success: boolean; message?: string }>;
  // Staff Roster Management
  staffMembers: StaffMember[];
  addStaffMember: (staff: Omit<StaffMember, 'id'>) => Promise<StaffMember>;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => Promise<StaffMember>;
  deleteStaffMember: (id: string) => Promise<boolean>;
  // Promotions Management & Expiry Monitor
  promotions: ShopPromotion[];
  addPromotion: (promo: Omit<ShopPromotion, 'id'>) => Promise<ShopPromotion>;
  updatePromotion: (id: string, updates: Partial<ShopPromotion>) => Promise<ShopPromotion>;
  deletePromotion: (id: string) => Promise<boolean>;
  refreshPromotionsExpiry: () => void;

  // Discount codes & till sales
  discountCodes: DiscountCode[];
  sales: SaleTransaction[];
  addDiscountCode: (code: Omit<DiscountCode, 'id' | 'createdAt' | 'timesUsed'>) => Promise<DiscountCode>;
  updateDiscountCode: (id: string, updates: Partial<DiscountCode>) => Promise<DiscountCode | null>;
  deleteDiscountCode: (id: string) => Promise<boolean>;
  refreshDiscountCodes: () => Promise<void>;
  /** Persist a completed counter sale and record discount usage. */
  completeSale: (sale: SaleTransaction) => Promise<{ success: boolean; message?: string; sale?: SaleTransaction }>;
  /** Build a quote for a till basket (no payment taken yet). */
  createSaleQuote: (sale: SaleTransaction) => Promise<{ success: boolean; message?: string; sale?: SaleTransaction }>;
  /** Re-quote an existing till sale before it is processed. */
  updateSaleQuote: (saleId: string, quote: { amount: number; note?: string }) => Promise<{ success: boolean; message?: string }>;
  /** Mark a quoted till sale as approved by the customer (ready to process). */
  approveSale: (saleId: string) => Promise<{ success: boolean; message?: string }>;
  /** Decline a quoted till sale. */
  declineSale: (saleId: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
  /** Process an approved till sale: take payment and close it out. */
  processSale: (saleId: string, paymentMethod: SalePaymentMethod) => Promise<{ success: boolean; message?: string }>;
  /** Bump a discount code's usage counter in local state + DB. */
  recordDiscountUsage: (discountCodeId: string) => Promise<void>;

  // Refer a Friend
  referrals: ReferralRecord[];
  /** Get (or lazily create) the signed-in customer's own referral record. */
  ensureMyReferral: () => Promise<ReferralRecord | null>;
  /** Record that a referral link was shared (increments the share counter). */
  markReferralShared: (code: string) => Promise<void>;
  /** Resolve a referral code to the owning record, or null. */
  resolveReferral: (code: string) => ReferralRecord | null;
  /** Attach a referred friend to a code (called when they sign up). */
  registerReferredFriend: (
    code: string,
    friend: { uid?: string; name: string; email?: string }
  ) => Promise<void>;
  /** Grant the friend's £15 reward + the referrer's £5 credit when a booking is approved. */
  grantReferralRewards: (booking: ServiceBooking) => Promise<void>;
  // Prize Draw CRUD
  updateDraw: (drawId: string, updates: Partial<PrizeDraw>) => Promise<void>;
  deleteDraw: (drawId: string) => Promise<void>;
  // Loyalty Member Admin
  deleteCustomerAccount: (userId: string) => Promise<{ success: boolean; message: string }>;
  adjustCustomerStamps: (userId: string, count: number, note?: string) => Promise<{ success: boolean; message: string; stamps: number }>;
  // Booking actions
  createBooking: (
    data: Omit<ServiceBooking, 'id' | 'createdAt' | 'status' | 'notifications'>
  ) => Promise<ServiceBooking>;
  approveBooking: (
    bookingId: string,
    staffNote?: string,
    quote?: { quotedPrice: number; quoteNote?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  declineBooking: (
    bookingId: string,
    reason?: string
  ) => Promise<{ success: boolean; message?: string }>;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  updateBookingQuote: (bookingId: string, quote: { quotedPrice: number, quoteNote?: string }) => Promise<{ success: boolean; message?: string }>;
  /** SOS: record that we asked the rider for their WhatsApp live location. */
  requestSosLocation: (bookingId: string, locationNote?: string) => Promise<{ success: boolean; message?: string }>;
  /** SOS: the rider confirmed the quoted price — set off immediately. */
  confirmSosQuote: (bookingId: string) => Promise<{ success: boolean; message?: string }>;
  deleteBooking: (bookingId: string) => Promise<{ success: boolean; message?: string }>;
  clearAllBookings: () => Promise<{ success: boolean; message?: string; deleted: number }>;
  setRepairStage: (
    bookingId: string,
    stage: RepairStageId,
    options?: { note?: string; estimateReadyAt?: string | null }
  ) => Promise<{ success: boolean; message?: string }>;
  resolveScannedMember: (rawCode: string) => Promise<UserProfile | null>;
  /** Like resolveScannedMember, but surfaces the underlying Supabase/RLS error. */
  resolveScannedMemberDetailed: (
    rawCode: string
  ) => Promise<{ customer: UserProfile | null; error?: string }>;
  addRepairProgressNote: (
    bookingId: string,
    note: string,
    options?: { photoUrl?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  saveRepairInvoice: (
    bookingId: string,
    invoice: RepairInvoice
  ) => Promise<{ success: boolean; message?: string }>;
  updateInvoicePaymentStatus: (
    bookingId: string,
    paymentStatus: 'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online'
  ) => Promise<void>;
  updateOwnerConfig: (config: Partial<OwnerNotificationConfig>) => void;
  resetAllDemoData: () => void;
  hardResetApp: () => void;
  // Staff loud booking alert & push notifications
  isStaffBookingSoundEnabled: boolean;
  toggleStaffBookingSound: () => boolean;
  playStaffBookingAlertPing: () => void;
  workshopAudioVolume: WorkshopAudioVolume;
  cycleWorkshopAudioVolume: () => WorkshopAudioVolume;
  requestPushNotificationPermission: () => Promise<NotificationPermission | 'unsupported' | 'not_configured'>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export type { SeasonalThemeId, ThemeOverride } from '../utils/holidayCalendar';

const STORAGE_KEY = 'stakeys_cycles_pb_state_v2';

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [prizeWheels, setPrizeWheels] = useState<PrizeWheel[]>([]);
  const [draws, setDraws] = useState<PrizeDraw[]>([]);
  const [stampLogs, setStampLogs] = useState<StampLog[]>([]);

  // Login is strictly the first screen: currentUser is always NULL initially on app load
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Clear any legacy persisted active user session so app always begins on the login screen
  useEffect(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_active_user`);
    } catch {
      // ignore
    }
  }, []);

  // Latest Winner Announcement for shop-wide broadcasts
  const [latestAnnouncement, setLatestAnnouncement] = useState<WinnerAnnouncement | null>(null);

  const dismissAnnouncement = () => {
    setLatestAnnouncement(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_latest_announcement`);
    } catch {
      // ignore
    }
  };

  // 1. Theme State (Dark / Light) with persistent LocalStorage
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('stakeys_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('stakeys_theme', next);
      } catch {}
      return next;
    });
  };

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem('stakeys_theme', t);
    } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme]);

  // ---------------------------------------------------------------------------
  // Seasonal theme — one shared setting in Supabase applied to every account.
  // The row is created on demand so this works even before the SQL is run.
  // ---------------------------------------------------------------------------
  // A ?theme= preview pins the theme for the whole session (see below).
  const previewThemeRef = useRef<ThemeOverride>((() => {
    try {
      const q = new URLSearchParams(window.location.search).get('theme');
      if (q === 'none') return 'none';
      if (q && isSeasonalThemeId(q)) return q;
    } catch {
      /* no window (SSR/tests) */
    }
    return null;
  })());

  const [seasonalOverride, setSeasonalOverride] = useState<ThemeOverride>(() => {
    // QA/preview: ?theme=halloween forces a theme for this session only. It never
    // writes to the shared store, so a preview link can't change anyone else.
    return previewThemeRef.current ?? 'AUTO';
  });
  // The theme actually rendered: the manual override when set, otherwise the
  // holiday the 9-day calendar window resolves for right now.
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalThemeId>(() =>
    resolveTheme('AUTO')
  );

  const refreshSeasonalTheme = async () => {
    let override: ThemeOverride = 'AUTO';
    try {
      const { data } = await supabase
        .from('app_theme_config')
        .select('theme')
        .eq('id', 1)
        .maybeSingle();
      const stored = data?.theme;
      if (stored === 'AUTO' || stored === null || stored === undefined) override = 'AUTO';
      else if (isSeasonalThemeId(stored)) override = stored;
    } catch {
      // Table not created yet — stay on AUTO (calendar) rather than crashing.
    }
    setSeasonalOverride(previewThemeRef.current ?? override);
    setSeasonalThemeState(resolveTheme(previewThemeRef.current ?? override));
  };

  const setSeasonalTheme = async (
    next: ThemeOverride
  ): Promise<{ success: boolean; message?: string }> => {
    const safe: ThemeOverride =
      next === 'AUTO' || next === null ? 'AUTO' : isSeasonalThemeId(next) ? next : 'AUTO';
    const prev = seasonalOverride;
    setSeasonalOverride(safe); // optimistic so this device updates instantly
    setSeasonalThemeState(resolveTheme(safe));
    try {
      const { error } = await supabase
        .from('app_theme_config')
        .upsert({ id: 1, theme: safe, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      const label = safe === 'AUTO' ? 'Auto (calendar)' : SEASONAL_THEME_LABELS[safe];
      toast.success(`Theme applied to all accounts: ${label}`);
      return { success: true };
    } catch (err: any) {
      setSeasonalOverride(prev);
      setSeasonalThemeState(resolveTheme(prev));
      const message =
        'Could not reach the shared theme store. Run the SQL setup (app_theme_config) to enable cross-account themes.';
      toast.error(message);
      return { success: false, message };
    }
  };

  useEffect(() => {
    refreshSeasonalTheme();

    // Realtime: any device that applies a theme updates every other account.
    const channel = supabase
      .channel('theme_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_theme_config', filter: 'id=eq.1' },
        (payload: any) => {
          const stored = payload?.new?.theme;
          const override: ThemeOverride =
            stored === 'AUTO' || stored === null || stored === undefined
              ? 'AUTO'
              : isSeasonalThemeId(stored)
                ? stored
                : 'AUTO';
          setSeasonalOverride(previewThemeRef.current ?? override);
          setSeasonalThemeState(resolveTheme(previewThemeRef.current ?? override));
        }
      )
      .subscribe();

    // In AUTO mode the calendar can change at midnight, so re-evaluate hourly
    // (cheap, and keeps a long-open tab in step with the schedule).
    const autoTick = window.setInterval(() => {
      setSeasonalOverride((current) => {
        if (current === 'AUTO') setSeasonalThemeState(resolveTheme('AUTO'));
        return current;
      });
    }, 60 * 60 * 1000);

    return () => {
      window.clearInterval(autoTick);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Staff Roster State & CRUD
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const addStaffMember = async (staffData: Omit<StaffMember, 'id'>): Promise<StaffMember> => {
    const newMember: StaffMember = {
      ...staffData,
      id: `staff-${Date.now().toString().slice(-4)}`,
    };
    setStaffMembers((prev) => [newMember, ...prev]);
    try {
      await upsertStaffMemberToDb(newMember);
    } catch (e) {
      console.warn('[DB SYNC] addStaffMember persist failed:', e);
    }
    return newMember;
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>): Promise<StaffMember> => {
    const target = staffMembers.find((m) => m.id === id);
    if (!target) throw new Error('Staff member not found');
    const updatedMember: StaffMember = { ...target, ...updates };
    setStaffMembers((prev) => prev.map((m) => (m.id === id ? updatedMember : m)));
    try {
      await upsertStaffMemberToDb(updatedMember);
    } catch (e) {
      console.warn('[DB SYNC] updateStaffMember persist failed:', e);
    }
    return updatedMember;
  };

  const deleteStaffMember = async (id: string): Promise<boolean> => {
    setStaffMembers((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteStaffMemberFromDb(id);
    } catch (e) {
      console.warn('[DB SYNC] deleteStaffMember persist failed:', e);
    }
    return true;
  };

  // 3. Promotions State & Expiry Monitor
  const [promotions, setPromotions] = useState<ShopPromotion[]>([]);

  // Automatic background expiration monitor every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      setPromotions((prev) => evaluatePromotionsExpiry(prev));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const refreshPromotionsExpiry = () => {
    setPromotions((prev) => evaluatePromotionsExpiry(prev));
  };

  const addPromotion = async (promoData: Omit<ShopPromotion, 'id'>): Promise<ShopPromotion> => {
    const newPromo: ShopPromotion = {
      ...promoData,
      id: `promo-${Date.now().toString().slice(-4)}`,
    };
    setPromotions((prev) => [newPromo, ...prev]);
    try {
      await upsertPromotionToDb(newPromo);
    } catch (e) {
      console.warn('[DB SYNC] addPromotion persist failed:', e);
    }
    return newPromo;
  };

  const updatePromotion = async (id: string, updates: Partial<ShopPromotion>): Promise<ShopPromotion> => {
    const target = promotions.find((p) => p.id === id);
    if (!target) throw new Error('Promotion not found');
    const updatedPromo: ShopPromotion = { ...target, ...updates };
    setPromotions((prev) => prev.map((p) => (p.id === id ? updatedPromo : p)));
    try {
      await upsertPromotionToDb(updatedPromo);
    } catch (e) {
      console.warn('[DB SYNC] updatePromotion persist failed:', e);
    }
    return updatedPromo;
  };

  const deletePromotion = async (id: string): Promise<boolean> => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePromotionFromDb(id);
    } catch (e) {
      console.warn('[DB SYNC] deletePromotion persist failed:', e);
    }
    return true;
  };

  /* ------------------------------------------------------------------ *
   * Discount codes (till) & counter sales
   * ------------------------------------------------------------------ */
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);

  const refreshReferrals = async () => {
    const remote = await fetchReferralsFromDb();
    if (remote) setReferrals(remote);
  };

  const refreshDiscountCodes = async () => {
    const remote = await fetchDiscountCodesFromDb();
    if (remote && remote.length > 0) setDiscountCodes(remote);
  };

  const addDiscountCode = async (
    codeData: Omit<DiscountCode, 'id' | 'createdAt' | 'timesUsed'>
  ): Promise<DiscountCode> => {
    const newCode: DiscountCode = {
      ...codeData,
      id: `disc-${Date.now().toString().slice(-6)}`,
      createdAt: new Date(),
      timesUsed: 0,
    };
    setDiscountCodes((prev) => [newCode, ...prev]);
    void upsertDiscountCodeToDb(newCode);
    return newCode;
  };

  const updateDiscountCode = async (
    id: string,
    updates: Partial<DiscountCode>
  ): Promise<DiscountCode | null> => {
    let updated: DiscountCode | null = null;
    setDiscountCodes((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          updated = { ...c, ...updates };
          return updated;
        }
        return c;
      })
    );
    if (updated) void upsertDiscountCodeToDb(updated);
    return updated;
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    setDiscountCodes((prev) => prev.filter((c) => c.id !== id));
    void deleteDiscountCodeFromDb(id);
    return true;
  };

  const recordDiscountUsage = async (discountCodeId: string): Promise<void> => {
    let nextCount = 0;
    setDiscountCodes((prev) =>
      prev.map((c) => {
        if (c.id === discountCodeId) {
          nextCount = (c.timesUsed || 0) + 1;
          return { ...c, timesUsed: nextCount };
        }
        return c;
      })
    );
    void incrementDiscountUsageInDb(discountCodeId, nextCount);
  };

  /* ------------------------------------------------------------------ *
   * Refer a Friend
   * ------------------------------------------------------------------ */
  const resolveReferral = (code: string): ReferralRecord | null =>
    findReferralByCode(code, referrals);

  /** Mint a fresh referral record for a customer, with a unique code. */
  const buildReferralRecord = (
    owner: { uid: string; displayName: string; membershipNumber?: string }
  ): ReferralRecord => {
    // Derive a stable code from the membership number when we have one so the
    // same customer keeps the same code across devices; fall back to random.
    let code = buildReferralCode(owner.membershipNumber);
    const taken = new Set(referrals.map((r) => normaliseReferralCode(r.code)));
    let guard = 0;
    while (taken.has(code) && guard < 20) {
      code = buildReferralCode(Date.now() + guard);
      guard += 1;
    }
    return {
      id: `ref-${owner.uid}`,
      ownerUid: owner.uid,
      ownerName: owner.displayName,
      ownerMembership: owner.membershipNumber,
      code,
      link: buildReferralLink(code),
      timesShared: 0,
      rewardsEarned: 0,
      rewards: [],
      referredFriends: [],
      createdAt: new Date().toISOString(),
    };
  };

  const ensureMyReferral = async (): Promise<ReferralRecord | null> => {
    if (!currentUser) return null;
    const existing = findReferralByOwner(currentUser.uid, referrals);
    if (existing) return existing;
    const fresh = buildReferralRecord({
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      membershipNumber: currentUser.membershipNumber,
    });
    setReferrals((prev) => [fresh, ...prev]);
    void upsertReferralToDb(fresh);
    return fresh;
  };

  const markReferralShared = async (code: string): Promise<void> => {
    const existing = findReferralByCode(code, referrals);
    if (!existing) return;
    const updated: ReferralRecord = { ...existing, timesShared: (existing.timesShared || 0) + 1 };
    setReferrals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    void upsertReferralToDb(updated);
  };

  const registerReferredFriend = async (
    code: string,
    friend: { uid?: string; name: string; email?: string }
  ): Promise<void> => {
    const clean = normaliseReferralCode(code);
    if (!clean) return;
    // The owner's record may not be in state yet (the friend has just signed
    // in), so pull the latest referrals before giving up.
    let list = referrals;
    if (!findReferralByCode(clean, list)) {
      const remote = await fetchReferralsFromDb();
      if (remote && remote.length > 0) {
        list = remote;
        setReferrals(remote);
      }
    }
    const owner = findReferralByCode(clean, list);
    if (!owner) return;

    // A referrer cannot refer themselves.
    if (friend.uid && friend.uid === owner.ownerUid) return;
    // Don't double-add the same friend.
    const already = owner.referredFriends.some(
      (f) => (friend.uid && f.friendUid === friend.uid) || (friend.email && f.friendEmail === friend.email)
    );
    if (already) return;

    const updated: ReferralRecord = {
      ...owner,
      referredFriends: [
        ...owner.referredFriends,
        {
          friendUid: friend.uid,
          friendName: friend.name,
          friendEmail: friend.email,
          joinedAt: new Date().toISOString(),
          bookingApproved: false,
          rewardGranted: false,
        },
      ],
    };
    setReferrals((prev) =>
      prev.some((r) => r.id === updated.id)
        ? prev.map((r) => (r.id === updated.id ? updated : r))
        : [updated, ...prev]
    );
    void upsertReferralToDb(updated);
  };

  /**
   * Called when a booking is approved. If it carried a referral code and is a
   * full service, the friend's £15 reward is marked redeemed and the referrer
   * earns a £5 credit. Idempotent: the same booking is never paid twice.
   */
  const grantReferralRewards = async (booking: ServiceBooking): Promise<void> => {
    const code = booking.referralCode;
    if (!code) return;

    // The referrer's record may not be in state yet on this device (e.g. staff
    // approving a booking before the friend's signup has synced here), so pull
    // the latest referrals before giving up.
    let list = referrals;
    let owner = findReferralByCode(code, list);
    if (!owner) {
      const remote = await fetchReferralsFromDb();
      if (remote && remote.length > 0) {
        list = remote;
        setReferrals(remote);
        owner = findReferralByCode(code, list);
      }
    }
    if (!owner) return;
    // A referrer cannot refer themselves.
    if (booking.customerId && booking.customerId === owner.ownerUid) return;

    const friendName = booking.customerName;
    const now = new Date().toISOString();

    const applied = applyReferralReward(owner, booking, now);
    if (!applied) return; // Already paid for this booking.
    const { record: updated, reward } = applied;

    setReferrals((prev) =>
      prev.some((r) => r.id === updated.id)
        ? prev.map((r) => (r.id === updated.id ? updated : r))
        : [updated, ...prev]
    );
    void upsertReferralToDb(updated);

    // Credit the referrer's own profile so the £5 shows in their account.
    const ownerProfile = users.find((u) => u.uid === owner.ownerUid);
    if (ownerProfile) {
      const existing = ownerProfile.referralRewards || [];
      if (!existing.some((rw) => rw.id === reward.id)) {
        const nextRewards = [...existing, reward];
        setUsers((prev) =>
          prev.map((u) => (u.uid === owner.ownerUid ? { ...u, referralRewards: nextRewards } : u))
        );
        if (currentUser?.uid === owner.ownerUid) {
          setCurrentUser((prev) => (prev ? { ...prev, referralRewards: nextRewards } : prev));
        }
        // The referrals table is the durable record of the reward; the profile
        // field above is only a convenience mirror for the signed-in session.
      }
    }

    toast.success(
      `Refer a Friend: ${friendName}'s booking is approved — ${owner.ownerName} earned a £${REFERRER_REWARD} credit!`,
      { icon: '🎉', duration: 6000 }
    );
  };

  const completeSale = async (
    sale: SaleTransaction
  ): Promise<{ success: boolean; message?: string; sale?: SaleTransaction }> => {
    const persisted: SaleTransaction = {
      ...sale,
      subtotal: roundMoney(sale.subtotal),
      vatAmount: roundMoney(sale.vatAmount),
      discount: roundMoney(sale.discount),
      grandTotal: roundMoney(sale.grandTotal),
      createdAt: sale.createdAt || new Date(),
    };
    setSales((prev) => [persisted, ...prev]);
    const ok = await insertCounterSaleToDb(persisted);

    // Audit log so the sale appears in the workshop history feed
    void insertStampLogToDb({
      id: `log-sale-${persisted.id}`,
      customerId: persisted.customerId || 'walk-in',
      customerName: persisted.customerName,
      membershipNumber: persisted.membershipNumber,
      staffId: currentUser?.uid || 'system',
      staffName: currentUser?.displayName,
      action: 'sale_completed',
      note: `Sale ${persisted.saleNumber} — £${persisted.grandTotal.toFixed(2)}${
        persisted.discount > 0 ? ` (discount ${persisted.discountCode || ''} -£${persisted.discount.toFixed(2)})` : ''
      }`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: ok,
      message: ok
        ? `Sale ${persisted.saleNumber} recorded — take £${persisted.grandTotal.toFixed(2)}.`
        : 'Sale saved locally but could not reach Supabase. Run the SQL setup to enable sync.',
      sale: persisted,
    };
  };

  // ---------------------------------------------------------------------------
  // Till quote lifecycle — mirrors the workshop booking flow:
  //   quote → customer happy → approved → processed (payment taken).
  // ---------------------------------------------------------------------------
  const nextSaleNumber = () =>
    `SALE-${new Date().getFullYear()}-${String(sales.length + 1).padStart(4, '0')}`;

  const persistSaleUpdate = (
    saleId: string,
    updates: Partial<SaleTransaction>
  ): SaleTransaction | null => {
    let updated: SaleTransaction | null = null;
    setSales((prev) =>
      prev.map((s) => {
        if (s.id !== saleId) return s;
        updated = { ...s, ...updates };
        return updated;
      })
    );
    updateCounterSaleInDb(saleId, updates).catch((e) =>
      console.warn('[DB SYNC] Error updating counter sale in DB:', e)
    );
    return updated;
  };

  const createSaleQuote = async (
    sale: SaleTransaction
  ): Promise<{ success: boolean; message?: string; sale?: SaleTransaction }> => {
    const quoted: SaleTransaction = {
      ...sale,
      saleNumber: sale.saleNumber || nextSaleNumber(),
      subtotal: roundMoney(sale.subtotal),
      vatAmount: roundMoney(sale.vatAmount),
      discount: roundMoney(sale.discount),
      grandTotal: roundMoney(sale.grandTotal),
      createdAt: sale.createdAt || new Date(),
      status: 'quote',
      quote: {
        amount: roundMoney(sale.grandTotal),
        note: sale.quote?.note,
        sentAt: new Date().toISOString(),
        sentBy: currentUser?.displayName,
      },
    };
    setSales((prev) => [quoted, ...prev]);
    const ok = await insertCounterSaleToDb(quoted);

    setLatestSmsAlert({
      title: '🧾 Quote Sent to Customer',
      message: `Quote ${quoted.saleNumber} for £${quoted.grandTotal.toFixed(2)} sent to ${quoted.customerName}. Awaiting their go-ahead.`,
      recipient: quoted.customerName,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    void insertStampLogToDb({
      id: `log-quote-${quoted.id}`,
      customerId: quoted.customerId || 'walk-in',
      customerName: quoted.customerName,
      membershipNumber: quoted.membershipNumber,
      staffId: currentUser?.uid || 'system',
      staffName: currentUser?.displayName,
      action: 'edit_profile',
      note: `QUOTE SENT: ${quoted.saleNumber} — £${quoted.grandTotal.toFixed(2)} for ${quoted.customerName}.`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: ok,
      message: ok
        ? `Quote ${quoted.saleNumber} sent — £${quoted.grandTotal.toFixed(2)}. Process once the customer is happy.`
        : 'Quote saved locally but could not reach Supabase. Run the SQL setup to enable sync.',
      sale: quoted,
    };
  };

  const updateSaleQuote = async (
    saleId: string,
    quote: { amount: number; note?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return { success: false, message: 'Quote not found' };

    const nextQuote = {
      amount: roundMoney(quote.amount),
      note: quote.note,
      sentAt: new Date().toISOString(),
      sentBy: currentUser?.displayName,
    };
    persistSaleUpdate(saleId, { status: 'quote', quote: nextQuote, grandTotal: nextQuote.amount });
    return {
      success: true,
      message: `Quote updated to £${nextQuote.amount.toFixed(2)}.`,
    };
  };

  const approveSale = async (
    saleId: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return { success: false, message: 'Quote not found' };

    const updated = persistSaleUpdate(saleId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.displayName,
    });

    setLatestSmsAlert({
      title: '✅ Customer Approved the Quote',
      message: `${target.customerName} accepted the £${target.grandTotal.toFixed(2)} quote on ${target.saleNumber}. Ready to process.`,
      recipient: target.customerName,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    void insertStampLogToDb({
      id: `log-saleappr-${saleId}-${Date.now()}`,
      customerId: target.customerId || 'walk-in',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'system',
      staffName: currentUser?.displayName,
      action: 'edit_profile',
      note: `QUOTE ACCEPTED: ${target.saleNumber} — £${target.grandTotal.toFixed(2)}.`,
      timestamp: new Date().toISOString(),
    });

    return { success: !!updated, message: 'Customer happy — ready to process.' };
  };

  const declineSale = async (
    saleId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return { success: false, message: 'Quote not found' };

    persistSaleUpdate(saleId, {
      status: 'declined',
      declinedAt: new Date().toISOString(),
      declineReason: reason || 'Customer did not accept the quote.',
    });

    void insertStampLogToDb({
      id: `log-saledecl-${saleId}-${Date.now()}`,
      customerId: target.customerId || 'walk-in',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'system',
      staffName: currentUser?.displayName,
      action: 'edit_profile',
      note: `QUOTE DECLINED: ${target.saleNumber} — ${reason || 'customer did not accept'}.`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: 'Quote declined.' };
  };

  const processSale = async (
    saleId: string,
    paymentMethod: SalePaymentMethod
  ): Promise<{ success: boolean; message?: string }> => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return { success: false, message: 'Quote not found' };
    if (target.status === 'quote' && !target.approvedAt) {
      return {
        success: false,
        message: 'Awaiting customer approval — mark the quote as accepted before processing.',
      };
    }

    persistSaleUpdate(saleId, {
      status: 'completed',
      paymentMethod,
      approvedAt: target.approvedAt || new Date().toISOString(),
      approvedBy: target.approvedBy || currentUser?.displayName,
    });

    // Consume the right reward only once the sale is actually paid for.
    if (target.discountSource === 'discount_code' && target.discountCode) {
      const code = discountCodes.find(
        (c) => c.code === target.discountCode || c.id === (target as any).discountCodeId
      );
      if (code) await recordDiscountUsage(code.id);
    } else if (target.discountSource === 'voucher' && target.customerId && target.discountCode) {
      await redeemServiceVoucher(target.customerId, target.discountCode, currentUser?.uid);
    }

    setLatestSmsAlert({
      title: '💳 Sale Processed',
      message: `${target.saleNumber} completed — £${target.grandTotal.toFixed(2)} taken by ${paymentMethod}.`,
      recipient: target.customerName,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    void insertStampLogToDb({
      id: `log-salepaid-${saleId}-${Date.now()}`,
      customerId: target.customerId || 'walk-in',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'system',
      staffName: currentUser?.displayName,
      action: 'sale_completed',
      note: `SALE PROCESSED: ${target.saleNumber} — £${target.grandTotal.toFixed(2)} (${paymentMethod})${
        target.discount > 0 ? ` discount ${target.discountCode} -£${target.discount.toFixed(2)}` : ''
      }.`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Sale ${target.saleNumber} processed — take £${target.grandTotal.toFixed(2)}.`,
    };
  };

  // Supabase Service Health Monitor
  const [serviceStatus, setServiceStatus] = useState<any>({
    isOnline: true,
    url: getStoredSupabaseUrl(),
    checkedAt: 'Testing...',
    error: 'Checking connection to Supabase cloud database...',
  });

  const checkServiceHealth = async (_customUrl?: string): Promise<any> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const st = { isOnline: false, url: getStoredSupabaseUrl(), error: 'Supabase client not initialized', checkedAt: new Date().toLocaleTimeString() };
      setServiceStatus(st);
      return st;
    }
    try {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      const st = { isOnline: !error, url: getStoredSupabaseUrl(), error: error?.message, checkedAt: new Date().toLocaleTimeString() };
      setServiceStatus(st);
      return st;
    } catch (err: any) {
      const st = { isOnline: false, url: getStoredSupabaseUrl(), error: err.message, checkedAt: new Date().toLocaleTimeString() };
      setServiceStatus(st);
      return st;
    }
  };

  const updatePocketBaseTargetUrl = async (newUrl: string): Promise<any> => {
    return await checkServiceHealth();
  };

  useEffect(() => {
    checkServiceHealth();
    const interval = setInterval(() => {
      checkServiceHealth();
    }, 40000);
    return () => clearInterval(interval);
  }, []);

  // Bike Specs & Upgrades Scraper Persistence
  const saveBikeScrapedSpecs = async (
    customerId: string,
    bikeId: string,
    result: BikeScrapeResult
  ): Promise<void> => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.uid !== customerId) return user;
        const currentBikes = user.bikes || [];
        const updatedBikes = currentBikes.map((b) => {
          if (b.id !== bikeId) return b;
          return {
            ...b,
            stockSpecsScraped: true,
            scrapedData: result,
          };
        });
        return { ...user, bikes: updatedBikes };
      })
    );
    updateCustomerBikeSpecsInDb(bikeId, customerId, result).catch((e) =>
      console.warn('[DB SYNC] Error updating scraped specs in DB:', e)
    );
  };

  const updateBikeComponent = async (
    customerId: string,
    bikeId: string,
    componentId: string,
    updates: Partial<BikeComponentSpec>
  ): Promise<void> => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.uid !== customerId) return user;
        const currentBikes = user.bikes || [];
        const updatedBikes = currentBikes.map((b) => {
          if (b.id !== bikeId || !b.scrapedData) return b;
          const updatedComponents = b.scrapedData.components.map((comp) => {
            if (comp.id !== componentId) return comp;
            return { ...comp, ...updates };
          });
          const upgradedCount = updatedComponents.filter((c) => c.isUpgraded).length;
          const totalVal = updatedComponents
            .filter((c) => c.isUpgraded)
            .reduce((sum, c) => sum + (c.estimatedUpgradeValue || 0), 0);
          return {
            ...b,
            scrapedData: {
              ...b.scrapedData,
              components: updatedComponents,
              detectedUpgradesCount: upgradedCount,
              totalEstimatedUpgradeValue: totalVal,
            },
          };
        });
        return { ...user, bikes: updatedBikes };
      })
    );
  };

  // Service Bookings State (loaded dynamically from backend database)
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const knownBookingIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialBookingsLoadRef = React.useRef<boolean>(true);
  const collectingRef = React.useRef<Set<string>>(new Set());
  const currentUserRef = React.useRef<UserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  const [isStaffBookingSoundEnabled, setIsStaffBookingSoundEnabled] = useState<boolean>(() =>
    staffBookingAudio.isSoundEnabled()
  );
  const [workshopAudioVolume, setWorkshopAudioVolume] = useState<WorkshopAudioVolume>(() =>
    staffBookingAudio.getVolumeLevel()
  );

  const toggleStaffBookingSound = () => {
    const newState = staffBookingAudio.toggleSound();
    setIsStaffBookingSoundEnabled(newState);
    if (newState) {
      staffBookingAudio.playLoudBookingPing();
      toast.success('🔊 Workshop booking audio alert activated (Loud Ping)', { icon: '🔔' });
    } else {
      toast('🔇 Workshop booking audio alert muted', { icon: '🔕' });
    }
    return newState;
  };

  const cycleWorkshopAudioVolume = () => {
    const next = staffBookingAudio.cycleVolumeLevel();
    setWorkshopAudioVolume(next);
    staffBookingAudio.playLoudBookingPing();
    const label =
      next === 'max_workshop'
        ? 'MAX WORKSHOP BOOST (220% LOUD)'
        : next === 'loud'
        ? 'LOUD (160%)'
        : 'NORMAL (100%)';
    toast.success(`🔊 Alert Loudness: ${label}`, { icon: '📢' });
    return next;
  };

  const playStaffBookingAlertPing = () => {
    staffBookingAudio.playLoudBookingPing();
    staffBookingAudio.dispatchPushNotification(
      '🔔 Workshop Audio Alert Test',
      "Loud alert ping sounded! Workshop terminals are armed for real-time booking alerts."
    );
  };

  const requestPushNotificationPermission = async () => {
    const perm = await requestPushPermission();
    if (perm === 'granted') {
      toast.success('✅ Push notifications enabled — booking alerts will reach this device!', { icon: '🔔' });
      staffBookingAudio.dispatchPushNotification('Stakey’s Cycles Workshop', 'Push notifications are now active!');
    } else if (perm === 'denied') {
      toast.error('Push notification permission was denied in your browser settings.');
    } else if (perm === 'not_configured') {
      toast.error('OneSignal is not configured yet. Add VITE_ONESIGNAL_APP_ID to enable push.');
    }
    return perm;
  };

  const updateBookingsWithStaffAlert = (incomingBookings: ServiceBooking[]) => {
    if (!incomingBookings || incomingBookings.length === 0) return;

    if (isInitialBookingsLoadRef.current) {
      incomingBookings.forEach((b) => knownBookingIdsRef.current.add(b.id));
      isInitialBookingsLoadRef.current = false;
      // Remember which lifecycle emails these bookings already had, so reloading
      // the shared table never re-sends a confirmation or reminder.
      rehydrateBookingEmailLedger(incomingBookings);
      setBookings(incomingBookings);
      return;
    }

    const isStaff = currentUserRef.current?.role === 'staff' || currentUserRef.current?.role === 'admin';
    const brandNewBookings = incomingBookings.filter((b) => !knownBookingIdsRef.current.has(b.id));

    incomingBookings.forEach((b) => knownBookingIdsRef.current.add(b.id));
    setBookings(incomingBookings);

    // ONLY staff receives the loud audio ping and push notification!
    if (isStaff && brandNewBookings.length > 0) {
      staffBookingAudio.playLoudBookingPing();

      const latest = brandNewBookings[0];
      staffBookingAudio.dispatchPushNotification(
        `🚨 New Workshop Booking: #${latest.id}`,
        `${latest.customerName} booked ${latest.serviceTitle} for ${latest.preferredDate} (${latest.preferredTimeSlot})`
      );
      // Server-to-server push so it reaches the phone even when the app is closed.
      void sendPushToUser(
        currentUserRef.current?.uid,
        `🚨 New Workshop Booking #${latest.id}`,
        `${latest.customerName} booked ${latest.serviceTitle} for ${latest.preferredDate} (${latest.preferredTimeSlot})`,
        undefined,
        { segment: 'staff' }
      );

      toast(
        `🚨 NEW WORKSHOP BOOKING #${latest.id}!\n${latest.customerName} • ${latest.serviceTitle}`,
        {
          icon: '🔔',
          duration: 9000,
          style: {
            background: '#071d12',
            color: '#4ade80',
            border: '2px solid #22c55e',
            boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.4)',
            fontSize: '13px',
            fontWeight: 700,
          },
        }
      );
    }
  };

  // Database Synchronization Engine & Real-time State
  const [isDatabaseSyncing, setIsDatabaseSyncing] = useState<boolean>(false);

  const syncUserFromDatabase = async (user: UserProfile) => {
    setIsDatabaseSyncing(true);
    try {
      const isStaff = user.role === 'staff' || user.role === 'admin';
      
      // Centralized Data Fetching: Dynamic database queries
      const [remoteBikes, remoteBookings, remoteLogs, remoteProfile, allProfiles, remoteVouchers] = await Promise.all([
        fetchCustomerBikesFromDb(user.uid, user.membershipNumber),
        fetchServiceBookingsFromDb(user.uid, isStaff, user.membershipNumber),
        fetchStampLogsFromDb(user.uid, isStaff, user.membershipNumber),
        fetchUserProfileFromDb(user.uid, user.membershipNumber, user.email),
        fetchAllProfilesFromDb(),
        fetchVouchersForCustomerFromDb(user.uid),
      ]);

      const mergedBikes = remoteBikes && remoteBikes.length > 0 ? remoteBikes : (user.bikes || []);

      const previousStamps = user.stamps || 0;
      const remoteStamps = remoteProfile?.stamps !== undefined ? remoteProfile.stamps : user.stamps;

      if (remoteProfile?.stamps !== undefined && remoteProfile.stamps > previousStamps) {
        const gained = remoteProfile.stamps - previousStamps;
        toast.success(
          `🎉 +${gained} New Stamp${gained > 1 ? 's' : ''} Received! Total: ${remoteProfile.stamps}/10`,
          { icon: '🎟️', duration: 4500 }
        );
      }

      const updatedUser: UserProfile = {
        ...user,
        bikes: mergedBikes,
        stamps: remoteStamps,
        tickets: remoteProfile?.tickets !== undefined ? remoteProfile.tickets : user.tickets,
        points: remoteProfile?.points !== undefined ? remoteProfile.points : user.points,
        lastStampedAt:
          remoteProfile?.lastStampedAt !== undefined ? remoteProfile.lastStampedAt : user.lastStampedAt,
        lastSpunAt: remoteProfile?.lastSpunAt !== undefined ? remoteProfile.lastSpunAt : user.lastSpunAt,
        displayName: remoteProfile?.displayName || user.displayName,
        phoneNumber: remoteProfile?.phoneNumber || user.phoneNumber,
        serviceVouchers:
          remoteVouchers && remoteVouchers.length > 0
            ? remoteVouchers
            : user.serviceVouchers,
      };

      setCurrentUser(updatedUser);
      if (allProfiles && allProfiles.length > 0) {
        setUsers(allProfiles);
      } else {
        setUsers((prev) => prev.map((u) => (u.uid === user.uid ? updatedUser : u)));
      }

      if (remoteBookings && remoteBookings.length > 0) {
        updateBookingsWithStaffAlert(remoteBookings);
      }
      if (remoteLogs && remoteLogs.length > 0) {
        setStampLogs(remoteLogs);
      }
      console.log(`[DB SYNC] ✅ Synchronized user "${updatedUser.displayName}" with backend database`);
    } catch (err) {
      console.warn('[DB SYNC] Database sync error:', err);
    } finally {
      setIsDatabaseSyncing(false);
    }
  };

  const refreshDatabaseState = async () => {
    const [allProfiles, remoteWheels, remoteDraws, remoteCodes, remoteSales, remoteStaff, remotePromos, remoteSettings] = await Promise.all([
      fetchAllProfilesFromDb(),
      fetchPrizeWheelsFromDb(),
      fetchPrizeDrawsFromDb(),
      fetchDiscountCodesFromDb(),
      fetchCounterSalesFromDb(),
      fetchStaffMembersFromDb(),
      fetchPromotionsFromDb(),
      fetchAppSettingsFromDb(),
    ]);
    if (allProfiles && allProfiles.length > 0) {
      setUsers(allProfiles);
      if (currentUser) {
        const freshCurrent = allProfiles.find((u) => u.uid === currentUser.uid || u.membershipNumber === currentUser.membershipNumber);
        if (freshCurrent) {
          setCurrentUser((prev) => prev ? { ...prev, ...freshCurrent } : freshCurrent);
        }
      }
    }
    if (remoteWheels && remoteWheels.length > 0) {
      setPrizeWheels(remoteWheels);
    }
    if (remoteDraws && remoteDraws.length > 0) {
      setDraws(remoteDraws);
    }
    if (remoteCodes && remoteCodes.length > 0) {
      setDiscountCodes(remoteCodes);
    }
    if (remoteSales && remoteSales.length > 0) {
      setSales(remoteSales);
    }
    if (remoteStaff && remoteStaff.length > 0) {
      setStaffMembers(remoteStaff);
    }
    if (remotePromos && remotePromos.length > 0) {
      setPromotions(remotePromos);
    }
    if (remoteSettings) {
      setOwnerConfig((prev) => ({
        ...prev,
        ownerEmail: remoteSettings.ownerEmail ?? prev.ownerEmail,
        ownerPhone: remoteSettings.ownerPhone ?? prev.ownerPhone,
        emailAlertsEnabled: remoteSettings.emailAlertsEnabled ?? prev.emailAlertsEnabled,
        smsAlertsEnabled: remoteSettings.smsAlertsEnabled ?? prev.smsAlertsEnabled,
        businessName: remoteSettings.businessName ?? prev.businessName,
      }));
      applyRemoteReminderSettings(remoteSettings);
    }

    if (currentUser) {
      await syncUserFromDatabase(currentUser);
    } else {
      const [remoteBookings, remoteLogs] = await Promise.all([
        fetchServiceBookingsFromDb(undefined, true),
        fetchStampLogsFromDb(undefined, true),
      ]);
      if (remoteBookings && remoteBookings.length > 0) updateBookingsWithStaffAlert(remoteBookings);
      if (remoteLogs && remoteLogs.length > 0) setStampLogs(remoteLogs);
    }
  };

  // Mount effect: Seed initial data & subscribe to Real-time postgres changes
  useEffect(() => {
    fetchAllProfilesFromDb().then((profiles) => {
      if (profiles && profiles.length > 0) {
        setUsers(profiles);
      }
    }).catch(() => {});

    // Load the authoritative prize wheel + draw configuration from the database
    fetchPrizeWheelsFromDb().then((wheels) => {
      if (wheels && wheels.length > 0) {
        setPrizeWheels(wheels);
      } else {
        // First run: seed the default wheel so the staff editor has something to edit
        setPrizeWheels([DEFAULT_PRIZE_WHEEL]);
        upsertPrizeWheelToDb(DEFAULT_PRIZE_WHEEL).catch(() => {});
      }
    }).catch(() => {});

    fetchPrizeDrawsFromDb().then((remoteDraws) => {
      if (remoteDraws && remoteDraws.length > 0) setDraws(remoteDraws);
    }).catch(() => {});

    fetchDiscountCodesFromDb().then((codes) => {
      if (codes && codes.length > 0) setDiscountCodes(codes);
    }).catch(() => {});

    fetchReferralsFromDb().then((remoteReferrals) => {
      if (remoteReferrals && remoteReferrals.length > 0) setReferrals(remoteReferrals);
    }).catch(() => {});

    fetchCounterSalesFromDb().then((remoteSales) => {
      if (remoteSales && remoteSales.length > 0) setSales(remoteSales);
    }).catch(() => {});

    // Staff roster, promotions and workshop settings are Supabase-backed so
    // staff edits survive a reload.
    fetchStaffMembersFromDb().then((members) => {
      if (members && members.length > 0) setStaffMembers(members);
    }).catch(() => {});

    fetchPromotionsFromDb().then((remotePromos) => {
      if (remotePromos && remotePromos.length > 0) setPromotions(remotePromos);
    }).catch(() => {});

    fetchAppSettingsFromDb().then((settings) => {
      if (settings) {
        setOwnerConfig((prev) => ({
          ...prev,
          ownerEmail: settings.ownerEmail ?? prev.ownerEmail,
          ownerPhone: settings.ownerPhone ?? prev.ownerPhone,
          emailAlertsEnabled: settings.emailAlertsEnabled ?? prev.emailAlertsEnabled,
          smsAlertsEnabled: settings.smsAlertsEnabled ?? prev.smsAlertsEnabled,
          businessName: settings.businessName ?? prev.businessName,
        }));
        if (typeof settings.automatedRemindersEnabled === 'boolean') {
          setAutomatedRemindersEnabled(settings.automatedRemindersEnabled);
        }
        applyRemoteReminderSettings(settings);
      }
    }).catch(() => {});

    fetchServiceBookingsFromDb(undefined, true).then((b) => {
      if (b && b.length > 0) updateBookingsWithStaffAlert(b);
    }).catch(() => {});

    fetchStampLogsFromDb(undefined, true).then((l) => {
      if (l && l.length > 0) setStampLogs(l);
    }).catch(() => {});

    const unsubscribe = subscribeToDatabaseChanges((table) => {
      console.log(`[DB SYNC] ⚡ Remote database mutation on table "${table}" - refreshing state`);
      refreshDatabaseState();
    });

    // Fallback polling every 4 seconds and window focus sync for instant multi-browser updates
    const pollInterval = setInterval(() => {
      refreshDatabaseState().catch(() => {});
    }, 4000);

    const handleFocus = () => {
      refreshDatabaseState().catch(() => {});
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Complete registration when the customer returns from the email confirmation
  // link. Supabase parses the link's token on load (detectSessionInUrl) and
  // emits a signed-in session; we then build the profile, self-heal the row and
  // log them straight in, so they never have to re-enter a password.
  useEffect(() => {
    const hasConfirmationParams = AUTH_LINK_ON_LOAD;

    const completeSignupSession = async (authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const authEmail = authUser.email || '';
      const meta = (authUser.user_metadata || {}) as Record<string, string | undefined>;
      const userProfile: UserProfile = {
        uid: authUser.id,
        email: profile?.email || authEmail,
        displayName: profile?.display_name || meta.full_name || authEmail.split('@')[0] || 'Stakey Rider',
        phoneNumber: profile?.phone || meta.phone || undefined,
        role: profile?.role || 'customer',
        membershipNumber:
          profile?.membership_number || `STK-${authUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        stamps: profile?.stamps || 0,
        tickets: profile?.completed_cards || 0,
        points: profile?.merit_points || 0,
        bikes: [],
        createdAt: profile?.created_at ? new Date(profile.created_at) : new Date(),
        lastStampedAt: profile?.last_stamped_at ? new Date(profile.last_stamped_at) : null,
      };

      await ensureProfileRowInDb(userProfile);
      setCurrentUser(userProfile);
      setUsers((prev) => (prev.some((u) => u.uid === userProfile.uid) ? prev : [userProfile, ...prev]));

      // Link the referral captured at signup (kept in auth metadata so it
      // survives the email-confirmation round trip).
      if (meta.referred_by) {
        await registerReferredFriend(meta.referred_by, {
          uid: authUser.id,
          name: userProfile.displayName,
          email: userProfile.email,
        }).catch(() => {});
      }

      await syncUserFromDatabase(userProfile);
    };

    // 1. Link already processed into a session before this effect ran.
    supabase.auth.getSession().then(({ data }) => {
      if (hasConfirmationParams && data.session?.user) {
        void completeSignupSession(data.session.user);
      }
    });

    // 2. Link processed after this effect subscribed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && hasConfirmationParams) {
        void completeSignupSession(session.user);
      }
    });

    // Clean the one-time tokens out of the URL so a refresh can't replay them.
    if (hasConfirmationParams) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // ignore
      }
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  // Owner Notification Configuration (Recipient workshop@stakeyscycles.com + SMS)
  const [ownerConfig, setOwnerConfig] = useState<OwnerNotificationConfig>({
    ownerEmail: '',
    ownerPhone: '',
    emailAlertsEnabled: false,
    businessName: 'Stakey\'s Cycles',
  });

  // Track the most recently placed booking for live modal notification preview
  const [latestDispatchedBooking, setLatestDispatchedBooking] = useState<ServiceBooking | null>(null);

  const clearLatestDispatchedBooking = () => {
    setLatestDispatchedBooking(null);
  };

  // 24-Hour Automated Reminder System state
  const [automatedRemindersEnabled, setAutomatedRemindersEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_automated_reminders`);
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Staff choice: reminders arrive as push notifications (default) rather than
  // email, so customers/owner aren't flooded with reminder emails.
  const [remindersPushOnly, setRemindersPushOnly] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_reminders_push_only`);
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Which email's devices should receive the workshop reminder push (defaults
  // to the shop Gmail; staff can change it).
  const [reminderOwnerEmail, setReminderOwnerEmail] = useState<string>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_reminder_owner_email`) || 'stakeyscycle95@gmail.com';
    } catch {
      return 'stakeyscycle95@gmail.com';
    }
  });

  // Read inside the reminder effect without making settings changes re-run it
  // (which would restart the interval on every toggle).
  const remindersPushOnlyRef = useRef(remindersPushOnly);
  const reminderOwnerEmailRef = useRef(reminderOwnerEmail);
  remindersPushOnlyRef.current = remindersPushOnly;
  reminderOwnerEmailRef.current = reminderOwnerEmail;

  // Recent SMS alert toast / banner state
  const [latestSmsAlert, setLatestSmsAlert] = useState<{
    title: string;
    message: string;
    recipient: string;
    time: string;
    recipientType: 'customer' | 'owner' | 'both';
  } | null>(null);

  const clearLatestSmsAlert = () => {
    setLatestSmsAlert(null);
  };

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_automated_reminders`, JSON.stringify(automatedRemindersEnabled));
      localStorage.setItem(`${STORAGE_KEY}_reminders_push_only`, JSON.stringify(remindersPushOnly));
      localStorage.setItem(`${STORAGE_KEY}_reminder_owner_email`, reminderOwnerEmail);
    } catch (e) {
      console.warn('Storage failed', e);
    }
    upsertAppSettingsToDb({ automatedRemindersEnabled, remindersPushOnly, reminderOwnerEmail }).catch(() => {});
  }, [automatedRemindersEnabled, remindersPushOnly, reminderOwnerEmail]);

  // Adopt reminder settings pushed from the database (e.g. changed on another
  // staff device) without clobbering a missing column with a default.
  const applyRemoteReminderSettings = (settings: {
    remindersPushOnly?: boolean;
    reminderOwnerEmail?: string;
  }) => {
    if (typeof settings.remindersPushOnly === 'boolean') setRemindersPushOnly(settings.remindersPushOnly);
    if (settings.reminderOwnerEmail) setReminderOwnerEmail(settings.reminderOwnerEmail);
  };

  // Loyalty data (profiles/stamps, wheel + draws, logs, bookings, config) is
  // Supabase-backed only — intentionally not cached in localStorage, so the app
  // never shows stale local data that the database would overwrite anyway.

  // Do not persist active user to localStorage so every app load fresh-starts at the login screen
  useEffect(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_active_user`);
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Keep currentUser state in sync when updated in the users array
  useEffect(() => {
    if (currentUser) {
      const updated = users.find((u) => u.uid === currentUser.uid);
      if (updated) {
        setCurrentUser(updated);
      }
    }
  }, [users]);

  const activeWheel = prizeWheels.find((w) => w.active) || null;

  // Customer Login with Supabase Auth
  const loginWithCredentials = async (email: string, password = '') => {
    try {
      const rawId = email.trim();
      const lowerId = rawId.toLowerCase();
      let resolvedEmail = lowerId;

      // Members sign in with their email, membership number, or name, but only
      // an email can be handed to Supabase Auth. Resolve the other two through
      // the profiles lookup first — otherwise a member typing their card number
      // gets "invalid credentials" even though their account is fine.
      if (!lowerId.includes('@')) {
        // Strip PostgREST filter metacharacters so a name like "Smith, John"
        // cannot break the .or() expression.
        const safe = rawId.replace(/[,()*]/g, ' ').trim();
        if (!safe) {
          return { success: false, message: 'Please enter your email, name, or member ID.' };
        }
        const { data: matches, error: lookupError } = await supabase
          .from('profiles')
          .select('email, membership_number, display_name')
          .or(`membership_number.eq.${safe},display_name.ilike.*${safe}*`)
          .limit(3);

        if (lookupError) {
          console.warn('Member lookup failed:', lookupError.message);
        }

        const match = (matches || []).find((m) => m.email);
        if (!match?.email) {
          return {
            success: false,
            message: 'No account found for that email, member ID, or name. Check the spelling, or sign in with your email address.',
          };
        }
        resolvedEmail = String(match.email).trim().toLowerCase();
      }

      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error || !data.user) {
        // Distinguish "you haven't confirmed yet" from a genuine wrong password,
        // otherwise a brand-new customer just sees the generic message.
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('not confirmed') || (error as any)?.code === 'email_not_confirmed') {
          return {
            success: false,
            message: 'Your email is not confirmed yet. Click the link in your confirmation email, then sign in. (You can resend it from the Sign Up tab.)',
          };
        }
        return { success: false, message: 'Invalid email or password.' };
      }

      // 2. Fetch profile from database using the authenticated user ID.
      //    If the row is missing or the fetch is blocked by RLS, fall back to a
      //    minimal profile built from the auth user so the customer can still
      //    reach their loyalty card and the app can self-heal the row.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Profile fetch error (falling back to auth user):', profileError.message);
      }

      // Map DB profile to UserProfile type, filling gaps from Supabase Auth.
      const authEmail = data.user.email || '';
      const authName =
        (data.user.user_metadata as any)?.full_name ||
        (data.user.user_metadata as any)?.display_name ||
        authEmail.split('@')[0] ||
        'Stakey Rider';
      const userProfile: UserProfile = {
        uid: data.user.id,
        email: profile?.email || authEmail,
        displayName: profile?.display_name || authName,
        phoneNumber: profile?.phone || undefined,
        role: profile?.role || 'customer',
        membershipNumber:
          profile?.membership_number || `STK-${data.user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        stamps: profile?.stamps || 0,
        tickets: profile?.completed_cards || 0,
        points: profile?.merit_points || 0,
        bikes: [], // Will be populated by syncUserFromDatabase
        createdAt: profile?.created_at ? new Date(profile.created_at) : new Date(),
        lastStampedAt: profile?.last_stamped_at ? new Date(profile.last_stamped_at) : null,
      };

      if (userProfile.role === 'staff' || userProfile.role === 'admin') {
        await supabase.auth.signOut();
        return { success: false, message: 'Please use the Staff Station tab to log in.' };
      }

      setCurrentUser(userProfile);
      // Some projects have no `on auth.users` trigger, so a freshly registered
      // customer may not have a profiles row yet — create it, then sync.
      await ensureProfileRowInDb(userProfile);

      // A friend who signed up from a referral link carries the code in their
      // auth metadata. Attach them to the referrer's record on first sign-in.
      const referredBy = (data.user.user_metadata as any)?.referred_by;
      if (referredBy) {
        await registerReferredFriend(referredBy, {
          uid: userProfile.uid,
          name: userProfile.displayName,
          email: userProfile.email,
        }).catch(() => {});
      }

      await syncUserFromDatabase(userProfile);
      return { success: true, user: userProfile };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  // Dedicated Staff Station Login using Email/Password
  const loginStaff = async (email: string, password: string) => {
    try {
      // 1. Authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user) {
        return { success: false, message: 'Invalid credentials or access denied.' };
      }

      // 2. Validate user profile role
      let staffUser = users.find((u) => u.uid === data.user.id);
      
      // Fallback: Fetch from DB if not in local state
      if (!staffUser) {
        console.log('[DEBUG] Fetching staffUser from DB for ID:', data.user.id);
        const remoteProfile = await fetchUserProfileFromDb(data.user.id);
        console.log('[DEBUG] remoteProfile:', remoteProfile);
        if (remoteProfile) {
          staffUser = remoteProfile as UserProfile;
        }
      }

      console.log('[DEBUG] staffUser role check:', staffUser?.role);
      
      // FIX: Ensure we have a user and check if role is either 'staff' OR 'admin'
      const hasStaffAccess = staffUser && (staffUser.role === 'staff' || staffUser.role === 'admin');

      if (!hasStaffAccess) {
        console.log('[DEBUG] Access Denied: User does not have staff or admin role.');
        await supabase.auth.signOut();
        return { success: false, message: 'Access Denied: Authorized workshop personnel only.' };
      }

      setCurrentUser(staffUser as UserProfile);
      // Automatically request notification permissions for staff terminals
      staffBookingAudio.requestNotificationPermission().catch(() => {});
      // Dynamic database fetch on staff login: syncs all workshop bookings and stamp logs
      await syncUserFromDatabase(staffUser as UserProfile);
      return { success: true, user: staffUser as UserProfile };
    } catch (err: any) {
      console.error('Staff login error:', err);
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  // Register implementation with Supabase Auth
  const registerCustomerAccount = async (
    email: string,
    password: string,
    name: string,
    phoneNumber?: string,
    referralCode?: string
  ) => {
    try {
      const cleanReferral = referralCode ? normaliseReferralCode(referralCode) : '';
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            phone: phoneNumber?.trim(),
            // Stored in user metadata so the referral survives the email
            // confirmation step, when there is no session to attach it to yet.
            referred_by: cleanReferral || undefined,
          },
          // Send the confirmation link back to the app itself. Without this the
          // link falls back to the project Site URL, which may be a different
          // origin and leaves the customer unable to complete the flow here.
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      // When email confirmation is enabled Supabase deliberately does not reveal
      // whether an address is already registered: a repeat signup returns a user
      // with an empty identities array and no error. Surface that clearly so the
      // customer logs in instead of waiting for an email that never arrives.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return {
          success: false,
          message: 'An account with this email already exists. Please sign in, or reset your password if you have forgotten it.',
        };
      }

      // Attach the friend to the referrer's record now, while we still have the
      // code in hand. If confirmation is on they will sign in shortly and the
      // referral is already waiting on the referrer's account.
      if (cleanReferral) {
        await registerReferredFriend(cleanReferral, {
          uid: data.user?.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }).catch(() => {});
      }

      return {
        success: true,
        message: 'Account created! Please check your email and click the confirmation link, then sign in.',
      };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, message: err.message || 'An unexpected error occurred during registration.' };
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Confirmation email re-sent. Check your inbox and spam folder.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Could not resend the confirmation email.' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Password reset link sent to your email.' };
    } catch (err: any) {
      console.error('Password reset error:', err);
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
  };

  /* ------------------------------------------------------------------ *
   * Staff login accounts. Creation/role changes go through admin-gated
   * SECURITY DEFINER RPCs; if the migration has not been applied yet the
   * calls fail cleanly so the UI can prompt the admin to run the SQL.
   * ------------------------------------------------------------------ */
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);

  const refreshStaffAccounts = async () => {
    const accounts = await fetchStaffAccountsFromDb();
    setStaffAccounts(accounts);
  };

  const createStaffAccount = async (
    email: string,
    password: string,
    displayName: string,
    role: StaffAccountRole
  ) => {
    const res = await createStaffAccountViaRpc(email, password, displayName, role);
    if (res.success) {
      await refreshStaffAccounts();
      toast.success(`Staff login created for ${email.trim().toLowerCase()}.`);
    }
    return { success: res.success, message: res.message };
  };

  const updateStaffAccountRole = async (
    userId: string,
    role: 'customer' | StaffAccountRole
  ) => {
    const res = await setStaffRoleViaRpc(userId, role);
    if (res.success) {
      // Keep the in-memory profile in sync when the admin edits their own row.
      setUsers((prev) => prev.map((u) => (u.uid === userId ? { ...u, role } : u)));
      await refreshStaffAccounts();
      toast.success(role === 'customer' ? 'Staff access revoked.' : `Role updated to ${role}.`);
    }
    return res;
  };

  // Load staff logins for admins only. The RPC itself is admin-gated, so this
  // is just to avoid a pointless request for everyone else.
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchStaffAccountsFromDb().then(setStaffAccounts).catch(() => {});
    } else {
      setStaffAccounts([]);
    }
  }, [currentUser?.uid, currentUser?.role]);

  // Add Stamp logic enforcing rate limit and 10-stamp card completion
  const addStamp = async (customerId: string, staffId: string, bypassLimit = false) => {
    let target = users.find((u) => u.uid === customerId);

    // Staff may scan a member code for a customer who is registered in auth but
    // whose profiles row is missing (no signup trigger). Backfill it on the fly.
    if (!target) {
      const remoteProfile = await fetchUserProfileFromDb(customerId);
      if (remoteProfile && remoteProfile.uid) {
        const filled: UserProfile = { ...(remoteProfile as UserProfile) };
        const ensured = await ensureProfileRowInDb(filled);
        if (ensured) {
          setUsers((prev) => (prev.some((u) => u.uid === filled.uid) ? prev : [...prev, filled]));
          target = filled;
        }
      }
    }

    if (!target) {
      return { success: false, message: `Customer ID "${customerId}" not found.` };
    }

    const staff = users.find((u) => u.uid === staffId);
    const staffName = staff?.displayName || 'Stakey Staff';

    // Daily rate limit verification — one visit stamp per calendar day.
    if (!bypassLimit) {
      const eligibility = stampEligibility(target.lastStampedAt);
      if (!eligibility.allowed) {
        return {
          success: false,
          message: `Daily Rate Limit: ${target.displayName} ${eligibility.reason}`,
        };
      }
    }

    const currentTickets = target.tickets || 0;
    const award = addVisitStamp(target.stamps || 0);
    const now = new Date();

    // New Audit Log
    const newLog: StampLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId,
      staffName,
      action: 'add_stamp',
      stampsBefore: award.stampsBefore,
      stampsAfter: award.stampsAfter,
      ticketsAwarded: 0,
      timestamp: now,
      note: award.cardReady
        ? `Visit stamp ${award.stampsAfter}/${STAMPS_PER_CARD} — card full, ready to collect the £40 service reward.`
        : `Added visit stamp (${award.stampsAfter}/${STAMPS_PER_CARD})`,
    };

    // Functional update so concurrent stamps never clobber each other.
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === customerId
          ? { ...u, stamps: award.stampsAfter, tickets: currentTickets, lastStampedAt: now }
          : u
      )
    );
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table
    updateUserProfileInDb(customerId, target.membershipNumber, {
      stamps: award.stampsAfter,
      lastStampedAt: now,
    }).catch((e) => console.warn('[DB SYNC] Error updating profile stamps in DB:', e));
    insertStampLogToDb(newLog).catch((e) => console.warn('[DB SYNC] Error inserting stamp log in DB:', e));

    const successMessage = award.cardReady
      ? `🎉 10TH STAMP! ${target.displayName}'s card is full — collect the £40 service reward in the customer portal.`
      : `Visit stamp added for ${target.displayName}! (${award.stampsAfter}/${STAMPS_PER_CARD})`;

    toast.success(successMessage, { icon: award.cardReady ? '🎉' : '🎟️' });

    return {
      success: true,
      message: successMessage,
    };
  };

  const redeemReward = async (customerId: string, staffId: string, rewardDescription: string) => {
    const target = users.find((u) => u.uid === customerId);
    if (!target) return { success: false, message: 'Customer not found' };

    const staff = users.find((u) => u.uid === staffId);
    const now = new Date();

    const newLog: StampLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId,
      staffName: staff?.displayName || 'Stakey Staff',
      action: 'redeem_reward',
      stampsBefore: target.stamps,
      stampsAfter: target.stamps,
      timestamp: now,
      note: `Redeemed in-store perk: ${rewardDescription}`,
    };

    setStampLogs([newLog, ...stampLogs]);
    insertStampLogToDb(newLog).catch((e) =>
      console.warn('[DB SYNC] Error inserting redeem log in DB:', e)
    );
    toast.success(`Redeemed: ${rewardDescription}`);
    return { success: true, message: `Redeemed: ${rewardDescription}` };
  };

  const updateCustomerAvatar = async (avatarColor: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, avatarColor };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.uid === currentUser.uid ? updatedUser : u)));
    try {
      const saved = await updateUserProfileInDb(currentUser.uid, currentUser.membershipNumber, { avatarColor });
      if (!saved) {
        // Surface the failure instead of leaving the UI showing an avatar that
        // will silently revert on the next profile reload.
        toast.error('Could not save your avatar — please try again.');
      }
    } catch (err) {
      console.error('[ShopContext] updateCustomerAvatar DB failed:', err);
      toast.error('Could not save your avatar — please try again.');
    }
  };

  // Manual Customer Point & Balance Adjustment for Staff Database
  const updateCustomerPoints = async (
    customerId: string,
    staffId: string,
    updates: {
      stamps?: number;
      tickets?: number;
      points?: number;
      displayName?: string;
      email?: string;
      phoneNumber?: string;
      resetDailyRateLimit?: boolean;
      resetSpinCooldown?: boolean;
      staffNote?: string;
    }
  ) => {
    const target = users.find((u) => u.uid === customerId);
    if (!target) {
      return { success: false, message: `Customer record "${customerId}" not found.` };
    }

    const staff = users.find((u) => u.uid === staffId);
    const staffName = staff?.displayName || 'Stakey Staff';

    const stampsBefore = target.stamps ?? 0;
    const ticketsBefore = target.tickets ?? 0;
    const pointsBefore = target.points ?? 0;

    const stampsAfter =
      updates.stamps !== undefined
        ? Math.max(0, Math.min(STAMPS_PER_CARD, updates.stamps))
        : stampsBefore;
    const ticketsAfter = updates.tickets !== undefined ? Math.max(0, updates.tickets) : ticketsBefore;
    const pointsAfter = updates.points !== undefined ? Math.max(0, updates.points) : pointsBefore;

    const now = new Date();

    const updatedUser: UserProfile = {
      ...target,
      displayName: updates.displayName?.trim() || target.displayName,
      email: updates.email?.trim() || target.email,
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber.trim() : target.phoneNumber,
      stamps: stampsAfter,
      tickets: ticketsAfter,
      points: pointsAfter,
      lastStampedAt: updates.resetDailyRateLimit ? null : target.lastStampedAt,
      lastSpunAt: updates.resetSpinCooldown ? null : target.lastSpunAt,
    };

    const changesSummary: string[] = [];
    if (stampsAfter !== stampsBefore) changesSummary.push(`Stamps: ${stampsBefore} -> ${stampsAfter}`);
    if (ticketsAfter !== ticketsBefore) changesSummary.push(`Tickets: ${ticketsBefore} -> ${ticketsAfter}`);
    if (pointsAfter !== pointsBefore) changesSummary.push(`Points: ${pointsBefore} -> ${pointsAfter}`);
    if (updates.resetDailyRateLimit) changesSummary.push('Daily rate limit cleared');
    if (updates.resetSpinCooldown) changesSummary.push('Spin cooldown reset');
    if (updates.displayName && updates.displayName !== target.displayName) changesSummary.push(`Name: ${updates.displayName}`);

    const summaryText = changesSummary.length > 0 ? changesSummary.join(', ') : 'Profile details updated';
    const finalNote = updates.staffNote?.trim()
      ? `${updates.staffNote.trim()} (${summaryText})`
      : `Manual point adjustment by ${staffName}: ${summaryText}`;

    const newLog: StampLog = {
      id: `log-point-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName: updatedUser.displayName,
      membershipNumber: updatedUser.membershipNumber,
      staffId,
      staffName,
      action: 'manual_points_adjustment',
      stampsBefore,
      stampsAfter,
      ticketsBefore,
      ticketsAfter,
      pointsBefore,
      pointsAfter,
      timestamp: now,
      note: finalNote,
    };

    setUsers((prev) => prev.map((u) => (u.uid === customerId ? updatedUser : u)));
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table.
    // The rate-limit/cooldown resets must be persisted (null) or the override
    // silently reverts on the next refresh.
    updateUserProfileInDb(customerId, target.membershipNumber, {
      stamps: stampsAfter,
      tickets: ticketsAfter,
      points: pointsAfter,
      displayName: updates.displayName?.trim() || target.displayName,
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber.trim() : target.phoneNumber,
      ...(updates.resetDailyRateLimit ? { lastStampedAt: null } : {}),
      ...(updates.resetSpinCooldown ? { lastSpunAt: null } : {}),
    }).catch((e) => console.warn('[DB SYNC] Error updating customer points in DB:', e));
    insertStampLogToDb(newLog).catch((e) => console.warn('[DB SYNC] Error inserting point log in DB:', e));

    return {
      success: true,
      message: `Updated points for ${updatedUser.displayName}: ${summaryText}`,
      customer: updatedUser,
    };
  };

  // Staff-side Walk-in Customer Registration
  const createCustomerByStaff = async (
    customerData: {
      displayName: string;
      email: string;
      phoneNumber?: string;
      stamps?: number;
      tickets?: number;
      points?: number;
    },
    staffId: string
  ) => {
    const existing = users.find(
      (u) => u.email.toLowerCase() === customerData.email.trim().toLowerCase()
    );
    if (existing) {
      return { success: false, message: 'A customer account with this email already exists.' };
    }

    const membershipNumber = generateMembershipNumber();
    const staff = users.find((u) => u.uid === staffId);
    const now = new Date();

    const newCustomer: UserProfile = {
      uid: `cust-${Date.now()}`,
      email: customerData.email.trim().toLowerCase(),
      displayName: customerData.displayName.trim(),
      phoneNumber: customerData.phoneNumber?.trim() || undefined,
      role: 'customer',
      membershipNumber,
      stamps: customerData.stamps ?? 0,
      tickets: customerData.tickets ?? 0,
      points: customerData.points ?? 0,
      createdAt: now,
      bikes: [],
    };

    const newLog: StampLog = {
      id: `log-newcust-${Date.now()}`,
      customerId: newCustomer.uid,
      customerName: newCustomer.displayName,
      membershipNumber: newCustomer.membershipNumber,
      staffId,
      staffName: staff?.displayName || 'Stakey Staff',
      action: 'edit_profile',
      stampsAfter: newCustomer.stamps,
      ticketsAfter: newCustomer.tickets,
      pointsAfter: newCustomer.points,
      timestamp: now,
      note: `New customer pass registered at till by ${staff?.displayName || 'Staff'}. Assigned ${newCustomer.stamps} stamps, ${newCustomer.tickets} tickets, and ${newCustomer.points} points.`,
    };

    setUsers((prev) => [...prev, newCustomer]);
    setStampLogs((prev) => [newLog, ...prev]);

    return {
      success: true,
      message: `Registered new customer pass ${membershipNumber} for ${newCustomer.displayName}`,
      customer: newCustomer,
    };
  };

  const updateWheel = async (wheelId: string, updatedData: Partial<PrizeWheel>) => {
    const existing = prizeWheels.find((w) => w.id === wheelId);
    if (!existing) return;
    const merged: PrizeWheel = { ...existing, ...updatedData, updatedAt: new Date() };
    setPrizeWheels((prev) => prev.map((w) => (w.id === wheelId ? merged : w)));
    upsertPrizeWheelToDb(merged).catch((e) =>
      console.warn('[DB SYNC] Error saving wheel to DB:', e)
    );
  };

  const executePrizeDraw = async (drawId: string) => {
    const draw = draws.find((d) => d.id === drawId);
    if (!draw) return { success: false, winner: null, message: 'Draw not found' };
    if (draw.status === 'completed') {
      return { success: false, winner: null, message: 'Draw is already completed' };
    }

    const eligibleCustomers = users.filter((u) => u.role === 'customer' && (u.tickets || 0) > 0);
    if (eligibleCustomers.length === 0) {
      return {
        success: false,
        winner: null,
        message: 'No customers with tickets > 0 found. Customers earn tickets by filling their 10-stamp card!',
      };
    }

    // Weighted pool
    const pool: UserProfile[] = [];
    eligibleCustomers.forEach((cust) => {
      const tCount = Math.max(1, cust.tickets || 1);
      for (let i = 0; i < tCount; i++) {
        pool.push(cust);
      }
    });

    const winner = pool[Math.floor(Math.random() * pool.length)];
    const now = new Date();

    const completedDraw: PrizeDraw = {
      ...draw,
      status: 'completed',
      winnerUid: winner.uid,
      winnerName: winner.displayName,
      completedAt: now,
    };

    setDraws((prev) => prev.map((d) => (d.id === drawId ? completedDraw : d)));

    // Persist the completed draw so the winner survives a reload
    upsertPrizeDrawToDb(completedDraw).catch((e) =>
      console.warn('[DB SYNC] Error saving completed draw to DB:', e)
    );

    // Announce to everybody that there was a winner!
    const announcement: WinnerAnnouncement = {
      id: `announce-${Date.now()}`,
      drawId: draw.id,
      drawTitle: draw.title,
      prizeDescription: draw.prizeDescription,
      winnerUid: winner.uid,
      winnerName: winner.displayName,
      winnerMembershipNumber: winner.membershipNumber,
      completedAt: now,
      announcedAt: now,
    };

    setLatestAnnouncement(announcement);

    // Public announcement stamp log
    const drawLog: StampLog = {
      id: `log-draw-${Date.now()}`,
      customerId: winner.uid,
      customerName: winner.displayName,
      membershipNumber: winner.membershipNumber,
      staffId: 'system-draw',
      staffName: "Stakey's Prize Draw",
      action: 'redeem_reward',
      timestamp: now,
      note: `🎉 GRAND PRIZE WINNER ANNOUNCED: ${winner.displayName} won "${draw.title}" (${draw.prizeDescription})!`,
    };
    setStampLogs((prev) => [drawLog, ...prev]);

    return {
      success: true,
      winner,
      message: `Winner selected: ${winner.displayName} (${winner.membershipNumber})! Total entries in pool: ${pool.length}. Announced to all users!`,
    };
  };

  const createDraw = async (title: string, prizeDescription: string, drawDate: Date) => {
    const newDraw: PrizeDraw = {
      id: `draw-${Date.now()}`,
      title,
      prizeDescription,
      drawDate,
      status: 'upcoming',
      winnerUid: null,
    };
    setDraws([newDraw, ...draws]);
    upsertPrizeDrawToDb(newDraw).catch((e) =>
      console.warn('[DB SYNC] Error saving draw to DB:', e)
    );
  };

  const awardPrizeToUser = (userId: string, prizeTitle: string, extraTickets = 0) => {
    const now = new Date();
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === userId) {
          return {
            ...u,
            tickets: Math.max(0, (u.tickets || 0) + extraTickets),
            lastSpunAt: now,
          };
        }
        return u;
      })
    );

    const target = users.find((u) => u.uid === userId);
    if (target) {
      toast.success(`🏆 Prize awarded: ${prizeTitle}!`, { icon: '🏆', duration: 5000 });
      const newLog: StampLog = {
        id: `log-${Date.now()}`,
        customerId: userId,
        customerName: target.displayName,
        membershipNumber: target.membershipNumber,
        staffId: 'system-wheel',
        staffName: 'Prize Wheel',
        action: 'redeem_reward',
        timestamp: now,
        note: `Won on Prize Wheel: ${prizeTitle}${extraTickets > 0 ? ` (+${extraTickets} ticket)` : ''}`,
      };
      setStampLogs((prev) => [newLog, ...prev]);

      // Persist tickets, spin timestamp (weekly cooldown) and audit log
      const nextTickets = Math.max(0, (target.tickets || 0) + extraTickets);
      updateUserProfileInDb(userId, target.membershipNumber, {
        tickets: nextTickets,
        lastSpunAt: now,
      }).catch((e) => console.warn('[DB SYNC] Error saving wheel win in DB:', e));
      insertStampLogToDb(newLog).catch((e) =>
        console.warn('[DB SYNC] Error inserting wheel log in DB:', e)
      );
    }
  };

  const awardWeeklyWheelPrize = async (
    userId: string,
    segment: PrizeWheelSegment
  ): Promise<{
    success: boolean;
    message: string;
    stampsAwarded?: number;
    isFull?: boolean;
    voucher?: CollectedVoucher;
  }> => {
    const target = users.find((u) => u.uid === userId);
    if (!target) return { success: false, message: 'User profile not found.' };

    const now = new Date();
    let stampsAwarded = 0;
    let extraTickets = 0;
    let extraPoints = 0;
    let newVoucher: CollectedVoucher | undefined = undefined;

    if (segment.rewardType === 'stamp') {
      stampsAwarded =
        segment.stampsAmount ||
        (segment.label.includes('3') ? 3 : segment.label.includes('2') ? 2 : 1);
    } else if (segment.rewardType === 'ticket') {
      extraTickets = segment.label.includes('3') ? 3 : 1;
    } else if (segment.rewardType === 'points') {
      extraPoints = parseInt(segment.rewardValue || '50', 10) || 50;
    } else if (
      segment.rewardType === 'discount' ||
      segment.rewardType === 'merch' ||
      segment.rewardType === 'service'
    ) {
      newVoucher = {
        id: `vouch-perk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        code: `STK-PRK-${Math.floor(100000 + Math.random() * 900000)}`,
        title: segment.label,
        description: segment.rewardValue || segment.label,
        value: segment.rewardType === 'discount' ? 10 : 0,
        type: segment.rewardType === 'discount' ? 'discount' : 'merch',
        terms: 'Won on Weekly Prize Wheel. Present voucher code or barcode at till.',
        claimedAt: now,
        status: 'available',
      };
    }

    const currentStamps = target.stamps || 0;
    // Wheel stamps add on top of the card; a full card stays "ready to collect"
    // rather than being capped, so banked stamps are never silently lost.
    const updatedStamps = currentStamps + stampsAwarded;
    const isFull = updatedStamps >= STAMPS_PER_CARD;
    
    // Add Cooldown check (7 days)
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const lastSpin = target.lastSpunAt ? new Date(target.lastSpunAt).getTime() : 0;
    const nowTime = now.getTime();
    
    // Allow spin if lastSpin was > 7 days ago, OR if override is used (for testing)
    // Note: 'isStaff' isn't explicitly passed, but we can check currentUser
    const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
    const isCooldownActive = !isStaff && (nowTime - lastSpin < sevenDaysInMs);

    if (isCooldownActive) {
      return { success: false, message: 'You have already spun the wheel this week. Please come back in 7 days!' };
    }

    // Apply logistics locally, then persist to Supabase.
    // Note: the previous implementation called a `spin_loyalty_wheel` RPC that
    // does not exist in the database, so every spin failed and nothing was saved.
    const updatedTickets = Math.max(0, (target.tickets || 0) + extraTickets);
    const updatedPoints = (target.points || 0) + extraPoints;

    const updatedUser: UserProfile = {
      ...target,
      stamps: updatedStamps,
      tickets: updatedTickets,
      points: updatedPoints,
      lastSpunAt: now,
      serviceVouchers: newVoucher
        ? [...(target.serviceVouchers || []), newVoucher]
        : target.serviceVouchers,
    };

    setUsers((prev) => prev.map((u) => (u.uid === userId ? updatedUser : u)));
    if (currentUser?.uid === userId) {
      setCurrentUser(updatedUser);
    }

    const logNote =
      stampsAwarded > 0
        ? `Weekly Prize Wheel: Won ${segment.label} (+${stampsAwarded} stamps! Card is now ${updatedStamps}/10${
            isFull ? ' - FULL CARD READY TO COLLECT £40 SERVICE!' : ''
          })`
        : `Weekly Prize Wheel: Won ${segment.label}`;

    const newLog: StampLog = {
      id: `log-wheel-${Date.now()}`,
      customerId: userId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId: 'weekly-prize-wheel',
      staffName: 'Weekly Prize Wheel',
      action: 'redeem_reward',
      stampsBefore: currentStamps,
      stampsAfter: updatedStamps,
      timestamp: now,
      note: logNote,
    };
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: profile progress, spin cooldown, audit log, prize voucher
    updateUserProfileInDb(userId, target.membershipNumber, {
      stamps: updatedStamps,
      tickets: updatedTickets,
      points: updatedPoints,
      lastSpunAt: now,
    }).catch((e) => console.warn('[DB SYNC] Error saving weekly wheel spin in DB:', e));
    insertStampLogToDb(newLog).catch((e) =>
      console.warn('[DB SYNC] Error inserting weekly wheel log in DB:', e)
    );
    if (newVoucher) {
      insertVoucherToDb(userId, newVoucher).catch((e) =>
        console.warn('[DB SYNC] Error saving prize voucher in DB:', e)
      );
    }

    const toastMsg =
      stampsAwarded > 0
        ? `🎉 Won ${segment.label}! (+${stampsAwarded} ${stampsAwarded === 1 ? 'stamp' : 'stamps'} added)`
        : `🎉 Won ${segment.label}!`;
    toast.success(toastMsg, {
      icon: stampsAwarded > 0 ? '🎟️' : '🎁',
      duration: 5000,
    });

    return {
      success: true,
      message: `Congratulations! You won ${segment.label}!`,
      stampsAwarded,
      isFull,
      voucher: newVoucher,
    };
  };

  const collectFullCardReward = async (
    userId: string
  ): Promise<{ success: boolean; voucher?: CollectedVoucher; message: string }> => {
    // Re-entrancy guard: a rapid double-tap must not mint two vouchers.
    if (collectingRef.current.has(userId)) {
      return { success: false, message: 'Your reward is already being claimed…' };
    }

    const target = users.find((u) => u.uid === userId);
    if (!target) return { success: false, message: 'User profile not found.' };

    const result = collectFullCard(target.stamps || 0);
    if (result.cardsCollected < 1) {
      return {
        success: false,
        message: `Your stamp card has ${result.stampsBefore}/${STAMPS_PER_CARD} stamps. Fill all ${STAMPS_PER_CARD} stamps to collect your £40 Service reward!`,
      };
    }

    collectingRef.current.add(userId);
    try {
      const now = new Date();
      const serviceVoucher = buildServiceVoucher(now);

      const updatedUser: UserProfile = {
        ...target,
        stamps: result.stampsAfter,
        serviceVouchers: [...(target.serviceVouchers || []), serviceVoucher],
      };

      setUsers((prev) => prev.map((u) => (u.uid === userId ? updatedUser : u)));
      if (currentUser?.uid === userId) {
        setCurrentUser(updatedUser);
      }

      const newLog: StampLog = {
        id: `log-reward-collect-${Date.now()}`,
        customerId: userId,
        customerName: target.displayName,
        membershipNumber: target.membershipNumber,
        staffId: 'customer-portal-collection',
        staffName: 'Customer Collection',
        action: 'redeem_reward',
        stampsBefore: result.stampsBefore,
        stampsAfter: result.stampsAfter,
        ticketsAwarded: 0,
        timestamp: now,
        note: `Customer collected ${result.cardsCollected} full card(s) — ${serviceVoucher.title}. Voucher Code: ${serviceVoucher.code}`,
      };
      setStampLogs((prev) => [newLog, ...prev]);

      // Remote Database Mutation: subtract stamps, record voucher + audit log
      updateUserProfileInDb(userId, target.membershipNumber, {
        stamps: result.stampsAfter,
      }).catch((e) => console.warn('[DB SYNC] Error saving full-card collection in DB:', e));
      insertVoucherToDb(userId, serviceVoucher).catch((e) =>
        console.warn('[DB SYNC] Error saving service voucher in DB:', e)
      );
      insertStampLogToDb(newLog).catch((e) =>
        console.warn('[DB SYNC] Error inserting collection log in DB:', e)
      );

      toast.success(
        '🎉 Congratulations! £40 Workshop Service Voucher claimed! Valid for 12 months.',
        { icon: '🎁', duration: 6000 }
      );

      return {
        success: true,
        voucher: serviceVoucher,
        message:
          'Congratulations! You have collected your £40 Service Voucher (labour only, parts not included)!',
      };
    } finally {
      collectingRef.current.delete(userId);
    }
  };

  const redeemServiceVoucher = async (
    customerId: string,
    voucherCode: string,
    staffId = 'staff-counter'
  ): Promise<{ success: boolean; message: string }> => {
    const target = users.find((u) => u.uid === customerId);
    if (!target) return { success: false, message: 'Customer record not found.' };

    const vouchers = target.serviceVouchers || [];
    const voucherIdx = vouchers.findIndex((v) => v.code === voucherCode);
    if (voucherIdx === -1) {
      return { success: false, message: `Voucher code "${voucherCode}" not found.` };
    }

    if (vouchers[voucherIdx].status === 'redeemed') {
      return { success: false, message: `Voucher "${voucherCode}" has already been redeemed.` };
    }

    const now = new Date();
    const updatedVouchers = [...vouchers];
    updatedVouchers[voucherIdx] = {
      ...updatedVouchers[voucherIdx],
      status: 'redeemed',
      redeemedAt: now,
    };

    const updatedUser: UserProfile = {
      ...target,
      serviceVouchers: updatedVouchers,
    };

    setUsers((prev) => prev.map((u) => (u.uid === customerId ? updatedUser : u)));
    if (currentUser?.uid === customerId) {
      setCurrentUser(updatedUser);
    }

    const staff = users.find((u) => u.uid === staffId);
    const staffName = staff?.displayName || 'Stakey Staff';

    const newLog: StampLog = {
      id: `log-vouch-redeem-${Date.now()}`,
      customerId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId,
      staffName,
      action: 'redeem_reward',
      timestamp: now,
      note: `Redeemed ${updatedVouchers[voucherIdx].title} (Voucher ${voucherCode}) by ${staffName}. Applied £${updatedVouchers[voucherIdx].value} labour discount.`,
    };
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: mark voucher redeemed + audit log
    updateVoucherStatusInDb(updatedVouchers[voucherIdx].id, 'redeemed', now).catch((e) =>
      console.warn('[DB SYNC] Error redeeming voucher in DB:', e)
    );
    insertStampLogToDb(newLog).catch((e) =>
      console.warn('[DB SYNC] Error inserting voucher redemption log in DB:', e)
    );

    return {
      success: true,
      message: `Successfully redeemed voucher "${voucherCode}"! £${updatedVouchers[voucherIdx].value} labour credit applied.`,
    };
  };

  const resetUserSpinCooldown = (userId: string) => {
    const target = users.find((u) => u.uid === userId);
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === userId) {
          return {
            ...u,
            lastSpunAt: null,
          };
        }
        return u;
      })
    );
    updateUserProfileInDb(userId, target?.membershipNumber, { lastSpunAt: null }).catch((e) =>
      console.warn('[DB SYNC] Error resetting spin cooldown in DB:', e)
    );
  };

  const addCustomerBikeForUser = async (
    userId: string,
    bikeData: Omit<CustomerBike, 'id' | 'addedAt'>
  ): Promise<CustomerBike> => {
    const newBike: CustomerBike = {
      ...bikeData,
      id: `bike-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      addedAt: new Date().toISOString().split('T')[0],
      healthStatus: bikeData.healthStatus || 'healthy',
    };

    // Single source of truth: optimistically update local state, then persist to Supabase.
    setUsers((prev) =>
      prev.map((u) => (u.uid === userId ? { ...u, bikes: [newBike, ...(u.bikes || [])] } : u))
    );
    if (currentUser && currentUser.uid === userId) {
      setCurrentUser((prev) =>
        prev ? { ...prev, bikes: [newBike, ...(prev.bikes || [])] } : prev
      );
    }

    insertCustomerBikeToDb(newBike, userId).catch((e) =>
      console.warn('[DB SYNC] Error inserting bike in DB:', e)
    );

    return newBike;
  };

  const addCustomerBike = async (bikeData: Omit<CustomerBike, 'id' | 'addedAt'>): Promise<CustomerBike> => {
    if (!currentUser) {
      throw new Error('You must be signed in to add a bike.');
    }
    return addCustomerBikeForUser(currentUser.uid, bikeData);
  };

  const removeCustomerBike = async (bikeId: string) => {
    if (currentUser) {
      // Remote Database Mutation: DELETE directly from customer_bikes table
      deleteCustomerBikeFromDb(bikeId, currentUser.uid).catch((e) => console.warn('[DB SYNC] Error deleting bike in DB:', e));
      const updatedBikes = (currentUser.bikes || []).filter((b) => b.id !== bikeId);
      const updatedUser: UserProfile = {
        ...currentUser,
        bikes: updatedBikes,
      };
      setCurrentUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.uid === currentUser.uid ? updatedUser : u)));
    }
  };

  const createBooking = async (
    data: Omit<ServiceBooking, 'id' | 'createdAt' | 'status' | 'notifications'>
  ): Promise<ServiceBooking> => {
    const now = new Date();
    const newId = `bk-${Date.now().toString().slice(-4)}`;

    const provisionalBooking: ServiceBooking = {
      ...data,
      id: newId,
      status: 'pending',
      approvalStatus: 'pending_approval',
      isGuest: !data.customerId,
      createdAt: now,
      notifications: [],
      repairStage: 'received',
      ...(data.isSos ? { sosStatus: data.sosStatus || 'requested' } : {}),
      progressEvents: [
        makeRepairEvent({
          stage: 'received',
          kind: 'stage',
          label: repairStageLabel('received'),
          note: data.isSos
            ? '🚨 SOS EXPRESS REPAIR received — jumping the workshop queue.'
            : 'Booking received — your repair is in the workshop queue.',
          createdBy: 'Online Booking System',
        }),
      ],
    };

    // Immediately dispatch email alerts to BOTH customer and owner confirming receipt and pending approval
    const { emailLog, customerEmailLog, failures } = await dispatchBookingNotifications(provisionalBooking, ownerConfig);

    const completedBooking: ServiceBooking = {
      ...provisionalBooking,
      notifications: [emailLog, customerEmailLog],
      notificationFailures: failures,
    };

    setBookings((prev) => [completedBooking, ...prev]);
    knownBookingIdsRef.current.add(completedBooking.id);
    setLatestDispatchedBooking(completedBooking);

    // Remote Database Mutation: INSERT directly into service_bookings table
    insertServiceBookingToDb(completedBooking).catch((e) => console.warn('[DB SYNC] Error inserting booking in DB:', e));

    // Audio Alert & Push. The loud ping only plays on staff devices; the server
    // push is sent by whoever creates the booking so staff phones are reached
    // even when the terminal isn't open.
    const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';
    if (isStaff) {
      staffBookingAudio.playLoudBookingPing();
      staffBookingAudio.dispatchPushNotification(
        `🚨 New Workshop Booking #${completedBooking.id}`,
        `${completedBooking.customerName} booked ${completedBooking.serviceTitle} for ${completedBooking.preferredDate}`
      );
    }
    void sendPushToUser(
      isStaff ? currentUser?.uid : undefined,
      `🚨 New Workshop Booking #${completedBooking.id}`,
      `${completedBooking.customerName} booked ${completedBooking.serviceTitle} for ${completedBooking.preferredDate}`,
      undefined,
      { segment: 'staff' }
    );

    // SOS emergency repair: fire an owner-only OneSignal push (and a loud ping
    // on any staff device that has the terminal open) the moment it lands.
    if (completedBooking.isSos) {
      staffBookingAudio.playLoudBookingPing();
      const sosLog = await dispatchSosNotification(completedBooking, ownerConfig, 'requested', {
        ownerReminderEmail: reminderOwnerEmailRef.current,
      }).catch((e) => {
        console.warn('[SOS] request push failed:', e);
        return null;
      });
      if (sosLog) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === completedBooking.id ? { ...b, notifications: [...b.notifications, sosLog] } : b
          )
        );
      }
    }

    // Trigger instant email alert confirmation banner
    const failureWarning = failures && failures.length > 0 ? ` ⚠️ ${failures.join(' ')}` : '';
    setLatestSmsAlert({
      title: failureWarning ? '📋 Repair Request Pending Approval — email warning' : '📋 Repair Request Pending Approval',
      message: `Repair request submitted! Staff will evaluate bench capacity. Email confirmation sent to ${completedBooking.customerEmail} and workshop alert to ${ownerConfig.ownerEmail}.${failureWarning}`,
      recipient: `${completedBooking.customerEmail} & ${ownerConfig.ownerEmail}`,
      time: new Date().toLocaleTimeString(),
      recipientType: 'both',
    });

    // Personalisation: Automatically save this bike to the customer's profile if logged in
    const targetUserId = data.customerId || currentUser?.uid;
    const targetEmail = data.customerEmail?.toLowerCase();

    setUsers((prevUsers) => {
      return prevUsers.map((u) => {
        const matchesUser = (targetUserId && u.uid === targetUserId) || (targetEmail && u.email.toLowerCase() === targetEmail);
        if (matchesUser) {
          const existingBikes = u.bikes || [];
          const alreadyExists = existingBikes.some(
            (b) => b.model.toLowerCase() === data.vehicleModel.toLowerCase() ||
                   data.vehicleModel.toLowerCase().includes(b.model.toLowerCase())
          );

          if (!alreadyExists && data.vehicleModel) {
            let brand = 'Standard';
            let model = data.vehicleModel;
            if (data.vehicleModel.includes(' - ')) {
              const parts = data.vehicleModel.split(' - ');
              brand = parts[0].trim();
              model = parts.slice(1).join(' - ').trim();
            } else if (data.vehicleModel.includes(' ')) {
              const parts = data.vehicleModel.split(' ');
              brand = parts[0].trim();
              model = parts.slice(1).join(' ').trim();
            }

            const autoBike: CustomerBike = {
              id: `bike-${Date.now()}`,
              category: data.vehicleCategory,
              categoryLabel: data.vehicleCategory === 'cycle' ? 'Bicycle' : data.vehicleCategory === 'ebike' ? 'Electric Bike' : data.vehicleCategory === 'electric_scooter' ? 'E-Scooter' : 'Kids / Cargo',
              brand,
              model,
              year: data.bikeDetails?.year || undefined,
              serialNumber: data.bikeDetails?.serialNumber || undefined,
              frameSizeOrNotes: data.bikeDetails?.frameSize || undefined,
              colour: 'Workshop Recorded',
              addedAt: new Date().toISOString().split('T')[0],
              lastServiceDate: data.preferredDate || new Date().toISOString().split('T')[0],
              lastServiceTitle: data.serviceTitle,
              healthStatus: 'in_workshop',
              bikeDetails: data.bikeDetails,
            };

            const updated = {
              ...u,
              bikes: [autoBike, ...existingBikes],
            };
            insertCustomerBikeToDb(autoBike, u.uid).catch((e) =>
              console.warn('[DB SYNC] Error inserting auto-bike in DB:', e)
            );
            if (currentUser && currentUser.uid === u.uid) {
              setCurrentUser(updated);
            }
            return updated;
          } else if (alreadyExists) {
            const updatedBikes = existingBikes.map((b) => {
              if (b.model.toLowerCase() === data.vehicleModel.toLowerCase() || data.vehicleModel.toLowerCase().includes(b.model.toLowerCase())) {
                return {
                  ...b,
                  lastServiceDate: data.preferredDate || new Date().toISOString().split('T')[0],
                  lastServiceTitle: data.serviceTitle,
                  healthStatus: 'in_workshop' as const,
                };
              }
              return b;
            });
            const updated = { ...u, bikes: updatedBikes };
            if (currentUser && currentUser.uid === u.uid) {
              setCurrentUser(updated);
            }
            return updated;
          }
        }
        return u;
      });
    });

    // Also record an entry in staff audit logs for transparency
    const newAuditLog: StampLog = {
      id: `log-bk-${Date.now()}`,
      customerId: data.customerId || 'guest',
      customerName: data.customerName,
      membershipNumber: data.membershipNumber,
      staffId: 'system-booking',
      staffName: "Online Booking System",
      action: 'redeem_reward',
      timestamp: now,
      note: `🔧 NEW BOOKING: ${data.customerName} booked "${data.serviceTitle}" (${data.vehicleModel}) for ${data.preferredDate}. Email dispatched to ${ownerConfig.ownerEmail}.`,
    };
    setStampLogs((prev) => [newAuditLog, ...prev]);
    insertStampLogToDb(newAuditLog).catch((e) =>
      console.warn('[DB SYNC] Error inserting booking audit log in DB:', e)
    );

    return completedBooking;
  };

  const approveBooking = async (
    bookingId: string,
    staffNote?: string,
    quote?: { quotedPrice: number; quoteNote?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    // The estimate the customer sees in their confirmation. Prefer the value
    // captured in this approval step, falling back to a previously saved quote.
    const quotedPrice =
      quote && Number.isFinite(quote.quotedPrice) ? quote.quotedPrice : target.quotedPrice;
    const quoteNote = quote ? quote.quoteNote : target.quoteNote;
    const quoteSentAt = quote ? new Date().toISOString() : target.quoteSentAt;

    const bookingWithQuote: ServiceBooking = {
      ...target,
      quotedPrice,
      quoteNote,
      quoteSentAt,
    };

    const { emailLog, sent: emailSent, error: emailError } = await dispatchBookingApprovalNotification(
      bookingWithQuote,
      staffNote,
      ownerConfig
    );

    const updated: ServiceBooking = {
      ...bookingWithQuote,
      status: 'confirmed',
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.displayName || 'Workshop Staff',
      staffNotes: staffNote || target.staffNotes,
      ...(isSosBooking(target) ? { sosStatus: 'approved' as const } : {}),
      notifications: [emailLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    // Refer a Friend: an approved full-service booking carrying a referral code
    // pays the referrer their £5 and closes out the friend's £15 reward.
    if (updated.referralCode) {
      void grantReferralRewards(updated);
    }

    // Remote Database Mutation: UPDATE service_bookings table
    const persisted = await updateServiceBookingInDb(bookingId, {
      status: 'confirmed',
      approvalStatus: 'approved',
      approvedAt: updated.approvedAt,
      approvedBy: updated.approvedBy,
      staffNotes: staffNote || target.staffNotes,
      quotedPrice,
      quoteNote,
      quoteSentAt,
      ...(isSosBooking(target) ? { sosStatus: 'approved' } : {}),
    }).catch((e) => {
      console.warn('[DB SYNC] Error approving booking in DB:', e);
      return false;
    });

    // SOS: nudge the owner to request the rider's live location over WhatsApp.
    if (isSosBooking(target)) {
      const sosLog = await dispatchSosNotification(updated, ownerConfig, 'approved', {
        ownerReminderEmail: reminderOwnerEmailRef.current,
      }).catch(() => null);
      if (sosLog) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, notifications: [...b.notifications, sosLog] } : b))
        );
      }
    }

    if (emailSent) {
      setLatestSmsAlert({
        title: '✅ Booking Approved & Customer Notified',
        message: `Official Approval Email delivered to ${target.customerEmail} for ${target.preferredDate}.`,
        recipient: target.customerEmail,
        time: new Date().toLocaleTimeString(),
        recipientType: 'customer',
      });
    } else {
      setLatestSmsAlert({
        title: '⚠️ Booking Approved — Email NOT Sent',
        message: `Approved locally, but the confirmation email to ${target.customerEmail} failed${emailError ? ` (${emailError})` : ''}. Deploy the send-email function / set RESEND_API_KEY, then notify the customer manually.`,
        recipient: target.customerEmail,
        time: new Date().toLocaleTimeString(),
        recipientType: 'customer',
      });
    }

    const auditLog: StampLog = {
      id: `log-appr-${Date.now()}`,
      customerId: target.customerId || 'guest',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Ben Stakey',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `✅ APPROVED: Booking #${target.id} (${target.serviceTitle}) for ${target.customerName}. ${emailSent ? `Email dispatched to ${target.customerEmail}.` : 'Email delivery FAILED.'}`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

    if (!emailSent) {
      return {
        success: true,
        message: `Booking #${bookingId} approved${persisted ? '' : ' (local only — database sync failed)'}. ⚠️ Confirmation email to ${target.customerEmail} was NOT sent${emailError ? `: ${emailError}` : ''}.`,
      };
    }

    return {
      success: true,
      message: `Booking #${bookingId} approved! Email notification sent to ${target.customerEmail}.`,
    };
  };

  const declineBooking = async (
    bookingId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const { emailLog } = await dispatchBookingDeclinedNotification(
      target,
      reason,
      ownerConfig
    );

    const updated: ServiceBooking = {
      ...target,
      status: 'declined',
      approvalStatus: 'declined',
      declinedAt: new Date().toISOString(),
      declineReason: reason || 'Workshop capacity limit',
      notifications: [emailLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    // Remote Database Mutation: UPDATE service_bookings table
    updateServiceBookingInDb(bookingId, {
      status: 'declined',
      approvalStatus: 'declined',
      declinedAt: updated.declinedAt,
      declineReason: reason || 'Workshop capacity limit',
    }).catch((e) => console.warn('[DB SYNC] Error declining booking in DB:', e));

    setLatestSmsAlert({
      title: '⚠️ Booking Declined & Customer Notified',
      message: `Decline notification email delivered to ${target.customerEmail} explaining the decision.`,
      recipient: target.customerEmail,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    const auditLog: StampLog = {
      id: `log-decl-${Date.now()}`,
      customerId: target.customerId || 'guest',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Ben Stakey',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `⚠️ DECLINED: Booking #${target.id} for ${target.customerName}. Reason: "${reason || 'Capacity limit'}". Email dispatched to ${target.customerEmail}.`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

    return {
      success: true,
      message: `Booking #${bookingId} declined. Notification email sent to ${target.customerEmail}.`,
    };
  };

  const updateDraw = async (drawId: string, updates: Partial<PrizeDraw>): Promise<void> => {
    setDraws((prev) =>
      prev.map((d) => (d.id === drawId ? { ...d, ...updates } : d))
    );
  };

  const deleteDraw = async (drawId: string): Promise<void> => {
    setDraws((prev) => prev.filter((d) => d.id !== drawId));
  };

  const deleteCustomerAccount = async (userId: string): Promise<{ success: boolean; message: string }> => {
    const target = users.find((u) => u.uid === userId);
    setUsers((prev) => prev.filter((u) => u.uid !== userId));
    return { success: true, message: `Account for ${target?.displayName || 'Customer'} has been removed.` };
  };

  const adjustCustomerStamps = async (
    userId: string,
    delta: number,
    note?: string
  ): Promise<{ success: boolean; message: string; stamps: number }> => {
    const target = users.find((u) => u.uid === userId);
    if (!target) {
      return { success: false, message: 'Customer not found.', stamps: 0 };
    }

    const now = new Date();
    const result = adjustStamps(target.stamps || 0, delta);

    setUsers((prev) =>
      prev.map((u) =>
        u.uid === userId ? { ...u, stamps: result.stampsAfter, lastStampedAt: now } : u
      )
    );

    const log: StampLog = {
      id: `log-adj-${Date.now()}`,
      customerId: userId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-admin',
      staffName: currentUser?.displayName || 'Workshop Staff',
      action: delta > 0 ? 'add_stamp' : 'manual_points_adjustment',
      stampsBefore: result.stampsBefore,
      stampsAfter: result.stampsAfter,
      timestamp: now,
      note: note || (delta > 0 ? `Issued +${result.delta} visit stamp` : `Adjusted stamps by ${result.delta}`),
    };
    setStampLogs((prev) => [log, ...prev]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table
    updateUserProfileInDb(userId, undefined, {
      stamps: result.stampsAfter,
      lastStampedAt: now,
    }).catch((e) => console.warn('[DB SYNC] Error adjusting stamps in DB:', e));
    insertStampLogToDb(log).catch((e) =>
      console.warn('[DB SYNC] Error inserting stamp adjustment log in DB:', e)
    );

    return {
      success: true,
      message: `Updated stamps for ${target.displayName} to ${result.stampsAfter}/${STAMPS_PER_CARD}.`,
      stamps: result.stampsAfter,
    };
  };

  const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
    const derivedStage = stageForStatus(status);
    const event = makeRepairEvent({
      stage: derivedStage,
      kind: 'stage',
      label: repairStageLabel(derivedStage),
      note: 'Status updated on the workshop bench',
      createdBy: currentUser?.displayName || 'Workshop',
    });
    let nextProgressEvents: RepairProgressEvent[] | undefined;

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        // Always keep the fixed stage + timeline in step with the coarse status.
        const progressEvents = [event, ...(b.progressEvents || [])];
        nextProgressEvents = progressEvents;
        return {
          ...b,
          status,
          repairStage: derivedStage,
          progressEvents,
        };
      })
    );
    updateServiceBookingInDb(bookingId, {
      status,
      repairStage: derivedStage,
      progressEvents: nextProgressEvents,
    }).catch((e) =>
      console.warn('[DB SYNC] Error updating booking status in DB:', e)
    );
  };

  const setRepairStage = async (
    bookingId: string,
    stage: RepairStageId,
    options?: { note?: string; estimateReadyAt?: string | null }
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const status = statusForStage(stage);
    const event = makeRepairEvent({
      stage,
      kind: 'stage',
      label: repairStageLabel(stage),
      note: options?.note,
      createdBy: currentUser?.displayName || 'Workshop',
    });

    const nextStageIndex = repairStageIndex(stage);
    const currentIndex = repairStageIndex(target.repairStage || stageForStatus(target.status));
    // Only ever append to the timeline when moving forward, so the customer's
    // history reads as a clean, chronological workshop log.
    const nextProgressEvents =
      nextStageIndex >= currentIndex
        ? [event, ...(target.progressEvents || [])]
        : target.progressEvents || [];

    const estimateReadyAt =
      options?.estimateReadyAt !== undefined ? options.estimateReadyAt : target.estimateReadyAt ?? null;

    const updated: ServiceBooking = {
      ...target,
      status,
      repairStage: stage,
      progressEvents: nextProgressEvents,
      estimateReadyAt,
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    await updateServiceBookingInDb(bookingId, {
      status,
      repairStage: stage,
      progressEvents: nextProgressEvents,
      estimateReadyAt,
    });

    return { success: true, message: `Repair moved to “${repairStageLabel(stage)}”.` };
  };

  /**
   * Server-backed lookup for a scanned member code / QR. Staff tills may not
   * have the full customer roster loaded locally, so this re-fetches profiles
   * from Supabase before resolving, and backfills the local cache with any
   * customer found remotely. Keeps every branch of the till pointing at the
   * same account for stamps, discounts and history.
   */
  const resolveScannedMemberDetailed = async (
    rawCode: string
  ): Promise<{ customer: UserProfile | null; error?: string }> => {
    let pool = users;
    const local = resolveCustomer(rawCode, pool);
    if (local.status !== 'match' && local.status !== 'multiple') {
      const { profiles: remote, error } = await fetchAllProfilesFromDbDetailed();
      if (remote && remote.length > 0) {
        pool = remote;
        setUsers(remote);
      }
      const res = resolveCustomer(rawCode, pool);
      if (res.status === 'match') return { customer: res.customer };
      // Surface the Supabase/RLS failure so the scanner can alert instead of
      // silently resetting to the scanning state.
      return { customer: null, error };
    }
    const res = resolveCustomer(rawCode, pool);
    return { customer: res.status === 'match' ? res.customer : null };
  };

  const resolveScannedMember = async (rawCode: string): Promise<UserProfile | null> => {
    const { customer } = await resolveScannedMemberDetailed(rawCode);
    return customer;
  };

  const addRepairProgressNote = async (
    bookingId: string,
    note: string,
    options?: { photoUrl?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    if (!note.trim()) return { success: false, message: 'Note cannot be empty' };
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const event = makeRepairEvent({
      kind: 'note',
      label: 'Workshop update',
      note,
      photoUrl: options?.photoUrl,
      createdBy: currentUser?.displayName || 'Workshop',
    });
    const nextProgressEvents = [event, ...(target.progressEvents || [])];

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, progressEvents: nextProgressEvents } : b))
    );
    await updateServiceBookingInDb(bookingId, { progressEvents: nextProgressEvents });

    return { success: true, message: 'Progress note added.' };
  };

  const updateBookingQuote = async (bookingId: string, quote: { quotedPrice: number, quoteNote?: string }): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const isSos = isSosBooking(target);
    const updated: ServiceBooking = {
      ...target,
      quotedPrice: quote.quotedPrice,
      quoteNote: quote.quoteNote,
      quoteSentAt: new Date().toISOString(),
      ...(isSos ? { sosStatus: 'quoted' as const } : {}),
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    const persisted = await updateServiceBookingInDb(bookingId, {
      quotedPrice: quote.quotedPrice,
      quoteNote: quote.quoteNote,
      quoteSentAt: updated.quoteSentAt,
      ...(isSos ? { sosStatus: 'quoted' } : {}),
    }).catch((e) => {
      console.warn('[DB SYNC] Error updating booking quote in DB:', e);
      return false;
    });

    // SOS: tell the owner a quote has gone out, so they watch for the CONFIRM.
    if (isSos) {
      const log = await dispatchSosNotification(updated, ownerConfig, 'quoted', {
        ownerReminderEmail: reminderOwnerEmailRef.current,
        quotedPrice: quote.quotedPrice,
      }).catch(() => null);
      if (log) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, notifications: [...b.notifications, log] } : b))
        );
      }
    }

    return {
      success: true,
      message: persisted
        ? `Quote of £${quote.quotedPrice.toFixed(2)} saved for booking #${bookingId}. It will be included as the estimate in the approval email.`
        : `Quote of £${quote.quotedPrice.toFixed(2)} saved on this device only — the database sync failed. Run the repair SQL, then re-send the quote.`,
    };
  };

  /**
   * SOS step 2: record that we've asked the rider for their live location over
   * WhatsApp. Staff send the actual WhatsApp message from the terminal (the
   * deep link lives in sosRepair.ts); this just advances the job's status.
   */
  const requestSosLocation = async (
    bookingId: string,
    locationNote?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const updated: ServiceBooking = {
      ...target,
      sosStatus: 'location_requested',
      sosLocationRequestedAt: new Date().toISOString(),
      sosLocationNote: locationNote || target.sosLocationNote,
    };
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    const persisted = await updateServiceBookingInDb(bookingId, {
      sosStatus: 'location_requested',
      sosLocationRequestedAt: updated.sosLocationRequestedAt,
      sosLocationNote: updated.sosLocationNote,
    }).catch(() => false);

    return {
      success: true,
      message: persisted
        ? 'Live-location request recorded — send the WhatsApp message to the rider.'
        : 'Recorded on this device only — the database sync failed.',
    };
  };

  /**
   * SOS step 4: the rider has confirmed the quoted price over WhatsApp, so we
   * set off immediately. Fires the loudest owner push of the flow.
   */
  const confirmSosQuote = async (
    bookingId: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const updated: ServiceBooking = {
      ...target,
      sosStatus: 'confirmed',
      sosConfirmedAt: new Date().toISOString(),
    };
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    await updateServiceBookingInDb(bookingId, {
      sosStatus: 'confirmed',
      sosConfirmedAt: updated.sosConfirmedAt,
    }).catch(() => false);

    const log = await dispatchSosNotification(updated, ownerConfig, 'confirmed', {
      ownerReminderEmail: reminderOwnerEmailRef.current,
      quotedPrice: updated.quotedPrice,
    }).catch(() => null);
    if (log) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, notifications: [...b.notifications, log] } : b))
      );
    }

    return { success: true, message: `Price confirmed for #${bookingId} — set off immediately!` };
  };

  const deleteBooking = async (
    bookingId: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    setBookings((prev) => prev.filter((b) => b.id !== bookingId));

    const persisted = await deleteServiceBookingFromDb(bookingId).catch((e) => {
      console.warn('[DB SYNC] Error deleting booking in DB:', e);
      return false;
    });

    const auditLog: StampLog = {
      id: `log-bkdel-${Date.now()}`,
      customerId: target.customerId || 'guest',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Workshop Staff',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `🗑️ BOOKING DELETED: ${target.customerName} — "${target.serviceTitle}" (${target.preferredDate}).`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

    return {
      success: true,
      message: persisted
        ? `Booking #${bookingId} deleted.`
        : `Booking #${bookingId} removed on this device only — the database delete failed.`,
    };
  };

  const clearAllBookings = async (): Promise<{
    success: boolean;
    message?: string;
    deleted: number;
  }> => {
    const count = bookings.length;
    if (count === 0) return { success: true, deleted: 0, message: 'There are no bookings to clear.' };

    setBookings([]);

    const persisted = await deleteAllServiceBookingsFromDb().catch((e) => {
      console.warn('[DB SYNC] Error clearing bookings in DB:', e);
      return false;
    });

    const auditLog: StampLog = {
      id: `log-bkclear-${Date.now()}`,
      customerId: 'system',
      customerName: 'Workshop',
      membershipNumber: '-',
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Workshop Staff',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `🧹 BOOKINGS CLEARED: removed all ${count} booking(s) ready for launch.`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

    return {
      success: persisted,
      deleted: count,
      message: persisted
        ? `Cleared ${count} booking${count === 1 ? '' : 's'} — workshop is ready for launch.`
        : `Cleared ${count} booking${count === 1 ? '' : 's'} on this device only — the database delete failed.`,
    };
  };

  const saveRepairInvoice = async (
    bookingId: string,
    invoice: RepairInvoice
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const emailContent = `Your bicycle repair is complete! Invoice ${invoice.invoiceNumber} for £${invoice.grandTotal.toFixed(2)} has been generated. Ready for collection at Stakey's Cycles bench.`;
    const notificationLog = {
      id: `notif-inv-${Date.now()}`,
      type: 'email' as const,
      recipient: invoice.customerEmail,
      recipientRole: 'customer' as const,
      subject: `Official Workshop Invoice: ${invoice.invoiceNumber} - Stakey's Cycles`,
      content: emailContent,
      timestamp: new Date().toISOString(),
      status: 'delivered' as const,
      category: 'status_update' as const,
    };

    const updated: ServiceBooking = {
      ...target,
      status: 'ready_for_pickup',
      servicePrice: invoice.grandTotal,
      quotedPrice: invoice.grandTotal,
      invoice,
      notifications: [notificationLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    updateServiceBookingInDb(bookingId, {
      status: 'ready_for_pickup',
      servicePrice: invoice.grandTotal,
      invoice,
    }).catch((e) => console.warn('[DB SYNC] Error saving invoice in DB:', e));

    setLatestSmsAlert({
      title: `📄 Invoice ${invoice.invoiceNumber} Dispatched`,
      message: `Repair completed! High-detailed invoice (£${invoice.grandTotal.toFixed(2)}) delivered to ${invoice.customerEmail}. Bike marked ready for pickup.`,
      recipient: invoice.customerEmail,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    const auditLog: StampLog = {
      id: `log-inv-${Date.now()}`,
      customerId: target.customerId || 'guest',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Ben Stake',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `🛠️ REPAIR COMPLETED: Generated Invoice ${invoice.invoiceNumber} (£${invoice.grandTotal.toFixed(2)}) for ${target.customerName}. Marked Ready for Pickup.`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} generated! Customer notified.`,
    };
  };

  const updateInvoicePaymentStatus = async (
    bookingId: string,
    paymentStatus: 'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online'
  ): Promise<void> => {
    let nextInvoice: RepairInvoice | undefined;
    let nextStatus: ServiceBooking['status'] | undefined;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId && b.invoice) {
          const updatedInvoice: RepairInvoice = {
            ...b.invoice,
            paymentStatus,
            paymentDate: paymentStatus !== 'unpaid' ? new Date().toISOString() : undefined,
          };
          nextInvoice = updatedInvoice;
          nextStatus = paymentStatus !== 'unpaid' ? 'completed' : b.status;
          return {
            ...b,
            status: nextStatus,
            invoice: updatedInvoice,
          };
        }
        return b;
      })
    );

    if (nextInvoice) {
      updateServiceBookingInDb(bookingId, {
        status: nextStatus,
        invoice: nextInvoice,
      }).catch((e) => console.warn('[DB SYNC] Error updating invoice payment status:', e));
    }
  };

  const updateOwnerConfig = (config: Partial<OwnerNotificationConfig>) => {
    setOwnerConfig((prev) => {
      const next = { ...prev, ...config };
      upsertAppSettingsToDb({
        ownerEmail: next.ownerEmail,
        ownerPhone: next.ownerPhone,
        emailAlertsEnabled: next.emailAlertsEnabled,
        smsAlertsEnabled: next.smsAlertsEnabled === true,
        businessName: next.businessName,
      }).catch((e) => console.warn('[DB SYNC] updateOwnerConfig persist failed:', e));
      return next;
    });
  };

  const resetAllDemoData = () => {
    localStorage.clear();
    window.location.reload();
  };
  
  const hardResetApp = () => {
    localStorage.clear();
    window.location.reload();
  };

  const dispatch24hReminderForBooking = async (bookingId: string): Promise<boolean> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return false;

    const { customerReminderLog, ownerReminderLog, updatedBooking } = await dispatch24hReminderNotification(
      target,
      ownerConfig,
      { pushOnly: remindersPushOnlyRef.current, ownerReminderEmail: reminderOwnerEmailRef.current }
    );

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updatedBooking : b)));

    // Persist so every other client stops re-sending the reminder.
    updateServiceBookingInDb(bookingId, {
      reminder24hSent: true,
      notifications: updatedBooking.notifications,
    }).catch((e) => console.warn('[DB SYNC] Error persisting 24h reminder:', e));

    const pushOnly = remindersPushOnlyRef.current;
    const channel = pushOnly ? 'push notification' : 'email';
    setLatestSmsAlert({
      title: `⏰ 24-Hour Reminder Sent (${pushOnly ? 'Push' : 'Email'})`,
      message: `Delivered 24-hour reminder ${channel} to ${target.customerName} (${target.customerEmail}) & Stakey's Cycles (${reminderOwnerEmailRef.current}) for ${target.preferredDate} (${target.preferredTimeSlot}).`,
      recipient: `${target.customerEmail} & ${reminderOwnerEmailRef.current}`,
      time: new Date().toLocaleTimeString(),
      recipientType: 'both',
    });

    return true;
  };

  // Background automated 24-hour reminder check. Reminders are a staff concern
  // (owner notifications), so only the staff surface (and the combined local-dev
  // 'full' surface) runs the engine — the website/customer builds never dispatch
  // them. Keeping it in one place is what stops several open clients from
  // dispatching the same reminder.
  useEffect(() => {
    if (!automatedRemindersEnabled || !(isStaffSurface || isFullSurface)) return;

    const runAutomatedRemindersCheck = async () => {
      // Find eligible bookings:
      // status !== 'completed' && status !== 'cancelled' && !reminder24hSent && isBookingDueIn24Hours(b)
      const dueBookings = bookings.filter(
        (b) => !b.reminder24hSent && b.status !== 'completed' && b.status !== 'cancelled' && isBookingDueIn24Hours(b)
      );

      if (dueBookings.length === 0) return;

      for (const booking of dueBookings) {
        await dispatch24hReminderForBooking(booking.id);
      }
    };

    const timer = setTimeout(() => {
      runAutomatedRemindersCheck();
    }, 1500);

    const interval = setInterval(runAutomatedRemindersCheck, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [bookings, automatedRemindersEnabled, ownerConfig]);

  const bookingsDueIn24h = bookings.filter(
    (b) => isBookingDueIn24Hours(b) && b.status !== 'completed' && b.status !== 'cancelled'
  );

  return (
    <ShopContext.Provider
      value={{
        currentUser,
        users,
        prizeWheels,
        draws,
        stampLogs,
        activeWheel,
        latestAnnouncement,
        bookings,
        ownerConfig,
        latestDispatchedBooking,
        clearLatestDispatchedBooking,
        refreshDatabaseState,
        isDatabaseSyncing,
        serviceStatus,
        checkServiceHealth,
        updatePocketBaseTargetUrl,
        saveBikeScrapedSpecs,
        updateBikeComponent,
        automatedRemindersEnabled,
        setAutomatedRemindersEnabled,
        remindersPushOnly,
        setRemindersPushOnly,
        reminderOwnerEmail,
        setReminderOwnerEmail,
        bookingsDueIn24h,
        dispatch24hReminderForBooking,
        latestSmsAlert,
        clearLatestSmsAlert,
        loginWithCredentials,
        loginStaff,
        registerCustomerAccount,
        resendConfirmationEmail,
        resetPassword,
        logoutUser,
        staffAccounts,
        refreshStaffAccounts,
        createStaffAccount,
        updateStaffAccountRole,
        addCustomerBike,
        addCustomerBikeForUser,
        removeCustomerBike,
        addStamp,
        redeemReward,
        updateCustomerAvatar,
        updateCustomerPoints,
        createCustomerByStaff,
        updateWheel,
        executePrizeDraw,
        createDraw,
        awardPrizeToUser,
        awardWeeklyWheelPrize,
        collectFullCardReward,
        redeemServiceVoucher,
        resetUserSpinCooldown,
        dismissAnnouncement,
        theme,
        toggleTheme,
        setTheme,
        seasonalTheme,
        seasonalOverride,
        refreshSeasonalTheme,
        setSeasonalTheme,
        staffMembers,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
        promotions,
        addPromotion,
        updatePromotion,
        deletePromotion,
        refreshPromotionsExpiry,
        discountCodes,
        sales,
        addDiscountCode,
        updateDiscountCode,
        deleteDiscountCode,
        refreshDiscountCodes,
        completeSale,
        createSaleQuote,
        updateSaleQuote,
        approveSale,
        declineSale,
        processSale,
        recordDiscountUsage,
        referrals,
        ensureMyReferral,
        markReferralShared,
        resolveReferral,
        registerReferredFriend,
        grantReferralRewards,
        updateDraw,
        deleteDraw,
        deleteCustomerAccount,
        adjustCustomerStamps,
        createBooking,
        approveBooking,
        declineBooking,
        updateBookingStatus,
        setRepairStage,
        resolveScannedMember,
        resolveScannedMemberDetailed,
        addRepairProgressNote,
        updateBookingQuote,
        requestSosLocation,
        confirmSosQuote,
        deleteBooking,
        clearAllBookings,
        saveRepairInvoice,
        updateInvoicePaymentStatus,
        updateOwnerConfig,
        resetAllDemoData,
        hardResetApp,
        isStaffBookingSoundEnabled,
        toggleStaffBookingSound,
        playStaffBookingAlertPing,
        workshopAudioVolume,
        cycleWorkshopAudioVolume,
        requestPushNotificationPermission,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
