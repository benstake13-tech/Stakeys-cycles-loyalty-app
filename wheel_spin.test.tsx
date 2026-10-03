import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: {} as any,
  award: vi.fn(async () => ({ success: true, message: 'ok', stampsAwarded: 1 })),
  reset: vi.fn(),
  collect: vi.fn(async () => ({ success: true, message: 'ok' })),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { WeeklyPrizeWheel } from './src/components/WeeklyPrizeWheel';

function makeUser(over: any = {}) {
  return {
    uid: 'u1',
    displayName: 'Ada',
    email: 'a@b.c',
    role: 'customer',
    membershipNumber: 'STK-1',
    stamps: 3,
    tickets: 0,
    merits: 0,
    ...over,
  };
}

beforeEach(() => {
  hoisted.award.mockClear();
  hoisted.award.mockResolvedValue({ success: true, message: 'ok', stampsAwarded: 1 });
  hoisted.shop = {
    currentUser: makeUser(),
    activeWheel: null,
    awardWeeklyWheelPrize: hoisted.award,
    collectFullCardReward: hoisted.collect,
    resetUserSpinCooldown: hoisted.reset,
  };
});

describe('WeeklyPrizeWheel spin', () => {
  it('renders without throwing', () => {
    const { container } = render(<WeeklyPrizeWheel />);
    expect(container.textContent).toContain('SPIN THE PRIZE WHEEL');
  });

  it('advances the wheel rotation when spin is clicked (animation runs)', async () => {
    vi.useFakeTimers();
    const { container } = render(<WeeklyPrizeWheel />);
    const spinBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /SPIN THE PRIZE WHEEL/.test(b.textContent || '')
    )!;
    expect(spinBtn).toBeTruthy();
    fireEvent.click(spinBtn);

    const rotatingEl = () =>
      Array.from(container.querySelectorAll('div')).find(
        (d) => (d.style.willChange || '') === 'transform'
      )!;
    const before = rotatingEl().style.transform;

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const after = rotatingEl().style.transform;

    expect(after).not.toBe(before);
    vi.useRealTimers();
  });

  it('awards the prize after the spin animation completes', async () => {
    vi.useFakeTimers();
    const { container } = render(<WeeklyPrizeWheel />);
    const spinBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /SPIN THE PRIZE WHEEL/.test(b.textContent || '')
    )!;
    fireEvent.click(spinBtn);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(hoisted.award).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not spin when the weekly cooldown is active', () => {
    hoisted.shop.currentUser = makeUser({ lastSpunAt: new Date().toISOString() });
    const { container } = render(<WeeklyPrizeWheel />);
    const spinBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /SPIN LOCKED/.test(b.textContent || '')
    )!;
    expect(spinBtn).toBeTruthy();
    fireEvent.click(spinBtn!);
    expect(hoisted.award).not.toHaveBeenCalled();
  });
});
