import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebProduct } from './src/types/websiteContent';
import {
  itemCodeForProduct,
  encodeItemCode,
  normalizeItemCode,
  resolveItemByCode,
} from './src/utils/itemCode';
import { ItemQrModal } from './src/components/ItemQrModal';
import { ItemScanModal } from './src/components/ItemScanModal';

const bike: WebProduct = {
  id: 'prod-abc123',
  name: 'Carrera Vengeance 2021',
  price: 249.99,
  wasPrice: 299.99,
  category: 'Mens Bikes',
  image: '',
  description: 'Hardtail MTB, 18 inch frame, recently serviced.',
  stock: 2,
};

const other: WebProduct = {
  id: 'prod-xyz789',
  name: 'Inner Tube (Presta)',
  price: 6.5,
  category: 'Second hand parts',
  image: '',
  stock: 10,
};

describe('itemCode utility', () => {
  it('derives a stable, barcode-friendly code from the product id', () => {
    expect(itemCodeForProduct('prod-abc123')).toBe('ITEM-PRODABC123');
    expect(itemCodeForProduct('prod-abc123')).toBe(itemCodeForProduct('prod-abc123'));
    expect(itemCodeForProduct('a.b/c d')).toBe('ITEM-ABCD');
  });

  it('round-trips an encoded payload back to the code', () => {
    const payload = encodeItemCode(bike.id);
    expect(payload).toContain('urn:stakeys:item:');
    expect(normalizeItemCode(payload)).toBe('ITEM-PRODABC123');
  });

  it('reads the code out of a bare token and a URL', () => {
    expect(normalizeItemCode('ITEM-PRODABC123')).toBe('ITEM-PRODABC123');
    expect(normalizeItemCode('https://stakeys-cycles.co.uk/item/ITEM-PRODABC123')).toBe(
      'ITEM-PRODABC123'
    );
  });

  it('resolves the scanned payload back to the live product', () => {
    const products = [bike, other];
    expect(resolveItemByCode(encodeItemCode(bike.id), products)?.id).toBe('prod-abc123');
    expect(resolveItemByCode('ITEM-PRODXYZ789', products)?.id).toBe('prod-xyz789');
    expect(resolveItemByCode('ITEM-NOPE', products)).toBeNull();
    expect(resolveItemByCode('STK-123456', products)).toBeNull();
  });
});

describe('ItemQrModal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  it('shows the item name, code, price and a scannable QR', () => {
    const { container } = render(<ItemQrModal product={bike} isDark onClose={() => {}} />);
    expect(screen.getByText('Carrera Vengeance 2021')).toBeTruthy();
    expect(screen.getByText('ITEM-PRODABC123')).toBeTruthy();
    expect(screen.getByText(/249\.99/)).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('prints the label on demand', () => {
    render(<ItemQrModal product={bike} isDark onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Print label/i }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});

describe('ItemScanModal', () => {
  it('offers selling the item and reveals details on request', () => {
    const onSell = vi.fn();
    render(<ItemScanModal product={bike} isDark onSell={onSell} onClose={() => {}} />);

    expect(screen.getByText('Carrera Vengeance 2021')).toBeTruthy();
    expect(screen.getByText('2 in stock')).toBeTruthy();
    // Details are hidden until asked for.
    expect(screen.queryByText(/recently serviced/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /View item details/i }));
    expect(screen.getByText(/recently serviced/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Sell this item/i }));
    expect(onSell).toHaveBeenCalledTimes(1);
  });

  it('disables selling when the item is out of stock', () => {
    render(
      <ItemScanModal product={{ ...bike, stock: 0 }} isDark onSell={() => {}} onClose={() => {}} />
    );
    const sell = screen.getByRole('button', { name: /Sell this item/i }) as HTMLButtonElement;
    expect(sell.disabled).toBe(true);
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });
});
