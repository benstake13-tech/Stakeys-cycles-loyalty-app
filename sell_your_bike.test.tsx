import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'u1', displayName: 'Ada Rider', email: 'ada@x.com', role: 'customer', membershipNumber: 'STK-1' },
  }),
}));

// The AI read is canned so the offer + damage UI can be asserted without the SDK.
vi.mock('./src/api/visionService', () => ({
  isBikeVisionConfigured: () => true,
  diagnoseFault: vi.fn(),
}));

import { SellYourBikeForm, SELL_ANGLES } from './src/components/TradeInRequestForm';
import { StaffOfferPricesTab } from './src/components/StaffOfferPricesTab';
import { StaffTradeInsTab } from './src/components/StaffTradeInsTab';
import { diagnoseFault } from './src/api/visionService';
import {
  getOfferPrices,
  upsertOfferPrice,
  deleteOfferPrice,
  resetOfferPrices,
} from './src/context/OfferPriceBook';
import { getTradeInRequests, deleteTradeInRequest, submitTradeInRequest } from './src/context/TradeInStore';
import { valueBike } from './src/utils/bikeValuation';
import { buildCatalogue } from './src/data/offerCatalogue';

const selectPhoto = (input: HTMLElement) => {
  const file = new File(['fake-bytes'], 'bike.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  resetOfferPrices();
  (diagnoseFault as unknown as ReturnType<typeof vi.fn>).mockReset();
  for (const r of getTradeInRequests()) deleteTradeInRequest(r.id);
});

describe('SellYourBikeForm — seven angle capture', () => {
  it('renders exactly seven guided angle slots', () => {
    render(<SellYourBikeForm />);
    expect(SELL_ANGLES).toHaveLength(7);
    for (const angle of SELL_ANGLES) {
      expect(screen.getByTestId(`sell-angle-${angle.id}`)).toBeTruthy();
    }
  });

  it('shows the Sell Your Bike heading', () => {
    render(<SellYourBikeForm />);
    expect(screen.getByText(/Sell Your Bike/i)).toBeTruthy();
  });

  it('requires a brand and model before submitting', () => {
    render(<SellYourBikeForm />);
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.queryByTestId('tradein-success')).toBeNull();
  });

  it('captures a sell lead with brand and model', () => {
    render(<SellYourBikeForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Giant'), { target: { value: 'Giant' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Escape 3'), { target: { value: 'Escape 3' } });
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.getByTestId('tradein-success')).toBeTruthy();
    const leads = getTradeInRequests();
    expect(leads).toHaveLength(1);
    expect(leads[0].brand).toBe('Giant');
    expect(leads[0].model).toBe('Escape 3');
  });

  it('accepts a photo into the first angle slot', async () => {
    render(<SellYourBikeForm />);
    fireEvent.click(screen.getByTestId('sell-angle-drive-side').querySelector('button')!);
    selectPhoto(screen.getByTestId('sell-photo-input'));
    await waitFor(() => {
      expect(screen.getByAltText('Drive side')).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('shows the spec list, the price ladder and the damage the AI spotted after analysis', async () => {
    (diagnoseFault as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      make: 'Trek',
      model: 'Marlin 5',
      type: 'cycle',
      categoryLabel: 'Mountain Bike',
      year: '2021',
      colour: 'Matte Black',
      frameMaterial: 'Aluminium',
      serialNumber: 'WTU123456',
      overallCondition: 'Good',
      confidence: 0.9,
      coverage: 0.9,
      faults: [],
      obviousProblems: [],
      positioning: { frameSizeEstimate: 'Medium (~17in)', wheelSize: '27.5in', tyreSize: '27.5 x 2.10' },
      electricKit: { isElectric: false },
      mainSpecs: [
        { systemId: 'drivetrain', componentId: 'rear-derailleur', category: 'Drivetrain', componentName: 'Rear derailleur', currentPart: 'Shimano Altus', specValue: '8-speed', visibility: 'visible' },
        { systemId: 'brakes', componentId: 'front-brake', category: 'Brakes', componentName: 'Front brake', currentPart: 'Tektro disc', specValue: '160mm rotor', visibility: 'visible' },
      ],
      notVisible: ['Bottom bracket'],
      cosmeticIssues: [
        { type: 'Scratch on top tube', location: 'Top tube', severity: 'Moderate' },
        { type: 'Dent in down tube', location: 'Down tube', severity: 'Major' },
      ],
    });
    render(<SellYourBikeForm />);
    fireEvent.click(screen.getByTestId('sell-angle-drive-side').querySelector('button')!);
    selectPhoto(screen.getByTestId('sell-photo-input'));
    await waitFor(() => expect(screen.getByAltText('Drive side')).toBeTruthy(), { timeout: 4000 });

    fireEvent.click(screen.getByText(/Identify my bike/i));
    await waitFor(() => expect(screen.getByTestId('sell-specs')).toBeTruthy(), { timeout: 4000 });

    // Every detail the AI read off the photos is listed, grouped by system.
    const specs = screen.getByTestId('sell-specs');
    expect(specs.textContent).toMatch(/Identification/);
    expect(specs.textContent).toMatch(/Serial number/);
    expect(specs.textContent).toMatch(/WTU123456/);
    expect(specs.textContent).toMatch(/Rear derailleur/);
    expect(specs.textContent).toMatch(/Shimano Altus/);
    expect(specs.textContent).toMatch(/Front brake/);
    expect(specs.textContent).toMatch(/Bottom bracket/); // the "couldn't see" note

    // The condition ladder renders all four grades.
    expect(screen.getByText(/Price by condition/i)).toBeTruthy();
    for (const grade of ['excellent', 'good', 'fair', 'poor']) {
      expect(screen.getAllByText(new RegExp(`^${grade}$`, 'i')).length).toBeGreaterThan(0);
    }
    const damage = screen.getByTestId('sell-damage');
    expect(damage.textContent).toMatch(/Scratch on top tube/);
    expect(damage.textContent).toMatch(/Dent in down tube/);
  });
});

describe('OfferPriceBook store', () => {
  it('seeds sensible defaults', () => {
    const prices = getOfferPrices();
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.some((p) => p.brand === 'Trek')).toBe(true);
  });

  it('keeps every Trek offer between £10 and £160 with £10–£20 condition steps', () => {
    const trek = getOfferPrices().filter((p) => p.brand === 'Trek' && p.model);
    expect(trek).toHaveLength(22);
    for (const entry of trek) {
      const grades = entry.conditionPrices!;
      expect(grades.fair!.price - grades.poor!.price).toBeGreaterThanOrEqual(10);
      expect(grades.fair!.price - grades.poor!.price).toBeLessThanOrEqual(20);
      expect(grades.good!.price - grades.fair!.price).toBeGreaterThanOrEqual(10);
      expect(grades.good!.price - grades.fair!.price).toBeLessThanOrEqual(20);
      expect(grades.excellent!.price - grades.good!.price).toBeGreaterThanOrEqual(10);
      expect(grades.excellent!.price - grades.good!.price).toBeLessThanOrEqual(20);
      expect(Math.min(...Object.values(grades).map((point) => point!.price))).toBeGreaterThanOrEqual(10);
      expect(Math.max(...Object.values(grades).map((point) => point!.price))).toBeLessThanOrEqual(160);
    }
  });

  it('prices every remaining brand and model within the £10–£160 budget', () => {
    const book = getOfferPrices();
    const models = buildCatalogue(book).flatMap(brand => brand.models);
    expect(models).toHaveLength(621);
    expect(models.every(model => model.entry)).toBe(true);
    for (const { entry } of models) {
      const points = Object.values(entry!.conditionPrices!);
      expect(Math.min(...points.map(point => point!.price))).toBeGreaterThanOrEqual(10);
      expect(Math.max(...points.map(point => point!.price))).toBeLessThanOrEqual(160);
      const ordered = [entry!.conditionPrices!.poor!.price, entry!.conditionPrices!.fair!.price,
        entry!.conditionPrices!.good!.price, entry!.conditionPrices!.excellent!.price];
      for (let index = 1; index < ordered.length; index++) {
        expect(ordered[index] - ordered[index - 1]).toBeGreaterThanOrEqual(10);
        expect(ordered[index] - ordered[index - 1]).toBeLessThanOrEqual(20);
      }
    }
    expect(book.find(entry => entry.brand === 'Pinarello' && /Dogma/i.test(entry.model))?.basePrice)
      .toBeGreaterThan(book.find(entry => entry.brand === 'Raleigh' && /Pioneer/i.test(entry.model))?.basePrice ?? 0);
  });

  it('adds, edits and deletes a price', () => {
    const created = upsertOfferPrice({ brand: 'Raleigh', model: 'Pioneer', category: 'cycle', basePrice: 60 });
    expect(getOfferPrices().some((p) => p.id === created.id)).toBe(true);

    upsertOfferPrice({ id: created.id, brand: 'Raleigh', model: 'Pioneer', category: 'cycle', basePrice: 75 });
    expect(getOfferPrices().find((p) => p.id === created.id)?.basePrice).toBe(75);

    deleteOfferPrice(created.id);
    expect(getOfferPrices().some((p) => p.id === created.id)).toBe(false);
  });

  it('resets to the seeded defaults', () => {
    upsertOfferPrice({ brand: 'Test', model: 'X', category: 'cycle', basePrice: 10 });
    resetOfferPrices();
    expect(getOfferPrices().some((p) => p.brand === 'Test')).toBe(false);
  });

  it('keeps a per-condition-only row by deriving its base from the good price', () => {
    const created = upsertOfferPrice({
      brand: 'Voodoo',
      model: 'Bizango',
      category: 'cycle',
      basePrice: undefined as unknown as number,
      conditionPrices: { good: { price: 120 }, fair: { price: 80 } },
    });
    const saved = getOfferPrices().find((p) => p.id === created.id)!;
    expect(saved.basePrice).toBe(120);
    expect(saved.conditionPrices?.fair?.price).toBe(100);
  });
});

describe('StaffOfferPricesTab', () => {
  it('lists the seeded brands and adds a new price from the UI', () => {
    render(<StaffOfferPricesTab />);
    expect(screen.getByTestId('staff-offer-prices')).toBeTruthy();
    expect(screen.getAllByText(/Trek/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/Add price/i));
    fireEvent.change(screen.getByPlaceholderText('e.g. Trek'), { target: { value: 'Raleigh' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Marlin 5'), { target: { value: 'Pioneer' } });
    fireEvent.change(screen.getByPlaceholderText('180'), { target: { value: '65' } });
    fireEvent.click(screen.getByText(/Add to price book/i));

    expect(getOfferPrices().some((p) => p.brand === 'Raleigh' && p.basePrice === 65)).toBe(true);
  });

  it('shows the browsable brand & model catalogue', () => {
    render(<StaffOfferPricesTab />);
    expect(screen.getByTestId('offer-catalogue')).toBeTruthy();
    expect(screen.getByTestId('offer-catalogue-search')).toBeTruthy();
    expect(screen.getByTestId('catalogue-brand-trek')).toBeTruthy();
  });

  it('filters the catalogue by model search', () => {
    render(<StaffOfferPricesTab />);
    fireEvent.change(screen.getByTestId('offer-catalogue-search'), { target: { value: 'marlin' } });
    // Trek remains (it has a Marlin); a brand with no matching model drops out.
    expect(screen.getByTestId('catalogue-brand-trek')).toBeTruthy();
    expect(screen.queryByTestId('catalogue-brand-giant')).toBeNull();
  });

  it('prefills the price editor when staff pick a model from the catalogue', () => {
    render(<StaffOfferPricesTab />);
    fireEvent.click(screen.getByTestId('catalogue-brand-trek'));
    fireEvent.click(screen.getByTestId('catalogue-model-trek-marlin'));
    expect(screen.getByTestId('offer-price-editor')).toBeTruthy();
    const brand = screen.getByPlaceholderText('e.g. Trek') as HTMLInputElement;
    const model = screen.getByPlaceholderText('e.g. Marlin 5') as HTMLInputElement;
    expect(brand.value).toBe('Trek');
    expect(model.value).toBe('Marlin');
  });

  it('adds a price straight from a catalogue pick', () => {
    render(<StaffOfferPricesTab />);
    fireEvent.click(screen.getByTestId('catalogue-brand-trek'));
    fireEvent.click(screen.getByTestId('catalogue-model-trek-domane'));
    fireEvent.change(screen.getByPlaceholderText('180'), { target: { value: '205' } });
    fireEvent.click(screen.getByText(/Save changes/i));
    expect(getOfferPrices().some((p) => p.brand === 'Trek' && p.model === 'Domane' && p.basePrice === 145)).toBe(true);
  });

  it('edits and saves a per-model price from the catalogue', () => {
    render(<StaffOfferPricesTab />);
    fireEvent.click(screen.getByTestId('catalogue-brand-trek'));
    fireEvent.click(screen.getByTestId('catalogue-model-trek-marlin'));
    fireEvent.change(screen.getByLabelText('good price'), { target: { value: '205' } });
    fireEvent.click(screen.getByText(/Save changes/i));
    const saved = getOfferPrices().find((p) => p.brand === 'Trek' && p.model === 'Marlin')!;
    expect(saved.conditionPrices?.good?.price).toBe(145);
  });
});

describe('StaffTradeInsTab — sell-your-bike lead detail', () => {
  it('shows the customer photos, the AI offer and a final-offer input', () => {
    submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Trek',
      model: 'Marlin 5',
      condition: 'good',
      photos: [
        { angle: 'drive-side', label: 'Drive side', dataUrl: 'data:image/jpeg;base64,AAA' },
        { angle: 'front', label: 'Front-on', dataUrl: 'data:image/jpeg;base64,BBB' },
      ],
      offerEstimate: 230,
      offerRationale: ['Matched Trek Marlin 5 in the price book.'],
    });
    render(<StaffTradeInsTab />);
    expect(screen.getByAltText('Drive side')).toBeTruthy();
    expect(screen.getByText(/AI offer estimate/i)).toBeTruthy();
    expect(screen.getByText('£230')).toBeTruthy();
    expect(screen.getByTestId(/final-offer-/)).toBeTruthy();
  });

  it('saves a final offer entered by staff', () => {
    const lead = submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Trek',
      model: 'Marlin 5',
      condition: 'good',
    });
    render(<StaffTradeInsTab />);
    const input = screen.getByLabelText(/Final offer/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '210' } });
    fireEvent.click(screen.getByText('Save'));
    expect(getTradeInRequests().find((r) => r.id === lead.id)?.finalOffer).toBe(210);
  });

  it('lists the damage the AI spotted in the photos', () => {
    const lead = submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Trek',
      model: 'Marlin 5',
      condition: 'fair',
      aiIdentification: {
        cosmeticIssues: [
          { type: 'Scratch on top tube', location: 'Top tube', severity: 'Moderate' },
          { type: 'Dent in down tube', location: 'Down tube', severity: 'Major' },
        ],
      },
    });
    render(<StaffTradeInsTab />);
    const block = screen.getByTestId(`lead-damage-${lead.id}`);
    expect(block.textContent).toMatch(/Scratch on top tube/);
    expect(block.textContent).toMatch(/Dent in down tube/);
  });
});

describe('StaffOfferPricesTab — per-condition prices', () => {
  it('edits and saves an explicit price per condition grade', () => {
    render(<StaffOfferPricesTab />);
    // Open the Carrera Vengeance worked example seeded in the price book.
    fireEvent.click(screen.getByTestId('catalogue-brand-carrera'));
    fireEvent.click(screen.getByTestId('catalogue-model-carrera-vengeance'));
    expect(screen.getByTestId('offer-price-conditions')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('good price'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('good max price'), { target: { value: '50' } });
    fireEvent.click(screen.getByText(/Save changes/i));

    const saved = getOfferPrices().find((p) => p.brand === 'Carrera' && p.model === 'Vengeance')!;
    expect(saved.conditionPrices?.good?.price).toBe(45);
    expect(saved.conditionPrices?.good?.maxPrice).toBe(50);
    expect(saved.conditionPrices?.poor?.price).toBe(10);
  });

  it('drives the offer engine with the saved per-condition prices', () => {
    upsertOfferPrice({
      brand: 'Raleigh',
      model: 'Pioneer',
      category: 'cycle',
      basePrice: 30,
      conditionPrices: { poor: { price: 10 }, fair: { price: 20 }, good: { price: 30, maxPrice: 40 } },
    });
    const v = valueBike({ make: 'Raleigh', model: 'Pioneer', type: 'cycle', declaredCondition: 'fair' }, getOfferPrices());
    expect(v.offer).toBe(20);
  });
});

