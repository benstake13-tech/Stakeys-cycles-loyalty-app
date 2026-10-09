import { describe, it, expect } from 'vitest';
import {
  planPromotion,
  deriveStatus,
  generatePromoCode,
  buildTimeline,
  suggestWindows,
  applyDurationPreset,
  addDays,
  daysBetween,
  toDateOnly,
} from './src/utils/promotionPlanner';
import { ShopPromotion } from './src/types/bikeShop';
import { PlannerInput } from './src/utils/promotionPlanner';

const TODAY = new Date(2026, 5, 15); // 15 Jun 2026 (a Monday)

const promo = (over: Partial<ShopPromotion>): ShopPromotion => ({
  id: over.id || Math.random().toString(36).slice(2),
  title: over.title || 'Campaign',
  subtitle: '',
  code: over.code || 'STK-XXX',
  badgeText: '',
  status: over.status || 'active',
  startDate: over.startDate || '2026-06-01',
  endDate: over.endDate || '2026-06-30',
  termsAndConditions: [],
  eligibleCategories: over.eligibleCategories || ['cycle'],
  bgGradient: '',
  discountPercentage: over.discountPercentage ?? 10,
});

describe('deriveStatus', () => {
  it('is active when today is inside the range', () => {
    expect(deriveStatus('2026-06-01', '2026-06-30', TODAY)).toBe('active');
  });
  it('is upcoming before the start and expired after the end', () => {
    expect(deriveStatus('2026-07-01', '2026-07-10', TODAY)).toBe('upcoming');
    expect(deriveStatus('2026-05-01', '2026-05-10', TODAY)).toBe('expired');
  });
});

describe('date helpers', () => {
  it('adds days and measures spans', () => {
    expect(addDays('2026-06-15', 29)).toBe('2026-07-14');
    expect(daysBetween('2026-06-15', '2026-07-14')).toBe(29);
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('generatePromoCode', () => {
  it('derives a code from the title initials and avoids clashes', () => {
    expect(generatePromoCode('Spring Drivetrain', [])).toBe('STK-SPR');
    const clash = [promo({ code: 'STK-SPR' })];
    expect(generatePromoCode('Spring Drivetrain', clash)).toBe('STK-SPR1');
  });
});

describe('planPromotion', () => {
  it('summarises a valid plan with no warnings', () => {
    const plan = planPromotion(
      { title: 'Summer Sale', discountPercentage: 20, startDate: '2026-06-15', endDate: '2026-06-29', eligibleCategories: ['cycle'] },
      [],
      { today: TODAY }
    );
    expect(plan.status).toBe('active');
    expect(plan.durationDays).toBe(15);
    expect(plan.warnings).toEqual([]);
    expect(plan.summary).toMatch(/15-day 20% off campaign/);
  });

  it('warns when dates are reversed', () => {
    const plan = planPromotion(
      { title: 'Oops', discountPercentage: 10, startDate: '2026-06-20', endDate: '2026-06-10', eligibleCategories: ['cycle'] },
      [],
      { today: TODAY }
    );
    expect(plan.warnings.some((w) => /before the start/i.test(w))).toBe(true);
  });

  it('flags overlaps with a live campaign in the same category', () => {
    const existing = [promo({ title: 'June Deal', startDate: '2026-06-10', endDate: '2026-06-25', eligibleCategories: ['cycle'] })];
    const plan = planPromotion(
      { title: 'Clash', discountPercentage: 15, startDate: '2026-06-20', endDate: '2026-07-05', eligibleCategories: ['cycle'] },
      existing,
      { today: TODAY }
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.warnings.some((w) => /Overlaps 1 live campaign/.test(w))).toBe(true);
  });

  it('does not flag an overlap in a different category', () => {
    const existing = [promo({ startDate: '2026-06-10', endDate: '2026-06-25', eligibleCategories: ['ebike'] })];
    const plan = planPromotion(
      { title: 'No clash', discountPercentage: 15, startDate: '2026-06-20', endDate: '2026-07-05', eligibleCategories: ['cycle'] },
      existing,
      { today: TODAY }
    );
    expect(plan.conflicts).toHaveLength(0);
  });

  it('warns when no discount is set', () => {
    const plan = planPromotion(
      { title: 'No discount', discountPercentage: 0, discountAmount: 0, startDate: '2026-06-15', endDate: '2026-06-20', eligibleCategories: ['cycle'] },
      [],
      { today: TODAY }
    );
    expect(plan.warnings.some((w) => /No discount set/i.test(w))).toBe(true);
  });
});

describe('applyDurationPreset', () => {
  it('snaps the weekend preset to the coming Friday→Sunday', () => {
    const { startDate, endDate } = applyDurationPreset('weekend', '2026-06-15', TODAY);
    expect(startDate).toBe('2026-06-19'); // Friday
    expect(endDate).toBe('2026-06-21'); // Sunday
  });
  it('counts a fixed span for numeric presets', () => {
    const { endDate } = applyDurationPreset('30d', '2026-06-15', TODAY);
    expect(endDate).toBe('2026-07-14');
  });
});

describe('buildTimeline', () => {
  it('positions the planned campaign and marks a clash', () => {
    const existing = [promo({ title: 'Live', startDate: '2026-06-10', endDate: '2026-06-25', eligibleCategories: ['cycle'] })];
    const planned: PlannerInput = { title: 'Plan', discountPercentage: 10, startDate: '2026-06-20', endDate: '2026-07-05', eligibleCategories: ['cycle'] };
    const tl = buildTimeline(existing, planned, { today: TODAY, spanDays: 120 });
    const plannedRow = tl.rows.find((r) => r.isPlanned);
    expect(plannedRow).toBeTruthy();
    expect(plannedRow!.tone).toBe('conflict');
    expect(plannedRow!.leftPct).toBeGreaterThanOrEqual(0);
    expect(plannedRow!.widthPct).toBeGreaterThan(0);
  });

  it('omits campaigns entirely outside the window', () => {
    const far = [promo({ startDate: '2027-01-01', endDate: '2027-02-01' })];
    const tl = buildTimeline(far, null, { today: TODAY, spanDays: 120 });
    expect(tl.rows).toHaveLength(0);
  });
});

describe('suggestWindows', () => {
  it('returns clear stretches when the calendar is empty', () => {
    const windows = suggestWindows([], { today: TODAY, horizonDays: 180, minDays: 7, count: 3 });
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].days).toBeGreaterThanOrEqual(7);
  });

  it('skips over a busy period', () => {
    const busy = [promo({ status: 'active', startDate: '2026-06-15', endDate: '2026-08-15' })];
    const windows = suggestWindows(busy, { today: TODAY, horizonDays: 180, minDays: 7, count: 1 });
    if (windows.length) {
      expect(daysBetween('2026-08-15', windows[0].startDate)).toBeGreaterThan(0);
    }
  });
});
