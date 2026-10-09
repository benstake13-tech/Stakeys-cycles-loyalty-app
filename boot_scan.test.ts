import { describe, it, expect, vi } from 'vitest';
import {
  summarizeBootScan,
  BOOT_EXCLUDED_AREAS,
  FEATURE_TESTS,
  type BootScanSummary,
} from './src/utils/featureDiagnostics';
import type { FeatureTestResult } from './src/utils/featureDiagnostics';
import { resolveRepairTarget } from './src/utils/repairTargets';
import { executeRepairTarget } from './src/utils/repairRunner';

const r = (over: Partial<FeatureTestResult>): FeatureTestResult => ({
  id: 'x',
  area: 'logic',
  label: 'x',
  status: 'pass',
  detail: '',
  ms: 1,
  ...over,
});

describe('summarizeBootScan', () => {
  it('reports healthy and no fix when everything passes', () => {
    const s: BootScanSummary = summarizeBootScan([
      r({ id: 'a', area: 'connectivity', status: 'pass' }),
      r({ id: 'b', area: 'members', status: 'pass' }),
      r({ id: 'c', area: 'logic', status: 'skipped' }),
    ]);
    expect(s.healthy).toBe(true);
    expect(s.failingArea).toBeUndefined();
    expect(s.problems).toHaveLength(0);
    expect(s.counts).toEqual({ pass: 2, fail: 0, warn: 0, skipped: 1 });
  });

  it('picks the highest-priority failing area and resolves it to a Supabase target', () => {
    const s = summarizeBootScan([
      r({ id: 'm', area: 'members', status: 'fail', tables: ['profiles'] }),
      r({ id: 'c', area: 'connectivity', status: 'fail', tables: ['service_bookings'] }),
    ]);
    expect(s.healthy).toBe(false);
    expect(s.failingArea).toBe('connectivity');
    const target = resolveRepairTarget({ area: s.failingArea!, tables: s.problems.flatMap((p) => p.tables ?? []) });
    expect(target.service).toBe('supabase');
    expect(target.tables).toContain('service_bookings');
    expect(target.tables).toContain('profiles');
    expect(typeof target.copySql).toBe('function');
  });

  it('ignores self-test limitations and routes a reach failure to OneSignal', () => {
    const s = summarizeBootScan([
      r({ id: 'profile-balance-write', area: 'loyalty', status: 'fail', selfTestLimited: true }),
      r({ id: 'push-reach', area: 'reach', status: 'fail' }),
    ]);
    expect(s.failingArea).toBe('reach');
    expect(resolveRepairTarget({ area: s.failingArea! }).service).toBe('onesignal');
  });

  it('treats warnings as problems but keeps them below failures', () => {
    const s = summarizeBootScan([
      r({ id: 'w', area: 'settings', status: 'warn' }),
      r({ id: 'f', area: 'members', status: 'fail' }),
    ]);
    expect(s.failingArea).toBe('members');
    expect(s.counts.warn).toBe(1);
  });
});

describe('boot scan excludes email/push delivery checks', () => {
  it('never runs an email or reach test during the boot scan', () => {
    const bootIds = new Set(
      FEATURE_TESTS.filter((t) => !BOOT_EXCLUDED_AREAS.includes(t.area)).map((t) => t.id)
    );
    const leaked = FEATURE_TESTS.filter(
      (t) => (t.area === 'email' || t.area === 'reach') && bootIds.has(t.id)
    );
    expect(leaked).toHaveLength(0);
    // The excluded areas genuinely have checks that would otherwise fire.
    expect(FEATURE_TESTS.some((t) => t.area === 'email')).toBe(true);
    expect(FEATURE_TESTS.some((t) => t.area === 'reach')).toBe(true);
  });
});

describe('executeRepairTarget', () => {
  it('copies the repair SQL and opens the editor for a Supabase target', async () => {
    const copySql = vi.fn();
    const openUrl = vi.fn();
    const target = resolveRepairTarget({ area: 'members', tables: ['profiles'] });
    await executeRepairTarget(target, { copySql, openUrl });
    expect(copySql).toHaveBeenCalledTimes(1);
    expect((copySql.mock.calls[0][0] as string).length).toBeGreaterThan(0);
    expect(openUrl).toHaveBeenCalledWith(target.openUrl);
  });

  it('runs the push repair chain then opens OneSignal for a reach target', async () => {
    const runPushRepair = vi.fn(async () => {});
    const openUrl = vi.fn();
    await executeRepairTarget(resolveRepairTarget({ area: 'reach' }), { runPushRepair, openUrl });
    expect(runPushRepair).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalled();
  });

  it('navigates to email settings for an email target and does nothing for none', async () => {
    const onEmail = vi.fn();
    await executeRepairTarget(resolveRepairTarget({ area: 'email' }), { onEmail });
    expect(onEmail).toHaveBeenCalledTimes(1);

    const openUrl = vi.fn();
    await executeRepairTarget(resolveRepairTarget({ area: 'logic' }), { openUrl });
    expect(openUrl).not.toHaveBeenCalled();
  });
});
