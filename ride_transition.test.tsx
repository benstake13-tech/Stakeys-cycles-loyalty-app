import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RideTransition, useRideTransition, RIDE_DURATION_MS } from './src/components/tiles/RideTransition';

/** Drives the ride hook from a button so the state is observable in the DOM. */
const Harness: React.FC = () => {
  const ride = useRideTransition();
  return (
    <div>
      <button type="button" data-testid="in" onClick={ride.rideIn}>
        in
      </button>
      <button type="button" data-testid="back" onClick={ride.rideBack}>
        back
      </button>
      <RideTransition state={ride.state}>
        <span>view</span>
      </RideTransition>
    </div>
  );
};

const mockReducedMotion = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

describe('RideTransition', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle and rides in / pedals back through the expected states', () => {
    render(<Harness />);
    const stage = screen.getByTestId('ride-stage');
    expect(stage.getAttribute('data-ride-state')).toBe('idle');

    fireEvent.click(screen.getByTestId('in'));
    expect(stage.getAttribute('data-ride-state')).toBe('entering');
    act(() => {
      vi.advanceTimersByTime(RIDE_DURATION_MS + 10);
    });
    expect(stage.getAttribute('data-ride-state')).toBe('idle');

    fireEvent.click(screen.getByTestId('back'));
    expect(stage.getAttribute('data-ride-state')).toBe('exiting');
    act(() => {
      vi.advanceTimersByTime(RIDE_DURATION_MS + 10);
    });
    expect(stage.getAttribute('data-ride-state')).toBe('idle');
  });

  it('settles immediately when prefers-reduced-motion is set (no waiting on animation)', () => {
    mockReducedMotion(true);
    render(<Harness />);
    const stage = screen.getByTestId('ride-stage');
    fireEvent.click(screen.getByTestId('in'));
    // No timer advance — reduced motion must resolve synchronously.
    expect(stage.getAttribute('data-ride-state')).toBe('idle');
  });
});
