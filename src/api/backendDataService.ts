/**
 * Stakey's Cycles - Backend Database Synchronization Service
 * Uses singleton Supabase client from src/lib/supabase with diagnostic console logging.
 */
import { getSupabaseClient } from '../lib/supabase';
import {
  UserProfile,
  CustomerBike,
  ServiceBooking,
  StampLog,
  VehicleCategory,
  BikeScrapeResult,
  PrizeWheel,
  PrizeDraw,
  CollectedVoucher,
  DiscountCode,
  SaleTransaction,
} from '../types/bikeShop';

export interface DatabaseSyncStatus {
  lastSyncAt: string;
  isSyncing: boolean;
  activeProvider: 'supabase' | 'offline';
  error: string | null;
}

function normalizeCategory(cat?: string): VehicleCategory {
  if (!cat) return 'cycle';
  const lower = cat.toLowerCase();
  if (lower.includes('scooter')) return 'electric_scooter';
  if (lower.includes('cargo')) return 'cargo';
  if (lower.includes('ebike') || lower.includes('electric')) return 'ebike';
  return 'cycle';
}

/**
 * 1. FETCH BIKES
 */
export async function fetchCustomerBikesFromDb(
  userId: string,
  membershipNumber?: string
): Promise<CustomerBike[]> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] SELECT customer_bikes for userId=${userId}, membership=${membershipNumber}`);
  try {
    let query = supabase.from('customer_bikes').select('*');
    if (membershipNumber) {
      query = query.or(`customer_id.eq.${userId},customer_id.eq.${membershipNumber}`);
    } else {
      query = query.eq('customer_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT customer_bikes failed:', error.message);
    } else {
      console.log(`[SUPABASE NET SUCCESS] SELECT customer_bikes returned ${data?.length || 0} rows`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => {
        const extraMeta = row.scraped_data?.meta || {};
        return {
          id: row.id,
          brand: row.brand || 'Unknown',
          model: row.model || 'Bike',
          year: row.year || undefined,
          colour: row.color || 'Standard',
          color: row.color || 'Standard',
          serialNumber: row.serial_number || undefined,
          category: normalizeCategory(row.category),
          categoryLabel: extraMeta.categoryLabel || row.model || 'Cycle',
          frameSizeOrNotes: extraMeta.frameSizeOrNotes || undefined,
          addedAt: row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          lastServiceDate: extraMeta.lastServiceDate || undefined,
          lastServiceTitle: extraMeta.lastServiceTitle || undefined,
          healthStatus: extraMeta.healthStatus || 'healthy',
          stockSpecsScraped: Boolean(row.stock_specs_scraped),
          scrapedData: row.scraped_data && row.scraped_data.components ? row.scraped_data : undefined,
        };
      });
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchCustomerBikesFromDb:', err);
  }

  return [];
}

/**
 * 2. INSERT BIKE
 */
export async function insertCustomerBikeToDb(
  bike: CustomerBike,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] INSERT customer_bikes id=${bike.id} for userId=${userId}`);
  try {
    const payload = {
      id: bike.id,
      customer_id: userId,
      brand: bike.brand,
      model: bike.model,
      year: bike.year || null,
      color: bike.colour || bike.color || 'Standard',
      serial_number: bike.serialNumber || null,
      category: bike.category || 'cycle',
      stock_specs_scraped: Boolean(bike.stockSpecsScraped),
      scraped_data: {
        ...(bike.scrapedData || {}),
        meta: {
          categoryLabel: bike.categoryLabel,
          frameSizeOrNotes: bike.frameSizeOrNotes,
          healthStatus: bike.healthStatus,
          lastServiceDate: bike.lastServiceDate,
          lastServiceTitle: bike.lastServiceTitle,
        },
      },
    };

    const { error } = await supabase.from('customer_bikes').insert(payload);
    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] INSERT customer_bikes succeeded for id=${bike.id}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] INSERT customer_bikes failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] insertCustomerBikeToDb:', err);
  }
  return false;
}

/**
 * 3. DELETE BIKE
 */
export async function deleteCustomerBikeFromDb(
  bikeId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] DELETE customer_bikes id=${bikeId}`);
  try {
    const { error } = await supabase
      .from('customer_bikes')
      .delete()
      .eq('id', bikeId);

    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] DELETE customer_bikes succeeded for id=${bikeId}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] DELETE customer_bikes failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteCustomerBikeFromDb:', err);
  }
  return false;
}

/**
 * 4. UPDATE BIKE SPECS
 */
export async function updateCustomerBikeSpecsInDb(
  bikeId: string,
  userId: string,
  result: BikeScrapeResult
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] UPDATE customer_bikes specs for id=${bikeId}`);
  try {
    const { error } = await supabase
      .from('customer_bikes')
      .update({
        stock_specs_scraped: true,
        scraped_data: result,
      })
      .eq('id', bikeId);

    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] UPDATE customer_bikes specs succeeded for id=${bikeId}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] UPDATE customer_bikes specs failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] updateCustomerBikeSpecsInDb:', err);
  }
  return false;
}

/**
 * 5. FETCH BOOKINGS
 */
export async function fetchServiceBookingsFromDb(
  userId?: string,
  isStaff = false,
  membershipNumber?: string
): Promise<ServiceBooking[]> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] SELECT service_bookings userId=${userId}, isStaff=${isStaff}, membership=${membershipNumber}`);
  try {
    let query = supabase.from('service_bookings').select('*');
    if (!isStaff && userId) {
      if (membershipNumber) {
        query = query.or(`customer_id.eq.${userId},customer_id.eq.${membershipNumber},membership_number.eq.${membershipNumber}`);
      } else {
        query = query.eq('customer_id', userId);
      }
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT service_bookings failed:', error.message);
    } else {
      console.log(`[SUPABASE NET SUCCESS] SELECT service_bookings returned ${data?.length || 0} rows`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email || 'customer@example.com',
        customerId: row.customer_id,
        membershipNumber: row.membership_number || undefined,
        serviceId: row.service_id,
        serviceTitle: row.service_title,
        servicePrice: Number(row.service_price) || 0,
        vehicleCategory: normalizeCategory(row.vehicle_type),
        vehicleModel: row.vehicle_model || 'Bicycle',
        preferredDate: row.preferred_date,
        preferredTimeSlot: row.preferred_time_slot,
        notes: row.notes || undefined,
        status: row.status || 'pending',
        approvalStatus: row.approval_status || (row.status === 'confirmed' ? 'approved' : 'pending_approval'),
        approvedAt: row.approved_at || undefined,
        approvedBy: row.approved_by || undefined,
        declineReason: row.decline_reason || undefined,
        staffNotes: row.staff_notes || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        notifications: Array.isArray(row.notifications) ? row.notifications : [],
        reminder24hSent: Boolean(row.reminder_24h_sent),
      }));
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchServiceBookingsFromDb:', err);
  }

  return [];
}

/**
 * 6. INSERT BOOKING
 */
export async function insertServiceBookingToDb(
  booking: ServiceBooking
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] INSERT service_bookings id=${booking.id}`);
  try {
    const payload = {
      id: booking.id,
      customer_id: booking.customerId || null,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_email: booking.customerEmail,
      membership_number: booking.membershipNumber || null,
      service_id: booking.serviceId,
      service_title: booking.serviceTitle,
      service_price: booking.servicePrice,
      vehicle_type: booking.vehicleCategory,
      vehicle_model: booking.vehicleModel,
      preferred_date: booking.preferredDate,
      preferred_time_slot: booking.preferredTimeSlot,
      notes: booking.notes || null,
      status: booking.status,
      reminder_24h_sent: Boolean(booking.reminder24hSent),
    };

    const { error } = await supabase.from('service_bookings').insert(payload);
    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] INSERT service_bookings succeeded for id=${booking.id}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] INSERT service_bookings failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] insertServiceBookingToDb:', err);
  }
  return false;
}

/**
 * 7. UPDATE BOOKING
 */
export async function updateServiceBookingInDb(
  bookingId: string,
  updates: Partial<ServiceBooking>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] UPDATE service_bookings id=${bookingId}`);
  try {
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.approvalStatus) payload.approval_status = updates.approvalStatus;
    if (updates.approvedAt) payload.approved_at = updates.approvedAt;
    if (updates.approvedBy) payload.approved_by = updates.approvedBy;
    if (updates.declineReason) payload.decline_reason = updates.declineReason;
    if (updates.staffNotes) payload.staff_notes = updates.staffNotes;
    if (updates.reminder24hSent !== undefined) payload.reminder_24h_sent = updates.reminder24hSent;

    const { error } = await supabase
      .from('service_bookings')
      .update(payload)
      .eq('id', bookingId);

    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] UPDATE service_bookings succeeded for id=${bookingId}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] UPDATE service_bookings failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] updateServiceBookingInDb:', err);
  }
  return false;
}

/**
 * 8. FETCH STAMP LOGS
 */
export async function fetchStampLogsFromDb(
  userId?: string,
  isStaff = false,
  membershipNumber?: string
): Promise<StampLog[]> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] SELECT stamp_logs userId=${userId}, isStaff=${isStaff}`);
  try {
    let query = supabase.from('stamp_logs').select('*');
    if (!isStaff && userId) {
      if (membershipNumber) {
        query = query.or(`customer_id.eq.${userId},customer_id.eq.${membershipNumber},membership_number.eq.${membershipNumber}`);
      } else {
        query = query.eq('customer_id', userId);
      }
    }
    query = query.order('timestamp', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT stamp_logs failed:', error.message);
    } else {
      console.log(`[SUPABASE NET SUCCESS] SELECT stamp_logs returned ${data?.length || 0} rows`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name || 'Customer',
        membershipNumber: row.membership_number,
        staffId: row.staff_id,
        staffName: row.staff_name || 'Staff',
        action: row.action,
        stampsBefore: row.stamps_before,
        stampsAfter: row.stamps_after,
        ticketsAwarded: row.action === 'add_stamp' && row.stamps_after === 0 ? 1 : 0,
        timestamp: new Date(row.timestamp),
        note: row.note,
      }));
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchStampLogsFromDb:', err);
  }

  return [];
}

/**
 * Ensures a customer's `profiles` row exists. Some Supabase projects do not have
 * an `on auth.users` trigger, so a freshly registered auth user has no profile
 * row — every spin / stamp / voucher write then silently fails. This creates a
 * minimal row on demand (safe to call often; it only inserts when missing).
 */
export async function ensureProfileRowInDb(profile: {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  membershipNumber?: string;
  stamps?: number;
  tickets?: number;
  merits?: number;
}): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: profile.uid,
      email: profile.email || null,
      display_name: profile.displayName || 'Stakey Rider',
      role: profile.role || 'customer',
      membership_number: profile.membershipNumber || null,
      stamps: profile.stamps ?? 0,
      completed_cards: profile.tickets ?? 0,
      merit_points: profile.merits ?? 0,
      updated_at: new Date().toISOString(),
    };
    // ignoreDuplicates: only INSERT when the row is missing. Existing profiles
    // must never be overwritten here or a returning customer's stamp balance
    // would be reset to zero on every login.
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      console.error('[SUPABASE NET ERROR] ensureProfileRowInDb failed:', error.message);
      return false;
    }
    console.log(`[SUPABASE NET SUCCESS] ensureProfileRowInDb ensured profile for userId=${profile.uid}`);
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] ensureProfileRowInDb:', err);
    return false;
  }
}

let stampLogSchemaWarned = false;

export async function insertStampLogToDb(log: StampLog): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] INSERT stamp_logs id=${log.id}`);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const payload: any = {
    id: log.id,
    customer_id: log.customerId,
    customer_name: log.customerName,
    membership_number: log.membershipNumber || null,
    staff_id: log.staffId,
    staff_name: log.staffName,
    action: log.action,
    stamps_before: log.stampsBefore ?? null,
    stamps_after: log.stampsAfter ?? null,
    reward_id: (log as any).rewardId || null,
    note: log.note || null,
    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : new Date().toISOString(),
  };
  // Legacy schemas have a NOT NULL `user_id`; supply it when the customer id is
  // a real UUID so the row can land before the schema sync migration is run.
  if (uuid.test(log.customerId)) payload.user_id = log.customerId;
  try {
    const { error } = await supabase.from('stamp_logs').insert(payload);
    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] INSERT stamp_logs succeeded for id=${log.id}`);
      return true;
    }

    // Some projects created stamp_logs via an older schema (e.g. a NOT NULL
    // `user_id` and no `action`/`customer_*` columns). Retry with a minimal,
    // UUID-identified payload so the audit trail still lands.
    const isSchemaMismatch =
      error.code === 'PGRST204' ||
      error.code === '22P02' ||
      error.code === '23502' ||
      error.message?.includes('schema cache');
    if (isSchemaMismatch) {
      const retryPayload: any = { reason: log.note || log.action || 'stamp_event' };
      if (log.staffId) retryPayload.staff_id = log.staffId;
      const uid = (log as any).user_id || log.customerId;
      if (uid && uuid.test(uid)) {
        retryPayload.user_id = uid;
      }
      const retry = await supabase.from('stamp_logs').insert(retryPayload);
      if (!retry.error) {
        console.log(`[SUPABASE NET SUCCESS] INSERT stamp_logs (legacy schema) succeeded for id=${log.id}`);
        return true;
      }
      if (!stampLogSchemaWarned) {
        stampLogSchemaWarned = true;
        console.error(
          '[SUPABASE NET ERROR] INSERT stamp_logs failed on both schemas:',
          retry.error.message,
          '— run the schema sync SQL (Service Status → Copy SQL setup).'
        );
      }
      return false;
    }

    console.error('[SUPABASE NET ERROR] INSERT stamp_logs failed:', error.message);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] insertStampLogToDb:', err);
  }
  return false;
}

/**
 * 10. UPSERT USER PROFILE
 */
export async function updateUserProfileInDb(
  userId: string,
  membershipNumber: string | undefined,
  updates: {
    stamps?: number;
    tickets?: number;
    merits?: number;
    displayName?: string;
    phoneNumber?: string;
    lastStampedAt?: Date | null;
    lastSpinDate?: string | null;
    lastSpunAt?: Date | string | null;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] UPSERT profiles userId=${userId}, membership=${membershipNumber}, updates=`, updates);
  try {
    const payload: any = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (membershipNumber) payload.membership_number = membershipNumber;
    if (updates.stamps !== undefined) payload.stamps = updates.stamps;
    if (updates.tickets !== undefined) payload.completed_cards = updates.tickets;
    if (updates.merits !== undefined) payload.merit_points = updates.merits;
    if (updates.displayName !== undefined) payload.display_name = updates.displayName;
    if (updates.phoneNumber !== undefined) payload.phone = updates.phoneNumber;
    if (updates.lastSpinDate !== undefined) payload.last_spin_date = updates.lastSpinDate;
    if (updates.lastSpunAt !== undefined) {
      payload.last_spun_at =
        updates.lastSpunAt instanceof Date
          ? updates.lastSpunAt.toISOString()
          : updates.lastSpunAt;
    }

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] UPSERT profiles succeeded for userId=${userId}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] UPSERT profiles failed:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] updateUserProfileInDb:', err);
  }
  return false;
}

/**
 * 11. FETCH USER PROFILE
 */
export async function fetchUserProfileFromDb(
  userId: string,
  membershipNumber?: string,
  email?: string
): Promise<Partial<UserProfile> | null> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] SELECT profiles userId=${userId}, membership=${membershipNumber}, email=${email}`);
  try {
    let query = supabase.from('profiles').select('*');
    const conditions: string[] = [`id.eq.${userId}`];
    if (membershipNumber) {
      conditions.push(`membership_number.ilike.${membershipNumber}`);
    }
    if (email) {
      conditions.push(`email.ilike.${email.toLowerCase()}`);
    }
    query = query.or(conditions.join(','));

    const { data, error } = await query.limit(1);
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT profiles failed:', error.message);
    } else {
      console.log(`[SUPABASE NET SUCCESS] SELECT profiles returned ${data?.length || 0} rows`);
    }

    if (data && data.length > 0) {
      const row = data[0];
      return {
        uid: row.id,
        displayName: row.display_name,
        email: row.email,
        phoneNumber: row.phone || undefined,
        role: row.role || 'customer',
        membershipNumber: row.membership_number,
        stamps: row.stamps !== undefined ? row.stamps : 0,
        tickets: row.completed_cards !== undefined ? row.completed_cards : 0,
        merits: row.merit_points !== undefined ? row.merit_points : 0,
        lastSpunAt: row.last_spun_at
          ? new Date(row.last_spun_at)
          : row.last_spin_date
          ? new Date(row.last_spin_date)
          : undefined,
      };
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchUserProfileFromDb:', err);
  }

  return null;
}

/**
 * 12. FETCH ALL PROFILES
 */
export async function fetchAllProfilesFromDb(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient();
  console.log('[SUPABASE NET] SELECT ALL profiles');
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT ALL profiles failed:', error.message);
      return []; // Return empty list instead of crashing
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        uid: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role || 'customer',
        membershipNumber: row.membership_number,
        stamps: row.stamps !== undefined ? row.stamps : 0,
        tickets: row.completed_cards !== undefined ? row.completed_cards : 0,
        merits: row.merit_points !== undefined ? row.merit_points : 0,
        phoneNumber: row.phone || undefined,
        lastSpunAt: row.last_spun_at
          ? new Date(row.last_spun_at)
          : row.last_spin_date
          ? new Date(row.last_spin_date)
          : undefined,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      }));
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchAllProfilesFromDb:', err);
  }
  return [];
}

/**
 * 13. REAL-TIME SUBSCRIPTION
 */
export function subscribeToDatabaseChanges(onChanged: (table: string) => void): () => void {
  const supabase = getSupabaseClient();
  console.log('[SUPABASE NET] Subscribing to realtime postgres_changes...');
  try {
    const channel = supabase
      .channel('stakeys-shop-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_bikes' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on customer_bikes');
          onChanged('customer_bikes');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_bookings' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on service_bookings');
          onChanged('service_bookings');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stamp_logs' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on stamp_logs');
          onChanged('stamp_logs');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on profiles');
          onChanged('profiles');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prize_wheels' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on prize_wheels');
          onChanged('prize_wheels');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prize_draws' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on prize_draws');
          onChanged('prize_draws');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_vouchers' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on service_vouchers');
          onChanged('service_vouchers');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discount_codes' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on discount_codes');
          onChanged('discount_codes');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counter_sales' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on counter_sales');
          onChanged('counter_sales');
        }
      )
      .subscribe((status) => {
        console.log(`[SUPABASE REALTIME STATUS] Subscription status: ${status}`);
      });

    return () => {
      console.log('[SUPABASE REALTIME] Unsubscribing channel');
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] subscribeToDatabaseChanges:', err);
    return () => {};
  }
}

/* ------------------------------------------------------------------ *
 * Prize Wheel / Draw / Voucher persistence
 * ------------------------------------------------------------------ */

function mapWheelRow(row: any): PrizeWheel {
  return {
    id: row.id,
    title: row.title,
    active: row.is_active !== undefined ? row.is_active : true,
    ticketCost: row.ticket_cost !== undefined && row.ticket_cost !== null ? row.ticket_cost : 1,
    segments: Array.isArray(row.segments) ? row.segments : [],
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

export async function fetchPrizeWheelsFromDb(): Promise<PrizeWheel[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.from('prize_wheels').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT prize_wheels failed:', error.message);
      return [];
    }
    return (data || []).map(mapWheelRow);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchPrizeWheelsFromDb:', err);
    return [];
  }
}

export async function upsertPrizeWheelToDb(wheel: PrizeWheel): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: wheel.id,
      title: wheel.title,
      segments: wheel.segments,
      is_active: wheel.active,
      ticket_cost: wheel.ticketCost ?? 1,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('prize_wheels').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT prize_wheels failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertPrizeWheelToDb:', err);
    return false;
  }
}

export async function fetchPrizeDrawsFromDb(): Promise<PrizeDraw[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.from('prize_draws').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT prize_draws failed:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      prizeDescription: row.prize_description || '',
      drawDate: row.draw_date ? new Date(row.draw_date) : new Date(),
      status: row.status || 'upcoming',
      winnerUid: row.winner_uid || null,
      winnerName: row.winner_name || null,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchPrizeDrawsFromDb:', err);
    return [];
  }
}

export async function upsertPrizeDrawToDb(draw: PrizeDraw): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: draw.id,
      title: draw.title,
      prize_description: draw.prizeDescription,
      draw_date: draw.drawDate ? new Date(draw.drawDate).toISOString() : null,
      status: draw.status,
      winner_uid: draw.winnerUid,
      winner_name: draw.winnerName || null,
      completed_at: draw.completedAt ? new Date(draw.completedAt).toISOString() : null,
    };
    const { error } = await supabase.from('prize_draws').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT prize_draws failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertPrizeDrawToDb:', err);
    return false;
  }
}

export async function fetchVouchersForCustomerFromDb(customerId: string): Promise<CollectedVoucher[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('service_vouchers')
      .select('*')
      .eq('customer_id', customerId)
      .order('claimed_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT service_vouchers failed:', error.message);
      return [];
    }
    return (data || []).map(mapVoucherRow);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchVouchersForCustomerFromDb:', err);
    return [];
  }
}

function mapVoucherRow(row: any): CollectedVoucher {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || '',
    value: Number(row.value) || 0,
    type: row.type || 'merch',
    terms: row.terms || '',
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : new Date(),
    status: row.status || 'available',
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : undefined,
  };
}

export async function insertVoucherToDb(customerId: string, voucher: CollectedVoucher): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: voucher.id,
      customer_id: customerId,
      code: voucher.code,
      title: voucher.title,
      description: voucher.description,
      value: voucher.value,
      type: voucher.type,
      terms: voucher.terms,
      status: voucher.status,
      claimed_at: voucher.claimedAt ? new Date(voucher.claimedAt).toISOString() : new Date().toISOString(),
      redeemed_at: voucher.redeemedAt ? new Date(voucher.redeemedAt).toISOString() : null,
    };
    const { error } = await supabase.from('service_vouchers').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT service_vouchers failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] insertVoucherToDb:', err);
    return false;
  }
}

export async function updateVoucherStatusInDb(
  voucherId: string,
  status: 'available' | 'redeemed',
  redeemedAt?: Date
): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('service_vouchers')
      .update({ status, redeemed_at: redeemedAt ? redeemedAt.toISOString() : null })
      .eq('id', voucherId);
    if (error) {
      console.error('[SUPABASE NET ERROR] UPDATE service_vouchers failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] updateVoucherStatusInDb:', err);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Discount codes & counter sales
 * ------------------------------------------------------------------ */

function mapDiscountCodeRow(row: any): DiscountCode {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || undefined,
    type: row.type === 'fixed' ? 'fixed' : 'percent',
    value: Number(row.value) || 0,
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    usageLimit: row.usage_limit || undefined,
    timesUsed: Number(row.times_used) || 0,
    assignedToUid: row.assigned_to_uid || undefined,
    assignedToMembership: row.assigned_to_membership || undefined,
    assignedToName: row.assigned_to_name || undefined,
    eligibleCategories: Array.isArray(row.eligible_categories) ? row.eligible_categories : [],
    minimumSpend: row.minimum_spend != null ? Number(row.minimum_spend) : undefined,
    createdBy: row.created_by || undefined,
  };
}

export async function fetchDiscountCodesFromDb(): Promise<DiscountCode[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT discount_codes failed:', error.message);
      return [];
    }
    return (data || []).map(mapDiscountCodeRow);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchDiscountCodesFromDb:', err);
    return [];
  }
}

export async function upsertDiscountCodeToDb(code: DiscountCode): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: code.id,
      code: code.code,
      title: code.title,
      description: code.description || null,
      type: code.type,
      value: code.value,
      status: code.status,
      expires_at: code.expiresAt ? new Date(code.expiresAt).toISOString() : null,
      usage_limit: code.usageLimit || null,
      times_used: code.timesUsed || 0,
      assigned_to_uid: code.assignedToUid || null,
      assigned_to_membership: code.assignedToMembership || null,
      assigned_to_name: code.assignedToName || null,
      eligible_categories: code.eligibleCategories || [],
      minimum_spend: code.minimumSpend != null ? code.minimumSpend : null,
      created_by: code.createdBy || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('discount_codes').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT discount_codes failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertDiscountCodeToDb:', err);
    return false;
  }
}

export async function deleteDiscountCodeFromDb(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) {
      console.error('[SUPABASE NET ERROR] DELETE discount_codes failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteDiscountCodeFromDb:', err);
    return false;
  }
}

export async function incrementDiscountUsageInDb(id: string, timesUsed: number): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('discount_codes')
      .update({ times_used: timesUsed, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[SUPABASE NET ERROR] UPDATE discount_codes usage failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] incrementDiscountUsageInDb:', err);
    return false;
  }
}

export async function fetchCounterSalesFromDb(): Promise<SaleTransaction[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('counter_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT counter_sales failed:', error.message);
      return [];
    }
    return (data || []).map(mapSaleRow);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchCounterSalesFromDb:', err);
    return [];
  }
}

function mapSaleRow(row: any): SaleTransaction {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    customerId: row.customer_id || undefined,
    membershipNumber: row.membership_number || undefined,
    customerName: row.customer_name || 'Walk-in customer',
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    vatRate: Number(row.vat_rate) || 0,
    vatAmount: Number(row.vat_amount) || 0,
    discount: Number(row.discount) || 0,
    discountCode: row.discount_code || undefined,
    discountLabel: row.discount_label || undefined,
    grandTotal: Number(row.grand_total) || 0,
    paymentMethod: row.payment_method || 'unpaid',
    staffUid: row.staff_uid || undefined,
    staffName: row.staff_name || undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export async function insertCounterSaleToDb(sale: SaleTransaction): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: sale.id,
      sale_number: sale.saleNumber,
      customer_id: sale.customerId || null,
      membership_number: sale.membershipNumber || null,
      customer_name: sale.customerName,
      items: sale.items,
      subtotal: sale.subtotal,
      vat_rate: sale.vatRate,
      vat_amount: sale.vatAmount,
      discount: sale.discount,
      discount_code: sale.discountCode || null,
      discount_label: sale.discountLabel || null,
      grand_total: sale.grandTotal,
      payment_method: sale.paymentMethod,
      staff_uid: sale.staffUid || null,
      staff_name: sale.staffName || null,
      created_at: sale.createdAt ? new Date(sale.createdAt).toISOString() : new Date().toISOString(),
    };
    const { error } = await supabase.from('counter_sales').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT counter_sales failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] insertCounterSaleToDb:', err);
    return false;
  }
}

