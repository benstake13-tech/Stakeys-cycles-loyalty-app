import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types/bikeShop';
import { evaluatePromotionsExpiry } from '../utils/promotionUtils';
import { DEFAULT_PRIZE_WHEEL } from '../utils/prizeWheelHelper';
import { roundMoney } from '../utils/discountService';
import {
  dispatchBookingNotifications,
  dispatch24hReminderNotification,
  dispatchBookingApprovalNotification,
  dispatchBookingDeclinedNotification,
  isBookingDueIn24Hours,
} from '../utils/notificationService';
import { staffBookingAudio, WorkshopAudioVolume } from '../utils/staffAlertAudio';
import { sendPushToUser, requestPushPermission, getPushPermission } from '../utils/onesignalPush';
import { generateMembershipNumber } from '../api/firebaseService';
import { getSupabaseClient, getStoredSupabaseUrl, saveSupabaseConfig } from '../supabase';
import { supabase } from '../lib/supabase';
import {
  fetchCustomerBikesFromDb,
  insertCustomerBikeToDb,
  deleteCustomerBikeFromDb,
  updateCustomerBikeSpecsInDb,
  fetchServiceBookingsFromDb,
  insertServiceBookingToDb,
  updateServiceBookingInDb,
  fetchStampLogsFromDb,
  insertStampLogToDb,
  updateUserProfileInDb,
  fetchUserProfileFromDb,
  fetchAllProfilesFromDb,
  subscribeToDatabaseChanges,
  seedInitialDatabaseIfEmpty,
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
  fetchCounterSalesFromDb,
  insertCounterSaleToDb,
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
  registerCustomerAccount: (email: string, password: string, name: string, phoneNumber?: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => void;
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
  updateCustomerMerits: (
    customerId: string,
    staffId: string,
    updates: {
      stamps?: number;
      tickets?: number;
      merits?: number;
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
      merits?: number;
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
  /** Bump a discount code's usage counter in local state + DB. */
  recordDiscountUsage: (discountCodeId: string) => Promise<void>;
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
    staffNote?: string
  ) => Promise<{ success: boolean; message?: string }>;
  declineBooking: (
    bookingId: string,
    reason?: string
  ) => Promise<{ success: boolean; message?: string }>;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  updateBookingQuote: (bookingId: string, quote: { quotedPrice: number, quoteNote?: string }) => Promise<{ success: boolean; message?: string }>;
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
  const [latestAnnouncement, setLatestAnnouncement] = useState<WinnerAnnouncement | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_latest_announcement`);
      if (saved) return JSON.parse(saved);
      const completed = INITIAL_DRAWS.find((d) => d.status === 'completed' && d.winnerUid);
      if (completed) {
        return {
          id: `announce-${completed.id}`,
          drawId: completed.id,
          drawTitle: completed.title,
          prizeDescription: completed.prizeDescription,
          winnerUid: completed.winnerUid!,
          winnerName: completed.winnerName || 'Alex Henderson',
          winnerMembershipNumber: 'STK-839201',
          completedAt: completed.completedAt || new Date('2026-07-31T18:05:00Z'),
          announcedAt: completed.completedAt || new Date('2026-07-31T18:05:00Z'),
        };
      }
      return null;
    } catch {
      return null;
    }
  });

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

  // 2. Staff Roster State & CRUD
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_staff_roster`, JSON.stringify(staffMembers));
    } catch {}
  }, [staffMembers]);

  const addStaffMember = async (staffData: Omit<StaffMember, 'id'>): Promise<StaffMember> => {
    const newMember: StaffMember = {
      ...staffData,
      id: `staff-${Date.now().toString().slice(-4)}`,
    };
    setStaffMembers((prev) => [newMember, ...prev]);
    return newMember;
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>): Promise<StaffMember> => {
    let updatedMember: StaffMember | null = null;
    setStaffMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          updatedMember = { ...m, ...updates };
          return updatedMember;
        }
        return m;
      })
    );
    if (!updatedMember) throw new Error('Staff member not found');
    return updatedMember;
  };

  const deleteStaffMember = async (id: string): Promise<boolean> => {
    setStaffMembers((prev) => prev.filter((m) => m.id !== id));
    return true;
  };

  // 3. Promotions State & Expiry Monitor
  const [promotions, setPromotions] = useState<ShopPromotion[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_promotions`, JSON.stringify(promotions));
    } catch {}
  }, [promotions]);

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
    return newPromo;
  };

  const updatePromotion = async (id: string, updates: Partial<ShopPromotion>): Promise<ShopPromotion> => {
    let updatedPromo: ShopPromotion | null = null;
    setPromotions((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          updatedPromo = { ...p, ...updates };
          return updatedPromo;
        }
        return p;
      })
    );
    if (!updatedPromo) throw new Error('Promotion not found');
    return updatedPromo;
  };

  const deletePromotion = async (id: string): Promise<boolean> => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    return true;
  };

  /* ------------------------------------------------------------------ *
   * Discount codes (till) & counter sales
   * ------------------------------------------------------------------ */
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);

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
        { key: 'role', value: 'staff' }
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
        merits: remoteProfile?.merits !== undefined ? remoteProfile.merits : user.merits,
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
    const [allProfiles, remoteWheels, remoteDraws, remoteCodes, remoteSales] = await Promise.all([
      fetchAllProfilesFromDb(),
      fetchPrizeWheelsFromDb(),
      fetchPrizeDrawsFromDb(),
      fetchDiscountCodesFromDb(),
      fetchCounterSalesFromDb(),
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

    fetchCounterSalesFromDb().then((remoteSales) => {
      if (remoteSales && remoteSales.length > 0) setSales(remoteSales);
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
    } catch (e) {
      console.warn('Storage failed', e);
    }
  }, [automatedRemindersEnabled]);

  // Local storage persistence
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
    } catch (e) {
      console.warn('Storage failed', e);
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_wheels`, JSON.stringify(prizeWheels));
    } catch (e) {
      console.warn('Storage failed', e);
    }
  }, [prizeWheels]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_draws`, JSON.stringify(draws));
    } catch (e) {
      console.warn('Storage failed', e);
    }
  }, [draws]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(stampLogs));
    } catch (e) {
      console.warn('Storage failed', e);
    }
  }, [stampLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_bookings`, JSON.stringify(bookings));
    } catch (e) {
      console.warn('Storage failed for bookings', e);
    }
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_owner_config`, JSON.stringify(ownerConfig));
    } catch (e) {
      console.warn('Storage failed for owner config', e);
    }
  }, [ownerConfig]);

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
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error || !data.user) {
        return { success: false, message: 'Invalid email or password.' };
      }

      // 2. Fetch profile from database using the authenticated user ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return { success: false, message: 'Login successful, but could not load profile. Please contact support.' };
      }

      // Map DB profile to UserProfile type
      const userProfile: UserProfile = {
        uid: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        phoneNumber: profile.phone || undefined,
        role: profile.role || 'customer',
        membershipNumber: profile.membership_number,
        stamps: profile.stamps || 0,
        tickets: profile.completed_cards || 0,
        merits: profile.merit_points || 0,
        bikes: [], // Will be populated by syncUserFromDatabase
        createdAt: new Date(profile.created_at),
        lastStampedAt: profile.last_stamped_at ? new Date(profile.last_stamped_at) : null,
      };

      if (userProfile.role === 'staff' || userProfile.role === 'admin') {
        await supabase.auth.signOut();
        return { success: false, message: 'Please use the Staff Station tab to log in.' };
      }

      setCurrentUser(userProfile);
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
    phoneNumber?: string
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim(), phone: phoneNumber?.trim() },
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'Account created! Please check your email to confirm your registration before signing in.',
      };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, message: err.message || 'An unexpected error occurred during registration.' };
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

  // Add Stamp logic enforcing rate limit and 10-stamp card completion
  const addStamp = async (customerId: string, staffId: string, bypassLimit = false) => {
    const target = users.find((u) => u.uid === customerId);
    if (!target) {
      return { success: false, message: `Customer ID "${customerId}" not found.` };
    }

    const staff = users.find((u) => u.uid === staffId);
    const staffName = staff?.displayName || 'Stakey Staff';

    // Daily rate limit verification
    if (!bypassLimit && target.lastStampedAt) {
      const lastStamped = new Date(target.lastStampedAt);
      const now = new Date();
      const isSameDay =
        lastStamped.getFullYear() === now.getFullYear() &&
        lastStamped.getMonth() === now.getMonth() &&
        lastStamped.getDate() === now.getDate();

      if (isSameDay) {
        return {
          success: false,
          message: `Daily Rate Limit: ${target.displayName} already received a visit stamp today at ${lastStamped.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Only 1 stamp per day is permitted.`,
        };
      }
    }

    const currentStamps = target.stamps || 0;
    const currentTickets = target.tickets || 0;
    let nextStamps = currentStamps + 1;
    let nextTickets = currentTickets;
    let cardCompleted = false;

    if (nextStamps >= 10) {
      nextStamps = 0; // Reset for next cycle
      nextTickets += 1; // 1 Ticket awarded for full card
      cardCompleted = true;
    }

    const now = new Date();

    // Update user
    const updatedUsers = users.map((u) => {
      if (u.uid === customerId) {
        return {
          ...u,
          stamps: nextStamps,
          tickets: nextTickets,
          lastStampedAt: now,
        };
      }
      return u;
    });

    // New Audit Log
    const newLog: StampLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName: target.displayName,
      membershipNumber: target.membershipNumber,
      staffId,
      staffName,
      action: 'add_stamp',
      stampsBefore: currentStamps,
      stampsAfter: nextStamps,
      ticketsAwarded: cardCompleted ? 1 : 0,
      timestamp: now,
      note: cardCompleted
        ? 'Completed 10-stamp card! Reset to 0 and awarded +1 Prize Draw ticket.'
        : `Added visit stamp (${nextStamps}/10)`,
    };

    setUsers(updatedUsers);
    setStampLogs([newLog, ...stampLogs]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table
    updateUserProfileInDb(customerId, target.membershipNumber, {
      stamps: nextStamps,
      tickets: nextTickets,
      lastStampedAt: now,
    }).catch((e) => console.warn('[DB SYNC] Error updating profile stamps in DB:', e));
    insertStampLogToDb(newLog).catch((e) => console.warn('[DB SYNC] Error inserting stamp log in DB:', e));

    const successMessage = cardCompleted
      ? `🎉 10TH STAMP ACHIEVED! Card reset and 1 Prize Draw ticket credited to ${target.displayName}!`
      : `Visit stamp added for ${target.displayName}! (${nextStamps}/10)`;

    toast.success(successMessage, { icon: cardCompleted ? '🎉' : '🎟️' });

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

  // Manual Customer Merit & Balance Adjustment for Staff Database
  const updateCustomerMerits = async (
    customerId: string,
    staffId: string,
    updates: {
      stamps?: number;
      tickets?: number;
      merits?: number;
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
    const meritsBefore = target.merits ?? 0;

    const stampsAfter = updates.stamps !== undefined ? Math.max(0, Math.min(10, updates.stamps)) : stampsBefore;
    const ticketsAfter = updates.tickets !== undefined ? Math.max(0, updates.tickets) : ticketsBefore;
    const meritsAfter = updates.merits !== undefined ? Math.max(0, updates.merits) : meritsBefore;

    const now = new Date();

    const updatedUser: UserProfile = {
      ...target,
      displayName: updates.displayName?.trim() || target.displayName,
      email: updates.email?.trim() || target.email,
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber.trim() : target.phoneNumber,
      stamps: stampsAfter,
      tickets: ticketsAfter,
      merits: meritsAfter,
      lastStampedAt: updates.resetDailyRateLimit ? undefined : target.lastStampedAt,
      lastSpunAt: updates.resetSpinCooldown ? undefined : target.lastSpunAt,
    };

    const changesSummary: string[] = [];
    if (stampsAfter !== stampsBefore) changesSummary.push(`Stamps: ${stampsBefore} -> ${stampsAfter}`);
    if (ticketsAfter !== ticketsBefore) changesSummary.push(`Tickets: ${ticketsBefore} -> ${ticketsAfter}`);
    if (meritsAfter !== meritsBefore) changesSummary.push(`Merits: ${meritsBefore} -> ${meritsAfter}`);
    if (updates.resetDailyRateLimit) changesSummary.push('Daily rate limit cleared');
    if (updates.resetSpinCooldown) changesSummary.push('Spin cooldown reset');
    if (updates.displayName && updates.displayName !== target.displayName) changesSummary.push(`Name: ${updates.displayName}`);

    const summaryText = changesSummary.length > 0 ? changesSummary.join(', ') : 'Profile details updated';
    const finalNote = updates.staffNote?.trim()
      ? `${updates.staffNote.trim()} (${summaryText})`
      : `Manual merit adjustment by ${staffName}: ${summaryText}`;

    const newLog: StampLog = {
      id: `log-merit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName: updatedUser.displayName,
      membershipNumber: updatedUser.membershipNumber,
      staffId,
      staffName,
      action: 'manual_merit_adjustment',
      stampsBefore,
      stampsAfter,
      ticketsBefore,
      ticketsAfter,
      meritsBefore,
      meritsAfter,
      timestamp: now,
      note: finalNote,
    };

    setUsers((prev) => prev.map((u) => (u.uid === customerId ? updatedUser : u)));
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table
    updateUserProfileInDb(customerId, target.membershipNumber, {
      stamps: stampsAfter,
      tickets: ticketsAfter,
      merits: meritsAfter,
      displayName: updates.displayName?.trim() || target.displayName,
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber.trim() : target.phoneNumber,
    }).catch((e) => console.warn('[DB SYNC] Error updating customer merits in DB:', e));
    insertStampLogToDb(newLog).catch((e) => console.warn('[DB SYNC] Error inserting merit log in DB:', e));

    return {
      success: true,
      message: `Updated merits for ${updatedUser.displayName}: ${summaryText}`,
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
      merits?: number;
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
      merits: customerData.merits ?? 0,
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
      meritsAfter: newCustomer.merits,
      timestamp: now,
      note: `New customer pass registered at till by ${staff?.displayName || 'Staff'}. Assigned ${newCustomer.stamps} stamps, ${newCustomer.tickets} tickets, and ${newCustomer.merits} merits.`,
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
    try {
      localStorage.setItem(`${STORAGE_KEY}_latest_announcement`, JSON.stringify(announcement));
    } catch (e) {
      console.warn('Failed to store announcement', e);
    }

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
    let extraMerits = 0;
    let newVoucher: CollectedVoucher | undefined = undefined;

    if (segment.rewardType === 'stamp') {
      stampsAwarded =
        segment.stampsAmount ||
        (segment.label.includes('3') ? 3 : segment.label.includes('2') ? 2 : 1);
    } else if (segment.rewardType === 'ticket') {
      extraTickets = segment.label.includes('3') ? 3 : 1;
    } else if (segment.rewardType === 'merit') {
      extraMerits = parseInt(segment.rewardValue || '50', 10) || 50;
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
    const updatedStamps = Math.min(10, currentStamps + stampsAwarded);
    const isFull = updatedStamps >= 10;
    
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
    const updatedMerits = (target.merits || 0) + extraMerits;

    const updatedUser: UserProfile = {
      ...target,
      stamps: updatedStamps,
      tickets: updatedTickets,
      merits: updatedMerits,
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
      merits: updatedMerits,
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
    const target = users.find((u) => u.uid === userId);
    if (!target) return { success: false, message: 'User profile not found.' };

    if ((target.stamps || 0) < 10) {
      return {
        success: false,
        message: `Your stamp card has ${target.stamps || 0}/10 stamps. Fill all 10 stamps to collect your £40 Service reward!`,
      };
    }

    const now = new Date();
    const voucherCode = `STK-SRV40-${Math.floor(100000 + Math.random() * 900000)}`;

    const serviceVoucher: CollectedVoucher = {
      id: `vouch-srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: voucherCode,
      title: '£40 Workshop Service Credit',
      description: 'Eligible for £40 service (labour only, parts not included)',
      value: 40,
      type: 'service_credit',
      terms: 'Eligible for £40 service (labour only, parts not included). Valid for 12 months on any workshop booking.',
      claimedAt: now,
      status: 'available',
    };

    const updatedUser: UserProfile = {
      ...target,
      stamps: Math.max(0, (target.stamps || 0) - 10),
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
      stampsBefore: 10,
      stampsAfter: updatedUser.stamps,
      timestamp: now,
      note: `Customer pressed collect: Eligible for £40 service (labour only parts not included) - Voucher Code: ${voucherCode}`,
    };
    setStampLogs((prev) => [newLog, ...prev]);

    // Remote Database Mutation: subtract stamps, record voucher + audit log
    updateUserProfileInDb(userId, target.membershipNumber, {
      stamps: updatedUser.stamps,
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
    };

    // Immediately dispatch email alerts to BOTH customer and owner confirming receipt and pending approval
    const { emailLog, customerEmailLog } = await dispatchBookingNotifications(provisionalBooking, ownerConfig);

    const completedBooking: ServiceBooking = {
      ...provisionalBooking,
      notifications: [emailLog, customerEmailLog],
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
      { key: 'role', value: 'staff' }
    );

    // Trigger instant email alert confirmation banner
    setLatestSmsAlert({
      title: '📋 Repair Request Pending Approval',
      message: `Repair request submitted! Staff will evaluate bench capacity. Email confirmation sent to ${completedBooking.customerEmail} and workshop alert to ${ownerConfig.ownerEmail}.`,
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
              colour: 'Workshop Recorded',
              addedAt: new Date().toISOString().split('T')[0],
              lastServiceDate: data.preferredDate || new Date().toISOString().split('T')[0],
              lastServiceTitle: data.serviceTitle,
              healthStatus: 'in_workshop',
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
    staffNote?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const { emailLog } = await dispatchBookingApprovalNotification(
      target,
      staffNote,
      ownerConfig
    );

    const updated: ServiceBooking = {
      ...target,
      status: 'confirmed',
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.displayName || 'Workshop Staff',
      staffNotes: staffNote || target.staffNotes,
      notifications: [emailLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    // Remote Database Mutation: UPDATE service_bookings table
    updateServiceBookingInDb(bookingId, {
      status: 'confirmed',
      approvalStatus: 'approved',
      approvedAt: updated.approvedAt,
      approvedBy: updated.approvedBy,
      staffNotes: staffNote || target.staffNotes,
    }).catch((e) => console.warn('[DB SYNC] Error approving booking in DB:', e));

    setLatestSmsAlert({
      title: '✅ Booking Approved & Customer Notified',
      message: `Official Approval Email delivered to ${target.customerEmail} for ${target.preferredDate}.`,
      recipient: target.customerEmail,
      time: new Date().toLocaleTimeString(),
      recipientType: 'customer',
    });

    const auditLog: StampLog = {
      id: `log-appr-${Date.now()}`,
      customerId: target.customerId || 'guest',
      customerName: target.customerName,
      membershipNumber: target.membershipNumber,
      staffId: currentUser?.uid || 'staff-001',
      staffName: currentUser?.displayName || 'Ben Stakey',
      action: 'edit_profile',
      timestamp: new Date(),
      note: `✅ APPROVED: Booking #${target.id} (${target.serviceTitle}) for ${target.customerName}. Email dispatched to ${target.customerEmail}.`,
    };
    setStampLogs((prev) => [auditLog, ...prev]);

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
    let finalStamps = 0;
    let customerName = 'Customer';
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === userId) {
          customerName = u.displayName;
          const oldStamps = u.stamps || 0;
          finalStamps = Math.max(0, Math.min(10, oldStamps + delta));
          let tickets = u.tickets || 0;
          if (finalStamps === 10 && oldStamps < 10) {
            tickets += 1;
          }
          return {
            ...u,
            stamps: finalStamps,
            tickets,
            lastStampedAt: new Date().toISOString(),
          };
        }
        return u;
      })
    );

    const log: StampLog = {
      id: `log-adj-${Date.now()}`,
      customerId: userId,
      customerName,
      staffId: currentUser?.uid || 'staff-admin',
      staffName: currentUser?.displayName || 'Workshop Staff',
      action: delta > 0 ? 'add_stamp' : 'manual_merit_adjustment',
      stampsAfter: finalStamps,
      timestamp: new Date(),
      note: note || (delta > 0 ? `Issued +${delta} visit stamp` : `Adjusted stamps by ${delta}`),
    };
    setStampLogs((prev) => [log, ...prev]);

    // Remote Database Mutation: Update profiles table and insert into stamp_logs table
    updateUserProfileInDb(userId, undefined, {
      stamps: finalStamps,
      lastStampedAt: new Date(),
    }).catch((e) => console.warn('[DB SYNC] Error adjusting stamps in DB:', e));
    insertStampLogToDb(log).catch((e) =>
      console.warn('[DB SYNC] Error inserting stamp adjustment log in DB:', e)
    );

    return {
      success: true,
      message: `Updated stamps for ${customerName} to ${finalStamps}/10.`,
      stamps: finalStamps,
    };
  };

  const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
    );
    updateServiceBookingInDb(bookingId, { status }).catch((e) =>
      console.warn('[DB SYNC] Error updating booking status in DB:', e)
    );
  };

  const updateBookingQuote = async (bookingId: string, quote: { quotedPrice: number, quoteNote?: string }): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const updated: ServiceBooking = {
      ...target,
      quotedPrice: quote.quotedPrice,
      quoteNote: quote.quoteNote,
      quoteSentAt: new Date().toISOString(),
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    updateServiceBookingInDb(bookingId, {
      quotedPrice: quote.quotedPrice,
      quoteNote: quote.quoteNote,
      quoteSentAt: updated.quoteSentAt,
    }).catch((e) => console.warn('[DB SYNC] Error updating booking quote in DB:', e));

    return {
      success: true,
      message: `Quote of £${quote.quotedPrice.toFixed(2)} updated for booking #${bookingId}.`,
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
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId && b.invoice) {
          const updatedInvoice: RepairInvoice = {
            ...b.invoice,
            paymentStatus,
            paymentDate: paymentStatus !== 'unpaid' ? new Date().toISOString() : undefined,
          };
          return {
            ...b,
            status: paymentStatus !== 'unpaid' ? 'completed' : b.status,
            invoice: updatedInvoice,
          };
        }
        return b;
      })
    );
  };

  const updateOwnerConfig = (config: Partial<OwnerNotificationConfig>) => {
    setOwnerConfig((prev) => ({ ...prev, ...config }));
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
      ownerConfig
    );

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updatedBooking : b)));

    setLatestSmsAlert({
      title: '⏰ 24-Hour Reminder Email Sent',
      message: `Delivered 24-hour reminder email to ${target.customerName} (${target.customerEmail}) & Stakey's Cycles (${ownerConfig.ownerEmail}) for ${target.preferredDate} (${target.preferredTimeSlot}).`,
      recipient: `${target.customerEmail} & ${ownerConfig.ownerEmail}`,
      time: new Date().toLocaleTimeString(),
      recipientType: 'both',
    });

    return true;
  };

  // Background automated 24-hour reminder check
  useEffect(() => {
    if (!automatedRemindersEnabled) return;

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
        bookingsDueIn24h,
        dispatch24hReminderForBooking,
        latestSmsAlert,
        clearLatestSmsAlert,
        loginWithCredentials,
        loginStaff,
        registerCustomerAccount,
        resetPassword,
        logoutUser,
        addCustomerBike,
        addCustomerBikeForUser,
        removeCustomerBike,
        addStamp,
        redeemReward,
        updateCustomerMerits,
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
        recordDiscountUsage,
        updateDraw,
        deleteDraw,
        deleteCustomerAccount,
        adjustCustomerStamps,
        createBooking,
        approveBooking,
        declineBooking,
        updateBookingStatus,
        updateBookingQuote,
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
