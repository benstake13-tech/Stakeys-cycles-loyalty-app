import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake the Supabase builder slices the bike-details persistence path uses:
//   from(table).insert(payload)            -> { error }
//   from(table).update(payload).eq(...)    -> { error }
const hoisted = vi.hoisted(() => ({
  inserts: [] as any[],
  updates: [] as any[],
  /** When true, the first insert on a table fails as if the column is missing. */
  failFirstInsert: false,
  failedTables: new Set<string>(),
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => ({
      insert: (payload: any) => {
        hoisted.inserts.push({ table: name, payload });
        if (hoisted.failFirstInsert && !hoisted.failedTables.has(name)) {
          hoisted.failedTables.add(name);
          return Promise.resolve({ error: { code: 'PGRST204', message: 'column does not exist' } });
        }
        return Promise.resolve({ error: null });
      },
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          hoisted.updates.push({ table: name, payload, col, val });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  }),
}));

import {
  insertServiceBookingToDb,
  insertCustomerBikeToDb,
  updateServiceBookingInDb,
} from './src/api/backendDataService';

beforeEach(() => {
  hoisted.inserts = [];
  hoisted.updates = [];
  hoisted.failFirstInsert = false;
  hoisted.failedTables = new Set<string>();
});

describe('bike_details persistence', () => {
  it('writes bikeDetails to the bike_details column on a booking insert', async () => {
    await insertServiceBookingToDb({
      id: 'bk-9',
      customerName: 'A Rider',
      customerPhone: '07000',
      customerEmail: 'a@b.c',
      vehicleCategory: 'ebike',
      vehicleModel: 'Trek - Powerfly',
      bikeDetails: { ebikeStatus: 'converted', conversionSystem: 'Bafang BBSHD' },
      serviceId: 'ebike-complete',
      serviceTitle: 'E-Bike Service',
      servicePrice: 0,
      preferredDate: '2026-10-10',
      preferredTimeSlot: 'Morning',
      status: 'pending',
      notifications: [],
    } as any);

    expect(hoisted.inserts[0].table).toBe('service_bookings');
    expect(hoisted.inserts[0].payload.bike_details).toEqual({
      ebikeStatus: 'converted',
      conversionSystem: 'Bafang BBSHD',
    });
  });

  it('retries without bike_details when the column is missing (schema drift)', async () => {
    hoisted.failFirstInsert = true;

    const ok = await insertServiceBookingToDb({
      id: 'bk-10',
      customerName: 'A Rider',
      customerPhone: '07000',
      customerEmail: 'a@b.c',
      vehicleCategory: 'ebike',
      vehicleModel: 'Trek - Powerfly',
      bikeDetails: { ebikeStatus: 'factory' },
      serviceId: 'ebike-complete',
      serviceTitle: 'E-Bike Service',
      servicePrice: 0,
      preferredDate: '2026-10-10',
      preferredTimeSlot: 'Morning',
      status: 'pending',
      notifications: [],
    } as any);

    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(2);
    expect(hoisted.inserts[0].payload.bike_details).toBeDefined();
    expect(hoisted.inserts[1].payload.bike_details).toBeUndefined();
  });

  it('writes bikeDetails to the customer_bikes column and retries on drift', async () => {
    hoisted.failFirstInsert = true;

    const ok = await insertCustomerBikeToDb(
      {
        id: 'bike-1',
        category: 'ebike',
        categoryLabel: 'Electric',
        brand: 'Trek',
        model: 'Powerfly',
        colour: 'Black',
        bikeDetails: { ebikeStatus: 'factory', batteryPosition: 'Downtube' },
      } as any,
      'user-1'
    );

    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(2);
    expect(hoisted.inserts[0].payload.bike_details).toEqual({
      ebikeStatus: 'factory',
      batteryPosition: 'Downtube',
    });
    // Even on the fallback the details survive inside scraped_data.meta.
    expect(hoisted.inserts[1].payload.bike_details).toBeUndefined();
    expect(hoisted.inserts[1].payload.scraped_data.meta.bikeDetails).toEqual({
      ebikeStatus: 'factory',
      batteryPosition: 'Downtube',
    });
  });

  it('maps bikeDetails onto the bike_details column for booking updates', async () => {
    await updateServiceBookingInDb('bk-11', {
      bikeDetails: { ebikeStatus: 'converted', motorDetails: '750W kit' },
    } as any);

    expect(hoisted.updates[0].payload.bike_details).toEqual({
      ebikeStatus: 'converted',
      motorDetails: '750W kit',
    });
  });
});
