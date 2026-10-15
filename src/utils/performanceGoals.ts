/**
 * Staff growth-scorecard definitions. The observed values come from real
 * workshop bookings, loyalty accounts and completed till sales; only targets
 * are user-configurable.
 */
import type { SaleTransaction, ServiceBooking, UserProfile } from '../types/bikeShop';
import { summarizePerformance } from './performanceTracker';

export const GOAL_IDS = ['requests7d', 'phone7d', 'callConversionPct', 'activeRiders', 'signups30d', 'sales30dPounds', 'transactions30d', 'repeatCustomers'] as const;
export type GoalId = typeof GOAL_IDS[number];
export type GoalTargets = Record<GoalId, number>;

export const DEFAULT_GOALS: GoalTargets = {
  requests7d: 12,
  phone7d: 4,
  callConversionPct: 70,
  activeRiders: 50,
  signups30d: 20,
  sales30dPounds: 5000,
  transactions30d: 40,
  repeatCustomers: 10,
};

export const GOAL_META: Record<GoalId, { label: string; period: string; description: string; unit: string; group: 'Bookings' | 'Customers' | 'Sales' }> = {
  requests7d: { label: 'Workshop enquiries', period: 'Last 7 days', description: 'New service bookings', unit: '', group: 'Bookings' },
  phone7d: { label: 'Phone bookings', period: 'Last 7 days', description: 'Phone calls logged as bookings', unit: '', group: 'Bookings' },
  callConversionPct: { label: 'Phone conversion', period: 'All-time', description: 'Phone bookings approved or progressed', unit: '%', group: 'Bookings' },
  activeRiders: { label: 'Engaged members', period: 'Current total', description: 'Loyalty members with one or more stamps', unit: '', group: 'Customers' },
  signups30d: { label: 'New sign-ups', period: 'Last 30 days', description: 'New customer accounts created', unit: '', group: 'Customers' },
  sales30dPounds: { label: 'Sales revenue', period: 'Last 30 days', description: 'Completed till sales, net of recorded discounts', unit: '£', group: 'Sales' },
  transactions30d: { label: 'Completed sales', period: 'Last 30 days', description: 'Paid till transactions', unit: '', group: 'Sales' },
  repeatCustomers: { label: 'Returning customers', period: 'Last 30 days', description: 'Customers with 2+ completed sales', unit: '', group: 'Sales' },
};

export function isGoalId(value: string): value is GoalId {
  return (GOAL_IDS as readonly string[]).includes(value);
}

export function isValidGoalValue(id: GoalId, value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= (id === 'callConversionPct' ? 100 : 100000000);
}

export function parseGoals(value: unknown): GoalTargets {
  const result = { ...DEFAULT_GOALS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  for (const id of GOAL_IDS) if (isValidGoalValue(id, record[id])) result[id] = record[id] as number;
  return result;
}

function asDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function growthSnapshot(bookings: ServiceBooking[], users: UserProfile[], sales: SaleTransaction[] = [], now = new Date()): GoalTargets {
  const summary = summarizePerformance(bookings);
  const since = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const customers = users.filter(u => u.role === 'customer');
  const completed = sales.filter(s => {
    const time = asDate(s.createdAt)?.getTime() ?? 0;
    return (!s.status || s.status === 'completed') && time >= since && time <= now.getTime();
  });
  const salesByCustomer = new Map<string, number>();
  for (const sale of completed) {
    const key = sale.customerId || sale.membershipNumber;
    if (key) salesByCustomer.set(key, (salesByCustomer.get(key) || 0) + 1);
  }
  return {
    requests7d: summary.requests7d,
    phone7d: summary.phone7d,
    callConversionPct: summary.callConversionPct,
    activeRiders: customers.filter(u => (u.stamps ?? 0) > 0).length,
    signups30d: customers.filter(u => (asDate(u.createdAt)?.getTime() ?? 0) >= since && (asDate(u.createdAt)?.getTime() ?? Infinity) <= now.getTime()).length,
    sales30dPounds: Math.round(completed.reduce((sum, s) => sum + Math.max(0, s.grandTotal), 0)),
    transactions30d: completed.length,
    repeatCustomers: [...salesByCustomer.values()].filter(count => count > 1).length,
  };
}

export function goalProgress(actual: number, target: number) {
  const reached = actual >= target;
  const remaining = Math.max(0, target - actual);
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
  return { reached, remaining, percent, barPercent: Math.min(100, Math.max(0, percent)) };
}

export function raiseTargets(targets: GoalTargets): GoalTargets {
  return Object.fromEntries(GOAL_IDS.map(id => [id, Math.min(id === 'callConversionPct' ? 100 : 100000000, Math.max(1, Math.ceil((targets[id] * 110) / 100)))])) as GoalTargets;
}
