import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  reviews: [] as any[],
  addReview: vi.fn(async (_review: any) => ({ id: 'new' })),
  updateReview: vi.fn(async (_id: string, _updates: any) => ({ id: 'x' })),
  deleteReview: vi.fn(async (_id: string) => true),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    reviews: hoisted.reviews,
    addReview: hoisted.addReview,
    updateReview: hoisted.updateReview,
    deleteReview: hoisted.deleteReview,
  }),
}));

import { ReviewsTab } from './src/components/ReviewsTab';

const published = {
  id: 'r1',
  customerName: 'Ada Rider',
  rating: 5,
  title: 'Brilliant',
  comment: 'Quick turnaround on my brake bleed.',
  status: 'published',
  source: 'website',
  createdAt: '2026-01-01T00:00:00Z',
};
const pending = {
  id: 'r2',
  customerName: 'Ben Wheeler',
  rating: 3,
  comment: 'Decent but busy.',
  status: 'pending',
  source: 'in_store',
  createdAt: '2026-01-02T00:00:00Z',
};

beforeEach(() => {
  cleanup();
  hoisted.reviews = [published, pending];
  hoisted.addReview.mockClear();
  hoisted.updateReview.mockClear();
  hoisted.deleteReview.mockClear();
});

describe('ReviewsTab', () => {
  it('renders each review with its author, comment and status', () => {
    render(<ReviewsTab />);
    expect(screen.getByText('Ada Rider')).toBeTruthy();
    expect(screen.getByText('Quick turnaround on my brake bleed.')).toBeTruthy();
    expect(screen.getByText('Ben Wheeler')).toBeTruthy();
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('filters to a single status', () => {
    render(<ReviewsTab />);
    fireEvent.click(screen.getByRole('button', { name: 'pending' }));
    expect(screen.getByText('Ben Wheeler')).toBeTruthy();
    expect(screen.queryByText('Ada Rider')).toBeNull();
  });

  it('adds a review with trimmed values', () => {
    render(<ReviewsTab />);
    fireEvent.click(screen.getByTestId('review-new'));
    const inputs = screen.getAllByRole('textbox');
    // Order: customer name, membership no., title, then the review textarea.
    fireEvent.change(inputs[0], { target: { value: '  Cara  ' } });
    fireEvent.change(inputs[3], { target: { value: '  Lovely staff  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save review/i }));

    expect(hoisted.addReview).toHaveBeenCalledTimes(1);
    const arg = hoisted.addReview.mock.calls[0][0];
    expect(arg.customerName).toBe('Cara');
    expect(arg.comment).toBe('Lovely staff');
    expect(arg.rating).toBe(5);
  });

  it('hides a published review when the eye button is clicked', () => {
    render(<ReviewsTab />);
    const row = screen.getByTestId('review-row-r1');
    const buttons = row.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(hoisted.updateReview).toHaveBeenCalledWith('r1', { status: 'hidden' });
  });
});
