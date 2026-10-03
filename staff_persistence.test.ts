import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fake that understands the small slice of the Supabase query
// builder these persistence helpers use: select().order(), select().eq().maybeSingle(),
// upsert(), and delete().eq().
const hoisted = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  upserts: [] as any[],
  deletes: [] as any[],
}));

function tableRows(name: string): any[] {
  if (!hoisted.tables[name]) hoisted.tables[name] = [];
  return hoisted.tables[name];
}

function makeBuilder(name: string, mode: 'select' | 'delete' | 'upsert', payload?: any, opts?: any) {
  const builder: any = {
    _eq: null as null | { col: string; val: any },
    select: () => builder,
    order: () => Promise.resolve({ data: tableRows(name), error: null }),
    eq: (col: string, val: any) => {
      builder._eq = { col, val };
      return builder;
    },
    maybeSingle: () => {
      const rows = tableRows(name);
      const match = builder._eq ? rows.find((r) => r[builder._eq.col] === builder._eq.val) : rows[0];
      return Promise.resolve({ data: match ?? null, error: null });
    },
    upsert: (p: any, o: any) => {
      hoisted.upserts.push({ table: name, payload: p, opts: o });
      const rows = tableRows(name);
      const idx = rows.findIndex((r) => r.id === p.id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...p };
      else rows.push({ ...p });
      return Promise.resolve({ error: null });
    },
    delete: () => {
      hoisted.deletes.push({ table: name });
      return builder;
    },
    then: (resolve: any) => {
      // delete().eq() resolves here; also makes the object awaitable.
      if (mode === 'delete' && builder._eq) {
        const rows = tableRows(name);
        const remaining = rows.filter((r) => r[builder._eq.col] !== builder._eq.val);
        hoisted.tables[name] = remaining;
      }
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => ({
      select: () => makeBuilder(name, 'select').select(),
      upsert: (p: any, o: any) => makeBuilder(name, 'upsert', p, o).upsert(p, o),
      delete: () => makeBuilder(name, 'delete').delete(),
    }),
  }),
}));

import {
  fetchStaffMembersFromDb,
  upsertStaffMemberToDb,
  deleteStaffMemberFromDb,
  fetchPromotionsFromDb,
  upsertPromotionToDb,
  deletePromotionFromDb,
  fetchAppSettingsFromDb,
  upsertAppSettingsToDb,
} from './src/api/backendDataService';

beforeEach(() => {
  hoisted.tables = {};
  hoisted.upserts = [];
  hoisted.deletes = [];
});

describe('staff roster persistence', () => {
  it('upserts a staff member with snake_case columns', async () => {
    const ok = await upsertStaffMemberToDb({
      id: 'staff-1',
      name: 'Ben',
      email: 'ben@stakeys.co.uk',
      phone: '07700 900123',
      role: 'Cytech Mechanic',
      status: 'Active',
      joinedDate: '2024-01-01',
      cytechLevel: 'Cytech Level 2',
      notes: 'Lead mechanic',
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts).toHaveLength(1);
    expect(hoisted.upserts[0].table).toBe('staff_members');
    expect(hoisted.upserts[0].payload.joined_date).toBe('2024-01-01');
    expect(hoisted.upserts[0].payload.cytech_level).toBe('Cytech Level 2');
  });

  it('reads staff back out of the database', async () => {
    await upsertStaffMemberToDb({
      id: 'staff-2',
      name: 'Ada',
      email: 'ada@stakeys.co.uk',
      phone: '07700 900456',
      role: 'Admin',
      status: 'On Leave',
      joinedDate: '2023-05-05',
    });
    const members = await fetchStaffMembersFromDb();
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('Ada');
    expect(members[0].status).toBe('On Leave');
  });

  it('deletes a staff member', async () => {
    await upsertStaffMemberToDb({
      id: 'staff-3',
      name: 'Temp',
      email: 't@x.co',
      phone: '1',
      role: 'Barista',
      status: 'Active',
      joinedDate: '2024-01-01',
    });
    expect(tableCount('staff_members')).toBe(1);
    const ok = await deleteStaffMemberFromDb('staff-3');
    expect(ok).toBe(true);
    expect(tableCount('staff_members')).toBe(0);
  });
});

describe('promotions persistence', () => {
  it('round-trips a promotion including JSONB arrays', async () => {
    await upsertPromotionToDb({
      id: 'promo-1',
      title: 'Summer Sale',
      subtitle: '10% off',
      code: 'SUMMER10',
      discountPercentage: 10,
      badgeText: 'HOT',
      status: 'active',
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      termsAndConditions: ['One per customer'],
      eligibleCategories: ['cycle'],
      bgGradient: 'from-x to-y',
      featured: true,
    });
    const promos = await fetchPromotionsFromDb();
    expect(promos).toHaveLength(1);
    expect(promos[0].discountPercentage).toBe(10);
    expect(promos[0].termsAndConditions).toEqual(['One per customer']);
    expect(promos[0].featured).toBe(true);
    expect(hoisted.upserts[0].payload.eligible_categories).toEqual(['cycle']);
  });

  it('deletes a promotion', async () => {
    await upsertPromotionToDb({
      id: 'promo-2',
      title: 'X',
      subtitle: '',
      code: '',
      badgeText: '',
      status: 'active',
      startDate: '',
      endDate: '',
      termsAndConditions: [],
      eligibleCategories: [],
      bgGradient: '',
    });
    await deletePromotionFromDb('promo-2');
    expect(tableCount('promotions')).toBe(0);
  });
});

describe('app settings persistence', () => {
  it('upserts only the provided fields and reads them back', async () => {
    await upsertAppSettingsToDb({ ownerEmail: 'workshop@stakeys.co.uk' });
    await upsertAppSettingsToDb({ emailAlertsEnabled: true });
    const settings = await fetchAppSettingsFromDb();
    expect(settings?.ownerEmail).toBe('workshop@stakeys.co.uk');
    expect(settings?.emailAlertsEnabled).toBe(true);
  });

  it('persists the automated reminders toggle', async () => {
    await upsertAppSettingsToDb({ automatedRemindersEnabled: false });
    const settings = await fetchAppSettingsFromDb();
    expect(settings?.automatedRemindersEnabled).toBe(false);
  });
});

function tableCount(name: string): number {
  return (hoisted.tables[name] || []).length;
}
