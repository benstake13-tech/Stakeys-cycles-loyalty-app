import { describe, it, expect } from 'vitest';
import {
  REPAIR_STAGES,
  REPAIR_STAGE_ORDER,
  deriveRepairStage,
  formatEstimate,
  makeRepairEvent,
  matchesRepairQuery,
  nextRepairStage,
  repairProgressPercent,
  repairStageIndex,
  repairStageLabel,
  stageForStatus,
  statusForStage,
} from './src/shared/utils/repairProgress';
import type { ServiceBooking } from './src/shared/types/bikeShop';

const baseBooking: ServiceBooking = {
  id: 'bk-1042',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '07911 882910',
  membershipNumber: 'STK-123456',
  vehicleCategory: 'cycle',
  vehicleModel: 'Trek Domane',
  serviceId: 'svc-1',
  serviceTitle: 'Full Service',
  servicePrice: 60,
  preferredDate: '2026-10-05',
  preferredTimeSlot: '09:00 - 10:00',
  status: 'confirmed',
  createdAt: '2026-10-03T09:00:00Z',
  notifications: [],
};

describe('repairProgress stage metadata', () => {
  it('exposes an ordered, complete stage list', () => {
    expect(REPAIR_STAGES.length).toBe(8);
    expect(REPAIR_STAGE_ORDER[0]).toBe('received');
    expect(REPAIR_STAGE_ORDER[REPAIR_STAGE_ORDER.length - 1]).toBe('collected');
    expect(new Set(REPAIR_STAGE_ORDER).size).toBe(REPAIR_STAGE_ORDER.length);
  });

  it('indexes and labels stages, clamping unknown input', () => {
    expect(repairStageIndex('received')).toBe(0);
    expect(repairStageIndex('on_the_bench')).toBe(4);
    expect(repairStageIndex(undefined)).toBe(0);
    expect(repairStageIndex('nonsense' as any)).toBe(0);
    expect(repairStageLabel('ready_for_pickup')).toBe('Ready for Collection');
  });

  it('computes monotonic progress percentages from 0 to 100', () => {
    expect(repairProgressPercent('received')).toBe(0);
    expect(repairProgressPercent('collected')).toBe(100);
    const mid = repairProgressPercent('on_the_bench');
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
    expect(repairProgressPercent('quality_check')).toBeGreaterThan(mid);
  });

  it('walks forward and stops at the final stage', () => {
    expect(nextRepairStage('received')).toBe('diagnosing');
    expect(nextRepairStage('quality_check')).toBe('ready_for_pickup');
    expect(nextRepairStage('collected')).toBeNull();
  });
});

describe('repairProgress status <-> stage mapping', () => {
  it('maps coarse statuses onto a sensible stage', () => {
    expect(stageForStatus('pending')).toBe('received');
    expect(stageForStatus('confirmed')).toBe('diagnosing');
    expect(stageForStatus('in_progress')).toBe('on_the_bench');
    expect(stageForStatus('ready_for_pickup')).toBe('ready_for_pickup');
    expect(stageForStatus('completed')).toBe('collected');
  });

  it('round-trips stages to a compatible coarse status', () => {
    expect(statusForStage('received')).toBe('confirmed');
    expect(statusForStage('awaiting_approval')).toBe('in_progress');
    expect(statusForStage('on_the_bench')).toBe('in_progress');
    expect(statusForStage('ready_for_pickup')).toBe('ready_for_pickup');
    expect(statusForStage('collected')).toBe('completed');
  });

  it('prefers an explicit staff-set stage over the coarse status', () => {
    expect(deriveRepairStage({ status: 'confirmed', repairStage: 'parts_ordered' })).toBe('parts_ordered');
    expect(deriveRepairStage({ status: 'ready_for_pickup' })).toBe('ready_for_pickup');
    expect(deriveRepairStage({ status: 'in_progress', repairStage: 'bogus' as any })).toBe('on_the_bench');
  });
});

describe('makeRepairEvent', () => {
  it('builds a timestamped stage event with a sensible default label', () => {
    const ev = makeRepairEvent({ stage: 'on_the_bench', createdBy: 'Ben' });
    expect(ev.kind).toBe('stage');
    expect(ev.stage).toBe('on_the_bench');
    expect(ev.label).toBe('On the Workshop Bench');
    expect(ev.createdBy).toBe('Ben');
    expect(Number.isNaN(Date.parse(ev.createdAt))).toBe(false);
    expect(ev.id).toMatch(/^rep-/);
  });

  it('keeps free-text notes and defaults empty notes to undefined', () => {
    expect(makeRepairEvent({ kind: 'note', note: '  ordering chain  ' }).note).toBe('ordering chain');
    expect(makeRepairEvent({ kind: 'note', note: '   ' }).note).toBeUndefined();
  });

  it('records who wrote an entry so customers and staff can be told apart', () => {
    const cust = makeRepairEvent({ kind: 'customer_note', note: 'check the headset', authorRole: 'customer' });
    expect(cust.authorRole).toBe('customer');
    const staff = makeRepairEvent({ kind: 'note', note: 'on the bench', authorRole: 'staff' });
    expect(staff.authorRole).toBe('staff');
    // Defaults to undefined when not supplied (older events).
    expect(makeRepairEvent({ kind: 'note', note: 'x' }).authorRole).toBeUndefined();
  });
});

describe('formatEstimate', () => {
  it('renders a readable date and handles empty/invalid input', () => {
    expect(formatEstimate('2026-10-06T15:30:00Z')).toMatch(/6 Oct 2026/);
    expect(formatEstimate(null)).toBeNull();
    expect(formatEstimate('')).toBeNull();
    expect(formatEstimate('not-a-date')).toBeNull();
  });
});

describe('matchesRepairQuery (public tracker lookup)', () => {
  it('matches booking id with and without the bk- prefix', () => {
    expect(matchesRepairQuery(baseBooking, 'bk-1042')).toBe(true);
    expect(matchesRepairQuery(baseBooking, '1042')).toBe(true);
    expect(matchesRepairQuery(baseBooking, 'BK-1042')).toBe(true);
  });

  it('matches a partial phone number, email, membership and name', () => {
    expect(matchesRepairQuery(baseBooking, '882910')).toBe(true);
    expect(matchesRepairQuery(baseBooking, 'ADA@EXAMPLE')).toBe(true);
    expect(matchesRepairQuery(baseBooking, 'stk-123456')).toBe(true);
    expect(matchesRepairQuery(baseBooking, 'lovelace')).toBe(true);
  });

  it('does not match unrelated or empty queries', () => {
    expect(matchesRepairQuery(baseBooking, '')).toBe(false);
    expect(matchesRepairQuery(baseBooking, '   ')).toBe(false);
    expect(matchesRepairQuery(baseBooking, 'bk-9999')).toBe(false);
    expect(matchesRepairQuery(baseBooking, 'zzz')).toBe(false);
  });
});
