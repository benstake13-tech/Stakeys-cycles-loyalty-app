import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BookingConfirmationAnimation } from './src/components/BookingConfirmationAnimation';

describe('booking confirmation animation', () => {
  it('plays once without looping, then keeps a static confirmation', () => {
    render(<BookingConfirmationAnimation bookingId="animation-first" />);
    expect(screen.getByTestId('booking-confirmation-animation').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('booking-confirmation-animation').querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss booking animation' }));
    expect(screen.queryByTestId('booking-confirmation-animation')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-label')).toContain('Awaiting team approval');
  });

  it('does not replay the same booking after remount, but plays for a new booking', () => {
    const first = render(<BookingConfirmationAnimation bookingId="animation-remount" />);
    expect(screen.getByTestId('booking-confirmation-animation')).toBeTruthy();
    first.unmount();
    const revisit = render(<BookingConfirmationAnimation bookingId="animation-remount" />);
    expect(screen.queryByTestId('booking-confirmation-animation')).toBeNull();
    revisit.unmount();
    render(<BookingConfirmationAnimation bookingId="animation-next" />);
    expect(screen.getByTestId('booking-confirmation-animation')).toBeTruthy();
  });

  it('respects a previously recorded booking and allows dismissal', () => {
    localStorage.setItem('stakeys.booking-confirmation-played:animation-persisted', '1');
    const old = render(<BookingConfirmationAnimation bookingId="animation-persisted" />);
    expect(screen.queryByTestId('booking-confirmation-animation')).toBeNull();
    old.unmount();
    render(<BookingConfirmationAnimation bookingId="animation-error" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss booking animation' }));
    expect(screen.queryByTestId('booking-confirmation-animation')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
