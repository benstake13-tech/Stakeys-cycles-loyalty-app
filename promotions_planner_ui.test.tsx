import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: { promotions: [] as any[], addPromotion: vi.fn(async (p: any) => ({ ...p, id: 'new' })) } as any,
  advisePromotion: vi.fn(),
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));
vi.mock('./src/api/promotionAdvisorService', () => ({
  isPromotionAdvisorConfigured: () => true,
  advisePromotion: hoisted.advisePromotion,
}));
vi.mock('./src/utils/weatherService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./src/utils/weatherService')>();
  return {
    ...actual,
    loadCachedWeather: () => null,
    fetchWeatherReport: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  };
});

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
  hoisted.advisePromotion.mockReset();
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

  it('shows AI suggestions and loads one into the draft', async () => {
    hoisted.advisePromotion.mockResolvedValue({
      headline: 'Lead with drivetrain work',
      source: 'ai',
      actions: [
        {
          title: 'Drivetrain Week',
          rationale: 'Summer demand.',
          discountPercentage: 15,
          categories: ['cycle'],
          startDate: '2026-06-20',
          endDate: '2026-06-26',
          confidence: 0.8,
        },
      ],
    });
    render(<PromotionsPlanner />);
    fireEvent.click(screen.getByTestId('promo-advisor-run'));
    await waitFor(() => expect(screen.getByTestId('promo-advisor-result')).toBeTruthy());
    expect(screen.getByTestId('promo-advisor-source').textContent).toBe('AI');
    expect(hoisted.advisePromotion).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('promo-advisor-apply-0'));
    expect((screen.getByTestId('planner-start') as HTMLInputElement).value).toBe('2026-06-20');
    expect((screen.getByTestId('planner-end') as HTMLInputElement).value).toBe('2026-06-26');
  });

  it('surfaces the offline badge when the advisor falls back', async () => {
    hoisted.advisePromotion.mockResolvedValue({
      headline: 'Start small',
      source: 'offline',
      actions: [
        { title: 'Weekend offer', rationale: 'r', discountPercentage: 10, categories: ['cycle'], startDate: '2026-06-20', endDate: '2026-06-26', confidence: 0.5 },
      ],
    });
    render(<PromotionsPlanner />);
    fireEvent.click(screen.getByTestId('promo-advisor-run'));
    await waitFor(() => expect(screen.getByTestId('promo-advisor-source').textContent).toBe('Offline'));
  });

  it('renders the deterministic weather→demand forecast offline', () => {
    render(<PromotionsPlanner />);
    expect(screen.getByTestId('promo-demand-forecast')).toBeTruthy();
    expect(screen.getByTestId('promo-demand-headline').textContent).toMatch(/expect|weather/i);
    // signals are rendered and seed the draft when clicked
    const signals = screen.getByTestId('promo-demand-signals');
    expect(signals.children.length).toBeGreaterThan(0);
    fireEvent.click(signals.children[0] as HTMLElement);
    expect((screen.getByTestId('planner-title') as HTMLInputElement).value.length).toBeGreaterThan(0);
  });
});
