import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: {} as any,
  collect: vi.fn(async () => ({ success: true, message: 'ok', voucher: { id: 'v1', code: 'STK-SRV40-000001', title: '£40 Workshop Service Credit' } })),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./src/shared/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { StampCard } from './src/components/StampCard';

function makeUser(over: any = {}) {
  return {
    uid: 'u1',
    displayName: 'Ada',
    email: 'a@b.c',
    role: 'customer',
    membershipNumber: 'STK-1',
    stamps: 0,
    tickets: 0,
    points: 0,
    serviceVouchers: [],
    ...over,
  };
}

beforeEach(() => {
  hoisted.collect.mockClear();
  hoisted.shop = { collectFullCardReward: hoisted.collect };
});

describe('StampCard', () => {
  it('renders 10 slots and the stamp count', () => {
    const { container } = render(<StampCard user={makeUser({ stamps: 4 })} />);
    expect(container.textContent).toContain('10-Visit Stamp Journey');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('/ 10');
  });

  it('shows the collect callout only when the card is full', () => {
    const notFull = render(<StampCard user={makeUser({ stamps: 9 })} />);
    expect(notFull.container.textContent).not.toContain('Ready to Collect');
    const full = render(<StampCard user={makeUser({ stamps: 10 })} />);
    expect(full.container.textContent).toContain('Ready to Collect');
  });

  it('collects the reward when full and the button is pressed', async () => {
    const { getByText } = render(<StampCard user={makeUser({ stamps: 10 })} />);
    fireEvent.click(getByText(/Press to Collect/i));
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.collect).toHaveBeenCalledWith('u1');
  });

  it('lists collected vouchers', () => {
    const { container } = render(
      <StampCard
        user={makeUser({
          stamps: 0,
          serviceVouchers: [{ id: 'v1', code: 'STK-SRV40-1', title: '£40 Workshop Service Credit', status: 'available', value: 40, terms: 'x' }],
        })}
      />
    );
    expect(container.textContent).toContain('My Collected Rewards');
    expect(container.textContent).toContain('STK-SRV40-1');
  });
});
