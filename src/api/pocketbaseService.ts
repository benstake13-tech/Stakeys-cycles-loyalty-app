/**
 * Stakey's Cycles - PocketBase Service
 * Connects to PocketBase at https://intelligent-traffic-icon-catherine.trycloudflare.com
 */
import pb, { POCKETBASE_URL, getStoredPocketBaseUrl, setPocketBaseUrl } from '../pocketbase';
import { UserProfile, PrizeWheel, PrizeDraw, StampLog } from '../types/bikeShop';
import { generateMembershipNumber } from './firebaseService';

export { POCKETBASE_URL, getStoredPocketBaseUrl, setPocketBaseUrl, pb };

export interface PocketBaseHealthStatus {
  isOnline: boolean;
  url: string;
  latencyMs?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  checkedAt: string;
}

/**
 * Health check to verify if PocketBase daemon is listening at the active target URL
 */
export async function checkPocketBaseHealth(customUrl?: string): Promise<PocketBaseHealthStatus> {
  const targetUrl = (customUrl || getStoredPocketBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(`${targetUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        isOnline: true,
        url: targetUrl,
        latencyMs,
        statusCode: res.status,
        message: data.message || 'Healthy',
        checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    }
    const errorDetail =
      res.status === 404
        ? `Tunnel reachable (${latencyMs}ms), but PocketBase /api/health returned 404. Verify local PocketBase is serving on the tunneled port.`
        : `HTTP ${res.status}: Server returned error response`;
    return {
      isOnline: false,
      url: targetUrl,
      latencyMs,
      statusCode: res.status,
      error: errorDetail,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    let errMsg = err.message || 'Cannot reach PocketBase server';
    if (err.name === 'AbortError') {
      errMsg = 'Connection timed out (4.5s)';
    } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
      errMsg = 'Cloudflare tunnel offline or network unreachable';
    }
    return {
      isOnline: false,
      url: targetUrl,
      latencyMs,
      error: errMsg,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}

/**
 * Authenticate with Email & Password via PocketBase
 */
export async function loginWithPassword(email: string, password: string) {
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return { success: true, user: authData.record, token: authData.token };
  } catch (err: any) {
    throw new Error(err.message || 'PocketBase authentication failed');
  }
}

/**
 * Register a new Customer in PocketBase
 */
export async function registerCustomer(
  email: string,
  password: string,
  passwordConfirm: string,
  name: string
) {
  const membershipNumber = generateMembershipNumber();
  try {
    const record = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      name,
      displayName: name,
      membershipNumber,
      role: 'customer',
      stamps: 0,
      tickets: 0,
    });

    // Auto-login after registration
    const authData = await pb.collection('users').authWithPassword(email, password);
    return { success: true, user: authData.record };
  } catch (err: any) {
    throw new Error(err.message || 'PocketBase customer registration failed');
  }
}

/**
 * Log out
 */
export function logout() {
  pb.authStore.clear();
}

/**
 * Fetch Customer Profile
 * PocketBase Rule enforces: @request.auth.id = id || @request.auth.role = 'staff'
 */
export async function getUserProfile(userId: string) {
  try {
    const record = await pb.collection('users').getOne(userId);
    return record;
  } catch (err: any) {
    return null;
  }
}

/**
 * Add Stamp to Customer via PocketBase & write immutable stamp_log
 */
export async function addStampToCustomer(
  customerId: string,
  staffId: string,
  bypassRateLimit = false
) {
  try {
    const customer = await pb.collection('users').getOne(customerId);

    // 1-visit-per-day rate limit
    if (!bypassRateLimit && customer.lastStampedAt) {
      const lastStamped = new Date(customer.lastStampedAt);
      const now = new Date();
      if (
        lastStamped.getFullYear() === now.getFullYear() &&
        lastStamped.getMonth() === now.getMonth() &&
        lastStamped.getDate() === now.getDate()
      ) {
        throw new Error('Daily Rate Limit: 1 stamp per day allowed.');
      }
    }

    const currentStamps = Number(customer.stamps || 0);
    const currentTickets = Number(customer.tickets || 0);

    let nextStamps = currentStamps + 1;
    let nextTickets = currentTickets;
    let cardCompleted = false;

    if (nextStamps >= 10) {
      nextStamps = 0;
      nextTickets += 1;
      cardCompleted = true;
    }

    const nowIso = new Date().toISOString();

    // 1. Update customer record
    const updatedUser = await pb.collection('users').update(customerId, {
      stamps: nextStamps,
      tickets: nextTickets,
      lastStampedAt: nowIso,
    });

    // 2. Create immutable audit log in stamp_logs collection
    const log = await pb.collection('stamp_logs').create({
      customerId,
      customerName: customer.name || customer.displayName || 'Customer',
      membershipNumber: customer.membershipNumber,
      staffId,
      staffName: pb.authStore.model?.name || 'Staff Mechanic',
      action: 'add_stamp',
      stampsBefore: currentStamps,
      stampsAfter: nextStamps,
      ticketsAwarded: cardCompleted ? 1 : 0,
      note: cardCompleted
        ? 'Completed 10-stamp card! Awarded 1 Prize Draw Ticket and reset card.'
        : `Added 1 visit stamp (${nextStamps}/10)`,
    });

    return {
      success: true,
      customerId,
      newStamps: nextStamps,
      newTickets: nextTickets,
      cardCompleted,
      log,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to add stamp in PocketBase');
  }
}

/**
 * Fetch active Prize Wheels
 */
export async function getPrizeWheels(onlyActive = true) {
  try {
    const filter = onlyActive ? 'active = true' : '';
    const records = await pb.collection('prize_wheels').getFullList({ filter });
    return records;
  } catch (err: any) {
    return [];
  }
}

/**
 * Update Prize Wheel
 */
export async function updatePrizeWheel(wheelId: string, data: any) {
  try {
    return await pb.collection('prize_wheels').update(wheelId, data);
  } catch (err: any) {
    throw new Error(err.message || 'Failed to update prize wheel');
  }
}

/**
 * Run Periodic Prize Draw in PocketBase
 */
export async function runPrizeDraw(drawId: string) {
  try {
    const draw = await pb.collection('draws').getOne(drawId);
    if (draw.status === 'completed') {
      throw new Error('This draw is already completed');
    }

    // Get all customers with tickets > 0
    const ticketHolders = await pb.collection('users').getFullList({
      filter: "role = 'customer' && tickets > 0",
    });

    if (ticketHolders.length === 0) {
      throw new Error('No eligible customers with tickets > 0 found in PocketBase.');
    }

    const pool: any[] = [];
    ticketHolders.forEach((user) => {
      const count = Math.max(1, user.tickets || 1);
      for (let i = 0; i < count; i++) pool.push(user);
    });

    const winner = pool[Math.floor(Math.random() * pool.length)];

    const updated = await pb.collection('draws').update(drawId, {
      status: 'completed',
      winnerId: winner.id,
      winnerName: winner.name || winner.displayName,
      winnerMembershipNumber: winner.membershipNumber,
    });

    return {
      drawId,
      winner,
      totalEntries: pool.length,
      updated,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to run prize draw');
  }
}
