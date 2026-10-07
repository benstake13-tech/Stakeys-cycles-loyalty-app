/**
 * Stakey's Cycles - Backend Database Synchronization Service
 * Uses singleton Supabase client from src/lib/supabase with diagnostic console logging.
 */
import { getSupabaseClient } from '../lib/supabase';
import {
  UserProfile,
  CustomerBike,
  BikeDetails,
  ServiceBooking,
  StampLog,
  VehicleCategory,
  BikeScrapeResult,
  PrizeWheel,
  PrizeWheelSegment,
  PrizeDraw,
  CollectedVoucher,
  DiscountCode,
  SaleTransaction,
  RepairStageId,
  RepairProgressEvent,
  RepairInvoice,
  StaffMember,
  ShopPromotion,
  ReferralRecord,
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
 * The `customer_id` values that legitimately own a customer's bikes. Always
 * includes the profile UUID; adds the membership number only when it is a real,
 * non-empty token (never the empty string, which PostgREST `eq.` would match
 * against every NULL row and leak the whole workshop's garage).
 */
function bikeOwnerIds(userId: string, membershipNumber?: string): string[] {
  const ids = [userId];
  const membership = (membershipNumber || '').trim();
  if (membership && membership !== userId) ids.push(membership);
  return ids;
}

/**
 * Reassigns every bike owned by `membershipNumber` (legacy rows written before
 * the profile-UUID migration) to `userId`, so a customer's garage is keyed only
 * by their stable UUID going forward. Returns the number of rows updated.
 */
export async function reassignBikesToOwner(
  userId: string,
  membershipNumber: string
): Promise<number> {
  const membership = (membershipNumber || '').trim();
  if (!membership) return 0;
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('customer_bikes')
      .update({ customer_id: userId })
      .eq('customer_id', membership)
      .select('id');
    if (error) {
      console.error('[SUPABASE NET ERROR] reassignBikesToOwner failed:', error.message);
      return 0;
    }
    return data?.length || 0;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] reassignBikesToOwner:', err);
    return 0;
  }
}

/**
 * Deletes the given bike rows by id, scoped to `userId` so a stray id can never
 * remove another customer's bike. Returns the number of rows deleted.
 */
export async function deleteBikesByIds(userId: string, ids: string[]): Promise<number> {
  const clean = ids.filter((id) => id && id.trim());
  if (clean.length === 0) return 0;
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('customer_bikes')
      .delete()
      .eq('customer_id', userId)
      .in('id', clean)
      .select('id');
    if (error) {
      console.error('[SUPABASE NET ERROR] deleteBikesByIds failed:', error.message);
      return 0;
    }
    return data?.length || 0;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteBikesByIds:', err);
    return 0;
  }
}

function normalizeProgressEvents(value: unknown): RepairProgressEvent[] {
  if (Array.isArray(value)) return value as RepairProgressEvent[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as RepairProgressEvent[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * 1. FETCH BIKES
 */
export async function fetchCustomerBikesFromDb(
  userId: string,
  membershipNumber?: string
): Promise<CustomerBike[]> {
  const supabase = getSupabaseClient();
  const ownerIds = bikeOwnerIds(userId, membershipNumber);
  console.log(`[SUPABASE NET] SELECT customer_bikes for owners=${ownerIds.join(',')}`);
  try {
    let query = supabase.from('customer_bikes').select('*');
    // Match the profile UUID, and (for legacy rows written before the id
    // migration) an exact non-empty membership number. A blank membership must
    // NEVER be used as a filter — `eq.` matches every NULL/empty row and would
    // hand this customer the whole workshop's bikes.
    query = ownerIds.length > 1
      ? query.or(ownerIds.map((id) => `customer_id.eq.${id}`).join(','))
      : query.eq('customer_id', ownerIds[0]);

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
          bikeDetails: (row.bike_details as BikeDetails) || extraMeta.bikeDetails || undefined,
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
    const buildPayload = (includeBikeDetails: boolean) => {
      const payload: any = {
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
            // Always mirror the details into meta so they survive even on the
            // retry payload that omits the dedicated column.
            ...(bike.bikeDetails ? { bikeDetails: bike.bikeDetails } : {}),
          },
        },
      };
      // Only send the dedicated column when we know the live table has it; on an
      // older project the unknown column would fail the whole insert (PGRST204).
      if (includeBikeDetails && bike.bikeDetails) payload.bike_details = bike.bikeDetails;
      return payload;
    };

    let { error } = await supabase.from('customer_bikes').insert(buildPayload(true));
    if (error) {
      // Retry without the new column so the bike still saves on an unsynced DB.
      const retry = await supabase.from('customer_bikes').insert(buildPayload(false));
      error = retry.error;
    }

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
        bikeDetails: (row.bike_details as BikeDetails) || undefined,
        preferredDate: row.preferred_date,
        preferredTimeSlot: row.preferred_time_slot,
        notes: row.notes || undefined,
        referralCode: row.referral_code || undefined,
        status: row.status || 'pending',
        approvalStatus: row.approval_status || (row.status === 'confirmed' ? 'approved' : 'pending_approval'),
        approvedAt: row.approved_at || undefined,
        approvedBy: row.approved_by || undefined,
        declinedAt: row.declined_at || undefined,
        declineReason: row.decline_reason || undefined,
        staffNotes: row.staff_notes || undefined,
        quotedPrice: row.quoted_price !== null && row.quoted_price !== undefined ? Number(row.quoted_price) : undefined,
        quoteNote: row.quote_note || undefined,
        quoteSentAt: row.quote_sent_at || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        notifications: Array.isArray(row.notifications) ? row.notifications : [],
        reminder24hSent: Boolean(row.reminder_24h_sent),
        repairStage: (row.repair_stage as RepairStageId) || undefined,
        progressEvents: normalizeProgressEvents(row.progress_events),
        estimateReadyAt: row.estimate_ready_at || null,
        invoice: (row.invoice as RepairInvoice) || undefined,
        isSos: Boolean(row.is_sos),
        sosStatus: row.sos_status || undefined,
        sosLocationRequestedAt: row.sos_location_requested_at || undefined,
        sosLocationNote: row.sos_location_note || undefined,
        sosConfirmedAt: row.sos_confirmed_at || undefined,
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
    const buildPayload = (includeBikeDetails: boolean, includeSos: boolean) => {
      const payload: any = {
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
        repair_stage: booking.repairStage || null,
        progress_events: booking.progressEvents || [],
        estimate_ready_at: booking.estimateReadyAt || null,
      };
      if (includeBikeDetails && booking.bikeDetails) payload.bike_details = booking.bikeDetails;
      if (includeBikeDetails && booking.referralCode) payload.referral_code = booking.referralCode;
      if (includeSos && booking.isSos) {
        payload.is_sos = true;
        payload.sos_status = booking.sosStatus || 'requested';
      }
      return payload;
    };

    let { error } = await supabase.from('service_bookings').insert(buildPayload(true, true));
    if (error) {
      // Older project without the bike_details/referral_code columns — still
      // save the booking.
      const retry = await supabase.from('service_bookings').insert(buildPayload(false, true));
      error = retry.error;
    }
    if (error && booking.isSos) {
      // Older project without the SOS columns — fall back to the notes marker
      // so the job is still recognisable.
      const retry = await supabase.from('service_bookings').insert(buildPayload(true, false));
      error = retry.error;
    }

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
 * 8. DELETE BOOKING(S) — used by the staff "Clear Bookings" launch tool.
 */
export async function deleteServiceBookingFromDb(bookingId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from('service_bookings').delete().eq('id', bookingId);
    if (error) {
      console.error('[SUPABASE NET ERROR] DELETE service_bookings failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteServiceBookingFromDb:', err);
    return false;
  }
}

export async function deleteAllServiceBookingsFromDb(): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    // PostgREST requires a filter on DELETE; ids are the primary key so this
    // matches every row without needing to enumerate them.
    const { error } = await supabase
      .from('service_bookings')
      .delete()
      .not('id', 'is', null);
    if (error) {
      console.error('[SUPABASE NET ERROR] DELETE ALL service_bookings failed:', error.message);
      return false;
    }
    console.log('[SUPABASE NET SUCCESS] DELETE ALL service_bookings succeeded');
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteAllServiceBookingsFromDb:', err);
    return false;
  }
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
    if (updates.declinedAt) payload.declined_at = updates.declinedAt;
    if (updates.staffNotes) payload.staff_notes = updates.staffNotes;
    if (updates.quotedPrice !== undefined) payload.quoted_price = updates.quotedPrice;
    if (updates.quoteNote !== undefined) payload.quote_note = updates.quoteNote;
    if (updates.quoteSentAt) payload.quote_sent_at = updates.quoteSentAt;
    if (updates.reminder24hSent !== undefined) payload.reminder_24h_sent = updates.reminder24hSent;
    if (updates.notifications !== undefined) payload.notifications = updates.notifications;
    if (updates.repairStage !== undefined) payload.repair_stage = updates.repairStage;
    if (updates.progressEvents !== undefined) payload.progress_events = updates.progressEvents;
    if (updates.estimateReadyAt !== undefined) payload.estimate_ready_at = updates.estimateReadyAt;
    if (updates.bikeDetails !== undefined) payload.bike_details = updates.bikeDetails;
    if (updates.invoice !== undefined) payload.invoice = updates.invoice;
    if (updates.isSos !== undefined) payload.is_sos = updates.isSos;
    if (updates.sosStatus !== undefined) payload.sos_status = updates.sosStatus;
    if (updates.sosLocationRequestedAt !== undefined) payload.sos_location_requested_at = updates.sosLocationRequestedAt;
    if (updates.sosLocationNote !== undefined) payload.sos_location_note = updates.sosLocationNote;
    if (updates.sosConfirmedAt !== undefined) payload.sos_confirmed_at = updates.sosConfirmedAt;

    let { error } = await supabase
      .from('service_bookings')
      .update(payload)
      .eq('id', bookingId);

    // Newer optional columns (invoice, notifications, SOS fields) may not exist
    // on an older project. Drop the offending column(s) and retry so the rest
    // still persists.
    const OPTIONAL_COLUMNS = [
      'invoice',
      'notifications',
      'is_sos',
      'sos_status',
      'sos_location_requested_at',
      'sos_location_note',
      'sos_confirmed_at',
    ];
    for (const column of OPTIONAL_COLUMNS) {
      if (error && payload[column] !== undefined) {
        console.warn(`[SUPABASE NET] Retrying UPDATE without optional column "${column}"`);
        delete payload[column];
        const retry = await supabase.from('service_bookings').update(payload).eq('id', bookingId);
        error = retry.error;
      }
    }

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
  points?: number;
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
      merit_points: profile.points ?? 0,
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
  const uid = (log as any).user_id || log.customerId;
  const iso = log.timestamp instanceof Date ? log.timestamp.toISOString() : new Date().toISOString();
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
    timestamp: iso,
  };
  // Legacy schemas have a NOT NULL `user_id`; supply it when the customer id is
  // a real UUID so the row can land before the schema sync migration is run.
  if (uid && uuid.test(uid)) payload.user_id = uid;

  // These errors all mean "the live table does not match the app schema", which
  // the schema sync SQL fixes. Legacy columns are typed UUID on some projects.
  const isSchemaMismatch = (e: any): boolean =>
    e?.code === 'PGRST204' ||
    e?.code === '22P02' ||
    e?.code === '23502' ||
    e?.code === '23503' ||
    e?.code === '23514' ||
    e?.code === '42703' ||
    e?.code === '42501' ||
    e?.message?.includes('schema cache') ||
    e?.message?.includes('column') ||
    e?.message?.includes('schema');

  // Attempts are ordered most-complete -> most-minimal so that whichever
  // schema (current, legacy-uuid, or legacy points-ledger) the project has,
  // exactly one payload lands.
  //
  // Some projects' stamp_logs is an older points ledger whose `amount`
  // (CHECK <> 0), `source` (CHECK IN ('visit','wheel')) and `created_at` are
  // NOT NULL and are not columns the app otherwise writes; attempt 2 supplies
  // valid values so the row can land before the repair SQL drops them.
  // Attempt 3 keeps the full detail but drops `user_id`, because some projects
  // keep a FK from stamp_logs.user_id to profiles and the customer may not have
  // a profile row yet. Attempt 4 is the bare legacy shape for the oldest
  // schemas that lack even the app's named columns.
  const delta = (log.stampsAfter ?? 0) - (log.stampsBefore ?? 0);
  const ledger: any = {
    amount: delta !== 0 ? delta : log.action === 'redeem_reward' ? -1 : 1,
    source: 'visit',
    created_at: iso,
  };
  const withLedger: any = { ...payload, ...ledger };
  const noFk: any = { ...withLedger };
  delete noFk.user_id;

  const bare: any = { reason: log.note || log.action || 'stamp_event' };
  if (log.staffId) bare.staff_id = log.staffId;

  const attempts: any[] = [payload, withLedger, noFk, bare];

  let lastError: any = null;
  for (let i = 0; i < attempts.length; i++) {
    const { error } = await supabase.from('stamp_logs').insert(attempts[i]);
    if (!error) {
      if (i > 0) {
        console.warn('[SUPABASE NET] INSERT stamp_logs used legacy fallback payload.');
      }
      console.log(`[SUPABASE NET SUCCESS] INSERT stamp_logs succeeded for id=${log.id}`);
      return true;
    }
    lastError = error;
    if (!isSchemaMismatch(error)) {
      console.error('[SUPABASE NET ERROR] INSERT stamp_logs failed:', error.message);
      return false;
    }
  }

  if (!stampLogSchemaWarned) {
    stampLogSchemaWarned = true;
    console.error(
      '[SUPABASE NET ERROR] INSERT stamp_logs failed on all schemas:',
      lastError?.message,
      '— the loyalty tables are not reachable with the anon key. Open Service Status → “Copy SQL setup”, run it in the Supabase SQL Editor, then reload.'
    );
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
    points?: number;
    displayName?: string;
    phoneNumber?: string;
    avatarColor?: string;
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
    if (updates.points !== undefined) payload.merit_points = updates.points;
    if (updates.displayName !== undefined) payload.display_name = updates.displayName;
    if (updates.phoneNumber !== undefined) payload.phone = updates.phoneNumber;
    if (updates.avatarColor !== undefined) payload.avatar_color = updates.avatarColor;
    const spunIso =
      updates.lastSpunAt !== undefined
        ? updates.lastSpunAt instanceof Date
          ? updates.lastSpunAt.toISOString()
          : updates.lastSpunAt
        : undefined;
    if (updates.lastStampedAt !== undefined) {
      payload.last_stamped_at =
        updates.lastStampedAt instanceof Date
          ? updates.lastStampedAt.toISOString()
          : updates.lastStampedAt;
    }
    if (updates.lastSpunAt !== undefined) {
      payload.last_spun_at = spunIso;
    }
    // Keep the legacy last_spin_date mirror in sync with last_spun_at: the
    // fetch helpers fall back to it, so a cooldown set in one column but read
    // from the other let customers spin more than once a week.
    if (updates.lastSpinDate !== undefined) {
      payload.last_spin_date = updates.lastSpinDate;
    } else if (spunIso !== undefined) {
      payload.last_spin_date = spunIso;
    }

    // PATCH the existing row rather than upsert: profiles.display_name is NOT
    // NULL, and a partial upsert makes PostgREST build an INSERT candidate
    // (display_name omitted -> null) that is rejected with 23502 before conflict
    // resolution, so every balance/spin write failed. All callers target a row
    // already created by ensureProfileRowInDb / auth signup.
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('id');
    if (error) {
      console.error('[SUPABASE NET ERROR] UPDATE profiles failed:', error.message);
      return false;
    }
    if (!data || data.length === 0) {
      // No row to update (e.g. a profile created outside the signup trigger).
      // Create the minimal row, then apply the change.
      const ensured = await ensureProfileRowInDb({
        uid: userId,
        displayName: payload.display_name,
        membershipNumber,
      });
      if (!ensured) {
        console.error('[SUPABASE NET ERROR] UPDATE profiles found no row and could not create one.');
        return false;
      }
      const retry = await supabase.from('profiles').update(payload).eq('id', userId).select('id');
      if (retry.error) {
        console.error('[SUPABASE NET ERROR] UPDATE profiles retry failed:', retry.error.message);
        return false;
      }
    }
    console.log(`[SUPABASE NET SUCCESS] UPDATE profiles succeeded for userId=${userId}`);
    return true;
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
        avatarColor: row.avatar_color || undefined,
        role: row.role || 'customer',
        membershipNumber: row.membership_number,
        stamps: row.stamps !== undefined ? row.stamps : 0,
        tickets: row.completed_cards !== undefined ? row.completed_cards : 0,
        points: row.merit_points !== undefined ? row.merit_points : 0,
        lastStampedAt: row.last_stamped_at ? new Date(row.last_stamped_at) : undefined,
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
  const { profiles } = await fetchAllProfilesFromDbDetailed();
  return profiles;
}

/**
 * Same as fetchAllProfilesFromDb but also reports the underlying error (e.g. an
 * RLS/permission denial) so callers can distinguish "empty" from "denied".
 */
export async function fetchAllProfilesFromDbDetailed(): Promise<{
  profiles: UserProfile[];
  error?: string;
}> {
  const supabase = getSupabaseClient();
  console.log('[SUPABASE NET] SELECT ALL profiles');
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT ALL profiles failed:', error.message);
      return { profiles: [], error: error.message };
    }

    if (data && data.length > 0) {
      return {
        profiles: data.map((row: any) => ({
          uid: row.id,
          email: row.email,
          displayName: row.display_name,
          role: row.role || 'customer',
          membershipNumber: row.membership_number,
          stamps: row.stamps !== undefined ? row.stamps : 0,
          tickets: row.completed_cards !== undefined ? row.completed_cards : 0,
          points: row.merit_points !== undefined ? row.merit_points : 0,
          phoneNumber: row.phone || undefined,
          lastStampedAt: row.last_stamped_at ? new Date(row.last_stamped_at) : undefined,
          lastSpunAt: row.last_spun_at
            ? new Date(row.last_spun_at)
            : row.last_spin_date
            ? new Date(row.last_spin_date)
            : undefined,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        })),
      };
    }
    return { profiles: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SUPABASE NET EXCEPTION] fetchAllProfilesFromDb:', err);
    return { profiles: [], error: message };
  }
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_members' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on staff_members');
          onChanged('staff_members');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promotions' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on promotions');
          onChanged('promotions');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => {
          console.log('[SUPABASE REALTIME] Change detected on app_settings');
          onChanged('app_settings');
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
 * 8. STAFF ROSTER, PROMOTIONS & APP SETTINGS (staff-editable)
 * ------------------------------------------------------------------ */

export async function fetchStaffMembersFromDb(): Promise<StaffMember[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] fetch staff_members failed:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      role: (row.role || 'Mechanic') as StaffMember['role'],
      status: (row.status || 'Active') as StaffMember['status'],
      joinedDate: row.joined_date || '',
      certificationLevel: row.certification_level || undefined,
      avatarColor: row.avatar_color || undefined,
      notes: row.notes || undefined,
    }));
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchStaffMembersFromDb:', err);
    return [];
  }
}

export async function upsertStaffMemberToDb(staff: StaffMember): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      status: staff.status,
      joined_date: staff.joinedDate || null,
      certification_level: staff.certificationLevel || null,
      avatar_color: staff.avatarColor || null,
      notes: staff.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('staff_members').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] upsert staff_members failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertStaffMemberToDb:', err);
    return false;
  }
}

export async function deleteStaffMemberFromDb(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from('staff_members').delete().eq('id', id);
    if (error) {
      console.error('[SUPABASE NET ERROR] delete staff_members failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteStaffMemberFromDb:', err);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * 8b. STAFF LOGINS (auth accounts with a staff/admin profile role)
 *
 * These go through SECURITY DEFINER RPCs defined in
 * supabase/migrations/20261004_staff_accounts.sql. An anon-key client cannot
 * mint a staff login, so the browser never touches auth.admin or the role
 * column directly.
 * ------------------------------------------------------------------ */

export type StaffAccountRole = 'staff' | 'admin';

export interface StaffAccount {
  id: string;
  email: string;
  displayName: string;
  role: StaffAccountRole;
  createdAt: string;
}

export async function fetchStaffAccountsFromDb(): Promise<StaffAccount[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.rpc('list_staff_accounts');
    if (error) {
      console.error('[SUPABASE NET ERROR] list_staff_accounts failed:', error.message);
      return [];
    }
    return ((data || []) as any[]).map((row) => ({
      id: row.id,
      email: row.email || '',
      displayName: row.display_name || '',
      role: row.role === 'admin' ? 'admin' : 'staff',
      createdAt: row.created_at || '',
    }));
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchStaffAccountsFromDb:', err);
    return [];
  }
}

/**
 * Reports whether the staff-account RPCs from
 * `supabase/migrations/20261004_staff_accounts.sql` are installed on the live
 * project. The RPCs are admin-gated, so an admin caller gets rows back and a
 * missing function surfaces as a "does not exist" / schema-cache error.
 */
export async function staffAccountsInstalled(): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.rpc('list_staff_accounts');
    if (!error) return true;
    const m = (error.message || '').toLowerCase();
    return !(
      m.includes('does not exist') ||
      m.includes('could not find the function') ||
      m.includes('schema cache')
    );
  } catch {
    return false;
  }
}

export async function createStaffAccountViaRpc(
  email: string,
  password: string,
  displayName: string,
  role: StaffAccountRole
): Promise<{ success: boolean; message?: string; id?: string }> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.rpc('create_staff_account', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
      p_display_name: displayName?.trim() || null,
      p_role: role,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, id: data as string };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not create the staff account.' };
  }
}

export async function setStaffRoleViaRpc(
  userId: string,
  role: 'customer' | StaffAccountRole
): Promise<{ success: boolean; message?: string }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.rpc('set_staff_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not update the role.' };
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function fetchPromotionsFromDb(): Promise<ShopPromotion[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] fetch promotions failed:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title || '',
      subtitle: row.subtitle || '',
      code: row.code || '',
      discountPercentage: row.discount_percentage != null ? Number(row.discount_percentage) : undefined,
      discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
      badgeText: row.badge_text || '',
      status: (row.status || 'active') as ShopPromotion['status'],
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      termsAndConditions: normalizeStringArray(row.terms_and_conditions),
      eligibleCategories: normalizeStringArray(row.eligible_categories) as ShopPromotion['eligibleCategories'],
      bgGradient: row.bg_gradient || '',
      featured: row.featured === true,
      imageUrl: row.image_url || undefined,
    }));
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchPromotionsFromDb:', err);
    return [];
  }
}

export async function upsertPromotionToDb(promo: ShopPromotion): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: promo.id,
      title: promo.title,
      subtitle: promo.subtitle || null,
      code: promo.code || null,
      discount_percentage: promo.discountPercentage != null ? promo.discountPercentage : null,
      discount_amount: promo.discountAmount != null ? promo.discountAmount : null,
      badge_text: promo.badgeText || null,
      status: promo.status,
      start_date: promo.startDate || null,
      end_date: promo.endDate || null,
      terms_and_conditions: promo.termsAndConditions || [],
      eligible_categories: promo.eligibleCategories || [],
      bg_gradient: promo.bgGradient || null,
      featured: promo.featured === true,
      image_url: promo.imageUrl || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('promotions').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] upsert promotions failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertPromotionToDb:', err);
    return false;
  }
}

export async function deletePromotionFromDb(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) {
      console.error('[SUPABASE NET ERROR] delete promotions failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deletePromotionFromDb:', err);
    return false;
  }
}

export interface AppSettings {
  ownerEmail: string;
  ownerPhone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  businessName: string;
  automatedRemindersEnabled: boolean;
  remindersPushOnly: boolean;
  reminderOwnerEmail: string;
}

export async function fetchAppSettingsFromDb(): Promise<Partial<AppSettings> | null> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      console.error('[SUPABASE NET ERROR] fetch app_settings failed:', error.message);
      return null;
    }
    if (!data) return null;
    const row = data as any;
    return {
      ownerEmail: row.owner_email || '',
      ownerPhone: row.owner_phone || '',
      emailAlertsEnabled: row.email_alerts_enabled === true,
      smsAlertsEnabled: row.sms_alerts_enabled === true,
      businessName: row.business_name || undefined,
      automatedRemindersEnabled:
        row.automated_reminders_enabled == null ? undefined : row.automated_reminders_enabled === true,
      remindersPushOnly: row.reminders_push_only == null ? undefined : row.reminders_push_only === true,
      reminderOwnerEmail: row.reminder_owner_email || undefined,
    };
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchAppSettingsFromDb:', err);
    return null;
  }
}

export async function upsertAppSettingsToDb(settings: Partial<AppSettings>): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
    if (settings.ownerEmail !== undefined) payload.owner_email = settings.ownerEmail;
    if (settings.ownerPhone !== undefined) payload.owner_phone = settings.ownerPhone;
    if (settings.emailAlertsEnabled !== undefined) payload.email_alerts_enabled = settings.emailAlertsEnabled;
    if (settings.smsAlertsEnabled !== undefined) payload.sms_alerts_enabled = settings.smsAlertsEnabled;
    if (settings.businessName !== undefined) payload.business_name = settings.businessName;
    if (settings.automatedRemindersEnabled !== undefined) {
      payload.automated_reminders_enabled = settings.automatedRemindersEnabled;
    }
    if (settings.remindersPushOnly !== undefined) payload.reminders_push_only = settings.remindersPushOnly;
    if (settings.reminderOwnerEmail !== undefined) payload.reminder_owner_email = settings.reminderOwnerEmail;
    const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] upsert app_settings failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertAppSettingsToDb:', err);
    return false;
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
    segments: normalizeWheelSegments(row.segments),
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

/**
 * Wheels seeded before the merits->points rename persist `rewardType: 'merit'`.
 * Normalise on read so those segments still award points instead of silently
 * falling through to a voucher.
 */
function normalizeWheelSegments(segments: unknown): PrizeWheelSegment[] {
  if (!Array.isArray(segments)) return [];
  return segments.map((seg: any) =>
    seg && seg.rewardType === 'merit' ? { ...seg, rewardType: 'points' } : seg
  );
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
    audience: row.audience === 'member' || row.audience === 'public' ? row.audience : undefined,
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
  const buildPayload = (includeAudience: boolean) => {
    const payload: Record<string, unknown> = {
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
    // Only send the new column when the live table has it; an unknown column
    // would otherwise fail the whole upsert on an unsynced project (PGRST204).
    if (includeAudience) payload.audience = code.audience || null;
    return payload;
  };
  try {
    let { error } = await supabase
      .from('discount_codes')
      .upsert(buildPayload(true), { onConflict: 'id' });
    if (error) {
      // Retry without the audience column so the code still saves.
      const retry = await supabase
        .from('discount_codes')
        .upsert(buildPayload(false), { onConflict: 'id' });
      error = retry.error;
    }
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

function mapReferralRow(row: any): ReferralRecord {
  return {
    id: row.id,
    ownerUid: row.owner_uid || '',
    ownerName: row.owner_name || 'Stakey’s Customer',
    ownerMembership: row.owner_membership || undefined,
    code: row.code || '',
    link: row.link || '',
    timesShared: Number(row.times_shared) || 0,
    rewardsEarned: Number(row.rewards_earned) || 0,
    rewards: Array.isArray(row.rewards) ? row.rewards : [],
    referredFriends: Array.isArray(row.referred_friends) ? row.referred_friends : [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export async function fetchReferralsFromDb(): Promise<ReferralRecord[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT referrals failed:', error.message);
      return [];
    }
    return (data || []).map(mapReferralRow);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchReferralsFromDb:', err);
    return [];
  }
}

export async function upsertReferralToDb(referral: ReferralRecord): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const payload = {
      id: referral.id,
      owner_uid: referral.ownerUid,
      owner_name: referral.ownerName,
      owner_membership: referral.ownerMembership || null,
      code: referral.code,
      link: referral.link,
      times_shared: referral.timesShared || 0,
      rewards_earned: referral.rewardsEarned || 0,
      rewards: referral.rewards || [],
      referred_friends: referral.referredFriends || [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('referrals').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT referrals failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertReferralToDb:', err);
    return false;
  }
}

/** Removes a referral row (used by the test bench to clean up a sentinel). */
export async function deleteReferralFromDb(referralId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from('referrals').delete().eq('id', referralId);
    if (error) {
      console.error('[SUPABASE NET ERROR] DELETE referrals failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deleteReferralFromDb:', err);
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
    discountSource: row.discount_source || undefined,
    grandTotal: Number(row.grand_total) || 0,
    paymentMethod: row.payment_method || 'unpaid',
    staffUid: row.staff_uid || undefined,
    staffName: row.staff_name || undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    status: row.status || 'completed',
    quote:
      row.quoted_amount != null
        ? {
            amount: Number(row.quoted_amount),
            note: row.quote_note || undefined,
            sentAt: row.quote_sent_at || undefined,
            sentBy: row.quote_sent_by || undefined,
          }
        : undefined,
    approvedAt: row.approved_at || undefined,
    approvedBy: row.approved_by || undefined,
    declinedAt: row.declined_at || undefined,
    declineReason: row.decline_reason || undefined,
  };
}

/** Supabase columns for the quote/approval lifecycle, shared by insert + update. */
function saleLifecycleColumns(sale: SaleTransaction) {
  return {
    status: sale.status || 'completed',
    quoted_amount: sale.quote?.amount ?? null,
    quote_note: sale.quote?.note ?? null,
    quote_sent_at: sale.quote?.sentAt ? new Date(sale.quote.sentAt).toISOString() : null,
    quote_sent_by: sale.quote?.sentBy ?? null,
    approved_at: sale.approvedAt ? new Date(sale.approvedAt).toISOString() : null,
    approved_by: sale.approvedBy ?? null,
    declined_at: sale.declinedAt ? new Date(sale.declinedAt).toISOString() : null,
    decline_reason: sale.declineReason ?? null,
  };
}

const iso = (value: unknown) =>
  value ? new Date(value as string | number | Date).toISOString() : null;

/**
 * Builds a lifecycle PATCH for an existing sale. Only the fields actually being
 * changed are emitted, so approving a quote keeps the quote that was sent (a
 * blind `saleLifecycleColumns(updates)` would null it out because the caller
 * does not repeat the quote on approval).
 */
function saleLifecyclePatch(
  existing: SaleTransaction,
  updates: Partial<SaleTransaction>
): Record<string, any> {
  const merged: SaleTransaction = { ...existing, ...updates };
  const patch: Record<string, any> = {};
  if (updates.status !== undefined) patch.status = merged.status || 'completed';
  if (updates.quote !== undefined) {
    patch.quoted_amount = merged.quote?.amount ?? null;
    patch.quote_note = merged.quote?.note ?? null;
    patch.quote_sent_at = iso(merged.quote?.sentAt);
    patch.quote_sent_by = merged.quote?.sentBy ?? null;
  }
  if (updates.approvedAt !== undefined) patch.approved_at = iso(merged.approvedAt);
  if (updates.approvedBy !== undefined) patch.approved_by = merged.approvedBy ?? null;
  if (updates.declinedAt !== undefined) patch.declined_at = iso(merged.declinedAt);
  if (updates.declineReason !== undefined) patch.decline_reason = merged.declineReason ?? null;
  return patch;
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
      discount_source: sale.discountSource || null,
      grand_total: sale.grandTotal,
      payment_method: sale.paymentMethod,
      staff_uid: sale.staffUid || null,
      staff_name: sale.staffName || null,
      created_at: sale.createdAt ? new Date(sale.createdAt).toISOString() : new Date().toISOString(),
      ...saleLifecycleColumns(sale),
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

/** Persist a change to an existing counter sale (quote sent, approved, paid…). */
export async function updateCounterSaleInDb(
  saleId: string,
  updates: Partial<SaleTransaction>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  try {
    // Read the current row so a lifecycle change (e.g. approve) does not wipe the
    // quote that was already sent, and so we only PATCH fields that changed.
    const { data: row, error: readError } = await supabase
      .from('counter_sales')
      .select('*')
      .eq('id', saleId)
      .maybeSingle();
    if (readError) {
      console.error('[SUPABASE NET ERROR] SELECT counter_sales (update) failed:', readError.message);
      return false;
    }
    if (!row) {
      console.error(`[SUPABASE NET ERROR] counter_sales row ${saleId} not found; cannot update.`);
      return false;
    }

    const existing = mapSaleRow(row);
    const payload: Record<string, any> = saleLifecyclePatch(existing, updates);
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
    if (updates.grandTotal !== undefined) payload.grand_total = updates.grandTotal;
    if (updates.discount !== undefined) payload.discount = updates.discount;
    if (updates.items !== undefined) payload.items = updates.items;
    if (Object.keys(payload).length === 0) return true;

    // PATCH the existing row: a partial upsert would build an INSERT candidate
    // (items is NOT NULL) that PostgREST rejects with 23502 before conflict
    // resolution, so the quote/approve lifecycle never persisted.
    const { error } = await supabase.from('counter_sales').update(payload).eq('id', saleId);
    if (error) {
      console.error('[SUPABASE NET ERROR] UPDATE counter_sales failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] updateCounterSaleInDb:', err);
    return false;
  }
}

