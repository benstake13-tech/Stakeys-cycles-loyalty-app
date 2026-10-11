import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  customerCodesFor,
  matchBySymptom,
  buildRetailerLinks,
  partForKey,
  PART_CATALOG,
} from './src/data/eVehicleCustomerInfo';
import { EVEHICLE_BRANDS, errorFamilyFor, errorCodesFor } from './src/data/eVehicleCodes';
import { CustomerErrorCodeHelper } from './src/components/CustomerErrorCodeHelper';

describe('customer-facing error-code layer', () => {
  it('enriches a known code with why / cost / parts', () => {
    const codes = customerCodesFor('electric_scooter', 'Xiaomi', 'M365');
    const e14 = codes.find((c) => c.code === 'E14')!;
    expect(e14.why).toBeTruthy();
    expect(e14.difficulty).toBe('DIY');
    expect(e14.costRange).toBeTruthy();
    expect(e14.partKeys).toContain('throttle_xiaomi');
  });

  it('every part key used by a code exists in PART_CATALOG', () => {
    const families: [string, string, string][] = [
      ['electric_scooter', 'Xiaomi', 'M365'],
      ['electric_scooter', 'Segway / Ninebot', 'Max G30'],
      ['electric_scooter', 'Vsett', '10+'],
      ['electric_scooter', 'Kaabo', 'Wolf Warrior'],
      ['ebike', 'Bosch', 'Performance CX'],
      ['ebike', 'Shimano', 'STEPS EP8'],
      ['ebike', 'Bafang', 'BBSHD'],
      ['ebike', 'Rad Power Bikes', 'RadCity'],
      ['ebike', 'Brose', 'Drive T'],
      ['ebike', 'Swytch', 'Swytch Kit (Conversions)'],
    ];
    for (const [cat, brand, model] of families) {
      const codes = customerCodesFor(cat as any, brand, model);
      expect(codes.length).toBeGreaterThan(0);
      for (const c of codes) {
        for (const k of c.partKeys || []) {
          expect(PART_CATALOG[k], `${c.code} references unknown part ${k}`).toBeTruthy();
        }
      }
    }
  });

  it('builds cheapest-first retailer links that include the model', () => {
    const links = buildRetailerLinks('throttle_xiaomi', 'M365');
    expect(links.length).toBe(4);
    expect(links[0].retailer).toBe('eBay UK');
    expect(links[0].url).toContain('ebay.co.uk');
    expect(decodeURIComponent(links[0].url)).toContain('M365');
    expect(partForKey('throttle_xiaomi')?.priceRange[0]).toBeGreaterThan(0);
  });

  it('finds a throttle code from a plain-language throttle symptom', () => {
    const codes = customerCodesFor('electric_scooter', 'Xiaomi', 'M365');
    const hits = matchBySymptom(codes, "won't accelerate at all");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.system === 'throttle')).toBe(true);
  });

  it('finds a code by its number', () => {
    const codes = customerCodesFor('electric_scooter', 'Xiaomi', 'M365');
    expect(matchBySymptom(codes, 'E14')[0].code).toBe('E14');
  });
});

describe('new brands / families', () => {
  it('maps the added brands to their own code families', () => {
    expect(errorFamilyFor('electric_scooter', 'Vsett', '10+')).toBe('vsett');
    expect(errorFamilyFor('electric_scooter', 'Kaabo', 'Wolf Warrior')).toBe('kaabo');
    expect(errorFamilyFor('electric_scooter', 'Zero', '10X')).toBe('vsett');
    expect(errorFamilyFor('ebike', 'Rad Power Bikes', 'RadCity')).toBe('radpower');
    expect(errorFamilyFor('ebike', 'Brose', 'Drive T')).toBe('brose');
  });

  it('exposes the new brands in the picker index', () => {
    const brands = new Set(EVEHICLE_BRANDS.map((b) => b.brand));
    for (const b of ['Vsett', 'Kaabo', 'Zero', 'Rad Power Bikes', 'Brose']) {
      expect(brands.has(b), `${b} missing`).toBe(true);
    }
  });

  it('VSETT uses its own small numeric code set', () => {
    const codes = errorCodesFor('electric_scooter', 'Vsett', '10+');
    expect(codes.some((c) => c.code === 'E2' && c.system === 'brake')).toBe(true);
    expect(codes.some((c) => c.code === 'E12' && c.system === 'bms')).toBe(true);
  });

  it('Rad Power code 25 is the brake sensor', () => {
    const codes = errorCodesFor('ebike', 'Rad Power Bikes', 'RadCity');
    expect(codes.find((c) => c.code === '25')?.system).toBe('brake');
  });
});

describe('CustomerErrorCodeHelper UI', () => {
  it('shows a prompt before a brand is chosen', () => {
    render(<CustomerErrorCodeHelper />);
    expect(screen.getByText('Fault Code Explainer')).toBeTruthy();
    expect(screen.getByTestId('cev-brand')).toBeTruthy();
    expect(screen.queryByTestId('cev-code-list')).toBeNull();
  });

  it('lists codes for a chosen model and expands a card with cost + part links', () => {
    render(<CustomerErrorCodeHelper />);
    fireEvent.change(screen.getByTestId('cev-brand'), { target: { value: 'Xiaomi' } });
    fireEvent.change(screen.getByTestId('cev-model'), { target: { value: 'M365' } });

    const list = screen.getByTestId('cev-code-list');
    expect(within(list).getByText('E14')).toBeTruthy();

    // Expand the E14 (throttle) card.
    fireEvent.click(within(list).getByText('E14'));
    expect(within(list).getByText(/Why it happened/i)).toBeTruthy();
    expect(within(list).getByText(/Workshop price/i)).toBeTruthy();
    // Cheapest-parts link is present.
    const ebay = screen.getAllByText('eBay UK').find((el) => el.closest('a'));
    expect(ebay).toBeTruthy();
  });

  it('filters the list by a symptom search', () => {
    render(<CustomerErrorCodeHelper />);
    fireEvent.change(screen.getByTestId('cev-brand'), { target: { value: 'Segway / Ninebot' } });
    fireEvent.change(screen.getByTestId('cev-model'), { target: { value: 'Max G30' } });

    fireEvent.change(screen.getByTestId('cev-search'), { target: { value: 'E14' } });
    const list = screen.getByTestId('cev-code-list');
    expect(within(list).getByText('E14')).toBeTruthy();
    expect(within(list).queryByText('E21')).toBeNull();
  });
});
