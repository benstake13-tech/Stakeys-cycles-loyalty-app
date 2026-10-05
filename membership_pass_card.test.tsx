import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { UserProfile } from './src/shared/types/bikeShop';

// jsbarcode draws to a real SVG; stub it so the test only asserts the payload.
const hoisted = vi.hoisted(() => ({ barcodePayloads: [] as string[] }));
vi.mock('jsbarcode', () => ({
  default: (_el: any, value: string) => {
    hoisted.barcodePayloads.push(value);
  },
}));

import { MembershipPassCard } from './src/components/MembershipPassCard';

const user = {
  uid: 'uid-1',
  email: 'rider@shop.com',
  role: 'customer',
  displayName: 'Rider One',
  membershipNumber: 'STK-123456',
  stamps: 4,
  tickets: 2,
  points: 75,
} as UserProfile;

describe('MembershipPassCard', () => {
  it('shows the stamp / ticket / point balances', () => {
    render(<MembershipPassCard user={user} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('75')).toBeTruthy();
    expect(screen.getByText('Stamps')).toBeTruthy();
    expect(screen.getByText('Tickets')).toBeTruthy();
    expect(screen.getByText('Points')).toBeTruthy();
  });

  it('encodes the balances into the barcode payload', () => {
    hoisted.barcodePayloads.length = 0;
    render(<MembershipPassCard user={user} />);
    const payload = hoisted.barcodePayloads.at(-1) || '';
    expect(payload).toContain('STK-123456');
    expect(payload).toContain('s=4');
    expect(payload).toContain('t=2');
    expect(payload).toContain('p=75');
  });
});
