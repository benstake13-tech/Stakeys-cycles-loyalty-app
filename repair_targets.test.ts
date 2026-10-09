import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the resolver unit-testable: stub the Supabase URL + OneSignal App ID
// sources so we assert the URLs without touching real config or the SDK.
vi.mock('./src/supabase', () => ({
  getStoredSupabaseUrl: () => 'https://lhojocpygcnkxvkrcuxh.supabase.co',
}));
vi.mock('./src/utils/pushNotifications', () => ({
  getConfiguredAppId: () => 'app-123',
}));

import {
  resolveRepairTarget,
  supabaseSqlEditorUrl,
  oneSignalDashboardUrl,
} from './src/utils/repairTargets';

beforeEach(() => {
  localStorage.clear();
});

describe('repairTargets resolver', () => {
  it('maps a Supabase-backed area to the SQL Editor with copy-ready repair SQL', () => {
    const target = resolveRepairTarget({ area: 'members', tables: ['profiles'] });
    expect(target.service).toBe('supabase');
    expect(target.label).toMatch(/SQL Editor/i);
    expect(target.openUrl).toBe('https://supabase.com/dashboard/project/lhojocpygcnkxvkrcuxh/sql');
    expect(typeof target.copySql).toBe('function');
    expect(target.copySql!().length).toBeGreaterThan(0);
    expect(target.copySql!()).toContain('profiles');
  });

  it('maps the push/reach area to OneSignal (no SQL)', () => {
    const target = resolveRepairTarget({ area: 'reach', tables: [] });
    expect(target.service).toBe('onesignal');
    expect(target.copySql).toBeUndefined();
    expect(target.openUrl).toBe('https://dashboard.onesignal.com/apps/app-123');
  });

  it('maps email to the email target', () => {
    const target = resolveRepairTarget({ area: 'email' });
    expect(target.service).toBe('email');
    expect(target.openUrl).toBeUndefined();
  });

  it('maps pure-logic and scanner areas to no external service', () => {
    expect(resolveRepairTarget({ area: 'logic' }).service).toBe('none');
    expect(resolveRepairTarget({ area: 'scanner' }).service).toBe('none');
  });

  it('offers the UUID-safe balance probe for the balance-write test', () => {
    const target = resolveRepairTarget({ area: 'loyalty', tables: ['profiles'], id: 'profile-balance-write' });
    expect(target.service).toBe('supabase');
    // The balance probe is a distinct SQL body from a generic table repair.
    const generic = resolveRepairTarget({ area: 'loyalty', tables: ['profiles'] }).copySql!();
    expect(target.copySql!()).not.toBe(generic);
  });

  it('builds stable dashboard URLs', () => {
    expect(supabaseSqlEditorUrl()).toContain('/project/lhojocpygcnkxvkrcuxh/sql');
    expect(oneSignalDashboardUrl('abc')).toBe('https://dashboard.onesignal.com/apps/abc');
  });
});
