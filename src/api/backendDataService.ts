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
} from '../types/bikeShop';
import { INITIAL_USERS, INITIAL_STAMP_LOGS } from '../data/initialData';
import { INITIAL_BOOKINGS } from '../data/bookingServices';

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

  const defaultUser = INITIAL_USERS.find(
    (u) => u.uid === userId || (membershipNumber && u.membershipNumber === membershipNumber)
  );
  return defaultUser?.bikes || [];
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

  return INITIAL_BOOKINGS;
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

  return INITIAL_STAMP_LOGS;
}

/**
 * 9. INSERT STAMP LOG
 */
export async function insertStampLogToDb(log: StampLog): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] INSERT stamp_logs id=${log.id}`);
  try {
    const payload = {
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

    const { error } = await supabase.from('stamp_logs').insert(payload);
    if (!error) {
      console.log(`[SUPABASE NET SUCCESS] INSERT stamp_logs succeeded for id=${log.id}`);
      return true;
    } else {
      console.error('[SUPABASE NET ERROR] INSERT stamp_logs failed:', error.message);
    }
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
        lastSpunAt: row.last_spin_date ? new Date(row.last_spin_date) : undefined,
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
    } else {
      console.log(`[SUPABASE NET SUCCESS] SELECT ALL profiles returned ${data?.length || 0} rows`);
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
        lastSpunAt: row.last_spin_date ? new Date(row.last_spin_date) : undefined,
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

/**
 * 14. SEED INITIAL DATA
 */
export async function seedInitialDatabaseIfEmpty(): Promise<void> {
  const supabase = getSupabaseClient();
  console.log('[SUPABASE NET] Checking if database needs initial seeding...');

  try {
    const { count: profileCount, error: profileErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!profileErr && (profileCount === null || profileCount === 0)) {
      console.log('[SUPABASE NET] Profiles table empty. Seeding initial profiles...');
      for (const user of INITIAL_USERS) {
        await supabase.from('profiles').upsert({
          id: user.uid,
          membership_number: user.membershipNumber,
          email: user.email,
          display_name: user.displayName,
          phone: user.phoneNumber || null,
          role: user.role,
          stamps: user.stamps || 0,
          completed_cards: user.tickets || 0,
          merit_points: user.merits || 0,
          last_spin_date: user.lastSpunAt ? user.lastSpunAt.toISOString() : null,
        }, { onConflict: 'id' });
      }
      console.log('[SUPABASE NET SUCCESS] Initial profiles seeded successfully');
    }

    const { count, error } = await supabase
      .from('customer_bikes')
      .select('*', { count: 'exact', head: true });

    if (!error && (count === null || count === 0)) {
      console.log('[SUPABASE NET] customer_bikes table empty. Seeding initial bikes...');
      for (const user of INITIAL_USERS) {
        if (user.bikes && user.bikes.length > 0) {
          for (const bike of user.bikes) {
            await insertCustomerBikeToDb(bike, user.uid);
          }
        }
      }
      console.log('[SUPABASE NET SUCCESS] Initial garage bikes seeded successfully');
    }
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] seedInitialDatabaseIfEmpty:', err);
  }
}
