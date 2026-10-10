import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updates: [] as any[],
  upserts: [] as any[],
  selectResults: [] as any[],
  updateResults: [] as any[],
  upsertResults: [] as any[],
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      update: (payload: any) => {
        hoisted.updates.push({ table, payload });
        const result = hoisted.updateResults.shift() ?? { error: null, data: [{ id: 'x' }] };
        const chain: any = {
          eq: () => chain,
          select: () => chain,
          maybeSingle: () => Promise.resolve(result),
          single: () => Promise.resolve(result),
          then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
        };
        return chain;
      },
      upsert: (payload: any, opts: any) => {
        hoisted.upserts.push({ table, payload, opts });
        return Promise.resolve(hoisted.upsertResults.shift() ?? { error: null });
      },
      select: () => {
        const result = hoisted.selectResults.shift() ?? { error: null, data: null };
        const chain: any = {
          eq: () => chain,
          maybeSingle: () => Promise.resolve(result),
          single: () => Promise.resolve(result),
          then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
        };
        return chain;
      },
    }),
  }),
}));

import { updateUserProfileInDb, upsertAppSettingsToDb, fetchAppSettingsFromDb } from './src/api/backendDataService';
import { DEFAULT_SCRATCH_CARD } from './src/utils/scratchCardHelper';

beforeEach(() => {
  hoisted.updates = [];
  hoisted.upserts = [];
  hoisted.selectResults = [];
  hoisted.updateResults = [];
  hoisted.upsertResults = [];
});

describe('scratch card profile persistence', () => {
  it('writes last_scratched_at as an ISO string when a Date is supplied', async () => {
    const when = new Date('2026-10-08T15:00:00Z');
    const ok = await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', {
      stamps: 4,
      tickets: 2,
      points: 120,
      lastScratchedAt: when,
    });
    expect(ok).toBe(true);
    const payload = hoisted.updates[0].payload;
    expect(payload.last_scratched_at).toBe('2026-10-08T15:00:00.000Z');
    expect(payload.stamps).toBe(4);
    expect(payload.completed_cards).toBe(2);
    expect(payload.merit_points).toBe(120);
  });

  it('omits last_scratched_at when the update does not touch it', async () => {
    await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', { stamps: 5 });
    expect(hoisted.updates[0].payload.last_scratched_at).toBeUndefined();
  });
});

describe('scratch card app_settings persistence', () => {
  it('writes scratch_card_config to the shared settings row', async () => {
    const cfg = { ...DEFAULT_SCRATCH_CARD, enabled: true, title: 'Golden Card' };
    const ok = await upsertAppSettingsToDb({ scratchCardConfig: cfg });
    expect(ok).toBe(true);
    expect(hoisted.upserts[0].table).toBe('app_settings');
    expect(hoisted.upserts[0].payload.scratch_card_config).toEqual(cfg);
    expect(hoisted.upserts[0].payload.id).toBe(1);
  });

  it('omits scratch_card_config when not supplied', async () => {
    await upsertAppSettingsToDb({ ownerEmail: 'a@b.com' });
    expect(hoisted.upserts[0].payload.scratch_card_config).toBeUndefined();
  });
});

describe('fetchAppSettingsFromDb', () => {
  it('normalizes a stored scratch_card_config blob', async () => {
    hoisted.selectResults.push({
      error: null,
      data: {
        id: 1,
        owner_email: 'shop@example.com',
        scratch_card_config: {
          title: 'X',
          enabled: true,
          cooldownHours: -5,
          prizes: [{ label: 'Free Tube', weight: 3, rewardType: 'merch' }],
        },
      },
    });

    const settings = await fetchAppSettingsFromDb();
    expect(settings?.scratchCardConfig?.enabled).toBe(true);
    expect(settings?.scratchCardConfig?.cooldownHours).toBe(0);
    expect(settings?.scratchCardConfig?.prizes[0].label).toBe('Free Tube');
  });

  it('leaves scratchCardConfig undefined when the column is null (schema drift)', async () => {
    hoisted.selectResults.push({ error: null, data: { id: 1, owner_email: 'shop@example.com' } });
    const settings = await fetchAppSettingsFromDb();
    expect(settings?.scratchCardConfig).toBeUndefined();
  });
});
