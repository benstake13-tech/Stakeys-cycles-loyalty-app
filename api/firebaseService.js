/**
 * Stakey's Cycles - Firebase Service API
 * Firebase v10+ Modular Web SDK (JavaScript)
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
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db, auth } from '../firebaseConfig.js';

/**
 * Generate unique Stakey's Cycles membership number (e.g. STK-839201)
 */
export function generateMembershipNumber() {
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  return `STK-${randomSixDigits}`;
}

/**
 * Generates formatted barcode string / CODE128 payload for the customer's membership
 */
export function generateBarcodeValue(membershipNumber) {
  if (!membershipNumber) return 'STK-000000';
  return membershipNumber.toUpperCase().replace(/\s+/g, '');
}

/**
 * 1. Authentication & Profile Setup
 */
export async function registerCustomer(email, password, displayName, customRole = 'customer') {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  const membershipNumber = generateMembershipNumber();
  const userProfile = {
    uid: user.uid,
    email: user.email,
    displayName: displayName || user.email.split('@')[0],
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

export async function signInUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signOutUser() {
  await signOut(auth);
}

/**
 * 2. Deliverable: getUserProfile(uid)
 * Fetches user profile from 'users' collection
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Lookup Customer by Membership Number or UID
 */
export async function findCustomerByMembershipOrUid(identifier) {
  const cleanId = (identifier || '').trim();
  if (!cleanId) return null;

  const directDoc = await getDoc(doc(db, 'users', cleanId));
  if (directDoc.exists()) {
    return { id: directDoc.id, ...directDoc.data() };
  }

  const q = query(
    collection(db, 'users'),
    where('membershipNumber', '==', cleanId.toUpperCase()),
    limit(1)
  );
  const querySnap = await getDocs(q);

  if (!querySnap.empty) {
    const docData = querySnap.docs[0];
    return { id: docData.id, ...docData.data() };
  }

  return null;
}

/**
 * 3. Deliverable: addStampToCustomer(customerId, staffId)
 * Uses Firestore transaction for atomic stamp increment, rate-limit check,
 * and immutable stampLogs audit record creation.
 */
export async function addStampToCustomer(customerId, staffId, bypassRateLimit = false) {
  if (!customerId) throw new Error('Customer ID is required');
  if (!staffId) throw new Error('Staff ID is required');

  const customerRef = doc(db, 'users', customerId);
  const stampLogRef = doc(collection(db, 'stampLogs'));

  const result = await runTransaction(db, async (transaction) => {
    const customerDoc = await transaction.get(customerRef);
    if (!customerDoc.exists()) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }

    const customer = customerDoc.data();

    // 1-visit-per-day rate limit check
    if (!bypassRateLimit && customer.lastStampedAt) {
      const lastStamped = customer.lastStampedAt.toDate
        ? customer.lastStampedAt.toDate()
        : new Date(customer.lastStampedAt);
      const now = new Date();
      if (
        lastStamped.getFullYear() === now.getFullYear() &&
        lastStamped.getMonth() === now.getMonth() &&
        lastStamped.getDate() === now.getDate()
      ) {
        throw new Error('Customer already received their daily visit stamp today.');
      }
    }

    const currentStamps = Number(customer.stamps || 0);
    const currentTickets = Number(customer.tickets || 0);

    let nextStamps = currentStamps + 1;
    let nextTickets = currentTickets;
    let cardCompleted = false;

    // Stamp card completes at 10 stamps, resets to 0 and awards 1 prize draw ticket
    if (nextStamps >= 10) {
      nextStamps = 0;
      nextTickets += 1;
      cardCompleted = true;
    }

    const timestamp = serverTimestamp();

    transaction.update(customerRef, {
      stamps: nextStamps,
      tickets: nextTickets,
      lastStampedAt: timestamp,
    });

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
        ? 'Completed 10-stamp card! Awarded 1 Prize Draw ticket and reset card.'
        : `Added 1 visit stamp (${nextStamps}/10)`,
    });

    return {
      success: true,
      customerId,
      previousStamps: currentStamps,
      newStamps: nextStamps,
      newTickets,
      cardCompleted,
      logId: stampLogRef.id,
    };
  });

  return result;
}

/**
 * 4. Deliverables: getPrizeWheels() & updatePrizeWheel(wheelId, data)
 */
export async function getPrizeWheels(onlyActive = false) {
  const wheelsRef = collection(db, 'prizeWheels');
  let q = wheelsRef;

  if (onlyActive) {
    q = query(wheelsRef, where('active', '==', true));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updatePrizeWheel(wheelId, data) {
  if (!wheelId) throw new Error('wheelId is required');
  const wheelRef = doc(db, 'prizeWheels', wheelId);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(wheelRef, payload);
  return { id: wheelId, ...payload };
}

export async function createPrizeWheel(wheelData) {
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
 * 5. Deliverable: runPrizeDraw(drawId)
 * Selects a random customer who holds tickets (tickets > 0),
 * weighted proportionally by ticket count, marks the draw completed,
 * records winnerUid and timestamp.
 */
export async function runPrizeDraw(drawId) {
  if (!drawId) throw new Error('drawId is required');

  const drawRef = doc(db, 'draws', drawId);
  const drawSnap = await getDoc(drawRef);

  if (!drawSnap.exists()) {
    throw new Error(`Prize draw ${drawId} does not exist`);
  }

  const drawData = drawSnap.data();
  if (drawData.status === 'completed') {
    throw new Error('This prize draw has already been completed.');
  }

  const customersQuery = query(
    collection(db, 'users'),
    where('role', '==', 'customer'),
    where('tickets', '>', 0)
  );

  const customersSnap = await getDocs(customersQuery);

  if (customersSnap.empty) {
    throw new Error('No eligible customers with tickets > 0 were found for this draw.');
  }

  const pool = [];
  customersSnap.docs.forEach((docSnap) => {
    const user = { uid: docSnap.id, ...docSnap.data() };
    const ticketCount = Math.max(1, Number(user.tickets || 1));
    for (let i = 0; i < ticketCount; i++) {
      pool.push(user);
    }
  });

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

export async function getDraws() {
  const drawsRef = collection(db, 'draws');
  const snapshot = await getDocs(drawsRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPrizeDraw(drawData) {
  const drawsRef = collection(db, 'draws');
  const payload = {
    title: drawData.title,
    prizeDescription: drawData.prizeDescription,
    drawDate: drawData.drawDate || Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
    status: 'upcoming',
    winnerUid: null,
    createdAt: serverTimestamp(),
  };

  const newDoc = await addDoc(drawsRef, payload);
  return { id: newDoc.id, ...payload };
}
