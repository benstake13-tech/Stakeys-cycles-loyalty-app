import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EVEHICLE_CATEGORIES,
  EVEHICLE_BRANDS,
  errorCodesFor,
  errorFamilyFor,
  brandsForEVehicleCategory,
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
});

describe('assistECodeLookup offline fallback', () => {
  // The service returns the offline path whenever VITE_GEMINI_API_KEY is unset
  // (the test runner has no key), so no AI call can be attempted here.
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an offline result with a throttle match for a throttle symptom', async () => {
    const result = await assistECodeLookup({
      category: 'electric_scooter',
      brand: 'Xiaomi',
      model: 'M365',
      symptom: 'it keeps beeping E23 and the throttle does nothing',
    });
    expect(result.source).toBe('offline');
    expect(result.empty).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
    // E23 is the Xiaomi throttle code.
    expect(result.matches.some((m) => m.code === 'E23')).toBe(true);
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
    expect(screen.getByText('Choose a brand and model to see its codes.')).toBeTruthy();
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
    expect(screen.getByText('Choose a brand and model to see its codes.')).toBeTruthy();
    expect(screen.queryByTestId('ev-code-list')).toBeNull();
  });
});