import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: {} as any,
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { ScratchCard } from './src/components/ScratchCard';
import { DEFAULT_SCRATCH_CARD } from './src/utils/scratchCardHelper';
import type { ScratchCardConfig, UserProfile } from './src/types/bikeShop';

const makeUser = (over: Partial<UserProfile> = {}): UserProfile =>
  ({ uid: 'u1', displayName: 'Ada', stamps: 0, tickets: 0, points: 0, ...over }) as UserProfile;

const ctxStub = {
  createLinearGradient: () => ({ addColorStop: vi.fn() }),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  clearRect: vi.fn(),
  getImageData: (_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
  }),
  globalCompositeOperation: 'source-over',
  fillStyle: '',
  font: '',
  textAlign: '',
  textBaseline: '',
};

beforeEach(() => {
  hoisted.shop = {};
  // jsdom has no canvas backend; stub the 2D context the component uses.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxStub) as any;
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn() as any;
});

const enabledConfig = (over: Partial<ScratchCardConfig> = {}): ScratchCardConfig => ({
  ...DEFAULT_SCRATCH_CARD,
  enabled: true,
  cooldownHours: 0,
  ...over,
});

describe('ScratchCard (customer)', () => {
  it('shows a locked message when the feature is disabled', () => {
    hoisted.shop = { currentUser: makeUser(), scratchCard: enabledConfig({ enabled: false }) };
    const { container } = render(<ScratchCard />);
    expect(container.textContent).toContain('Scratch card unavailable');
  });

  it('shows a locked message when no config has loaded', () => {
    hoisted.shop = { currentUser: makeUser(), scratchCard: null };
    const { container } = render(<ScratchCard />);
    expect(container.textContent).toContain('Scratch card unavailable');
  });

  it('renders the scratch surface when playable', () => {
    hoisted.shop = { currentUser: makeUser(), scratchCard: enabledConfig() };
    const { container } = render(<ScratchCard />);
    expect(container.textContent).toContain('Scratch to reveal');
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('reveals the staff-configured prize table on demand', () => {
    hoisted.shop = { currentUser: makeUser(), scratchCard: enabledConfig() };
    const { container, getByText } = render(<ScratchCard />);
    fireEvent.click(getByText(/Show possible prizes/));
    expect(container.textContent).toContain('+1 Loyalty Stamp');
    // The default stamp prize carries 30 of the 100 total weight.
    expect(container.textContent).toContain('30%');
  });

  it('shows the ticket cost badge when the card charges tickets', () => {
    hoisted.shop = {
      currentUser: makeUser({ tickets: 3 }),
      scratchCard: enabledConfig({ ticketCost: 2 }),
    };
    const { container } = render(<ScratchCard />);
    expect(container.textContent).toContain('2 tickets');
  });

  it('shows the cooldown countdown instead of the scratch surface', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    hoisted.shop = {
      currentUser: makeUser({ lastScratchedAt: new Date('2026-10-08T06:00:00Z') }),
      scratchCard: enabledConfig({ cooldownHours: 24 }),
    };
    const { container } = render(<ScratchCard />);
    expect(container.textContent).toContain('Next scratch card unlocks soon');
    expect(container.textContent).toContain('18h 0m');
    expect(container.querySelector('canvas')).toBeFalsy();
    vi.useRealTimers();
  });
});
