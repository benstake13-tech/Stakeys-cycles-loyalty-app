import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ currentUser: null, createBooking: vi.fn(), redeemServiceVoucher: vi.fn() }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./src/utils/membershipCode', () => ({}));

import { BookingPortal } from './src/components/BookingPortal';
import { BOOKING_PHRASES } from './src/utils/bookingTranslator';

beforeEach(() => {
  localStorage.clear();
});

const pickLanguage = (code: string) => {
  fireEvent.change(screen.getByLabelText(/Language/i), { target: { value: code } });
};

describe('booking form language selection', () => {
  it('renders the wizard in English by default', () => {
    render(<BookingPortal />);
    expect(screen.getByText(BOOKING_PHRASES.en.heroTitle)).toBeTruthy();
  });

  it('re-renders the whole form in the chosen language', () => {
    render(<BookingPortal />);
    pickLanguage('pl');

    const pl = BOOKING_PHRASES.pl;
    // Hero, step labels and the symptom checklist all follow the choice — not
    // just the picker itself.
    expect(screen.getByText(pl.heroTitle)).toBeTruthy();
    expect(screen.getAllByText(pl.stepBike).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(pl.issuesSearchPlaceholder)).toBeTruthy();
    expect(screen.getByPlaceholderText(pl.issuesOtherPlaceholder)).toBeTruthy();
    expect(screen.queryByText(BOOKING_PHRASES.en.heroTitle)).toBeNull();
  });

  it('sets right-to-left direction for Arabic', () => {
    render(<BookingPortal />);
    pickLanguage('ar');
    const form = document.querySelector('form');
    expect(form?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByText(BOOKING_PHRASES.ar.heroTitle)).toBeTruthy();
  });

  it('remembers the language on the next visit', () => {
    const first = render(<BookingPortal />);
    pickLanguage('ro');
    first.unmount();

    render(<BookingPortal />);
    expect(screen.getByText(BOOKING_PHRASES.ro.heroTitle)).toBeTruthy();
  });
});
