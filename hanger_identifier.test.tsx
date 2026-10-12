import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  DERAILLEUR_HANGERS_DATABASE,
  buildHangerPurchaseLinks,
} from './src/data/derailleurHangerData';
import {
  HANGER_CROSS_REFERENCE,
  buildCrossRefBuyLinks,
} from './src/data/hangerCrossReference';
import { DerailleurHangerIdentifier } from './src/components/DerailleurHangerIdentifier';

describe('derailleur hanger data', () => {
  it('ships the core workshop hangers with cross-reference codes', () => {
    expect(DERAILLEUR_HANGERS_DATABASE.length).toBeGreaterThanOrEqual(7);
    for (const h of DERAILLEUR_HANGERS_DATABASE) {
      expect(h.oemPartNumbers.length).toBeGreaterThan(0);
      expect(h.torqueSpecNm).toBeGreaterThan(0);
      expect(h.compatibleYears.length).toBeGreaterThan(0);
    }
  });

  it('ships a UK cross-reference index of real hangers', () => {
    expect(HANGER_CROSS_REFERENCE.length).toBeGreaterThan(150);
    for (const h of HANGER_CROSS_REFERENCE) {
      expect(h.wheelsMfg).toMatch(/^DROPOUT-\d+[A-Z]*$/);
      expect(h.oemPartNumbers.length).toBeGreaterThan(0);
      expect(h.brand).toBeTruthy();
    }
  });

  it('covers the major UK-market brands', () => {
    const brands = new Set(HANGER_CROSS_REFERENCE.map((h) => h.brand));
    for (const b of ['Trek', 'Specialized', 'Giant', 'Cannondale', 'Canyon', 'Nukeproof', 'Vitus']) {
      expect(brands.has(b), `${b} missing from cross-reference`).toBe(true);
    }
  });

  it('builds purchase links on every workshop hanger', () => {
    for (const h of DERAILLEUR_HANGERS_DATABASE) {
      const links = buildHangerPurchaseLinks(h);
      expect(links.length).toBeGreaterThanOrEqual(4);
      expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
      expect(links.some((l) => l.url.includes('ebay.co.uk'))).toBe(true);
    }
  });

  it('builds purchase links on every cross-reference entry', () => {
    for (const h of HANGER_CROSS_REFERENCE) {
      const links = buildCrossRefBuyLinks(h);
      expect(links.length).toBeGreaterThanOrEqual(4);
      expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
      // The Wheels Mfg DROPOUT number is the search key.
      expect(links.some((l) => decodeURIComponent(l.url).includes(h.wheelsMfg))).toBe(true);
    }
  });
});

describe('DerailleurHangerIdentifier UI', () => {
  it('renders the identifier and the cross-reference index', () => {
    render(<DerailleurHangerIdentifier />);
    expect(screen.getByText('High-Accuracy Derailleur Hanger Identification')).toBeTruthy();
    expect(screen.getByText('UK Cross-Reference Index')).toBeTruthy();
    expect(screen.getByTestId('hanger-xref-list')).toBeTruthy();
  });

  it('filters the cross-reference by brand and by DROPOUT number', () => {
    render(<DerailleurHangerIdentifier />);
    const search = screen.getByTestId('hanger-xref-search');

    fireEvent.change(search, { target: { value: 'Trek' } });
    let list = screen.getByTestId('hanger-xref-list');
    expect(within(list).getAllByText('Trek').length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: 'DROPOUT-487' } });
    list = screen.getByTestId('hanger-xref-list');
    expect(within(list).getByText('DROPOUT-487')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'zzz-no-such-hanger' } });
    list = screen.getByTestId('hanger-xref-list');
    expect(within(list).getByText(/No cross-reference matches/)).toBeTruthy();
  });

  it('expands a cross-reference row to reveal buy links', () => {
    render(<DerailleurHangerIdentifier />);
    fireEvent.change(screen.getByTestId('hanger-xref-search'), { target: { value: 'DROPOUT-487' } });
    const list = screen.getByTestId('hanger-xref-list');
    fireEvent.click(within(list).getByText('DROPOUT-487'));
    expect(within(list).getAllByText('eBay UK').length).toBeGreaterThan(0);
    expect(within(list).getByText('SJS')).toBeTruthy();
  });
});
