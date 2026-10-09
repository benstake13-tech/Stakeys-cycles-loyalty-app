import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bicycle-inspired "ride in / pedal back" view transition.
 *
 * Moving from the launcher into a tool (and back) plays a short transform +
 * opacity motion — the view "rides in" from one side and, on the way back,
 * "pedals back" from the other. Transform/opacity only (GPU-friendly) and
 * disabled for `prefers-reduced-motion`, where the state simply settles to
 * `idle` immediately so tests and users never wait on animation.
 *
 * The exposed `data-ride-state` attribute (`idle` / `entering` / `exiting`) lets
 * tests assert the motion without depending on real animation timing.
 */
export type RideState = 'idle' | 'entering' | 'exiting';

/** Must match the CSS animation durations in `index.css`. */
export const RIDE_DURATION_MS = 420;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface RideTransitionControls {
  state: RideState;
  /** Launcher -> tool: play the forward ride. */
  rideIn: () => void;
  /** Tool -> launcher: play the reverse "pedal back" ride. */
  rideBack: () => void;
}

export function useRideTransition(): RideTransitionControls {
  const [state, setState] = useState<RideState>('idle');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const play = useCallback((next: 'entering' | 'exiting') => {
    clearTimers();
    setState(next);
    if (prefersReducedMotion()) {
      setState('idle');
      return;
    }
    timers.current.push(window.setTimeout(() => setState('idle'), RIDE_DURATION_MS));
  }, []);

  return {
    state,
    rideIn: () => play('entering'),
    rideBack: () => play('exiting'),
  };
}

/** Wraps the launcher + active view and carries the ride animation. */
export const RideTransition: React.FC<{
  state: RideState;
  children: React.ReactNode;
  className?: string;
}> = ({ state, children, className = '' }) => (
  <div
    data-ride-state={state}
    data-testid="ride-stage"
    className={`ride-${state} ${className}`}
  >
    {children}
  </div>
);
