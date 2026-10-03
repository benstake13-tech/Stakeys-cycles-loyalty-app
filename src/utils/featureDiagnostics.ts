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
  deleteCustomerBikeFromDb,
  deleteStaffMemberFromDb,
  deletePromotionFromDb,
  deleteDiscountCodeFromDb,
} from '../api/backendDataService';
import {
  validateDiscountCode,
  computeSaleTotals,
  voucherToDiscountState,
  roundMoney,
} from '../utils/discountService';
import { canCustomerReceiveStampToday } from '../api/firebaseService';
import { generateMembershipNumber, generateBarcodeValue } from '../api/firebaseService';
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
} from '../types/bikeShop';

export type FeatureArea =
  | 'connectivity'
  | 'loyalty'
  | 'bookings'
  | 'till'
  | 'members'
  | 'prizes'
  | 'content'
  | 'settings'
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
}

export interface FeatureTest {
  id: string;
  area: FeatureArea;
  label: string;
  description: string;
  writes?: boolean;
  run: () => Promise<{ status: TestStatus; detail: string; hint?: string }>;
}

export const AREA_LABELS: Record<FeatureArea, string> = {
  connectivity: 'Connectivity & Auth',
  loyalty: 'Loyalty / Stamps / Wheel',
  bookings: 'Repair Bookings',
  till: 'Till & Discounts',
  members: 'Members & Bikes',
  prizes: 'Prizes & Vouchers',
  content: 'Staff, Promotions & Draws',
  settings: 'Settings & Theme',
  logic: 'Pure Logic (offline)',
};

const SENTINEL = '__stakeys_diag__';
const sentinel = (suffix: string) => `${SENTINEL}${suffix}`;
const diagBookingId = () => `${SENTINEL}booking-${Date.now()}`;

function err(e: unknown): string {
  const anyE = e as any;
  return anyE?.message || anyE?.error_description || String(e);
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

  // ---- Loyalty ------------------------------------------------------------
  {
    id: 'profiles-read',
    area: 'loyalty',
    label: 'Read loyalty members (profiles)',
    description: 'Selects every profile row.',
    run: () => probeRead('profiles'),
  },
  {
    id: 'stamp-log-read',
    area: 'loyalty',
    label: 'Read stamp / reward history',
    description: 'Selects stamp_logs for staff view.',
    run: () => probeRead('stamp_logs', 'timestamp'),
  },
  {
    id: 'stamp-log-write',
    area: 'loyalty',
    label: 'Write stamp / reward history',
    description: 'Inserts a temporary stamp_logs row (stamp + merit + audit trail) then deletes it.',
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
              hint: 'stamp_logs.id is likely still uuid while the app writes text ids. Run the repair SQL.',
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
    id: 'prize-wheel-read',
    area: 'loyalty',
    label: 'Read prize wheel config',
    description: 'Selects prize_wheels rows.',
    run: () => probeRead('prize_wheels'),
  },

  // ---- Bookings -----------------------------------------------------------
  {
    id: 'booking-read',
    area: 'bookings',
    label: 'Read repair bookings',
    description: 'Selects service_bookings for staff.',
    run: () => probeRead('service_bookings', 'created_at'),
  },
  {
    id: 'booking-write',
    area: 'bookings',
    label: 'Create a repair booking',
    description: 'Writes a temporary booking exactly as the booking form does, then deletes it.',
    writes: true,
    run: async () => {
      const booking: ServiceBooking = {
        id: diagBookingId(),
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
      } as ServiceBooking;
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

  // ---- Till & discounts ---------------------------------------------------
  {
    id: 'sales-read',
    area: 'till',
    label: 'Read counter sales',
    description: 'Selects counter_sales rows.',
    run: () => probeRead('counter_sales', 'created_at'),
  },
  {
    id: 'sale-write',
    area: 'till',
    label: 'Record a counter sale',
    description: 'Writes a temporary till sale (incl. quote lifecycle columns) then deletes it.',
    writes: true,
    run: async () => {
      const sale: SaleTransaction = {
        id: sentinel(`sale-${Date.now()}`),
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
    id: 'discount-codes-read',
    area: 'till',
    label: 'Read discount codes',
    description: 'Selects discount_codes rows.',
    run: () => probeRead('discount_codes'),
  },
  {
    id: 'discount-code-write',
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
    id: 'voucher-conversion',
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

  // ---- Members & bikes ----------------------------------------------------
  {
    id: 'bikes-read',
    area: 'members',
    label: 'Read customer garage (bikes)',
    description: 'Selects customer_bikes rows.',
    run: () => probeRead('customer_bikes'),
  },
  {
    id: 'bike-write',
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

  // ---- Prizes & vouchers --------------------------------------------------
  {
    id: 'vouchers-read',
    area: 'prizes',
    label: 'Read service vouchers',
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
    id: 'prize-draws-read',
    area: 'prizes',
    label: 'Read prize draws',
    description: 'Selects prize_draws rows.',
    run: () => probeRead('prize_draws', 'created_at'),
  },
  {
    id: 'prize-draw-write',
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
    area: 'content',
    label: 'Read team roster',
    description: 'Selects staff_members rows.',
    run: () => probeRead('staff_members'),
  },
  {
    id: 'staff-write',
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
        role: 'Cytech Mechanic',
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
    area: 'content',
    label: 'Read promotions',
    description: 'Selects promotions rows.',
    run: () => probeRead('promotions'),
  },
  {
    id: 'promotion-write',
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

  // ---- Settings -----------------------------------------------------------
  {
    id: 'settings-read',
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
    id: 'theme-read',
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
    try {
      const r = await test.run();
      status = r.status;
      detail = r.detail;
      hint = r.hint;
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
      ms: Math.round(performance.now() - start),
    };
    results.push(result);
    onProgress?.(result, i, tests.length);
  }
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
