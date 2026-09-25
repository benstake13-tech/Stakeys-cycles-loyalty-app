/**
 * Stakey's Cycles - Firebase Service API
 * Firebase v10+ Modular Web SDK
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  addDoc,
  Timestamp,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { UserProfile, PrizeWheel, PrizeDraw, StampLog, UserRole } from '../types/bikeShop';

/**
 * Helper to generate a unique Stakey's Cycles membership number (e.g. STK-839201)
 */
export function generateMembershipNumber(): string {
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  return `STK-${randomSixDigits}`;
}

/**
 * Generates formatted barcode string / CODE128 payload for the customer's membership
 */
export function generateBarcodeValue(membershipNumber: string | undefined): string {
  if (!membershipNumber) return 'STK-000000';
  return membershipNumber.toUpperCase().replace(/\s+/g, '');
}

/**
 * Checks if a customer already received a stamp within the current calendar day (1-visit-per-day rate limit)
 */
export function canCustomerReceiveStampToday(user: UserProfile | null | undefined): {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
} {
  if (!user || !user.lastStampedAt) return { allowed: true };

  const lastStampedDate = user.lastStampedAt?.toDate
    ? user.lastStampedAt.toDate()
    : new Date(user.lastStampedAt);

  const now = new Date();
  const isSameDay =
    lastStampedDate.getFullYear() === now.getFullYear() &&
    lastStampedDate.getMonth() === now.getMonth() &&
    lastStampedDate.getDate() === now.getDate();

  if (isSameDay) {
    const nextAllowed = new Date(lastStampedDate);
    nextAllowed.setDate(nextAllowed.getDate() + 1);
    nextAllowed.setHours(0, 0, 0, 0);

    return {
      allowed: false,
      reason: `Customer already received a stamp today at ${lastStampedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. 1 visit stamp allowed per calendar day.`,
      nextAllowedAt: nextAllowed,
    };
  }

  return { allowed: true };
}

/**
 * 1. Authentication & Profile Registration
 * Creates Auth account and initializes Firestore user profile with role 'customer',
 * 0 stamps, 0 tickets, and unique membershipNumber.
 */
export async function registerCustomer(
  email: string,
  password: string,
  displayName?: string,
  customRole: UserRole = 'customer'
): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  const membershipNumber = generateMembershipNumber();
  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email || email,
    displayName: displayName || user.email?.split('@')[0] || 'Customer',
    role: customRole,
    membershipNumber,
    stamps: 0,
    tickets: 0,
    createdAt: serverTimestamp(),
    lastStampedAt: null,
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);
  return { ...userProfile, uid: user.uid };
}

/**
 * Sign In
 */
export async function signInUser(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Sign Out
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * 2. Fetch User Profile
 * Deliverable: getUserProfile(uid)
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { uid: snapshot.id, ...(snapshot.data() as Omit<UserProfile, 'uid'>) };
}

/**
 * Lookup Customer by Membership Number or UID (for staff scanner)
 */
export async function findCustomerByMembershipOrUid(identifier: string): Promise<UserProfile | null> {
  const cleanId = (identifier || '').trim();
  if (!cleanId) return null;

  // Direct UID lookup
  const directDoc = await getDoc(doc(db, 'users', cleanId));
  if (directDoc.exists()) {
    return { uid: directDoc.id, ...(directDoc.data() as Omit<UserProfile, 'uid'>) };
  }

  // Lookup by membershipNumber (e.g. STK-839201)
  const q = query(
    collection(db, 'users'),
    where('membershipNumber', '==', cleanId.toUpperCase()),
    limit(1)
  );
  const querySnap = await getDocs(q);

  if (!querySnap.empty) {
    const docData = querySnap.docs[0];
    return { uid: docData.id, ...(docData.data() as Omit<UserProfile, 'uid'>) };
  }

  return null;
}

/**
 * 3. Add Stamp to Customer
 * Deliverable: addStampToCustomer(customerId, staffId)
 * Uses Firestore transaction to enforce:
 * - 1-visit-per-day rate limit
 * - 0 to 10 stamp progression logic (cycling or capping with bonus ticket awarded on 10)
 * - Atomic write to user document AND immutable stampLogs audit trail
 */
export async function addStampToCustomer(
  customerId: string,
  staffId: string,
  bypassRateLimit = false
) {
  if (!customerId) throw new Error('Customer ID is required');
  if (!staffId) throw new Error('Staff ID is required');

  const customerRef = doc(db, 'users', customerId);
  const stampLogRef = doc(collection(db, 'stampLogs'));

  const result = await runTransaction(db, async (transaction) => {
    const customerDoc = await transaction.get(customerRef);
    if (!customerDoc.exists()) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }

    const customer = customerDoc.data() as UserProfile;

    // 1-visit-per-day rate limit validation
    if (!bypassRateLimit) {
      const rateLimitCheck = canCustomerReceiveStampToday(customer);
      if (!rateLimitCheck.allowed) {
        throw new Error(rateLimitCheck.reason);
      }
    }

    const currentStamps = Number(customer.stamps || 0);
    const currentTickets = Number(customer.tickets || 0);

    let nextStamps = currentStamps + 1;
    let nextTickets = currentTickets;
    let cardCompleted = false;

    // Stamp Card completion reward logic (at 10 stamps)
    if (nextStamps >= 10) {
      nextStamps = 0; // Reset card for next cycle
      nextTickets += 1; // Award +1 Prize Draw ticket
      cardCompleted = true;
    }

    const timestamp = serverTimestamp();

    // 1. Update customer profile atomically
    transaction.update(customerRef, {
      stamps: nextStamps,
      tickets: nextTickets,
      lastStampedAt: timestamp,
    });

    // 2. Append immutable audit record to stampLogs
    transaction.set(stampLogRef, {
      id: stampLogRef.id,
      customerId,
      customerName: customer.displayName || 'Customer',
      membershipNumber: customer.membershipNumber || '',
      staffId,
      action: 'add_stamp',
      stampsBefore: currentStamps,
      stampsAfter: nextStamps,
      ticketsAwarded: cardCompleted ? 1 : 0,
      timestamp,
      note: cardCompleted
        ? 'Completed 10-stamp card! Awarded 1 Prize Draw Ticket and reset card.'
        : `Added 1 visit stamp (${nextStamps}/10)`,
    });

    return {
      success: true,
      customerId,
      previousStamps: currentStamps,
      newStamps: nextStamps,
      newTickets: nextTickets,
      cardCompleted,
      logId: stampLogRef.id,
    };
  });

  return result;
}

/**
 * 4. Prize Wheels Management
 * Deliverables: getPrizeWheels() & updatePrizeWheel(wheelId, data)
 */
export async function getPrizeWheels(onlyActive = false): Promise<PrizeWheel[]> {
  const wheelsRef = collection(db, 'prizeWheels');
  const q: Query<DocumentData, DocumentData> = onlyActive
    ? query(wheelsRef, where('active', '==', true))
    : wheelsRef;

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrizeWheel, 'id'>) }));
}

export async function updatePrizeWheel(wheelId: string, data: Partial<PrizeWheel>): Promise<{ id: string } & Partial<PrizeWheel>> {
  if (!wheelId) throw new Error('wheelId is required');
  const wheelRef = doc(db, 'prizeWheels', wheelId);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(wheelRef, payload);
  return { id: wheelId, ...payload };
}

export async function createPrizeWheel(wheelData: Partial<PrizeWheel>): Promise<PrizeWheel> {
  const wheelsRef = collection(db, 'prizeWheels');
  const payload = {
    title: wheelData.title || "Stakey's Weekly Spin",
    active: wheelData.active ?? true,
    segments: wheelData.segments || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const newDoc = await addDoc(wheelsRef, payload);
  return { id: newDoc.id, ...payload };
}

/**
 * 5. Periodic Prize Draws Management
 * Deliverable: runPrizeDraw(drawId)
 * Selects a random customer who holds tickets (tickets > 0),
 * weighted proportionally by ticket count, marks the draw completed,
 * records the winner UID and timestamp.
 */
export async function runPrizeDraw(drawId: string) {
  if (!drawId) throw new Error('drawId is required');

  const drawRef = doc(db, 'draws', drawId);
  const drawSnap = await getDoc(drawRef);

  if (!drawSnap.exists()) {
    throw new Error(`Prize draw ${drawId} does not exist`);
  }

  const drawData = drawSnap.data() as PrizeDraw;
  if (drawData.status === 'completed') {
    throw new Error('This prize draw has already been completed.');
  }

  // Find all customers with tickets > 0
  const customersQuery = query(
    collection(db, 'users'),
    where('role', '==', 'customer'),
    where('tickets', '>', 0)
  );

  const customersSnap = await getDocs(customersQuery);

  if (customersSnap.empty) {
    throw new Error('No eligible customers with tickets > 0 were found for this draw.');
  }

  // Create ticket pool weighted by number of tickets held
  const pool: UserProfile[] = [];
  customersSnap.docs.forEach((docSnap) => {
    const user = { uid: docSnap.id, ...(docSnap.data() as Omit<UserProfile, 'uid'>) };
    const ticketCount = Math.max(1, Number(user.tickets || 1));
    for (let i = 0; i < ticketCount; i++) {
      pool.push(user);
    }
  });

  // Pick random winner from the pool
  const randomIndex = Math.floor(Math.random() * pool.length);
  const winningUser = pool[randomIndex];

  const now = serverTimestamp();

  await updateDoc(drawRef, {
    status: 'completed',
    winnerUid: winningUser.uid,
    winnerDisplayName: winningUser.displayName || 'Stakey Rider',
    winnerMembershipNumber: winningUser.membershipNumber || '',
    completedAt: now,
  });

  return {
    drawId,
    prizeTitle: drawData.title,
    prizeDescription: drawData.prizeDescription,
    winner: {
      uid: winningUser.uid,
      displayName: winningUser.displayName,
      email: winningUser.email,
      membershipNumber: winningUser.membershipNumber,
      totalTicketsHeld: winningUser.tickets,
    },
    totalEntries: pool.length,
    uniqueParticipants: customersSnap.docs.length,
  };
}

/**
 * Fetch Draws List
 */
export async function getDraws(): Promise<PrizeDraw[]> {
  const drawsRef = collection(db, 'draws');
  const snapshot = await getDocs(drawsRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrizeDraw, 'id'>) }));
}

/**
 * Create a new Prize Draw
 */
export async function createPrizeDraw(drawData: { title: string; prizeDescription: string; drawDate?: any }): Promise<PrizeDraw> {
  const drawsRef = collection(db, 'draws');
  const payload = {
    title: drawData.title,
    prizeDescription: drawData.prizeDescription,
    drawDate: drawData.drawDate || Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
    status: 'upcoming' as const,
    winnerUid: null,
    createdAt: serverTimestamp(),
  };

  const newDoc = await addDoc(drawsRef, payload);
  return { id: newDoc.id, ...payload };
}

/**
 * Fetch Stamp Audit Logs for Customer or Staff
 */
export async function getCustomerStampLogs(customerId: string): Promise<StampLog[]> {
  const logsRef = collection(db, 'stampLogs');
  const q = query(
    logsRef,
    where('customerId', '==', customerId),
    orderBy('timestamp', 'desc'),
    limit(25)
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StampLog, 'id'>) }));
  } catch (err) {
    const fallbackQ = query(logsRef, where('customerId', '==', customerId), limit(25));
    const snapshot = await getDocs(fallbackQ);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StampLog, 'id'>) }));
  }
}
