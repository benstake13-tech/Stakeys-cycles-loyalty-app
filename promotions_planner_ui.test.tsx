import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: { promotions: [] as any[], addPromotion: vi.fn(async (p: any) => ({ ...p, id: 'new' })) } as any,
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { PromotionsPlanner } from './src/components/PromotionsPlanner';
import { ShopPromotion } from './src/types/bikeShop';

const promo = (over: Partial<ShopPromotion>): ShopPromotion => ({
  id: over.id || 'p1',
  title: over.title || 'Live Campaign',
  subtitle: '',
  code: over.code || 'STK-LIV',
  badgeText: '',
  status: over.status || 'active',
  startDate: over.startDate || '2026-06-10',
  endDate: over.endDate || '2026-06-25',
  termsAndConditions: [],
  eligibleCategories: over.eligibleCategories || ['cycle'],
  bgGradient: '',
  discountPercentage: over.discountPercentage ?? 10,
});

beforeEach(() => {
  hoisted.shop = { promotions: [], addPromotion: vi.fn(async (p: any) => ({ ...p, id: 'new' })) };
});

describe('PromotionsPlanner', () => {
  it('renders the planner with a summary', () => {
    render(<PromotionsPlanner />);
    expect(screen.getByTestId('promotions-planner')).toBeTruthy();
    expect(screen.getByTestId('planner-summary').textContent).toMatch(/campaign/);
  });

  it('shows an overlap warning when the draft clashes with a live promotion', () => {
    hoisted.shop = { promotions: [promo({})], addPromotion: vi.fn() };
    render(<PromotionsPlanner />);
    fireEvent.change(screen.getByTestId('planner-title'), { target: { value: 'Clashing Deal' } });
    fireEvent.change(screen.getByTestId('planner-start'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByTestId('planner-end'), { target: { value: '2026-06-20' } });
    expect(screen.getByTestId('planner-warnings').textContent).toMatch(/Overlaps 1 live campaign/);
  });

  it('creates a promotion through the real addPromotion call', async () => {
    const addPromotion = vi.fn(async (p: any) => ({ ...p, id: 'new' }));
    hoisted.shop = { promotions: [], addPromotion };
    render(<PromotionsPlanner />);
    fireEvent.change(screen.getByTestId('planner-title'), { target: { value: 'Autumn Service' } });
    fireEvent.click(screen.getByTestId('planner-create'));
    expect(addPromotion).toHaveBeenCalledTimes(1);
    const arg = addPromotion.mock.calls[0][0];
    expect(arg.title).toBe('Autumn Service');
    expect(arg.code).toMatch(/^STK-/);
  });

  it('applies a duration preset to the dates', () => {
    render(<PromotionsPlanner />);
    fireEvent.click(screen.getByTestId('planner-preset-1w'));
    const start = (screen.getByTestId('planner-start') as HTMLInputElement).value;
    const end = (screen.getByTestId('planner-end') as HTMLInputElement).value;
    expect(start).not.toBe(end);
  });
});
