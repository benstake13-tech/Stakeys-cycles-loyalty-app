import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake the Supabase query-builder slices used by the batch bike read. Every
// builder method returns `this`; the builder is thenable and resolves to the
// configured result, so we can assert the query shape the app issues.
const hoisted = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; args: any[] }[],
  rows: [] as any[],
  error: null as any,
}));

function makeBuilder(table: string) {
  const record = (op: string, ...args: any[]) => hoisted.calls.push({ table, op, args });
  const builder: any = {
    select: (...a: any[]) => { record('select', ...a); return builder; },
    eq: (...a: any[]) => { record('eq', ...a); return builder; },
    in: (...a: any[]) => { record('in', ...a); return builder; },
    or: (...a: any[]) => { record('or', ...a); return builder; },
    then: (resolve: any) => Promise.resolve({ data: hoisted.rows, error: hoisted.error }).then(resolve),
  };
  return builder;
}

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: (name: string) => makeBuilder(name) }),
}));

import { fetchBikesByOwner } from './src/api/backendDataService';
import {
  attachBikesToProfiles,
  hydrateRosterGarages,
  ownerKeysForProfile,
  ownerKeysForProfiles,
} from './src/utils/garageHydration';

beforeEach(() => {
  hoisted.calls = [];
  hoisted.rows = [];
  hoisted.error = null;
});

const bike = (id: string, brand = 'Trek') => ({
  id,
  customer_id: '',
  brand,
  model: 'Marlin',
  category: 'cycle' as const,
  categoryLabel: 'Mountain',
  addedAt: '2026-10-01',
  color: 'Blue',
  created_at: '2026-10-01T10:00:00Z',
});

describe('owner key derivation', () => {
  it('uses the profile UUID plus a non-empty membership number', () => {
    expect(ownerKeysForProfile({ uid: 'uuid-1', membershipNumber: '124' })).toEqual(['uuid-1', '124']);
  });

  it('never adds a blank membership as an owner key', () => {
    // A blank `eq.` filter matches every NULL row, which would leak the whole
    // workshop's bikes onto one customer.
    expect(ownerKeysForProfile({ uid: 'uuid-1', membershipNumber: '' })).toEqual(['uuid-1']);
    expect(ownerKeysForProfile({ uid: 'uuid-1', membershipNumber: '   ' })).toEqual(['uuid-1']);
    expect(ownerKeysForProfile({ uid: 'uuid-1' })).toEqual(['uuid-1']);
  });

  it('does not duplicate the key when membership equals the uid', () => {
    expect(ownerKeysForProfile({ uid: 'x', membershipNumber: 'x' })).toEqual(['x']);
  });

  it('de-duplicates keys across the whole roster', () => {
    const keys = ownerKeysForProfiles([
      { uid: 'a', membershipNumber: '124' },
      { uid: 'b', membershipNumber: '124' },
      { uid: 'a', membershipNumber: '125' },
    ]);
    expect(keys.sort()).toEqual(['124', '125', 'a', 'b']);
  });
});

describe('fetchBikesByOwner', () => {
  it('queries customer_bikes with one `in` filter over the owner set', async () => {
    hoisted.rows = [{ ...bike('b1'), customer_id: 'uuid-1' }];
    const { byOwner } = await fetchBikesByOwner(['uuid-1', '124']);
    const inCall = hoisted.calls.find((c) => c.op === 'in');
    expect(inCall?.args[0]).toBe('customer_id');
    expect(inCall?.args[1]).toEqual(['uuid-1', '124']);
    expect(Object.keys(byOwner)).toEqual(['uuid-1']);
  });

  it('drops blank and duplicate keys before querying', async () => {
    await fetchBikesByOwner(['uuid-1', '', '  ', 'uuid-1']);
    const inCall = hoisted.calls.find((c) => c.op === 'in');
    expect(inCall?.args[1]).toEqual(['uuid-1']);
  });

  it('skips the network entirely when there are no keys', async () => {
    const { byOwner } = await fetchBikesByOwner(['', '  ']);
    expect(hoisted.calls).toHaveLength(0);
    expect(byOwner).toEqual({});
  });

  it('groups rows by the raw customer_id and reports read errors', async () => {
    hoisted.rows = [
      { ...bike('b1'), customer_id: 'uuid-1' },
      { ...bike('b2'), customer_id: '124' },
      { ...bike('b3'), customer_id: 'uuid-1' },
    ];
    const { byOwner } = await fetchBikesByOwner(['uuid-1', '124']);
    expect(byOwner['uuid-1'].map((b) => b.id)).toEqual(['b1', 'b3']);
    expect(byOwner['124'].map((b) => b.id)).toEqual(['b2']);

    hoisted.error = { message: 'permission denied' };
    const failed = await fetchBikesByOwner(['uuid-1']);
    expect(failed.byOwner).toEqual({});
    expect(failed.error).toBe('permission denied');
  });
});

describe('attachBikesToProfiles', () => {
  const chloe = { uid: 'uuid-chloe', membershipNumber: '124' };
  const ben = { uid: 'uuid-ben', membershipNumber: '125' };

  it('attaches bikes stored under either the UUID or the membership number', () => {
    const byOwner = {
      'uuid-chloe': [bike('b1')],
      '124': [bike('b2')],
    };
    const [out] = attachBikesToProfiles([chloe], byOwner);
    expect(out.bikes.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('never shows the same bike twice when it is keyed under both owners', () => {
    const byOwner = { 'uuid-chloe': [bike('b1')], '124': [bike('b1')] };
    const [out] = attachBikesToProfiles([chloe], byOwner);
    expect(out.bikes.map((b) => b.id)).toEqual(['b1']);
  });

  it('gives an unmatched profile an explicit empty garage, not a stale one', () => {
    const [out] = attachBikesToProfiles([ben], { 'uuid-chloe': [bike('b1')] });
    expect(out.bikes).toEqual([]);
  });

  it('hydrates a whole roster without cross-contaminating owners', () => {
    const byOwner = { 'uuid-chloe': [bike('b1')], '125': [bike('b2')] };
    const out = attachBikesToProfiles([chloe, ben], byOwner);
    expect(out[0].bikes.map((b) => b.id)).toEqual(['b1']);
    expect(out[1].bikes.map((b) => b.id)).toEqual(['b2']);
  });

  it('preserves every other profile field while adding bikes', () => {
    const profile = { uid: 'u', membershipNumber: '9', displayName: 'A', stamps: 3 };
    const [out] = attachBikesToProfiles([profile], {});
    expect(out.displayName).toBe('A');
    expect(out.stamps).toBe(3);
    expect(out.bikes).toEqual([]);
  });
});

describe('hydrateRosterGarages (the roster-swap fix)', () => {
  const roster = [
    { uid: 'uuid-chloe', membershipNumber: '124' },
    { uid: 'uuid-ben', membershipNumber: '125' },
  ];

  it('re-attaches bikes the roster read does not carry, so they do not disappear', async () => {
    const reader = vi.fn(async () => ({
      byOwner: { 'uuid-chloe': [bike('b1') as any] },
    }));
    const out = await hydrateRosterGarages(roster, reader);
    expect(out[0].bikes.map((b) => b.id)).toEqual(['b1']);
    expect(out[1].bikes).toEqual([]);
    // One batch read for the whole roster, not one query per member.
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith(['uuid-chloe', '124', 'uuid-ben', '125']);
  });

  it('keeps the previous bikes when the batch read fails, so a blip cannot wipe a garage', async () => {
    const reader = vi.fn(async () => ({ byOwner: {}, error: 'permission denied' }));
    const previous = [{ uid: 'uuid-chloe', membershipNumber: '124', bikes: [bike('b1') as any] }];
    const out = await hydrateRosterGarages(roster, reader, previous);
    expect(out[0].bikes.map((b) => b.id)).toEqual(['b1']);
    expect(out[1].bikes).toEqual([]);
  });

  it('gives an empty garage when a successful read returns nothing for a member', async () => {
    const reader = vi.fn(async () => ({ byOwner: {} }));
    const out = await hydrateRosterGarages(roster, reader);
    expect(out.every((p) => p.bikes.length === 0)).toBe(true);
  });

  it('does not touch the network for an empty roster', async () => {
    const reader = vi.fn(async () => ({ byOwner: {} }));
    const out = await hydrateRosterGarages([], reader);
    expect(reader).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });
});
