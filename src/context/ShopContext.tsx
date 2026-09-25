import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types/bikeShop';
import {
  INITIAL_USERS,
  INITIAL_PRIZE_WHEELS,
  INITIAL_DRAWS,
  INITIAL_STAMP_LOGS,
} from '../data/initialData';
import {
  INITIAL_BOOKINGS,
  INITIAL_OWNER_CONFIG,
} from '../data/bookingServices';
import {
  dispatchBookingNotifications,
  dispatch24hReminderNotification,
  dispatchBookingApprovalNotification,
  dispatchBookingDeclinedNotification,
  isBookingDueIn24Hours,
} from '../utils/notificationService';
import { generateMembershipNumber } from '../api/firebaseService';
import pb, { POCKETBASE_URL } from '../pocketbase';
import {
  checkPocketBaseHealth,
  PocketBaseHealthStatus,
  getStoredPocketBaseUrl,
  setPocketBaseUrl,
} from '../api/pocketbaseService';

export const STAFF_MASTER_PIN = '210803';

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
  // PocketBase Service Health & Target URL
  serviceStatus: PocketBaseHealthStatus;
  checkServiceHealth: (customUrl?: string) => Promise<PocketBaseHealthStatus>;
  updatePocketBaseTargetUrl: (newUrl: string) => Promise<PocketBaseHealthStatus>;
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
  loginStaffWithPin: (staffIdentifierOrUid: string, pin: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  registerCustomerAccount: (email: string, password: string, name: string, phoneNumber?: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  logoutUser: () => void;
  // Bike actions
  addCustomerBike: (bike: Omit<CustomerBike, 'id' | 'addedAt'>) => Promise<CustomerBike>;
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
  updateOwnerConfig: (config: Partial<OwnerNotificationConfig>) => void;
  resetAllDemoData: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const STORAGE_KEY = 'stakeys_cycles_pb_state_v2';

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
      if (saved) {
        const parsed: UserProfile[] = JSON.parse(saved);
        // Ensure Ben and Chloe always exist with latest staff roles
        const merged = [...parsed];
        INITIAL_USERS.forEach((initU) => {
          const idx = merged.findIndex(
            (u) =>
              u.uid === initU.uid ||
              u.email.toLowerCase() === initU.email.toLowerCase() ||
              (initU.membershipNumber && u.membershipNumber === initU.membershipNumber)
          );
          if (idx >= 0) {
            merged[idx] = { ...initU, ...merged[idx], role: initU.role };
          } else {
            merged.push(initU);
          }
        });
        return merged;
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [prizeWheels, setPrizeWheels] = useState<PrizeWheel[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_wheels`);
      return saved ? JSON.parse(saved) : INITIAL_PRIZE_WHEELS;
    } catch {
      return INITIAL_PRIZE_WHEELS;
    }
  });

  const [draws, setDraws] = useState<PrizeDraw[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_draws`);
      return saved ? JSON.parse(saved) : INITIAL_DRAWS;
    } catch {
      return INITIAL_DRAWS;
    }
  });

  const [stampLogs, setStampLogs] = useState<StampLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      return saved ? JSON.parse(saved) : INITIAL_STAMP_LOGS;
    } catch {
      return INITIAL_STAMP_LOGS;
    }
  });

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

  // PocketBase Service Health Monitor
  const [serviceStatus, setServiceStatus] = useState<PocketBaseHealthStatus>({
    isOnline: false,
    url: getStoredPocketBaseUrl(),
    checkedAt: 'Testing...',
    error: 'Checking connection to PocketBase tunnel...',
  });

  const checkServiceHealth = async (customUrl?: string): Promise<PocketBaseHealthStatus> => {
    const status = await checkPocketBaseHealth(customUrl);
    setServiceStatus(status);
    return status;
  };

  const updatePocketBaseTargetUrl = async (newUrl: string): Promise<PocketBaseHealthStatus> => {
    const clean = setPocketBaseUrl(newUrl);
    const status = await checkPocketBaseHealth(clean);
    setServiceStatus(status);
    return status;
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

  // Service Bookings State
  const [bookings, setBookings] = useState<ServiceBooking[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_bookings`);
      return saved ? JSON.parse(saved) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  });

  // Owner Notification Configuration (Recipient workshop@stakeyscycles.com + SMS)
  const [ownerConfig, setOwnerConfig] = useState<OwnerNotificationConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_owner_config`);
      return saved ? JSON.parse(saved) : INITIAL_OWNER_CONFIG;
    } catch {
      return INITIAL_OWNER_CONFIG;
    }
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

  // Credentials store for strict customer password authentication
  const DEFAULT_CUSTOMER_CREDENTIALS: Record<string, string> = {
    'alex.henderson@example.com': 'password123',
    'maya.chen@example.com': 'password123',
    'liam.rossi@example.com': 'password123',
    'stk-839201': 'password123',
    'stk-492104': 'password123',
    'stk-129482': 'password123',
    'alex': 'password123',
    'maya': 'password123',
    'liam': 'password123',
  };

  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_credentials`);
      return saved ? { ...DEFAULT_CUSTOMER_CREDENTIALS, ...JSON.parse(saved) } : DEFAULT_CUSTOMER_CREDENTIALS;
    } catch {
      return DEFAULT_CUSTOMER_CREDENTIALS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_credentials`, JSON.stringify(credentials));
    } catch (e) {
      console.warn('Storage failed for credentials', e);
    }
  }, [credentials]);

  const activeWheel = prizeWheels.find((w) => w.active) || null;

  // Customer Login with strict password verification (No login without correct password)
  const loginWithCredentials = async (email: string, password = '') => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      return { success: false, message: 'Please enter your email, username, or membership ID.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Password is required. Please enter your account password.' };
    }

    // Direct instant matching in local state
    let matched = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!matched) {
      if (cleanEmail === 'alex' || cleanEmail.includes('alex')) {
        matched = users.find((u) => u.uid === 'cust-alex-839201' || u.email.toLowerCase() === 'alex.henderson@example.com');
      } else if (cleanEmail === 'maya' || cleanEmail.includes('maya')) {
        matched = users.find((u) => u.uid === 'cust-maya-492104' || u.email.toLowerCase() === 'maya.chen@example.com');
      } else if (cleanEmail === 'liam' || cleanEmail.includes('liam')) {
        matched = users.find((u) => u.uid === 'cust-liam-129482' || u.email.toLowerCase() === 'liam.rossi@example.com');
      } else if (
        cleanEmail === 'ben' ||
        cleanEmail === 'ben@stakeyscycles.com' ||
        cleanEmail === 'stk-staff-ben' ||
        cleanEmail === 'chloe' ||
        cleanEmail === 'chloe@stakeyscycles.com' ||
        cleanEmail === 'chloe.stakey@gmail.com' ||
        cleanEmail === 'stk-staff-chloe' ||
        cleanEmail === 'sarah' ||
        cleanEmail === 'sarah.manager@stakeyscycles.com'
      ) {
        return {
          success: false,
          message: 'This is an authorized Staff account. Please use the "Staff Station" tab and enter your staff PIN.',
        };
      } else {
        matched = users.find(
          (u) =>
            u.membershipNumber?.toLowerCase() === cleanEmail ||
            u.displayName.toLowerCase() === cleanEmail ||
            u.uid.toLowerCase() === cleanEmail
        );
      }
    }

    if (!matched) {
      return {
        success: false,
        message: `Could not find an account for "${email}". Please verify your email or click "Create Account".`,
      };
    }

    // Staff accounts must strictly use the dedicated Staff Login area with PIN
    if (matched.role === 'staff' || matched.role === 'admin') {
      return {
        success: false,
        message: 'This is an authorized Staff account. Please use the "Staff Station" tab and enter your staff PIN.',
      };
    }

    // STRICT PASSWORD VERIFICATION
    const expectedPassword =
      credentials[cleanEmail] ||
      credentials[matched.email.toLowerCase()] ||
      (matched.membershipNumber ? credentials[matched.membershipNumber.toLowerCase()] : undefined) ||
      credentials[matched.uid];

    if (!expectedPassword || expectedPassword !== cleanPass) {
      return {
        success: false,
        message: 'Incorrect password. Access denied. Please enter the correct password for your account.',
      };
    }

    setCurrentUser(matched);
    return { success: true, user: matched };
  };

  // Dedicated Staff Station PIN Login
  const loginStaffWithPin = async (staffIdentifierOrUid: string, pin: string) => {
    const cleanPin = (pin || '').trim();
    if (cleanPin !== STAFF_MASTER_PIN) {
      return {
        success: false,
        message: 'Access Denied: Incorrect Security PIN. Authorized workshop personnel only.',
      };
    }

    const cleanId = (staffIdentifierOrUid || '').trim().toLowerCase();
    let staffUser: UserProfile | undefined;

    if (cleanId) {
      staffUser = users.find(
        (u) =>
          (u.role === 'staff' || u.role === 'admin') &&
          (u.uid.toLowerCase() === cleanId ||
            u.email.toLowerCase() === cleanId ||
            u.displayName.toLowerCase().includes(cleanId) ||
            (u.membershipNumber && u.membershipNumber.toLowerCase() === cleanId))
      );
    }

    // If none specified or matching, default to Ben Stakey (shop owner)
    if (!staffUser) {
      staffUser =
        users.find((u) => u.uid === 'staff-ben-001' || u.email.toLowerCase() === 'ben@stakeyscycles.com') ||
        users.find((u) => u.role === 'staff' || u.role === 'admin');
    }

    if (!staffUser) {
      return { success: false, message: 'No staff account configured in system.' };
    }

    setCurrentUser(staffUser);
    return { success: true, user: staffUser };
  };

  // Register implementation with password saving
  const registerCustomerAccount = async (
    email: string,
    password: string,
    name: string,
    phoneNumber?: string
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, message: 'An account with this email address already exists. Please sign in.' };
    }

    const membershipNumber = generateMembershipNumber();
    const newUser: UserProfile = {
      uid: `cust-${Date.now()}`,
      email: cleanEmail,
      displayName: name.trim(),
      phoneNumber: phoneNumber?.trim() || undefined,
      role: 'customer',
      membershipNumber,
      stamps: 0,
      tickets: 0,
      merits: 0,
      bikes: [],
      serviceVouchers: [],
      createdAt: new Date(),
      lastStampedAt: null,
    };

    // Store password strictly in credentials map
    setCredentials((prev) => {
      const updated = {
        ...prev,
        [cleanEmail]: password,
        [membershipNumber.toLowerCase()]: password,
        [newUser.uid]: password,
      };
      try {
        localStorage.setItem(`${STORAGE_KEY}_credentials`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Try creating in PocketBase if available
    try {
      await pb.collection('users').create({
        email: cleanEmail,
        password,
        passwordConfirm: password,
        name: name.trim(),
        phoneNumber: phoneNumber?.trim() || '',
        membershipNumber,
        role: 'customer',
        stamps: 0,
        tickets: 0,
        merits: 0,
      });
    } catch {
      // Gracefully continue with local state
    }

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    return { success: true, user: newUser };
  };

  const logoutUser = () => {
    try {
      pb.authStore.clear();
    } catch {}
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

    return {
      success: true,
      message: cardCompleted
        ? `🎉 10TH STAMP ACHIEVED! Card reset and 1 Prize Draw ticket credited to ${target.displayName}!`
        : `Visit stamp added for ${target.displayName}! (${nextStamps}/10)`,
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
    setPrizeWheels((prev) =>
      prev.map((w) => (w.id === wheelId ? { ...w, ...updatedData, updatedAt: new Date() } : w))
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

    setDraws((prev) =>
      prev.map((d) =>
        d.id === drawId
          ? {
              ...d,
              status: 'completed',
              winnerUid: winner.uid,
              winnerName: winner.displayName,
              completedAt: now,
            }
          : d
      )
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

    const updatedUser: UserProfile = {
      ...target,
      stamps: updatedStamps,
      tickets: Math.max(0, (target.tickets || 0) + extraTickets),
      merits: Math.max(0, (target.merits || 0) + extraMerits),
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

    return {
      success: true,
      message: `Successfully redeemed voucher "${voucherCode}"! £${updatedVouchers[voucherIdx].value} labour credit applied.`,
    };
  };

  const resetUserSpinCooldown = (userId: string) => {
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
  };

  const addCustomerBike = async (bikeData: Omit<CustomerBike, 'id' | 'addedAt'>): Promise<CustomerBike> => {
    const newBike: CustomerBike = {
      ...bikeData,
      id: `bike-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      addedAt: new Date().toISOString().split('T')[0],
      healthStatus: bikeData.healthStatus || 'healthy',
    };

    if (currentUser) {
      const existingBikes = currentUser.bikes || [];
      const updatedUser: UserProfile = {
        ...currentUser,
        bikes: [newBike, ...existingBikes],
      };
      setCurrentUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.uid === currentUser.uid ? updatedUser : u)));
    }
    return newBike;
  };

  const removeCustomerBike = async (bikeId: string) => {
    if (currentUser) {
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

    // Immediately dispatch email and SMS alert to BOTH customer and owner confirming receipt and pending approval
    const { emailLog, customerSmsLog, ownerSmsLog } = await dispatchBookingNotifications(provisionalBooking, ownerConfig);

    const completedBooking: ServiceBooking = {
      ...provisionalBooking,
      notifications: [emailLog, customerSmsLog, ownerSmsLog],
    };

    setBookings((prev) => [completedBooking, ...prev]);
    setLatestDispatchedBooking(completedBooking);

    // Trigger instant SMS alert confirmation banner
    setLatestSmsAlert({
      title: '📋 Repair Request Pending Approval',
      message: `Repair request submitted! Staff will contact ${completedBooking.customerName} on ${completedBooking.customerPhone}. An email will be sent once approved or declined.`,
      recipient: `${completedBooking.customerPhone} & ${ownerConfig.ownerPhone}`,
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
      note: `🔧 NEW BOOKING: ${data.customerName} booked "${data.serviceTitle}" (${data.vehicleModel}) for ${data.preferredDate}. Email & SMS dispatched to ${ownerConfig.ownerEmail}.`,
    };
    setStampLogs((prev) => [newAuditLog, ...prev]);

    return completedBooking;
  };

  const approveBooking = async (
    bookingId: string,
    staffNote?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Booking not found' };

    const { emailLog, smsLog } = await dispatchBookingApprovalNotification(
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
      notifications: [emailLog, smsLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    setLatestSmsAlert({
      title: '✅ Booking Approved & Customer Notified',
      message: `Official Approval Email delivered to ${target.customerEmail} and SMS to ${target.customerPhone} for ${target.preferredDate}.`,
      recipient: `${target.customerEmail} & ${target.customerPhone}`,
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

    const { emailLog, smsLog } = await dispatchBookingDeclinedNotification(
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
      notifications: [emailLog, smsLog, ...(target.notifications || [])],
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

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

  const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
    );
  };

  const updateOwnerConfig = (config: Partial<OwnerNotificationConfig>) => {
    setOwnerConfig((prev) => ({ ...prev, ...config }));
  };

  const resetAllDemoData = () => {
    localStorage.removeItem(`${STORAGE_KEY}_users`);
    localStorage.removeItem(`${STORAGE_KEY}_wheels`);
    localStorage.removeItem(`${STORAGE_KEY}_draws`);
    localStorage.removeItem(`${STORAGE_KEY}_logs`);
    localStorage.removeItem(`${STORAGE_KEY}_bookings`);
    localStorage.removeItem(`${STORAGE_KEY}_owner_config`);
    localStorage.removeItem(`${STORAGE_KEY}_active_user`);
    localStorage.removeItem(`${STORAGE_KEY}_latest_announcement`);
    setUsers(INITIAL_USERS);
    setPrizeWheels(INITIAL_PRIZE_WHEELS);
    setDraws(INITIAL_DRAWS);
    setStampLogs(INITIAL_STAMP_LOGS);
    setBookings(INITIAL_BOOKINGS);
    setOwnerConfig(INITIAL_OWNER_CONFIG);
    setLatestAnnouncement(null);
    setLatestDispatchedBooking(null);
    setCurrentUser(null); // return to login screen
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
      title: '⏰ 24-Hour Reminder SMS Sent',
      message: `Delivered 24-hour reminder text to ${target.customerName} (${target.customerPhone}) & Stakey's Cycles (${ownerConfig.ownerPhone}) for ${target.preferredDate} (${target.preferredTimeSlot}).`,
      recipient: `${target.customerPhone} & ${ownerConfig.ownerPhone}`,
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
        loginStaffWithPin,
        registerCustomerAccount,
        logoutUser,
        addCustomerBike,
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
        createBooking,
        approveBooking,
        declineBooking,
        updateBookingStatus,
        updateOwnerConfig,
        resetAllDemoData,
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
