/**
 * Staff growth-scorecard definitions. The observed values come from real
 * workshop bookings / loyalty accounts; only targets are user-configurable.
 */
import type { ServiceBooking, UserProfile } from '../types/bikeShop';
import { summarizePerformance } from './performanceTracker';

export const GOAL_IDS = ['requests7d', 'phone7d', 'callConversionPct', 'activeRiders'] as const;
export type GoalId = typeof GOAL_IDS[number];
export type GoalTargets = Record<GoalId, number>;

export const DEFAULT_GOALS: GoalTargets = {
  requests7d: 12,
  phone7d: 4,
  callConversionPct: 70,
  activeRiders: 50,
};

export const GOAL_META: Record<GoalId, { label: string; period: string; description: string; unit: string }> = {
  requests7d: { label: 'Workshop enquiries', period: 'Last 7 days', description: 'New service bookings', unit: '' },
  phone7d: { label: 'Phone bookings', period: 'Last 7 days', description: 'Phone calls logged as bookings', unit: '' },
  callConversionPct: { label: 'Phone conversion', period: 'All-time', description: 'Phone bookings approved or progressed', unit: '%' },
  activeRiders: { label: 'Engaged members', period: 'Current total', description: 'Loyalty members with one or more stamps', unit: '' },
};

export function isGoalId(value: string): value is GoalId {
  return (GOAL_IDS as readonly string[]).includes(value);
}

export function isValidGoalValue(id: GoalId, value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= (id === 'callConversionPct' ? 100 : 1000000);
}

export function parseGoals(value: unknown): GoalTargets {
  const result = { ...DEFAULT_GOALS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  for (const id of GOAL_IDS) if (isValidGoalValue(id, record[id])) result[id] = record[id] as number;
  return result;
}

export function growthSnapshot(bookings: ServiceBooking[], users: UserProfile[]): GoalTargets {
  const summary = summarizePerformance(bookings);
  return {
    requests7d: summary.requests7d,
    phone7d: summary.phone7d,
    callConversionPct: summary.callConversionPct,
    activeRiders: users.filter(u => u.role === 'customer' && (u.stamps ?? 0) > 0).length,
  };
}

export function goalProgress(actual: number, target: number) {
  const reached = actual >= target;
  const remaining = Math.max(0, target - actual);
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
  return { reached, remaining, percent, barPercent: Math.min(100, Math.max(0, percent)) };
}

export function raiseTargets(targets: GoalTargets): GoalTargets {
  return Object.fromEntries(GOAL_IDS.map(id => [id, Math.min(id === 'callConversionPct' ? 100 : 1000000, Math.max(1, Math.ceil(targets[id] * 1.1)))])) as GoalTargets;
}
