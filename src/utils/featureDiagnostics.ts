/**
 * Staff diagnostics engine.
 *
 * Runs a catalogue of live read/write tests against the configured Supabase
 * project so staff can see at a glance which backend features work and which
 * have silently broken (usually schema drift). Every write test is
 * non-destructive: rows are created under a sentinel id and removed again.
 */
import { getSupabaseClient } from '../lib/supabase';
import { checkSupabaseHealth } from '../api/supabaseService';
import {
  insertCustomerBikeToDb,
  insertServiceBookingToDb,
  insertStampLogToDb,
  insertVoucherToDb,
  insertCounterSaleToDb,
  upsertStaffMemberToDb,
  upsertPromotionToDb,
  upsertPrizeDrawToDb,
  upsertDiscountCodeToDb,
  upsertPrizeWheelToDb,
  upsertAppSettingsToDb,
  updateServiceBookingInDb,
  updateCounterSaleInDb,
  updateVoucherStatusInDb,
  updateUserProfileInDb,
  updateCustomerBikeSpecsInDb,
  incrementDiscountUsageInDb,
  subscribeToDatabaseChanges,
  deleteCustomerBikeFromDb,
  deleteStaffMemberFromDb,
  deletePromotionFromDb,
  deleteDiscountCodeFromDb,
  deleteServiceBookingFromDb,
  upsertReferralToDb,
  deleteReferralFromDb,
} from '../api/backendDataService';
import {
  validateDiscountCode,
  computeSaleTotals,
  voucherToDiscountState,
  roundMoney,
  findDiscountCode,
} from '../utils/discountService';
import { websiteDiscountCatalogue, WEBSITE_DISCOUNT_FALLBACK, inferAudience } from '../utils/websiteDiscounts';
import { buildFinancialLedger, summarizeLedger, workshopPaymentLabel } from '../utils/financials';
import { canCustomerReceiveStampToday } from '../api/firebaseService';
import { generateMembershipNumber, generateBarcodeValue } from '../api/firebaseService';
import {
  fetchAllProfilesFromDbDetailed,
  fetchBikesByOwner,
} from '../api/backendDataService';
import {
  hydrateRosterGarages,
  ownerKeysForProfile,
  ownerKeysForProfiles,
} from '../utils/garageHydration';
import { planBalanceProbe } from '../utils/schemaSync';
import { generateBookingEmailHtml } from '../utils/notificationService';
import { moonPhase, ridingConditionsFor, syntheticWeatherReport } from '../utils/weatherService';
import {
  encodeMembership,
  encodeMembershipPayload,
  normalizeScannedCode,
  parseMembershipPayload,
  resolveCustomer,
  membershipBalance,
} from '../utils/membershipCode';
import { encodeItemCode, itemCodeForProduct, resolveItemByCode } from '../utils/itemCode';
import { classifyBookingChannel, didConvert, summarizePerformance } from '../utils/performanceTracker';
import { evaluatePromotionsExpiry } from '../utils/promotionUtils';
import { BOOKING_LANGUAGES, getPhrases, isRtlLanguage } from '../utils/bookingTranslator';
import type {
  CustomerBike,
  ServiceBooking,
  StampLog,
  StaffMember,
  ShopPromotion,
  DiscountCode,
  SaleTransaction,
  PrizeDraw,
  CollectedVoucher,
  ReferralRecord,
} from '../types/bikeShop';

export type FeatureArea =
  | 'connectivity'
  | 'loyalty'
  | 'bookings'
  | 'till'
  | 'members'
  | 'garage'
  | 'prizes'
  | 'content'
  | 'settings'
  | 'reach'
  | 'email'
  | 'scanner'
  | 'logic';

export type TestStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface FeatureTestResult {
  id: string;
  area: FeatureArea;
  label: string;
  status: TestStatus;
  detail: string;
  ms: number;
  /** When true the test writes a temporary row and deletes it again. */
  writes?: boolean;
  /** Extra info a staff member can act on when the test fails. */
  hint?: string;
  /** App tables this test exercises, used to generate a focused fix SQL. */
  tables?: string[];
  /** True when the failure is the self-test's own synthetic-id limitation. */
  selfTestLimited?: boolean;
}

export interface FeatureTest {
  id: string;
  area: FeatureArea;
  label: string;
  description: string;
  writes?: boolean;
  /** App tables this test exercises, used to generate a focused fix SQL. */
  tables?: string[];
  /** Marks a test that cannot fully self-test against the live schema. */
  selfTestLimited?: boolean;
  run: () => Promise<{ status: TestStatus; detail: string; hint?: string; selfTestLimited?: boolean }>;
}

export const AREA_LABELS: Record<FeatureArea, string> = {
  connectivity: 'Connectivity & Auth',
  loyalty: 'Loyalty / Stamps / Wheel',
  bookings: 'Repair Bookings',
  till: 'Till & Discounts',
  members: 'Members & Bikes',
  garage: 'Garage: Bikes Showing (step by step)',
  prizes: 'Prizes & Vouchers',
  content: 'Staff, Promotions & Draws',
  settings: 'Settings & Theme',
  reach: 'Push & Email Delivery',
  email: 'Transactional Email',
  scanner: 'Scanner & Codes',
  logic: 'Pure Logic (offline)',
};

const SENTINEL = '__stakeys_diag__';
const sentinel = (suffix: string) => `${SENTINEL}${suffix}`;
const diagBookingId = () => `${SENTINEL}booking-${Date.now()}`;

function err(e: unknown): string {
  const anyE = e as any;
  return anyE?.message || anyE?.error_description || String(e);
}

/** Short content-type of a fetch Response, for clearer endpoint failures. */
function friendlyType(res: Response): string {
  const ct = res.headers?.get?.('content-type') || 'unknown';
  return ct.split(';')[0];
}

/** Maps a raw PostgREST/Postgres failure onto a plain-English hint. */
function hintFor(message: string): string | undefined {
  if (/PGRST204|schema cache|column .* does not exist|does not exist/i.test(message)) {
    return 'Schema drift: the live table is missing a column the app writes. Run supabase/repair_schema_drift.sql.';
  }
  if (/42501|permission denied|row-level security/i.test(message)) {
    return 'Missing table GRANT / RLS policy for anon+authenticated. Re-run the grants section of the repair SQL.';
  }
  if (/22P02|invalid input syntax for type uuid/i.test(message)) {
    return 'Column type mismatch (live column is uuid but the app writes text ids). Convert the id column to text.';
  }
  if (/23502|not-null/i.test(message)) {
    return 'A NOT NULL column has no default and the app sends null. Drop NOT NULL or add a default.';
  }
  if (/23514|check constraint/i.test(message)) {
    return 'A CHECK constraint rejects a value the app writes. Widen the allowed values.';
  }
  if (/404|not found/i.test(message)) {
    return 'Edge function not deployed. Deploy it with `supabase functions deploy`.';
  }
  return undefined;
}

/** Reads a table directly so schema/permission errors surface (the fetch* helpers swallow them). */
async function probeRead(table: string, orderBy?: string) {
  const client = getSupabaseClient();
  let query = client.from(table).select('*').limit(5);
  if (orderBy) query = query.order(orderBy, { ascending: false });
  const { data, error } = await query;
  if (error) return { status: 'fail' as const, detail: error.message, hint: hintFor(error.message) };
  return { status: 'pass' as const, detail: `${table} reachable — ${data?.length ?? 0} row(s) readable.` };
}

/** Confirms a column on a just-written row holds the expected value. */
async function verifyColumn(
  table: string,
  id: string | number,
  column: string,
  expected: unknown
): Promise<{ ok: boolean; detail: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (error) return { ok: false, detail: error.message };
  if (!data) return { ok: false, detail: `row ${id} not found after update` };
  const actual = (data as any)[column];
  const norm = (v: unknown) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const ok = norm(actual) === norm(expected);
  return { ok, detail: ok ? `${column} persisted` : `${column} = ${norm(actual)} (expected ${norm(expected)})` };
}

/** Builds a booking payload shaped exactly like the customer booking form. */
function makeDiagBooking(id: string, overrides: Partial<ServiceBooking> = {}): ServiceBooking {
  return {
    id,
    customerName: 'Diagnostics Probe',
    customerEmail: 'diagnostics@example.com',
    customerPhone: '07000000000',
    serviceId: 'diag-service',
    serviceTitle: 'Diagnostics Service',
    servicePrice: 0,
    vehicleCategory: 'cycle',
    vehicleModel: 'Diagnostics Model',
    preferredDate: new Date().toISOString().slice(0, 10),
    preferredTimeSlot: 'AM',
    notes: 'diagnostics probe',
    status: 'pending',
    reminder24hSent: false,
    ...overrides,
  } as ServiceBooking;
}

/** Builds a counter-sale payload shaped like the till. */
function makeDiagSale(id: string): SaleTransaction {
  return {
    id,
    saleNumber: 'DIAG-0001',
    customerName: 'Diagnostics Probe',
    items: [{ id: 'diag', name: 'Diagnostics item', quantity: 1, unitPrice: 10 }],
    subtotal: 10,
    vatRate: 0.2,
    vatAmount: 2,
    discount: 0,
    grandTotal: 12,
    paymentMethod: 'card',
    staffName: 'Diagnostics',
    createdAt: new Date(),
    status: 'completed',
  } as unknown as SaleTransaction;
}

/**
 * Records which areas a manual run has actually exercised, so the Test Bench can
 * flag a feature whose checks have never been run (the app self-verifies live).
 */
const VERIFIED_KEY = 'stakeys_test_bench_verified_areas';

export function getVerifiedAreas(): FeatureArea[] {
  try {
    const raw = localStorage.getItem(VERIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as FeatureArea[]) : [];
  } catch {
    return [];
  }
}

export function markAreasVerified(areas: FeatureArea[]): void {
  try {
    const merged = Array.from(new Set([...getVerifiedAreas(), ...areas]));
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage unavailable — the badge is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Test catalogue
// ---------------------------------------------------------------------------
export const FEATURE_TESTS: FeatureTest[] = [
  // ---- Connectivity -------------------------------------------------------
  {
    id: 'supabase-health',
    area: 'connectivity',
    label: 'Supabase reachable & anon key valid',
    description: 'Pings the auth gateway and checks the key authenticates.',
    run: async () => {
      const res = await checkSupabaseHealth();
      if (res.isOnline) {
        return { status: 'pass', detail: `${res.message || 'Online'}${res.latencyMs ? ` (${res.latencyMs}ms)` : ''}` };
      }
      return {
        status: 'fail',
        detail: res.error || res.message || 'Supabase not reachable.',
        hint: 'Check the Supabase URL/anon key in Settings and that the project is not paused.',
      };
    },
  },
  {
    id: 'auth-gateway',
    area: 'connectivity',
    label: 'Auth gateway responds',
    description: 'Calls /auth/v1/settings to confirm login/signup endpoints are live.',
    run: async () => {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.getSession();
        if (error) return { status: 'warn', detail: `Session lookup error: ${error.message}` };
        const url: string = (client as any)?.supabaseUrl || '';
        const anon = (client as any)?.supabaseKey;
        const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        });
        if (!res.ok) return { status: 'fail', detail: `Auth settings HTTP ${res.status}` };
        const settings = await res.json();
        const providers = Object.entries(settings.external || {})
          .filter(([, on]) => on)
          .map(([k]) => k);
        return {
          status: 'pass',
          detail: `Auth online. Providers: ${providers.join(', ') || 'email'}. Confirmation required: ${!settings.mailer_autoconfirm}.`,
        };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  {
    id: 'realtime-subscribe',
    area: 'connectivity',
    label: 'Realtime change subscription',
    description: 'Opens the live postgres_changes channel and confirms it subscribes.',
    run: async () => {
      const client = getSupabaseClient();
      return new Promise((resolve) => {
        const unsubscribe = subscribeToDatabaseChanges(() => {});
        const started = Date.now();
        const poll = setInterval(() => {
          const channels = ((client as any).getChannels?.() || []) as any[];
          const ch =
            channels.find((c) => String(c.topic || '').includes('stakeys-shop-realtime-sync')) ||
            channels[channels.length - 1];
          const state = ch?.state;
          const done = (status: TestStatus, detail: string, hint?: string) => {
            clearInterval(poll);
            try {
              unsubscribe();
            } catch {}
            resolve({ status, detail, hint });
          };
          if (state === 'joined') {
            done('pass', 'Realtime channel subscribed (postgres_changes live).');
          } else if (state === 'errored') {
            done('fail', 'Realtime channel errored.', 'Enable Realtime for the tables in Supabase → Database → Replication.');
          } else if (Date.now() - started > 6000) {
            done('warn', `Realtime not confirmed within 6s (state: ${state || 'unknown'}).`);
          }
        }, 250);
      });
    },
  },

  // ---- Loyalty ------------------------------------------------------------
  {
    id: 'profiles-read',
    tables: ['profiles'],
    area: 'loyalty',
    label: 'Read loyalty members (profiles)',
    description: 'Selects every profile row.',
    run: () => probeRead('profiles'),
  },
  {
    id: 'stamp-log-read',
    tables: ['stamp_logs'],
    area: 'loyalty',
    label: 'Read stamp / reward history',
    description: 'Selects stamp_logs for staff view.',
    run: () => probeRead('stamp_logs', 'timestamp'),
  },
  {
    id: 'stamp-log-write',
    tables: ['stamp_logs'],
    area: 'loyalty',
    label: 'Write stamp / reward history',
    description: 'Inserts a temporary stamp_logs row (stamp + point + audit trail) then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`stamp-${Date.now()}`);
      const now = new Date();
      const log: StampLog = {
        id,
        customerId: sentinel('customer'),
        customerName: 'Diagnostics',
        membershipNumber: 'STK-DIAG',
        staffId: sentinel('staff'),
        staffName: 'Diagnostics',
        action: 'add_stamp',
        stampsBefore: 0,
        stampsAfter: 1,
        timestamp: now,
        note: 'diagnostics probe',
      };
      try {
        const ok = await insertStampLogToDb(log);
        const client = getSupabaseClient();
        await client.from('stamp_logs').delete().eq('id', id);
        return ok
          ? { status: 'pass', detail: 'Stamp history row written and cleaned up.' }
          : {
              status: 'fail',
              detail: 'Insert rejected — stamp history will not persist.',
              hint: 'stamp_logs still carries legacy columns (amount / source / created_at) that are NOT NULL or CHECK-constrained, so the app payload is rejected. Run the repair SQL.',
            };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'stamp-rate-limit',
    area: 'loyalty',
    label: 'Stamp rate-limit rule',
    description: 'Confirms the one-stamp-per-day rule evaluates.',
    run: async () => {
      const fresh = canCustomerReceiveStampToday({
        uid: 'diag',
        stamps: 0,
        lastStampedAt: undefined,
      } as any);
      const used = canCustomerReceiveStampToday({
        uid: 'diag',
        stamps: 1,
        lastStampedAt: new Date(),
      } as any);
      if (fresh.allowed && !used.allowed) {
        return { status: 'pass', detail: 'New customer allowed; same-day repeat blocked.' };
      }
      return {
        status: 'warn',
        detail: `fresh=${fresh.allowed}, sameDay=${used.allowed} (${used.reason || fresh.reason || 'no reason'})`,
      };
    },
  },
  {
    id: 'profile-balance-write',
    area: 'loyalty',
    label: 'Write stamp / ticket / point balance',
    description: 'Writes sentinel balance values to a real member profile (then restores them), using the same path as addStamp.',
    writes: true,
    tables: ['profiles'],
    run: async () => {
      const client = getSupabaseClient();
      // profiles.id is uuid with a FK to auth.users, so a synthetic row is
      // impossible. Probe a real profile instead and restore it afterwards.
      const { data: row, error: readError } = await client
        .from('profiles')
        .select('id, membership_number, stamps, completed_cards, merit_points, last_spin_date')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (readError) {
        return { status: 'fail', detail: readError.message, hint: hintFor(readError.message) };
      }
      if (!row) {
        return {
          status: 'warn',
          detail: 'No profile rows exist yet, so there is nothing to probe.',
          hint: 'Balance writes cannot be exercised until at least one member profile exists.',
        };
      }

      const plan = planBalanceProbe(row as any);
      let probeOk = false;
      let writeError: string | undefined;
      try {
        probeOk = await updateUserProfileInDb(plan.id, plan.membershipNumber, {
          stamps: plan.probe.stamps,
          tickets: plan.probe.tickets,
          points: plan.probe.points,
          lastSpinDate: new Date().toISOString(),
        });
        if (!probeOk) writeError = 'upsert reported an error (see console)';
      } catch (e) {
        writeError = err(e);
      }

      // Read back the sentinel values *before* restoring.
      const stamps = await verifyColumn('profiles', plan.id, 'stamps', plan.probe.stamps);
      const points = await verifyColumn('profiles', plan.id, 'merit_points', plan.probe.points);
      const cards = await verifyColumn('profiles', plan.id, 'completed_cards', plan.probe.tickets);

      // Always restore the member's real balance (incl. last_spin_date), even
      // if the probe failed, so the probe can't block their next spin.
      const restored = await updateUserProfileInDb(plan.id, plan.membershipNumber, {
        stamps: plan.restore.stamps,
        tickets: plan.restore.tickets,
        points: plan.restore.points,
        lastSpinDate: plan.restore.lastSpinDate,
      });

      if (probeOk && stamps.ok && points.ok && cards.ok) {
        return {
          status: 'pass',
          detail: `Stamp / ticket / point balance written to a real profile (${plan.id.slice(0, 8)}…) and restored.`,
        };
      }

      const raw = `${stamps.detail}; ${points.detail}; ${cards.detail}`;
      return {
        status: 'fail',
        detail: `upsert=${probeOk}; ${writeError ? `${writeError}; ` : ''}${raw}${restored ? '' : ' (restore failed)'}`,
        hint: 'profiles is missing a balance column (stamps / completed_cards / merit_points / last_spin_date) on the live DB, or the write is blocked. Run the repair SQL.',
      };
    },
  },
  {
    id: 'prize-wheel-read',
    tables: ['prize_wheels'],
    area: 'loyalty',
    label: 'Read prize wheel config',
    description: 'Selects prize_wheels rows.',
    run: () => probeRead('prize_wheels'),
  },
  {
    id: 'prize-wheel-write',
    tables: ['prize_wheels'],
    area: 'loyalty',
    label: 'Save prize wheel config',
    description: 'Upserts a temporary wheel, then restores the original config.',
    writes: true,
    run: async () => {
      const client = getSupabaseClient();
      const id = sentinel(`wheel-${Date.now()}`);
      try {
        const { data: existing } = await client.from('prize_wheels').select('*').limit(1);
        const previous = existing && existing.length ? (existing[0] as any) : null;
        const ok = await upsertPrizeWheelToDb({
          id,
          title: 'Diagnostics Wheel',
          active: true,
          ticketCost: 1,
          segments: [{ id: 's1', label: 'Diagnostics', prize: 'None', color: '#05C147', weight: 1 }],
        } as any);
        await client.from('prize_wheels').delete().eq('id', id);
        if (previous) {
          await client.from('prize_wheels').upsert(previous, { onConflict: 'id' });
        }
        return ok
          ? { status: 'pass', detail: 'Wheel config written and cleaned up.' }
          : { status: 'fail', detail: 'Wheel upsert rejected.', hint: 'Check prize_wheels grants/columns.' };
      } catch (e) {
        const message = err(e);
        await client.from('prize_wheels').delete().eq('id', id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Bookings -----------------------------------------------------------
  {
    id: 'booking-read',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Read repair bookings',
    description: 'Selects service_bookings for staff.',
    run: () => probeRead('service_bookings', 'created_at'),
  },
  {
    id: 'booking-write',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Create a repair booking',
    description: 'Writes a temporary booking exactly as the booking form does, then deletes it.',
    writes: true,
    run: async () => {
      const booking = makeDiagBooking(diagBookingId());
      try {
        const ok = await insertServiceBookingToDb(booking);
        const client = getSupabaseClient();
        await client.from('service_bookings').delete().eq('id', booking.id);
        return ok
          ? { status: 'pass', detail: 'Booking row written and cleaned up.' }
          : {
              status: 'fail',
              detail: 'Booking insert rejected — online bookings will not persist.',
              hint: 'service_bookings has NOT NULL columns with no defaults (customer_phone/service_id/service_title/…). Run the repair SQL.',
            };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'booking-delete',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Delete a booking (launch clear)',
    description: 'Writes a temporary booking then removes it via the Clear Bookings path and confirms it is gone.',
    writes: true,
    run: async () => {
      const booking = makeDiagBooking(diagBookingId());
      const client = getSupabaseClient();
      try {
        if (!(await insertServiceBookingToDb(booking))) {
          return { status: 'fail', detail: 'Could not create the probe booking.', hint: 'See the "Create a repair booking" test.' };
        }
        const ok = await deleteServiceBookingFromDb(booking.id);
        const { data } = await client
          .from('service_bookings')
          .select('id')
          .eq('id', booking.id)
          .maybeSingle();
        if (ok && !data) {
          return { status: 'pass', detail: 'Booking deleted and confirmed gone.' };
        }
        return {
          status: 'fail',
          detail: `delete=${ok}; row still present=${!!data}`,
          hint: 'DELETE on service_bookings is blocked (RLS/grants). Re-run the schema sync SQL so staff can clear bookings.',
        };
      } catch (e) {
        const message = err(e);
        await client.from('service_bookings').delete().eq('id', booking.id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'booking-update-lifecycle',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Approve / quote / repair-stage update',
    description: 'Writes a booking, then approves it with a quote and moves the repair stage — then deletes it.',
    writes: true,
    run: async () => {
      const booking = makeDiagBooking(diagBookingId());
      const client = getSupabaseClient();
      try {
        if (!(await insertServiceBookingToDb(booking))) {
          return { status: 'fail', detail: 'Could not create the probe booking.', hint: 'See the "Create a repair booking" test.' };
        }
        const ok = await updateServiceBookingInDb(booking.id, {
          status: 'confirmed',
          approvalStatus: 'approved',
          approvedAt: new Date(),
          approvedBy: 'Diagnostics',
          quotedPrice: 45,
          quoteNote: 'diagnostics quote',
          quoteSentAt: new Date(),
          repairStage: 'on_the_bench',
          estimateReadyAt: new Date().toISOString(),
        });
        const check = await verifyColumn('service_bookings', booking.id, 'approval_status', 'approved');
        const stage = await verifyColumn('service_bookings', booking.id, 'repair_stage', 'on_the_bench');
        await client.from('service_bookings').delete().eq('id', booking.id);
        if (ok && check.ok && stage.ok) {
          return { status: 'pass', detail: 'Approval, quote and repair stage all persisted.' };
        }
        return {
          status: 'fail',
          detail: `update=${ok}; ${check.detail}; ${stage.detail}`,
          hint: 'service_bookings is missing approval/quote/repair columns on the live DB. Run the repair SQL.',
        };
      } catch (e) {
        const message = err(e);
        await client.from('service_bookings').delete().eq('id', booking.id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Bike identity / e-bike conversion ----------------------------------
  {
    id: 'bike-details-write',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Save e-bike conversion details',
    description: 'Writes a booking with bike_details (factory/converted e-bike, motor, battery), verifies the jsonb, then deletes it.',
    writes: true,
    run: async () => {
      const booking = makeDiagBooking(diagBookingId());
      booking.bikeDetails = {
        ebikeStatus: 'converted',
        conversionSystem: 'Bafang BBSHD (Mid-Drive Kit)',
        batteryPosition: 'Downtube (bolt-on, external)',
        driveType: 'Mid-drive (motor at the cranks)',
        frameSize: 'M',
        year: '2019',
      };
      const client = getSupabaseClient();
      try {
        const ok = await insertServiceBookingToDb(booking);
        // jsonb reorders keys, so compare the fields we care about, not the raw JSON.
        const { data } = await client
          .from('service_bookings')
          .select('*')
          .eq('id', booking.id)
          .maybeSingle();
        const saved = (data as any)?.bike_details;
        await client.from('service_bookings').delete().eq('id', booking.id);
        const matches =
          saved?.ebikeStatus === 'converted' &&
          saved?.conversionSystem === 'Bafang BBSHD (Mid-Drive Kit)' &&
          saved?.frameSize === 'M';
        if (ok && matches) {
          return { status: 'pass', detail: 'Bike identity + e-bike conversion details persisted as jsonb.' };
        }
        return {
          status: 'fail',
          detail: `insert=${ok}; bike_details=${saved ? JSON.stringify(saved) : 'null'}`,
          hint: 'Run the bike-details migration to add service_bookings.bike_details. Until then the app falls back to storing the details inside notes/scraped_data.',
        };
      } catch (e) {
        const message = err(e);
        await client.from('service_bookings').delete().eq('id', booking.id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- SOS emergency repair -----------------------------------------------
  {
    id: 'sos-booking-write',
    tables: ['service_bookings'],
    area: 'bookings',
    label: 'Create an SOS emergency booking',
    description: 'Writes a priority SOS booking (is_sos + sos_status), verifies the flag persists, then deletes it.',
    writes: true,
    run: async () => {
      const booking = makeDiagBooking(diagBookingId(), { isSos: true, sosStatus: 'requested' });
      const client = getSupabaseClient();
      try {
        const ok = await insertServiceBookingToDb(booking);
        const flag = await verifyColumn('service_bookings', booking.id, 'is_sos', true);
        await client.from('service_bookings').delete().eq('id', booking.id);
        if (ok && flag.ok) {
          return { status: 'pass', detail: 'SOS booking written; is_sos + sos_status persisted.' };
        }
        return {
          status: 'fail',
          detail: `insert=${ok}; ${flag.detail}`,
          hint: 'Run supabase/migrations/20261006_sos_emergency_repair.sql to add service_bookings.is_sos / sos_status.',
        };
      } catch (e) {
        const message = err(e);
        await client.from('service_bookings').delete().eq('id', booking.id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Till & discounts ---------------------------------------------------
  {
    id: 'sales-read',
    tables: ['counter_sales'],
    area: 'till',
    label: 'Read counter sales',
    description: 'Selects counter_sales rows.',
    run: () => probeRead('counter_sales', 'created_at'),
  },
  {
    id: 'sale-write',
    tables: ['counter_sales'],
    area: 'till',
    label: 'Record a counter sale',
    description: 'Writes a temporary till sale (incl. quote lifecycle columns) then deletes it.',
    writes: true,
    run: async () => {
      const sale = makeDiagSale(sentinel(`sale-${Date.now()}`));
      try {
        const ok = await insertCounterSaleToDb(sale);
        const client = getSupabaseClient();
        await client.from('counter_sales').delete().eq('id', sale.id);
        return ok
          ? { status: 'pass', detail: 'Counter sale written and cleaned up.' }
          : { status: 'fail', detail: 'Counter sale insert rejected.', hint: 'Check counter_sales grants/columns.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'sale-lifecycle',
    tables: ['counter_sales'],
    area: 'till',
    label: 'Quote → approve a counter sale',
    description: 'Writes a sale, sends a quote then approves it, and checks the lifecycle columns persisted.',
    writes: true,
    run: async () => {
      const sale = makeDiagSale(sentinel(`sale-${Date.now()}`));
      const client = getSupabaseClient();
      try {
        if (!(await insertCounterSaleToDb(sale))) {
          return { status: 'fail', detail: 'Could not create the probe sale.', hint: 'See the "Record a counter sale" test.' };
        }
        const quoted = await updateCounterSaleInDb(sale.id, {
          status: 'quote',
          quote: { amount: 12, note: 'diagnostics quote', sentAt: new Date(), sentBy: 'Diagnostics' },
        } as Partial<SaleTransaction>);
        const approved = await updateCounterSaleInDb(sale.id, {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: 'Diagnostics',
        } as Partial<SaleTransaction>);
        const check = await verifyColumn('counter_sales', sale.id, 'status', 'approved');
        await client.from('counter_sales').delete().eq('id', sale.id);
        if (quoted && approved && check.ok) {
          return { status: 'pass', detail: 'Quote then approval persisted.' };
        }
        return {
          status: 'fail',
          detail: `quote=${quoted}; approve=${approved}; ${check.detail}`,
          hint: 'The sale row could not be updated. counter_sales.items is NOT NULL, so the lifecycle change must PATCH the existing row (updateCounterSaleInDb) — a partial upsert is rejected with 23502 before conflict resolution.',
        };
      } catch (e) {
        const message = err(e);
        await client.from('counter_sales').delete().eq('id', sale.id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'discount-codes-read',
    tables: ['discount_codes'],
    area: 'till',
    label: 'Read discount codes',
    description: 'Selects discount_codes rows.',
    run: () => probeRead('discount_codes'),
  },
  {
    id: 'discount-code-write',
    tables: ['discount_codes'],
    area: 'till',
    label: 'Create a discount code',
    description: 'Writes a temporary percent code then deletes it (checks the type CHECK constraint).',
    writes: true,
    run: async () => {
      const id = sentinel(`code-${Date.now()}`);
      const code: DiscountCode = {
        id,
        code: 'DIAGTEST',
        title: 'Diagnostics code',
        type: 'percent',
        value: 10,
        status: 'active',
        createdAt: new Date(),
        timesUsed: 0,
        usageLimit: 0,
        eligibleCategories: [],
      } as DiscountCode;
      try {
        const ok = await upsertDiscountCodeToDb(code);
        await deleteDiscountCodeFromDb(id);
        return ok
          ? { status: 'pass', detail: 'Discount code written and cleaned up.' }
          : { status: 'fail', detail: 'Discount code insert rejected.', hint: 'Check the discount_codes type CHECK constraint.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'discount-usage-increment',
    tables: ['discount_codes'],
    area: 'till',
    label: 'Increment discount usage',
    description: 'Creates a code, bumps times_used, verifies it, then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`code-${Date.now()}`);
      const client = getSupabaseClient();
      const code: DiscountCode = {
        id,
        code: 'DIAGTEST',
        title: 'Diagnostics code',
        type: 'percent',
        value: 10,
        status: 'active',
        createdAt: new Date(),
        timesUsed: 0,
        usageLimit: 0,
        eligibleCategories: [],
      } as DiscountCode;
      try {
        if (!(await upsertDiscountCodeToDb(code))) {
          return { status: 'fail', detail: 'Could not create the probe code.', hint: 'See the "Create a discount code" test.' };
        }
        const ok = await incrementDiscountUsageInDb(id, 1);
        const check = await verifyColumn('discount_codes', id, 'times_used', 1);
        await deleteDiscountCodeFromDb(id);
        if (ok && check.ok) return { status: 'pass', detail: 'Usage counter incremented and persisted.' };
        return { status: 'fail', detail: `update=${ok}; ${check.detail}` };
      } catch (e) {
        const message = err(e);
        await client.from('discount_codes').delete().eq('id', id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'voucher-conversion',
    tables: ['service_vouchers'],
    area: 'till',
    label: 'Service-credit voucher → discount',
    description: 'Checks a £40 service_credit voucher converts to a fixed discount.',
    run: async () => {
      const voucher: CollectedVoucher = {
        id: 'diag-voucher',
        code: 'STK-SRV40-DIAG',
        title: '£40 Workshop Service Credit',
        description: 'Diagnostics',
        value: 40,
        type: 'service_credit',
        terms: 'diagnostics',
        claimedAt: new Date(),
        status: 'available',
      };
      const state = voucherToDiscountState(voucher, 100);
      if (state && state.type === 'fixed' && state.amountOff === 40) {
        return { status: 'pass', detail: '£40 credit converts to a £40 fixed discount.' };
      }
      return { status: 'fail', detail: `Conversion returned ${JSON.stringify(state)}` };
    },
  },
  {
    id: 'website-discount-codes',
    tables: ['discount_codes'],
    area: 'till',
    label: 'Website discount codes',
    description: 'Reads your live codes, applies the curated public fallback, and checks a public code validates for a signed-out visitor.',
    run: async () => {
      // Same merge the marketing site uses, so a "no codes on the website"
      // report can be traced to an empty/unreadable table vs the audience column.
      let live: DiscountCode[] = [];
      let readError: string | undefined;
      try {
        const { data, error } = await getSupabaseClient()
          .from('discount_codes')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) readError = error.message;
        else live = (data || []) as DiscountCode[];
      } catch (e) {
        readError = err(e);
      }

      const catalogue = websiteDiscountCatalogue(live);
      const publicCodes = catalogue.filter((c) => c.audience === 'public' && c.status === 'active');
      const proxied = publicCodes[0] || WEBSITE_DISCOUNT_FALLBACK[0];
      const applied = validateDiscountCode(proxied, { subtotal: 50, isMember: false });
      const livePublic = live.filter((c) => inferAudience(c) === 'public' && c.status === 'active');

      const detail =
        `live=${live.length}, public=${publicCodes.length}` +
        (proxied ? `, ${proxied.code} → ${applied.ok ? `−£${(applied.amountOff || 0).toFixed(2)}` : applied.reason}` : '') +
        (readError ? `; read error: ${readError}` : '');

      if (readError) {
        return { status: 'fail', detail, hint: hintFor(readError) };
      }
      if (live.length === 0) {
        return {
          status: 'warn',
          detail,
          hint: 'The live discount_codes table is empty — the website is running on its built-in public codes. Open Discount Codes and "Generate Website visitor set" to make the codes editable.',
        };
      }
      if (livePublic.length === 0) {
        return {
          status: 'warn',
          detail,
          hint: 'No public website codes exist in the database. Open Discount Codes and "Generate Website visitor set".',
        };
      }
      if (!applied.ok) {
        return { status: 'fail', detail, hint: 'A public code did not validate for a signed-out visitor.' };
      }
      return {
        status: 'pass',
        detail: `${detail}. Public codes render on the website and apply at checkout.`,
      };
    },
  },

  // ---- Members & bikes ----------------------------------------------------
  {
    id: 'bikes-read',
    tables: ['customer_bikes'],
    area: 'members',
    label: 'Read customer garage (bikes)',
    description: 'Selects customer_bikes rows.',
    run: () => probeRead('customer_bikes'),
  },
  {
    id: 'bike-write',
    tables: ['customer_bikes'],
    area: 'members',
    label: 'Add a bike to a garage',
    description: 'Writes a temporary customer_bikes row then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`bike-${Date.now()}`);
      const bike = {
        id,
        category: 'cycle',
        categoryLabel: 'Diagnostics',
        brand: 'Diagnostics',
        model: 'Probe',
        addedAt: new Date().toISOString().slice(0, 10),
      } as CustomerBike;
      try {
        const ok = await insertCustomerBikeToDb(bike, sentinel('customer'));
        await deleteCustomerBikeFromDb(id, sentinel('customer'));
        return ok
          ? { status: 'pass', detail: 'Bike written and cleaned up.' }
          : {
              status: 'fail',
              detail: 'Bike insert rejected — bikes added from the app will not save.',
              hint: 'customer_bikes.id is likely still uuid while the app writes text ids. Run the repair SQL.',
            };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'bike-delete',
    tables: ['customer_bikes'],
    area: 'members',
    label: 'Remove a bike from a garage',
    description: 'Writes a temporary bike, removes it, and confirms the row is gone.',
    writes: true,
    run: async () => {
      const id = sentinel(`bike-${Date.now()}`);
      const customer = sentinel('customer');
      const client = getSupabaseClient();
      const bike = {
        id,
        category: 'cycle',
        categoryLabel: 'Diagnostics',
        brand: 'Diagnostics',
        model: 'Probe',
        addedAt: new Date().toISOString().slice(0, 10),
      } as CustomerBike;
      try {
        if (!(await insertCustomerBikeToDb(bike, customer))) {
          return { status: 'fail', detail: 'Could not create the probe bike.', hint: 'See the "Add a bike to a garage" test.' };
        }
        const deleted = await deleteCustomerBikeFromDb(id, customer);
        const { data } = await client.from('customer_bikes').select('id').eq('id', id);
        const gone = !data || data.length === 0;
        if (deleted && gone) return { status: 'pass', detail: 'Bike removed and confirmed gone.' };
        return { status: 'fail', detail: `delete=${deleted}; rowStillPresent=${!gone}` };
      } catch (e) {
        const message = err(e);
        await client.from('customer_bikes').delete().eq('id', id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'bike-specs-update',
    tables: ['customer_bikes'],
    area: 'members',
    label: 'Save scraped bike specs',
    description: 'Writes a bike, saves OEM specs onto it, verifies the flag, then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`bike-${Date.now()}`);
      const customer = sentinel('customer');
      const client = getSupabaseClient();
      const bike = {
        id,
        category: 'cycle',
        categoryLabel: 'Diagnostics',
        brand: 'Diagnostics',
        model: 'Probe',
        addedAt: new Date().toISOString().slice(0, 10),
      } as CustomerBike;
      try {
        if (!(await insertCustomerBikeToDb(bike, customer))) {
          return { status: 'fail', detail: 'Could not create the probe bike.', hint: 'See the "Add a bike to a garage" test.' };
        }
        const ok = await updateCustomerBikeSpecsInDb(id, customer, { source: 'diagnostics' } as any);
        const check = await verifyColumn('customer_bikes', id, 'stock_specs_scraped', true);
        await client.from('customer_bikes').delete().eq('id', id);
        if (ok && check.ok) return { status: 'pass', detail: 'Scraped specs saved and persisted.' };
        return { status: 'fail', detail: `update=${ok}; ${check.detail}`, hint: 'customer_bikes is missing stock_specs_scraped/scraped_data.' };
      } catch (e) {
        const message = err(e);
        await client.from('customer_bikes').delete().eq('id', id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'membership-number',
    area: 'members',
    label: 'Membership number + barcode generation',
    description: 'Confirms new members get a valid STK code and scannable barcode value.',
    run: async () => {
      const num = generateMembershipNumber();
      const barcode = generateBarcodeValue(num);
      if (/^STK-\d+/.test(num) && barcode) {
        return { status: 'pass', detail: `Generated ${num} → barcode ${barcode}.` };
      }
      return { status: 'warn', detail: `Unexpected number ${num} / barcode ${barcode}` };
    },
  },
  {
    id: 'membership-encode-roundtrip',
    area: 'members',
    label: 'Member pass encode → scan → resolve',
    description: 'Builds a scannable pass payload (number + balances), parses it back and resolves the member — offline, no network.',
    run: async () => {
      const payload = encodeMembershipPayload('stk-839201', { stamps: 4, tickets: 2, points: 130 });
      const normalized = normalizeScannedCode(payload);
      const balance = parseMembershipPayload(payload);
      const roster = [
        { uid: 'uuid-1', role: 'customer', displayName: 'Ada', membershipNumber: 'STK-839201', stamps: 4, tickets: 2, points: 130 },
      ] as any[];
      const match = resolveCustomer(payload, roster);
      const bare = parseMembershipPayload(encodeMembership('STK-839201'));
      const ok =
        normalized === 'STK-839201' &&
        balance?.stamps === 4 &&
        balance?.tickets === 2 &&
        balance?.points === 130 &&
        match.status === 'match' &&
        match.customer.uid === 'uuid-1' &&
        bare === undefined;
      return ok
        ? { status: 'pass', detail: `Encoded STK-839201, read back 4 stamps / 2 tickets / 130 points, resolved to the member.` }
        : { status: 'fail', detail: `normalized=${normalized}; balance=${JSON.stringify(balance)}; match=${match.status}` };
    },
  },

  // ---- Garage: bikes showing (step by step) -------------------------------
  // The "bikes show, then disappear" report is walked through the exact
  // production path: profiles read → owner keys → one batch bike read → attach.
  // A booking made from the website writes the bike under the membership number
  // while the roster stores the profile UUID, so step 3 (owner keys) and step 4
  // (the batch read) are where a real bike would be dropped.
  {
    id: 'garage-owner-keys',
    area: 'garage',
    label: 'Step 1 · Owner keys resolve a bike to its member',
    description: 'A profile maps to its UUID and (when non-blank) its membership number; a blank membership never becomes an owner key.',
    run: async () => {
      const withMember = ownerKeysForProfile({ uid: 'uuid-1', membershipNumber: '124' });
      const withoutMember = ownerKeysForProfile({ uid: 'uuid-2', membershipNumber: '' });
      const roster = ownerKeysForProfiles([
        { uid: 'uuid-1', membershipNumber: '124' },
        { uid: 'uuid-2', membershipNumber: '' },
      ]);
      const ok =
        withMember.join(',') === 'uuid-1,124' &&
        withoutMember.join(',') === 'uuid-2' &&
        roster.length === 3 &&
        !roster.includes('');
      return ok
        ? { status: 'pass', detail: 'UUID + membership keys built; blank memberships dropped.' }
        : { status: 'fail', detail: `withMember=${withMember}; withoutMember=${withoutMember}; roster=${roster}` };
    },
  },
  {
    id: 'garage-roster-read',
    tables: ['profiles'],
    area: 'garage',
    label: 'Step 2 · The roster loads members',
    description: 'Reads every profile the staff roster is built from.',
    run: async () => {
      const { profiles, error } = await fetchAllProfilesFromDbDetailed();
      if (error) return { status: 'fail', detail: error, hint: hintFor(error) };
      return profiles.length > 0
        ? { status: 'pass', detail: `${profiles.length} member profile(s) loaded.` }
        : { status: 'warn', detail: 'No member profiles returned — a garage test needs at least one member.', hint: 'Create a customer, or check the profiles table/policy.' };
    },
  },
  {
    id: 'garage-batch-bikes',
    tables: ['customer_bikes'],
    area: 'garage',
    label: 'Step 3 · One batch read fetches every garage',
    description: 'Queries customer_bikes for the whole roster in a single `in` call, grouped by owner.',
    run: async () => {
      const { profiles, error: rosterError } = await fetchAllProfilesFromDbDetailed();
      if (rosterError) return { status: 'fail', detail: rosterError, hint: hintFor(rosterError) };
      const keys = ownerKeysForProfiles(profiles);
      if (keys.length === 0) return { status: 'skipped', detail: 'No members to look up.' };
      const { byOwner, error } = await fetchBikesByOwner(keys);
      if (error) return { status: 'fail', detail: error, hint: hintFor(error) };
      const total = Object.values(byOwner).reduce((n, list) => n + list.length, 0);
      return total > 0
        ? { status: 'pass', detail: `${total} bike row(s) across ${Object.keys(byOwner).length} owner(s).` }
        : { status: 'warn', detail: 'No bike rows returned for any member — the garage would look empty.', hint: 'If bikes exist in the database, check the customer_bikes select policy (RLS).' };
    },
  },
  {
    id: 'garage-attach',
    area: 'garage',
    label: 'Step 4 · Bikes re-attach to the roster after a swap',
    description: 'Runs the real hydration: attaches each member\'s bikes so a roster refresh does not blank the garage.',
    run: async () => {
      const { profiles, error: rosterError } = await fetchAllProfilesFromDbDetailed();
      if (rosterError) return { status: 'fail', detail: rosterError, hint: hintFor(rosterError) };
      const keys = ownerKeysForProfiles(profiles);
      if (keys.length === 0) return { status: 'skipped', detail: 'No members to hydrate.' };
      const hydrated = await hydrateRosterGarages(profiles, fetchBikesByOwner);
      const attached = hydrated.reduce((n, p) => n + (p.bikes?.length || 0), 0);
      // Every profile must carry an array (never undefined) or the UI reads `.bikes`
      // as undefined and renders an empty garage.
      const allArrays = hydrated.every((p) => Array.isArray(p.bikes));
      return allArrays && attached > 0
        ? { status: 'pass', detail: `${attached} bike(s) re-attached across ${hydrated.length} member(s).` }
        : allArrays
        ? { status: 'warn', detail: 'Roster hydrated with 0 bikes — matches step 3 if no rows exist.' }
        : { status: 'fail', detail: 'A hydrated profile had an undefined bikes array.' };
    },
  },
  {
    id: 'garage-live-example',
    area: 'garage',
    label: 'Step 5 · Pick a member with bikes (sanity check)',
    description: 'Finds the first member who owns a bike and prints the owner key it is stored under.',
    run: async () => {
      const { profiles, error: rosterError } = await fetchAllProfilesFromDbDetailed();
      if (rosterError) return { status: 'fail', detail: rosterError, hint: hintFor(rosterError) };
      const keys = ownerKeysForProfiles(profiles);
      if (keys.length === 0) return { status: 'skipped', detail: 'No members.' };
      const { byOwner, error } = await fetchBikesByOwner(keys);
      if (error) return { status: 'fail', detail: error, hint: hintFor(error) };
      const ownerKey = Object.keys(byOwner).find((k) => byOwner[k].length > 0);
      if (!ownerKey) return { status: 'warn', detail: 'No member currently has a bike row.' };
      const member = profiles.find((p) => ownerKeysForProfile(p).includes(ownerKey));
      const sample = byOwner[ownerKey][0];
      return {
        status: 'pass',
        detail: `${member?.displayName || 'member'} (${ownerKey}) → ${sample.brand} ${sample.model}.`,
      };
    },
  },

  // ---- Prizes & vouchers --------------------------------------------------
  {
    id: 'vouchers-read',
    tables: ['service_vouchers'],
    area: 'prizes',
    label: 'Issue a service voucher',
    description: 'Writes a temp voucher then reads it back and deletes it.',
    writes: true,
    run: async () => {
      const customerId = sentinel('customer');
      const voucher: CollectedVoucher = {
        id: sentinel(`voucher-${Date.now()}`),
        code: 'STK-SRV40-DIAG',
        title: 'Diagnostics voucher',
        description: 'diagnostics',
        value: 40,
        type: 'service_credit',
        terms: 'diagnostics',
        claimedAt: new Date(),
        status: 'available',
      };
      try {
        const ok = await insertVoucherToDb(customerId, voucher);
        const client = getSupabaseClient();
        await client.from('service_vouchers').delete().eq('id', voucher.id);
        return ok
          ? { status: 'pass', detail: 'Voucher written and cleaned up.' }
          : { status: 'fail', detail: 'Voucher insert rejected.', hint: 'Check service_vouchers grants/columns.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'voucher-redeem',
    tables: ['service_vouchers'],
    area: 'prizes',
    label: 'Redeem a service voucher',
    description: 'Issues a voucher, marks it redeemed, verifies the status persisted, then deletes it.',
    writes: true,
    run: async () => {
      const customerId = sentinel('customer');
      const id = sentinel(`voucher-${Date.now()}`);
      const client = getSupabaseClient();
      const voucher: CollectedVoucher = {
        id,
        code: 'STK-SRV40-DIAG',
        title: 'Diagnostics voucher',
        description: 'diagnostics',
        value: 40,
        type: 'service_credit',
        terms: 'diagnostics',
        claimedAt: new Date(),
        status: 'available',
      };
      try {
        if (!(await insertVoucherToDb(customerId, voucher))) {
          return { status: 'fail', detail: 'Could not issue the probe voucher.', hint: 'See the "Issue a service voucher" test.' };
        }
        const ok = await updateVoucherStatusInDb(id, 'redeemed', new Date());
        const check = await verifyColumn('service_vouchers', id, 'status', 'redeemed');
        await client.from('service_vouchers').delete().eq('id', id);
        if (ok && check.ok) return { status: 'pass', detail: 'Voucher marked redeemed and persisted.' };
        return { status: 'fail', detail: `update=${ok}; ${check.detail}`, hint: 'service_vouchers is missing status/redeemed_at on the live DB.' };
      } catch (e) {
        const message = err(e);
        await client.from('service_vouchers').delete().eq('id', id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'prize-draws-read',
    tables: ['prize_draws'],
    area: 'prizes',
    label: 'Read prize draws',
    description: 'Selects prize_draws rows.',
    run: () => probeRead('prize_draws', 'created_at'),
  },
  {
    id: 'prize-draw-write',
    tables: ['prize_draws'],
    area: 'prizes',
    label: 'Create a prize draw',
    description: 'Writes a temporary draw then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`draw-${Date.now()}`);
      const draw: PrizeDraw = {
        id,
        title: 'Diagnostics Draw',
        prizeDescription: 'diagnostics',
        drawDate: new Date(),
        status: 'upcoming',
      } as PrizeDraw;
      try {
        const ok = await upsertPrizeDrawToDb(draw);
        const client = getSupabaseClient();
        await client.from('prize_draws').delete().eq('id', id);
        return ok
          ? { status: 'pass', detail: 'Prize draw written and cleaned up.' }
          : { status: 'fail', detail: 'Prize draw insert rejected.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Staff, promotions & draws -----------------------------------------
  {
    id: 'staff-read',
    tables: ['staff_members'],
    area: 'content',
    label: 'Read team roster',
    description: 'Selects staff_members rows.',
    run: () => probeRead('staff_members'),
  },
  {
    id: 'staff-write',
    tables: ['staff_members'],
    area: 'content',
    label: 'Add a team member',
    description: 'Writes a temporary staff_members row then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`staff-${Date.now()}`);
      const member: StaffMember = {
        id,
        name: 'Diagnostics Probe',
        email: 'diagnostics@example.com',
        phone: '07000000000',
        role: 'Mechanic',
        status: 'Active',
        joinedDate: new Date().toISOString().slice(0, 10),
      } as StaffMember;
      try {
        const ok = await upsertStaffMemberToDb(member);
        await deleteStaffMemberFromDb(id);
        return ok ? { status: 'pass', detail: 'Team member written and cleaned up.' } : { status: 'fail', detail: 'Team member insert rejected.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'promotions-read',
    tables: ['promotions'],
    area: 'content',
    label: 'Read promotions',
    description: 'Selects promotions rows.',
    run: () => probeRead('promotions'),
  },
  {
    id: 'promotion-write',
    tables: ['promotions'],
    area: 'content',
    label: 'Create a promotion',
    description: 'Writes a temporary promotion then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`promo-${Date.now()}`);
      const promo: ShopPromotion = {
        id,
        title: 'Diagnostics Promo',
        subtitle: 'diagnostics',
        code: 'DIAGPROMO',
        discountPercentage: 10,
        badgeText: 'DIAG',
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        termsAndConditions: [],
        eligibleCategories: [],
        bgGradient: 'from-emerald-500 to-emerald-700',
      } as ShopPromotion;
      try {
        const ok = await upsertPromotionToDb(promo);
        await deletePromotionFromDb(id);
        return ok ? { status: 'pass', detail: 'Promotion written and cleaned up.' } : { status: 'fail', detail: 'Promotion insert rejected.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Referrals & assistant ---------------------------------------------
  {
    id: 'referrals-read',
    tables: ['referrals'],
    area: 'content',
    label: 'Read referral records',
    description: 'Selects referrals rows.',
    run: () => probeRead('referrals', 'created_at'),
  },
  {
    id: 'referral-write',
    tables: ['referrals'],
    area: 'content',
    label: 'Save a refer-a-friend record',
    description: 'Writes a temporary referral, verifies it reads back, then deletes it.',
    writes: true,
    run: async () => {
      const id = sentinel(`ref-${Date.now()}`);
      const referral: ReferralRecord = {
        id,
        ownerUid: sentinel('owner'),
        ownerName: 'Diagnostics Probe',
        ownerMembership: 'STK-DIAG',
        code: 'STK-REF-DIAG',
        link: 'https://stakeys-cycle.co.uk/?ref=STK-REF-DIAG',
        timesShared: 0,
        rewardsEarned: 0,
        rewards: [],
        referredFriends: [],
        createdAt: new Date(),
      } as ReferralRecord;
      const client = getSupabaseClient();
      try {
        const ok = await upsertReferralToDb(referral);
        const { data } = await client.from('referrals').select('id, code').eq('id', id).maybeSingle();
        await deleteReferralFromDb(id);
        if (ok && data && (data as any).code === 'STK-REF-DIAG') {
          return { status: 'pass', detail: 'Referral written, read back and cleaned up.' };
        }
        return {
          status: 'fail',
          detail: `upsert=${ok}; row=${data ? JSON.stringify(data) : 'null'}`,
          hint: 'Check the referrals table columns/grants (owner_uid, code, link, rewards, referred_friends).',
        };
      } catch (e) {
        const message = err(e);
        await deleteReferralFromDb(id);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'assistant-config-read',
    tables: ['assistant_config'],
    area: 'content',
    label: 'Read assistant config table',
    description: 'Selects assistant_config so the staff-managed shop assistant can persist.',
    run: () => probeRead('assistant_config'),
  },

  // ---- Settings -----------------------------------------------------------
  {
    id: 'settings-read',
    tables: ['app_settings'],
    area: 'settings',
    label: 'Read workshop settings',
    description: 'Selects the app_settings row.',
    run: async () => {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('app_settings').select('*').eq('id', 1).maybeSingle();
        if (error) return { status: 'fail', detail: error.message, hint: hintFor(error.message) };
        if (!data) return { status: 'warn', detail: 'No app_settings row found (id=1).' };
        const row = data as any;
        const owner = row.owner_email;
        const emailOn = row.email_alerts_enabled === true;
        if (!owner || !emailOn) {
          return {
            status: 'warn',
            detail: `Owner email: ${owner || '(not set)'}; alerts: ${emailOn ? 'on' : 'off'}.`,
            hint: 'Set a workshop notification email and enable email alerts to receive booking emails.',
          };
        }
        return { status: 'pass', detail: `Owner alerts enabled → ${owner}.` };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'settings-write',
    tables: ['app_settings'],
    area: 'settings',
    label: 'Save workshop notification settings',
    description: 'Upserts a temporary owner email + alerts flag, verifies it, then restores the previous settings.',
    writes: true,
    run: async () => {
      const client = getSupabaseClient();
      try {
        const { data: before } = await client.from('app_settings').select('*').eq('id', 1).maybeSingle();
        const prev = (before as any) || null;
        const ok = await upsertAppSettingsToDb({
          ownerEmail: 'diagnostics@example.com',
          emailAlertsEnabled: true,
        } as any);
        const check = await verifyColumn('app_settings', 1, 'owner_email', 'diagnostics@example.com');
        // restore (only touch fields that existed, so a NULL owner_email stays NULL)
        const restore: Record<string, unknown> = {};
        if (prev && 'owner_email' in prev) restore.ownerEmail = prev.owner_email ?? '';
        if (prev && 'email_alerts_enabled' in prev) restore.emailAlertsEnabled = prev.email_alerts_enabled === true;
        if (Object.keys(restore).length) await upsertAppSettingsToDb(restore as any);
        if (ok && check.ok) return { status: 'pass', detail: 'Settings written, verified and restored.' };
        return { status: 'fail', detail: `upsert=${ok}; ${check.detail}`, hint: 'app_settings is missing owner_email/email_alerts_enabled. Run the repair SQL.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'theme-write',
    tables: ['app_theme_config'],
    area: 'settings',
    label: 'Apply a seasonal theme',
    description: 'Writes a temporary theme value, verifies it, then restores the previous theme.',
    writes: true,
    run: async () => {
      const client = getSupabaseClient();
      try {
        const { data: before } = await client.from('app_theme_config').select('*').eq('id', 1).maybeSingle();
        const prevTheme = (before as any)?.theme || 'none';
        const probe = prevTheme === 'halloween' ? 'christmas' : 'halloween';
        const { error } = await client
          .from('app_theme_config')
          .upsert({ id: 1, theme: probe, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) return { status: 'fail', detail: error.message, hint: hintFor(error.message) };
        const check = await verifyColumn('app_theme_config', 1, 'theme', probe);
        await client
          .from('app_theme_config')
          .upsert({ id: 1, theme: prevTheme, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (check.ok) return { status: 'pass', detail: `Theme written (${probe}) and restored to ${prevTheme}.` };
        return { status: 'fail', detail: check.detail, hint: 'app_theme_config theme column did not persist.' };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },
  {
    id: 'theme-read',
    tables: ['app_theme_config'],
    area: 'settings',
    label: 'Read seasonal theme config',
    description: 'Selects app_theme_config.',
    run: async () => {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('app_theme_config').select('*').limit(1);
        if (error) return { status: 'fail', detail: error.message, hint: hintFor(error.message) };
        const theme = (data?.[0] as any)?.active_theme || (data?.[0] as any)?.theme || 'none';
        return { status: 'pass', detail: `Theme config reachable (active: ${theme}).` };
      } catch (e) {
        const message = err(e);
        return { status: 'fail', detail: message, hint: hintFor(message) };
      }
    },
  },

  // ---- Push & email delivery ----------------------------------------------
  {
    id: 'push-runtime-config',
    area: 'reach',
    label: 'Push runtime config (/api/onesignal/config)',
    description: 'Confirms the deployed back-end exposes the OneSignal App ID + server-push capability.',
    run: async () => {
      try {
        const res = await fetch('/api/onesignal/config');
        const data: any = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data !== 'object' || !('appId' in data)) {
          return {
            status: 'fail',
            detail: `Endpoint returned ${res.status} ${friendlyType(res)} — no JSON config.`,
            hint: 'The production host has no /api/onesignal/config function, so server pushes never fire (the SPA rewrite returns index.html). Deploy api/onesignal/config.js and set ONESIGNAL_REST_API_KEY.',
          };
        }
        if (data.appId && data.serverPush) {
          return { status: 'pass', detail: `App ID ${String(data.appId).slice(0, 8)}… and server push configured${data.restKeyEnv ? ` (key from ${data.restKeyEnv})` : ''}.` };
        }
        if (data.appId) {
          return {
            status: 'warn',
            detail: 'App ID resolved but serverPush=false — the REST key is missing on the server.',
            hint: `Set the OneSignal REST key in the deployment environment under one of: ${(data.restKeyEnvNames || ['ONESIGNAL_REST_API_KEY', 'ONESIGNAL_API_KEY', 'VITE_ONESIGNAL_REST_API_KEY']).join(', ')}. In Vercel, add it to ALL environments, then Redeploy.`,
          };
        }
        return { status: 'fail', detail: 'No OneSignal App ID returned.', hint: 'Set VITE_ONESIGNAL_APP_ID / ONESIGNAL_APP_ID.' };
      } catch (e) {
        return { status: 'fail', detail: err(e), hint: 'The request never reached the server.' };
      }
    },
  },
  {
    id: 'push-server-dispatch',
    area: 'reach',
    label: 'Server push dispatch (/api/onesignal/notify)',
    description: 'Sends a silent internal test to the endpoint to confirm it can reach OneSignal.',
    run: async () => {
      try {
        const res = await fetch('/api/onesignal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '__stakeys_diag__',
            body: 'push probe',
            segment: '__stakeys_diag_no_such_segment__',
          }),
        });
        const data: any = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') {
          return {
            status: 'fail',
            detail: `Endpoint returned ${res.status} ${friendlyType(res)} — no JSON.`,
            hint: 'Deploy api/onesignal/notify.js (production) so server pushes have somewhere to go.',
          };
        }
        // OneSignal reports { id, recipients } or { errors:[...] }. An unknown
        // segment legitimately returns 200 with 0 recipients, which still proves
        // the server reached the provider with a valid key.
        if (data.errors && data.errors.length) {
          return {
            status: 'fail',
            detail: `OneSignal: ${JSON.stringify(data.errors).slice(0, 160)}`,
            hint: 'Usually a bad or missing ONESIGNAL_REST_API_KEY on the server.',
          };
        }
        return { status: 'pass', detail: 'Server reached OneSignal and accepted the message envelope.' };
      } catch (e) {
        return { status: 'fail', detail: err(e), hint: 'The request never reached the server.' };
      }
    },
  },

  // ---- Transactional email ------------------------------------------------
  {
    id: 'email-booking-template',
    area: 'email',
    label: 'Booking confirmation email template',
    description: 'Renders the workshop booking email and checks it is complete (customer, service, vehicle).',
    run: async () => {
      const html = generateBookingEmailHtml(
        makeDiagBooking('diag-email'),
        { ownerEmail: 'shop@example.com', ownerPhone: '+44 7000 000000', emailAlertsEnabled: true, businessName: "Stakey's Cycles" } as any
      );
      const checks: Array<[string, boolean]> = [
        ['service title', html.includes('Diagnostics Service')],
        ['customer name', html.includes('Diagnostics Probe')],
        ['vehicle model', html.includes('Diagnostics Model')],
        ['closing html', html.trim().endsWith('</html>')],
      ];
      const missing = checks.filter(([, ok]) => !ok).map(([n]) => n);
      return missing.length === 0
        ? { status: 'pass', detail: 'Workshop booking email renders all key fields.' }
        : { status: 'fail', detail: `Template missing: ${missing.join(', ')}` };
    },
  },
  {
    id: 'email-sos-importance',
    area: 'email',
    label: 'SOS email flagged as high importance',
    description: 'Renders an SOS booking email and confirms it is labelled SOS + marked high importance.',
    run: async () => {
      const booking = makeDiagBooking('diag-sos', { isSos: true, sosStatus: 'requested' });
      const html = generateBookingEmailHtml(
        booking,
        { ownerEmail: 'shop@example.com', ownerPhone: '+44 7000 000000', emailAlertsEnabled: true, businessName: "Stakey's Cycles" } as any
      );
      const checks: Array<[string, boolean]> = [
        ['SOS label', /SOS EMERGENCY/i.test(html)],
        ['HIGH IMPORTANCE label', /HIGH IMPORTANCE/i.test(html)],
        ['emergency title', /SOS Emergency Repair/i.test(html)],
      ];
      const missing = checks.filter(([, ok]) => !ok).map(([n]) => n);
      return missing.length === 0
        ? { status: 'pass', detail: 'SOS booking email is labelled emergency + high importance.' }
        : { status: 'fail', detail: `SOS email missing: ${missing.join(', ')}` };
    },
  },

  // ---- Scanner & codes ----------------------------------------------------
  // The member/item code path is pure and offline, so a broken QR label or a
  // mis-encoded pass shows up here even when the till camera itself works.
  {
    id: 'scanner-normalize-member-code',
    area: 'scanner',
    label: 'Member QR → membership number',
    description: 'Normalizes every shape of member code (bare token, encoded payload, URL, JSON) to the same number.',
    run: async () => {
      const encoded = encodeMembership('STK-839201'); // STK-839201|urn:stakeys:membership:STK-839201
      const cases: Array<[string, string]> = [
        ['bare token', normalizeScannedCode('stk-839201')],
        ['encoded payload', normalizeScannedCode(encoded)],
        ['profile URL', normalizeScannedCode('https://stakeys-cycle.co.uk/member/STK-839201')],
        ['JSON blob', normalizeScannedCode('{"membershipNumber":"STK-839201"}')],
      ];
      const bad = cases.filter(([, v]) => v !== 'STK-839201').map(([n]) => n);
      return bad.length === 0
        ? { status: 'pass', detail: 'All member-code shapes normalize to STK-839201.' }
        : { status: 'fail', detail: `Failed shapes: ${bad.join(', ')}`, hint: 'Check normalizeScannedCode in membershipCode.ts.' };
    },
  },
  {
    id: 'scanner-member-payload-balances',
    area: 'scanner',
    label: 'Member pass carries live balances',
    description: 'A pass payload rides with stamps/tickets/points so a scan works before the till has the roster.',
    run: async () => {
      const payload = encodeMembershipPayload('STK-839201', { stamps: 7, tickets: 1, points: 42 });
      const balance = parseMembershipPayload(payload);
      const ok =
        balance?.stamps === 7 &&
        balance?.tickets === 1 &&
        balance?.points === 42 &&
        parseMembershipPayload(encodeMembership('STK-839201')) === undefined;
      return ok
        ? { status: 'pass', detail: 'Balances 7/1/42 round-trip; a bare pass carries none.' }
        : { status: 'fail', detail: `balance=${JSON.stringify(balance)}` };
    },
  },
  {
    id: 'scanner-item-code-resolution',
    area: 'scanner',
    label: 'Item QR → product on the floor',
    description: 'An item label (bare code, encoded payload or URL) resolves back to the live catalogue product.',
    run: async () => {
      const products = [
        { id: 'prod-abc123', name: 'Carrera Vengeance', price: 249.99, category: 'Mens Bikes', stock: 2 },
      ] as any[];
      const code = itemCodeForProduct('prod-abc123');
      const encoded = encodeItemCode('prod-abc123');
      const viaBare = resolveItemByCode(code, products);
      const viaEncoded = resolveItemByCode(encoded, products);
      const viaUrl = resolveItemByCode(`https://stakeys-cycle.co.uk/item/${code}`, products);
      const ok = viaBare?.id === 'prod-abc123' && viaEncoded?.id === 'prod-abc123' && viaUrl?.id === 'prod-abc123';
      return ok
        ? { status: 'pass', detail: `${code} resolves from bare, encoded and URL forms.` }
        : { status: 'fail', detail: `bare=${viaBare?.id}; encoded=${viaEncoded?.id}; url=${viaUrl?.id}` };
    },
  },
  {
    id: 'scanner-discount-code-routing',
    area: 'scanner',
    label: 'Discount code scan routing',
    description: 'A scanned discount code is matched for the till and is NOT mistaken for a member or an item.',
    run: async () => {
      const codes = [
        { id: 'd1', code: 'WINTER10', title: 'Winter 10%', type: 'percent', value: 10, status: 'active' },
      ] as any[];
      const found = findDiscountCode('winter10', codes);
      const notMember = resolveCustomer('WINTER10', []).status === 'none';
      const notItem = resolveItemByCode('WINTER10', []) === null;
      const ok = found?.id === 'd1' && notMember && notItem;
      return ok
        ? { status: 'pass', detail: 'WINTER10 routes to the discount code, not to a member or item.' }
        : { status: 'fail', detail: `found=${found?.id}; member=${!notMember}; item=${!notItem}` };
    },
  },
  {
    id: 'scanner-member-resolution-fuzzy',
    area: 'scanner',
    label: 'Member resolution (exact, fuzzy, ambiguous)',
    description: 'Exact number/uid match wins; a partial match still resolves; two candidates are reported as ambiguous.',
    run: async () => {
      const roster = [
        { uid: 'u1', role: 'customer', displayName: 'Ada Rider', membershipNumber: 'STK-111111', email: 'ada@x.com' },
        { uid: 'u2', role: 'customer', displayName: 'Ada Two', membershipNumber: 'STK-222222', email: 'two@x.com' },
      ] as any[];
      const exact = resolveCustomer('STK-111111', roster);
      const byUid = resolveCustomer('u1', roster);
      const partial = resolveCustomer('STK-111', roster);
      const ambiguous = resolveCustomer('Ada', roster);
      const ok =
        exact.status === 'match' &&
        exact.customer.uid === 'u1' &&
        byUid.status === 'match' &&
        partial.status === 'match' &&
        ambiguous.status === 'multiple';
      return ok
        ? { status: 'pass', detail: 'Exact/uid/partial resolve to one member; "Ada" is reported ambiguous.' }
        : { status: 'fail', detail: `exact=${exact.status}; uid=${byUid.status}; partial=${partial.status}; ambiguous=${ambiguous.status}` };
    },
  },

  // ---- Pure logic (no network) -------------------------------------------
  {
    id: 'logic-discount-maths',
    area: 'logic',
    label: 'Discount maths',
    description: '10% of £50 = £5; fixed £20 capped at a £10 basket = £10.',
    run: async () => {
      const percent = validateDiscountCode(
        { code: 'P', type: 'percent', value: 10, status: 'active' } as DiscountCode,
        { subtotal: 50 }
      );
      const capped = validateDiscountCode(
        { code: 'F', type: 'fixed', value: 20, status: 'active' } as DiscountCode,
        { subtotal: 10 }
      );
      if (percent.ok && percent.amountOff === 5 && capped.ok && capped.amountOff === 10) {
        return { status: 'pass', detail: 'Percent and capped-fixed maths correct.' };
      }
      return { status: 'fail', detail: `percent=${JSON.stringify(percent)} fixed=${JSON.stringify(capped)}` };
    },
  },
  {
    id: 'logic-basket-totals',
    area: 'logic',
    label: 'VAT basket totals',
    description: '£100 + 20% VAT − £10 discount = £110.',
    run: async () => {
      const totals = computeSaleTotals([{ id: 'a', name: 'a', quantity: 1, unitPrice: 100 }] as any, 0.2, 10);
      if (totals.vatAmount === 20 && totals.grandTotal === 110) {
        return { status: 'pass', detail: `subtotal £${totals.subtotal}, VAT £${totals.vatAmount}, total £${totals.grandTotal}.` };
      }
      return { status: 'fail', detail: JSON.stringify(totals) };
    },
  },
  {
    id: 'logic-rounding',
    area: 'logic',
    label: 'Money rounding (1.005 → 1.01)',
    description: 'Guards against the classic floating-point rounding bug.',
    run: async () => {
      const r = roundMoney(1.005);
      return r === 1.01
        ? { status: 'pass', detail: 'roundMoney(1.005) = 1.01.' }
        : { status: 'fail', detail: `roundMoney(1.005) = ${r}` };
    },
  },
  {
    id: 'logic-weather-report',
    area: 'logic',
    label: 'Riding weather report',
    description: 'Builds a 7-day forecast with hourly + moon phase and confirms every day grades for riding.',
    run: async () => {
      const report = syntheticWeatherReport();
      const graded = report.days.every((d) => {
        const c = ridingConditionsFor(d);
        return c && typeof c.grade === 'string' && typeof c.headline === 'string';
      });
      // Moon phase is a pure helper; verify it on a known full moon.
      const full = moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14) + 14.765 * 86400000));
      const moonOk = full.name === 'Full Moon' && full.illumination > 0.95;
      const hourlyOk = report.hourly.length === 24;
      return report.days.length === 7 && graded && moonOk && hourlyOk
        ? { status: 'pass', detail: '7-day forecast + 24h hourly built; every day graded; moon phase correct.' }
        : { status: 'fail', detail: `days=${report.days.length}, graded=${graded}, moon=${moonOk}, hourly=${hourlyOk}` };
    },
  },
  {
    id: 'logic-financial-payment-split',
    area: 'logic',
    label: 'Financial ledger: paid vs unpaid + VAT',
    description: 'A paid invoice counts as received, an unpaid one as outstanding, and VAT is split out.',
    run: async () => {
      const paid = buildFinancialLedger({
        bookings: [
          { id: 'b1', customerName: 'A', serviceTitle: 'S', vehicleModel: 'M', status: 'completed', preferredDate: '2026-10-06', invoice: { invoiceNumber: 'INV-1', grandTotal: 120, vatAmount: 20, paymentStatus: 'paid_card' } },
        ],
        start: '2026-10-01',
        end: '2026-10-31',
      });
      const unpaid = buildFinancialLedger({
        bookings: [
          { id: 'b2', customerName: 'B', serviceTitle: 'S', vehicleModel: 'M', status: 'completed', preferredDate: '2026-10-06', invoice: { invoiceNumber: 'INV-2', grandTotal: 60, vatAmount: 10, paymentStatus: 'unpaid' } },
        ],
        start: '2026-10-01',
        end: '2026-10-31',
      });
      const s = summarizeLedger([...paid, ...unpaid]);
      const ok =
        paid[0]?.paymentState === 'paid' &&
        unpaid[0]?.paymentState === 'unpaid' &&
        s.paid === 120 &&
        s.unpaid === 60 &&
        s.vat === 30 &&
        s.net === 150 &&
        workshopPaymentLabel('paid_card') === 'Paid · Card';
      return ok
        ? { status: 'pass', detail: `Paid £${s.paid}, outstanding £${s.unpaid}, VAT £${s.vat}.` }
        : { status: 'fail', detail: JSON.stringify(s) };
    },
  },
  {
    id: 'logic-performance-tracker',
    area: 'logic',
    label: 'Performance tracker: channels + conversion',
    description: 'Classifies phone vs online bookings from the notes marker and counts a phone call as converted only when approved/completed.',
    run: async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
      const mk = (over: Partial<ServiceBooking>): ServiceBooking =>
        ({ id: 'x', customerName: 'A', status: 'pending', preferredDate: '2026-10-06', createdAt: twoDaysAgo, ...over } as ServiceBooking);
      const phone = mk({ notes: 'BOOKING CHANNEL: Phone call' });
      const online = mk({ notes: 'BOOKING CHANNEL: Website' });
      const converted = mk({ notes: 'BOOKING CHANNEL: Phone call', approvalStatus: 'approved' });
      const summary = summarizePerformance([phone, online, converted], now);
      const ok =
        classifyBookingChannel(phone) === 'phone' &&
        classifyBookingChannel(online) === 'online' &&
        didConvert(converted) === true &&
        didConvert(phone) === false &&
        summary.phone7d === 2 &&
        summary.online7d === 1 &&
        summary.callsLogged === 2 &&
        summary.callConversionPct === 50;
      return ok
        ? { status: 'pass', detail: `2 phone / 1 online requests; 1 of 2 calls converted (50%).` }
        : { status: 'fail', detail: JSON.stringify(summary) };
    },
  },
  {
    id: 'logic-promotion-expiry-identity',
    area: 'logic',
    label: 'Promotion expiry keeps state stable',
    description: 'A past end date flips a promotion to expired; when nothing expired the SAME array is returned (no re-render churn).',
    run: async () => {
      const active = [{ id: 'p1', title: 'Deal', status: 'active', endDate: '2999-01-01' }] as any[];
      const stale = [{ id: 'p2', title: 'Old', status: 'active', endDate: '2000-01-01' }] as any[];
      const unchanged = evaluatePromotionsExpiry(active) === active;
      const expired = evaluatePromotionsExpiry(stale);
      const ok = unchanged && expired !== stale && expired[0].status === 'expired';
      return ok
        ? { status: 'pass', detail: 'Unchanged promos keep their array identity; a past end date marks expired.' }
        : { status: 'fail', detail: `unchanged=${unchanged}; expiredStatus=${expired[0]?.status}` };
    },
  },
  {
    id: 'logic-booking-translator',
    area: 'logic',
    label: 'Rider booking translator',
    description: 'All 14 languages have a complete phrase book, Arabic/Urdu are flagged RTL, and every phrase is non-empty.',
    run: async () => {
      const languages = BOOKING_LANGUAGES.map((l) => l.code);
      const rtlOk = isRtlLanguage('ar') && isRtlLanguage('ur') && !isRtlLanguage('en');
      const complete = languages.every((code) => {
        const phrases = getPhrases(code);
        const values = Object.values(phrases);
        return values.length > 0 && values.every((v) => typeof v === 'string' && v.trim().length > 0);
      });
      const ok = languages.length >= 14 && rtlOk && complete;
      return ok
        ? { status: 'pass', detail: `${languages.length} languages complete; Arabic + Urdu are RTL.` }
        : { status: 'fail', detail: `languages=${languages.length}; rtl=${rtlOk}; complete=${complete}` };
    },
  },
];

/** Runs every test (or a filtered subset) and returns the results. */
export async function runFeatureTests(
  onProgress?: (result: FeatureTestResult, index: number, total: number) => void,
  ids?: string[]
): Promise<FeatureTestResult[]> {
  const tests = ids && ids.length ? FEATURE_TESTS.filter((t) => ids.includes(t.id)) : FEATURE_TESTS;
  const results: FeatureTestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const start = performance.now();
    let status: TestStatus = 'fail';
    let detail = '';
    let hint: string | undefined;
    let selfTestLimited = false;
    try {
      const r = await test.run();
      status = r.status;
      detail = r.detail;
      hint = r.hint;
      selfTestLimited = r.selfTestLimited ?? false;
    } catch (e) {
      detail = err(e);
      hint = hintFor(detail);
    }
    const result: FeatureTestResult = {
      id: test.id,
      area: test.area,
      label: test.label,
      status,
      detail,
      hint,
      writes: test.writes,
      tables: test.tables,
      selfTestLimited: selfTestLimited || test.selfTestLimited,
      ms: Math.round(performance.now() - start),
    };
    results.push(result);
    onProgress?.(result, i, tests.length);
  }
  // Remember which areas have actually been exercised, so the bench can flag a
  // feature whose checks have never been run.
  markAreasVerified(Array.from(new Set(tests.map((t) => t.area))));
  return results;
}

export function summarize(results: FeatureTestResult[]) {
  return {
    total: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    warn: results.filter((r) => r.status === 'warn').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
  };
}
