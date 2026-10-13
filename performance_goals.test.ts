import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOALS, GOAL_IDS, goalProgress, growthSnapshot,
  parseGoals, raiseTargets, isValidGoalValue,
} from './src/utils/performanceGoals';
import type { ServiceBooking, UserProfile } from './src/types/bikeShop';

const makeBooking = (overrides: Partial<ServiceBooking> = {}): ServiceBooking => ({
  id: 'b-1', customerName: 'Test', customerEmail: 'test@example.test',
  customerPhone: '07123456789', vehicleCategory: 'bicycle' as ServiceBooking['vehicleCategory'],
  vehicleModel: 'City', serviceId: 'service', serviceTitle: 'Service',
  servicePrice: 20, preferredDate: '2026-10-13', preferredTimeSlot: '10:00',
  status: 'pending', createdAt: new Date(), notifications: [],
  ...overrides,
});
const makeUser = (overrides: Partial<UserProfile>): UserProfile => ({
  uid: 'm-1', email: 'member@example.test', role: 'customer',
  displayName: 'Member', membershipNumber: '001',
  stamps: 1, tickets: 0, createdAt: new Date(), ...overrides,
});

describe('staff growth KPI targets', () => {
  it('defines meaningful defaults and safe goal input bounds', () => {
    expect(GOAL_IDS).toHaveLength(4);
    expect(GOAL_IDS.every(id => isValidGoalValue(id, DEFAULT_GOALS[id]))).toBe(true);
    expect(isValidGoalValue('callConversionPct', 101)).toBe(false);
    expect(isValidGoalValue('requests7d', 0)).toBe(false);
    expect(isValidGoalValue('activeRiders', Number.NaN)).toBe(false);
    expect(isValidGoalValue('activeRiders', 3.5)).toBe(false);
  });

  it('rejects invalid stored numbers and preserves valid configured targets', () => {
    expect(parseGoals({ requests7d: 30, phone7d: -2, callConversionPct: 999, activeRiders: '500' }))
      .toEqual({ requests7d: 30, phone7d: DEFAULT_GOALS.phone7d,
        callConversionPct: DEFAULT_GOALS.callConversionPct, activeRiders: DEFAULT_GOALS.activeRiders });
  });

  it('keeps goal progress clamped visually but reports true attainment', () => {
    expect(goalProgress(6, 12)).toEqual({ reached: false, remaining: 6, percent: 50, barPercent: 50 });
    expect(goalProgress(18, 12)).toEqual({ reached: true, remaining: 0, percent: 150, barPercent: 100 });
  });

  it('raises stretch goals without allowing a percentage above 100', () => {
    expect(raiseTargets({ requests7d: 10, phone7d: 3, callConversionPct: 99, activeRiders: 50 }))
      .toEqual({ requests7d: 11, phone7d: 4, callConversionPct: 100, activeRiders: 55 });
  });

  it('derives progress from real booking and loyalty data, not settings', () => {
    const now = new Date();
    const bookings = [
      makeBooking({ id: 'one', createdAt: now, status: 'approved',
        notes: 'BOOKING CHANNEL: Phone call' }),
      makeBooking({ id: 'two', createdAt: now, status: 'pending', notes: 'online' }),
      makeBooking({ id: 'three', createdAt: now, status: 'pending', notes: 'BOOKING CHANNEL: Phone call' }),
    ];
    const users = [
      makeUser({ uid: 'a', stamps: 1 }),
      makeUser({ uid: 'b', stamps: 0 }),
      makeUser({ uid: 'c', role: 'staff', stamps: 9 }),
    ];
    expect(growthSnapshot(bookings, users))
      .toEqual({ requests7d: 3, phone7d: 2, callConversionPct: 50, activeRiders: 1 });
  });
});
