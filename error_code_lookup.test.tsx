vi.mock('./src/api/geminiGateway', () => ({ isGeminiGatewayConfigured: () => false, generateGemini: vi.fn() }));
import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EVEHICLE_CATEGORIES,
  EVEHICLE_BRANDS,
  EVEHICLE_DISPLAYS,
  errorCodesFor,
  errorCodesForFamily,
  errorFamilyFor,
  brandsForEVehicleCategory,
  displaysForCategory,
  displayForModel,
  findErrorCode,
  normalizeErrorCode,
} from './src/data/eVehicleCodes';
import { assistECodeLookup } from './src/api/eVehicleCodeAssist';
import { ErrorCodeLookupTab } from './src/components/ErrorCodeLookupTab';

describe('e-vehicle error-code catalogue', () => {
  it('ships both categories', () => {
    expect(EVEHICLE_CATEGORIES.map((c) => c.id)).toEqual(['electric_scooter', 'ebike']);
  });

  it('normalises codes regardless of how they were written', () => {
    expect(normalizeErrorCode('E04')).toBe('4');
    expect(normalizeErrorCode('e04')).toBe('4');
    expect(normalizeErrorCode('ER14')).toBe('14');
    expect(normalizeErrorCode('014')).toBe('14');
    expect(normalizeErrorCode('')).toBe('');
  });

  it('returns a non-empty list for a known scooter model', () => {
    const codes = errorCodesFor('electric_scooter', 'Xiaomi', 'M365');
    expect(codes.length).toBeGreaterThanOrEqual(5);
    expect(codes.every((c) => c.code && c.title && c.fix.length > 0)).toBe(true);
  });

  it('every code carries a verifiable public source', () => {
    const families = [
      errorCodesFor('electric_scooter', 'Xiaomi', 'M365'),
      errorCodesFor('electric_scooter', 'Segway / Ninebot', 'Max G30'),
      errorCodesFor('electric_scooter', 'Dualtron', 'Thunder'),
      errorCodesFor('ebike', 'Bosch', 'Performance CX'),
      errorCodesFor('ebike', 'Shimano', 'STEPS EP8'),
      errorCodesFor('ebike', 'Bafang', 'BBSHD'),
      errorCodesFor('ebike', 'Swytch', 'Swytch Kit (Conversions)'),
    ];
    for (const list of families) {
      expect(list.length).toBeGreaterThan(0);
      for (const c of list) {
        expect(c.source, `${c.code} has no source`).toMatch(/^https:\/\//);
      }
    }
  });

  it('uses the corrected Xiaomi/Ninebot meanings (not the old invented ones)', () => {
    const m365 = errorCodesFor('electric_scooter', 'Xiaomi', 'M365');
    // E14 is the throttle code on the M365 (E23 is a BMS serial fault).
    expect(findErrorCode(m365, 'E14')?.system).toBe('throttle');
    expect(findErrorCode(m365, 'E23')?.title).toMatch(/serial|bms/i);
    // E35 is the serial-number code on both families.
    expect(findErrorCode(m365, 'E35')?.title).toMatch(/serial/i);

    const g30 = errorCodesFor('electric_scooter', 'Segway / Ninebot', 'Max G30');
    // Same numbering as Xiaomi on the shared G30/Xiaomi lexicon.
    expect(findErrorCode(g30, 'E10')?.system).toBe('display');
    expect(findErrorCode(g30, 'E11')?.system).toBe('motor');
    expect(findErrorCode(g30, 'E14')?.system).toBe('throttle');
    expect(findErrorCode(g30, 'E18')?.system).toBe('motor');
    expect(findErrorCode(g30, 'E35')?.title).toMatch(/serial/i);
  });

  it('maps e-bike brands to their real systems, not the scooter generic list', () => {
    expect(errorFamilyFor('ebike', 'Bosch', 'Performance CX')).toBe('bosch');
    expect(errorFamilyFor('ebike', 'Bosch Smart System', 'Performance Line CX Smart')).toBe('bosch');
    expect(errorFamilyFor('ebike', 'Shimano', 'STEPS EP8')).toBe('shimano');
    expect(errorFamilyFor('ebike', 'Bafang', 'BBSHD')).toBe('bafang');
    const bosch = errorCodesFor('ebike', 'Bosch', 'Performance CX');
    expect(findErrorCode(bosch, '423')?.title).toMatch(/battery/i);
    const bafang = errorCodesFor('ebike', 'Bafang', 'BBSHD');
    expect(findErrorCode(bafang, '30')?.system).toBe('display');
  });

  it('Xiaomi M365 maps to its dedicated family', () => {
    expect(errorFamilyFor('electric_scooter', 'Xiaomi', 'M365')).toBe('xiaomi');
  });

  it('unknown models fall back to the generic family', () => {
    expect(errorFamilyFor('electric_scooter', 'Budget / Other', 'Other / Not Listed')).toBe('generic');
    const codes = errorCodesFor('ebike', 'Swytch', 'Swytch Kit (Conversions)');
    expect(codes.length).toBeGreaterThan(0);
  });

  it('normalises lookup inside findErrorCode', () => {
    const codes = errorCodesFor('electric_scooter', 'Xiaomi', 'M365');
    expect(findErrorCode(codes, 'e21')?.title).toBeTruthy();
    expect(findErrorCode(codes, '21')?.code).toBe('E21');
  });

  it('lists brands for a category in picker order', () => {
    const scooters = brandsForEVehicleCategory('electric_scooter');
    expect(scooters.length).toBeGreaterThan(5);
    expect(scooters[0].brand).toBe('Segway / Ninebot');
    expect(scooters.some((s) => s.brand === 'Xiaomi')).toBe(true);
    const bikes = brandsForEVehicleCategory('ebike');
    expect(bikes.some((b) => b.brand === 'Bosch')).toBe(true);
  });

  it('every brand entry in EVEHICLE_BRANDS has models', () => {
    for (const b of EVEHICLE_BRANDS) {
      expect(b.models.length).toBeGreaterThan(0);
      expect(b.brand).toBeTruthy();
    }
  });

  it('covers the popular budget scooter brands (Kugoo, iENYRID, Gotrax, Hiboy, NIU)', () => {
    expect(errorFamilyFor('electric_scooter', 'Kugoo / Kukirin', 'M4')).toBe('kugoo');
    expect(errorFamilyFor('electric_scooter', 'iENYRID', 'M4 Pro S+')).toBe('ienyrid');
    expect(errorFamilyFor('electric_scooter', 'GoTrax', 'GXL')).toBe('gotrax');
    expect(errorFamilyFor('electric_scooter', 'Hiboy', 'S2 Pro')).toBe('hiboy');
    expect(errorFamilyFor('electric_scooter', 'NIU', 'KQi3')).toBe('niu');

    const kugoo = errorCodesFor('electric_scooter', 'Kugoo / Kukirin', 'M4');
    expect(findErrorCode(kugoo, '1')?.system).toBe('motor');
    expect(findErrorCode(kugoo, '2')?.system).toBe('throttle');

    const ienyrid = errorCodesFor('electric_scooter', 'iENYRID', 'M4 Pro S+');
    expect(findErrorCode(ienyrid, '7E')?.system).toBe('throttle');
    expect(findErrorCode(ienyrid, '15E')?.system).toBe('controller');

    const niu = errorCodesFor('electric_scooter', 'NIU', 'KQi3');
    expect(findErrorCode(niu, '03')?.system).toBe('throttle');
    expect(findErrorCode(niu, '21')?.system).toBe('bms');
  });
});

describe('display / system identification', () => {
  it('lists displays for both categories and routes them to a family', () => {
    const scooters = displaysForCategory('electric_scooter');
    const bikes = displaysForCategory('ebike');
    expect(scooters.length).toBeGreaterThan(5);
    expect(bikes.length).toBeGreaterThan(3);
    expect(scooters.every((d) => d.codeStyle && d.appearance && d.usedOn.length > 0)).toBe(true);
  });

  it('maps a chosen brand/model to the display that reports its codes', () => {
    expect(displayForModel('electric_scooter', 'Xiaomi', 'M365')?.family).toBe('xiaomi');
    expect(displayForModel('electric_scooter', 'Segway / Ninebot', 'Max G30')?.family).toBe('ninebot');
    expect(displayForModel('electric_scooter', 'iENYRID', 'M4')?.family).toBe('ienyrid');
    expect(displayForModel('ebike', 'Shimano', 'STEPS EP8')?.family).toBe('shimano');
  });

  it('every display family resolves to a non-empty code table', () => {
    for (const d of EVEHICLE_DISPLAYS) {
      expect(errorCodesForFamily(d.family).length, `${d.id} has no codes`).toBeGreaterThan(0);
    }
  });
});

describe('assistECodeLookup offline fallback', () => {
  // Force the offline path: clear the key so no AI call can be attempted here,
  // regardless of what is in the developer's local .env.
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an offline result with a throttle match for a throttle symptom', async () => {
    const result = await assistECodeLookup({
      category: 'electric_scooter',
      brand: 'Xiaomi',
      model: 'M365',
      symptom: 'the throttle does nothing and it beeps',
    });
    expect(result.source).toBe('offline');
    expect(result.empty).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
    // E14 is the Xiaomi throttle code.
    expect(result.matches.some((m) => m.code === 'E14')).toBe(true);
  });

  it('returns empty matches when no symptom matches the catalogue', async () => {
    const result = await assistECodeLookup({
      category: 'ebike',
      brand: 'Shimano',
      model: 'STEPS EP8',
      symptom: 'it smells of roses',
    });
    expect(result.source).toBe('offline');
    expect(result.matches).toHaveLength(0);
    expect(result.empty).toBe(true);
  });
});

describe('ErrorCodeLookupTab UI', () => {
  it('renders the pickers and a placeholder before a model is chosen', () => {
    render(<ErrorCodeLookupTab />);
    expect(screen.getByTestId('ev-category')).toBeTruthy();
    expect(screen.getByTestId('ev-brand')).toBeTruthy();
    expect(screen.getByTestId('ev-model')).toBeTruthy();
    expect(screen.getByText('Identify the display, or choose a brand and model, to see its codes.')).toBeTruthy();
    expect(screen.queryByTestId('ev-code-list')).toBeNull();
  });

  it('shows the Xiaomi M365 code table after selecting category → brand → model', () => {
    render(<ErrorCodeLookupTab />);

    fireEvent.change(screen.getByTestId('ev-category'), { target: { value: 'electric_scooter' } });
    fireEvent.change(screen.getByTestId('ev-brand'), { target: { value: 'Xiaomi' } });
    expect(screen.getByTestId('ev-model')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ev-model'), { target: { value: 'M365' } });

    const list = screen.getByTestId('ev-code-list');
    expect(list).toBeTruthy();
    expect(within(list).getByText('E21')).toBeTruthy();
    expect(within(list).getByText('E22')).toBeTruthy();
  });

  it('filters the table with a code search', () => {
    render(<ErrorCodeLookupTab />);
    fireEvent.change(screen.getByTestId('ev-category'), { target: { value: 'electric_scooter' } });
    fireEvent.change(screen.getByTestId('ev-brand'), { target: { value: 'Xiaomi' } });
    fireEvent.change(screen.getByTestId('ev-model'), { target: { value: 'M365' } });

    fireEvent.change(screen.getByTestId('ev-search'), { target: { value: 'E23' } });
    const list = screen.getByTestId('ev-code-list');
    expect(within(list).getByText('E23')).toBeTruthy();
    expect(within(list).queryByText('E21')).toBeNull();
  });

  it('runs the AI assist in offline mode and shows guidance', async () => {
    render(<ErrorCodeLookupTab />);
    fireEvent.change(screen.getByTestId('ev-category'), { target: { value: 'electric_scooter' } });
    fireEvent.change(screen.getByTestId('ev-brand'), { target: { value: 'Xiaomi' } });
    fireEvent.change(screen.getByTestId('ev-model'), { target: { value: 'M365' } });
    fireEvent.change(screen.getByTestId('ev-symptom'), { target: { value: 'throttle sticks and beeps' } });

    // "Ask the AI" resolves immediately in offline mode.
    fireEvent.click(screen.getByTestId('ev-assist-run'));
    const results = await screen.findByTestId('ev-assist-results');
    expect(results).toBeTruthy();
    expect(screen.getAllByTestId('ev-assist-match').length).toBeGreaterThan(0);
  });

  it('resets the selections', () => {
    render(<ErrorCodeLookupTab />);
    fireEvent.change(screen.getByTestId('ev-category'), { target: { value: 'electric_scooter' } });
    fireEvent.change(screen.getByTestId('ev-brand'), { target: { value: 'Xiaomi' } });
    fireEvent.change(screen.getByTestId('ev-model'), { target: { value: 'M365' } });
    fireEvent.click(screen.getByTestId('ev-reset'));
    expect(screen.getByText('Identify the display, or choose a brand and model, to see its codes.')).toBeTruthy();
    expect(screen.queryByTestId('ev-code-list')).toBeNull();
  });

  it('shows a code table from a chosen display without picking a brand or model', () => {
    render(<ErrorCodeLookupTab />);
    // iENYRID display → iENYRID "nE" codes, no brand/model needed.
    fireEvent.click(screen.getByTestId('ev-display-ienyrid-ne'));
    const list = screen.getByTestId('ev-code-list');
    expect(within(list).getByText('7E')).toBeTruthy();
    expect(within(list).getByText('15E')).toBeTruthy();
    expect(screen.getByTestId('ev-display-banner')).toBeTruthy();
    // Clearing the display returns to the empty state.
    fireEvent.click(screen.getByTestId('ev-display-clear'));
    expect(screen.queryByTestId('ev-code-list')).toBeNull();
  });

  it('runs AI assist from a display selection in offline mode', async () => {
    render(<ErrorCodeLookupTab />);
    fireEvent.click(screen.getByTestId('ev-display-kugoo-numeric'));
    fireEvent.change(screen.getByTestId('ev-symptom'), { target: { value: 'throttle dead' } });
    fireEvent.click(screen.getByTestId('ev-assist-run'));
    const results = await screen.findByTestId('ev-assist-results');
    expect(results).toBeTruthy();
    expect(screen.getAllByTestId('ev-assist-match').length).toBeGreaterThan(0);
  });
});