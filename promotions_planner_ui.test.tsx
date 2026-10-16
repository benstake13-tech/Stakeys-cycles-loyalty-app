import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: { promotions: [] as any[], addPromotion: vi.fn(async (p: any) => ({ ...p, id: 'new' })) } as any,
  advisePromotion: vi.fn(),
}));

vi.mock('./src/context/WebsiteContentStore', () => ({useWebsiteContent: () => ({products:[],priceList:[{id:'check',scope:'bike',item:'Small check',group:'Workshop',price:'£12',unitPrice:12}]})}));
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
    expect(screen.getByTestId('promo-starter-guide').textContent).toMatch(/Salford|Facebook|Instagram/);
  });

  it('copies a practical social post for a new local shop', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<PromotionsPlanner />);
    fireEvent.click(screen.getByText('New to promoting the shop? Start with this simple plan'));
    fireEvent.click(screen.getAllByText('Copy caption')[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Hello Salford')));
    expect(await screen.findByText('Copied')).toBeTruthy();
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
  it('keeps targeting, requires logistics review and publishes a quote-led campaign', async () => {
    const startDate = new Date(Date.now() + 86400000).toISOString().slice(0,10);
    const endDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
    hoisted.advisePromotion.mockResolvedValue({headline:'Useful workshop work',source:'ai',actions:[{
      title:'Small check',rationale:'Budget fit',discountPercentage:10,categories:['cycle'],startDate,endDate,confidence:0.4,
      objective:'workshop',serviceId:'check',segmentId:'cycle:commuter:up-to-50',audience:'member',audienceDescription:'Budget commuter riders',offerPriceGbp:10.8,spendCeilingGbp:12,requiresQuote:true,
    }]});
    render(<PromotionsPlanner/>);
    fireEvent.click(screen.getByTestId('promo-advisor-run'));
    await waitFor(() => expect(screen.getByTestId('promo-advisor-apply-0')).toBeTruthy());
    fireEvent.click(screen.getByTestId('promo-advisor-apply-0'));
    const create = screen.getByTestId('planner-create') as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect((screen.getByTestId('planner-cat-ebike') as HTMLButtonElement).disabled).toBe(true);
    for (const [label,value] of [
      ['Planned uptake limit','3'], ['Confirmed available slots for these dates','4'],
      ['Full variable cost per redemption (£, excluding recoverable VAT)','4'],
      ['VAT included in selling price (%)','0'], ['Fixed campaign spend (£, excluding recoverable VAT)','0'],
      ['Minimum contribution per redemption (£)','2'],
    ]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
    fireEvent.click(screen.getByLabelText(/I checked customer fit/));
    expect(create.disabled).toBe(false);
    // Date changes invalidate the previous staff confirmation.
    fireEvent.change(screen.getByTestId('planner-end'),{target:{value:new Date(Date.now()+8*86400000).toISOString().slice(0,10)}});
    expect(create.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/I checked customer fit/));
    fireEvent.click(create);
    await waitFor(() => expect(hoisted.shop.addPromotion).toHaveBeenCalledTimes(1));
    const saved = hoisted.shop.addPromotion.mock.calls[0][0];
    expect(saved.discountPercentage).toBe(0);
    expect(saved.discountAmount).toBe(0);
    expect(saved.campaignBrief).toMatchObject({serviceId:'check',segmentId:'cycle:commuter:up-to-50',requiresQuote:true,audience:'member',uptakeLimit:3});
    expect(saved.termsAndConditions.join(' ')).toMatch(/Budget commuter riders/);
    expect(saved.termsAndConditions.join(' ')).toMatch(/no automatic discount/);
  });

  it('keeps the draft and reports a failed server save', async () => {
    hoisted.shop.addPromotion.mockRejectedValueOnce(new Error('Promotion was not saved to the server.'));
    render(<PromotionsPlanner/>);
    fireEvent.change(screen.getByTestId('planner-title'),{target:{value:'Retry me'}});
    fireEvent.click(screen.getByTestId('planner-create'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not saved/));
    expect((screen.getByTestId('planner-title') as HTMLInputElement).value).toBe('Retry me');
  });

});
