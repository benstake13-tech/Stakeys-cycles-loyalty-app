import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/shared/api/websiteService', () => ({
  checkWebsiteTables: vi.fn(),
  fetchWebsiteOrders: vi.fn(),
  updateWebsiteOrderStatus: vi.fn(),
  updateWebsiteOrderPaymentReference: vi.fn(),
  deleteWebsiteOrder: vi.fn(),
  fetchWebsiteProducts: vi.fn(),
  saveWebsiteProduct: vi.fn(),
  deleteWebsiteProduct: vi.fn(),
  setWebsiteProductPublished: vi.fn(),
  fetchGalleryItems: vi.fn(),
  saveGalleryItem: vi.fn(),
  deleteGalleryItem: vi.fn(),
  uploadWebsiteImage: vi.fn(),
  subscribeToWebsiteShop: vi.fn(),
  provisionWebsiteSchema: vi.fn(),
  formatMoney: (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v),
  orderItemCount: (o: { items: { quantity: number }[] }) =>
    o.items.reduce((n, i) => n + i.quantity, 0),
  summariseOrderItems: (o: { items: { name: string; quantity: number }[] }) =>
    o.items.map((i) => `${i.quantity}× ${i.name}`).join(', '),
  isMissingTable: () => false,
}));

import * as service from './src/shared/api/websiteService';
import { ShopOrdersTab } from './src/components/ShopOrdersTab';
import { ShopManagerTab } from './src/components/ShopManagerTab';
import { GalleryManagerTab } from './src/components/GalleryManagerTab';

const order = {
  id: 'ord-123',
  customerName: 'Sam Rider',
  customerPhone: '07000000000',
  customerEmail: 'sam@example.com',
  fulfilment: 'collection' as const,
  address: '',
  postcode: '',
  notes: 'Please call on arrival',
  subtotal: 45,
  status: 'pending' as const,
  paymentMethod: 'payment_link',
  paymentReference: '',
  createdAt: '2026-10-05T10:00:00Z',
  items: [
    { id: 'l1', orderId: 'ord-123', productId: 'p1', name: 'Kenda Tyre 26"', unitPrice: 15, quantity: 3 },
  ],
};

const product = {
  id: 'prod-1',
  name: 'Shimano Chain',
  description: '9-speed chain',
  category: 'Parts',
  price: 18,
  stock: 4,
  imageUrl: '',
  condition: 'New',
  sku: 'CH-9',
  published: true,
  sortOrder: 0,
};

const galleryItem = {
  id: 'job-1',
  imageUrl: 'https://cdn.example/job.jpg',
  title: 'Full e-bike service',
  caption: 'Motor and brake overhaul',
  vehicleType: 'E-bike',
  sortOrder: 0,
  published: true,
  createdAt: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(service.checkWebsiteTables).mockResolvedValue({
    products: true,
    orders: true,
    gallery: true,
  });
  vi.mocked(service.fetchWebsiteOrders).mockResolvedValue([]);
  vi.mocked(service.fetchWebsiteProducts).mockResolvedValue([]);
  vi.mocked(service.fetchGalleryItems).mockResolvedValue([]);
  vi.mocked(service.updateWebsiteOrderStatus).mockResolvedValue(undefined);
  vi.mocked(service.updateWebsiteOrderPaymentReference).mockResolvedValue(undefined);
  vi.mocked(service.deleteWebsiteOrder).mockResolvedValue(undefined);
  vi.mocked(service.saveWebsiteProduct).mockResolvedValue(undefined);
  vi.mocked(service.deleteWebsiteProduct).mockResolvedValue(undefined);
  vi.mocked(service.setWebsiteProductPublished).mockResolvedValue(undefined);
  vi.mocked(service.saveGalleryItem).mockResolvedValue(undefined);
  vi.mocked(service.deleteGalleryItem).mockResolvedValue(undefined);
  vi.mocked(service.uploadWebsiteImage).mockResolvedValue('https://cdn.example/img.jpg');
  vi.mocked(service.subscribeToWebsiteShop).mockReturnValue(() => {});
  vi.mocked(service.provisionWebsiteSchema).mockResolvedValue(undefined);
});

describe('ShopOrdersTab', () => {
  it('lists a website order with its total and items', async () => {
    vi.mocked(service.fetchWebsiteOrders).mockResolvedValue([order]);
    render(<ShopOrdersTab />);
    expect(await screen.findByText('ord-123')).toBeTruthy();
    expect(screen.getByText('Sam Rider')).toBeTruthy();
    expect(screen.getByText('£45.00')).toBeTruthy();
    expect(screen.getByText('3× Kenda Tyre 26"')).toBeTruthy();
  });

  it('advances the order to the next stage', async () => {
    vi.mocked(service.fetchWebsiteOrders).mockResolvedValue([order]);
    render(<ShopOrdersTab />);
    const advance = await screen.findByText(/Mark Confirmed/);
    fireEvent.click(advance);
    await waitFor(() =>
      expect(service.updateWebsiteOrderStatus).toHaveBeenCalledWith('ord-123', 'confirmed')
    );
  });

  it('offers a WhatsApp payment request to the customer', async () => {
    vi.mocked(service.fetchWebsiteOrders).mockResolvedValue([order]);
    render(<ShopOrdersTab />);
    const link = (await screen.findByText('Payment request')).closest('a');
    expect(link?.getAttribute('href')).toContain('wa.me');
    expect(link?.getAttribute('href')).toContain('ord-123');
  });

  it('prompts for setup when the website tables are absent', async () => {
    vi.mocked(service.checkWebsiteTables).mockResolvedValue({
      products: false,
      orders: false,
      gallery: false,
    });
    render(<ShopOrdersTab />);
    expect(await screen.findByText(/website shop tables are not set up/i)).toBeTruthy();
  });
});

describe('ShopManagerTab', () => {
  it('lists catalogue items with a live badge', async () => {
    vi.mocked(service.fetchWebsiteProducts).mockResolvedValue([product]);
    render(<ShopManagerTab />);
    expect(await screen.findByText('Shimano Chain')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('4 in stock')).toBeTruthy();
  });

  it('hides a published item from the website', async () => {
    vi.mocked(service.fetchWebsiteProducts).mockResolvedValue([product]);
    render(<ShopManagerTab />);
    fireEvent.click(await screen.findByText('Hide'));
    await waitFor(() =>
      expect(service.setWebsiteProductPublished).toHaveBeenCalledWith('prod-1', false)
    );
  });

  it('saves a new item from the modal', async () => {
    vi.mocked(service.fetchWebsiteProducts).mockResolvedValue([]);
    render(<ShopManagerTab />);
    fireEvent.click(await screen.findByText('New Item'));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Brake Pads' } });
    fireEvent.change(screen.getByLabelText(/^Price/), { target: { value: '12' } });
    fireEvent.click(screen.getByText('Add item'));
    await waitFor(() =>
      expect(service.saveWebsiteProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Brake Pads', price: 12 })
      )
    );
  });
});

describe('GalleryManagerTab', () => {
  it('shows job photos with a live badge', async () => {
    vi.mocked(service.fetchGalleryItems).mockResolvedValue([galleryItem]);
    render(<GalleryManagerTab />);
    expect(await screen.findByText('Full e-bike service')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('hides a photo from the website', async () => {
    vi.mocked(service.fetchGalleryItems).mockResolvedValue([galleryItem]);
    render(<GalleryManagerTab />);
    fireEvent.click(await screen.findByText('Hide'));
    await waitFor(() =>
      expect(service.saveGalleryItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-1', published: false })
      )
    );
  });
});
