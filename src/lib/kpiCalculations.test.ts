import { describe, expect, it } from 'vitest';
import { compareTarget, summariseSales } from './kpiCalculations';
describe('sales KPI calculations', () => {
  const base = { id: '1', status: 'completed' as const, totalPence: 10000, completedAt: '2026-10-13T10:00:00Z' };
  it('excludes voids and pending sales', () => {
    expect(summariseSales([base, { ...base, id: '2', status: 'voided' }, { ...base, id: '3', status: 'pending' }])).toEqual({ netSalesPence: 10000, completedTransactions: 1 });
  });
  it('deduplicates synchronised records and subtracts refunds', () => {
    expect(summariseSales([{ ...base, refundPence: 2500 }, { ...base, refundPence: 2500 }])).toEqual({ netSalesPence: 7500, completedTransactions: 1 });
  });
  it('rejects impossible refunds', () => expect(() => summariseSales([{ ...base, refundPence: 10001 }])).toThrow());
  it('calculates target status', () => {
    expect(compareTarget(50, 100).status).toBe('behind');
    expect(compareTarget(100, 100).status).toBe('achieved');
    expect(compareTarget(101, 100).status).toBe('exceeded');
  });
});
