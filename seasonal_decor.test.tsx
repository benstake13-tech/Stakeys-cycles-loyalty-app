import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The decor reads only `seasonalTheme`; a mutable mock keeps tests isolated.
const hoisted = vi.hoisted(() => ({ theme: 'none' as string }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ seasonalTheme: hoisted.theme }) }));

import { SeasonalDecor } from './src/components/SeasonalDecor';
import { SeasonalHeroBanner } from './src/components/SeasonalHeroBanner';
import { SeasonalFooterDecor } from './src/components/SeasonalFooterDecor';
import { THEME_DECOR, themeDecorFor, decorDismissKey } from './src/utils/themeDecor';
import { HOLIDAY_THEME_IDS } from './src/utils/holidayCalendar';

beforeEach(() => {
  localStorage.clear();
  hoisted.theme = 'none';
});

describe('theme decor registry', () => {
  it('has decor for every concrete seasonal theme (extensible by construction)', () => {
    for (const id of HOLIDAY_THEME_IDS) {
      expect(THEME_DECOR[id as keyof typeof THEME_DECOR], `decor for ${id}`).toBeTruthy();
    }
  });

  it('maps "none"/unknown to null and gives every theme a full structure', () => {
    expect(themeDecorFor('none')).toBeNull();
    expect(themeDecorFor(undefined)).toBeNull();
    expect(themeDecorFor('nonsense')).toBeNull();
    for (const id of HOLIDAY_THEME_IDS) {
      const d = THEME_DECOR[id as keyof typeof THEME_DECOR];
      expect(d.heading.length).toBeGreaterThan(0);
      expect(d.subtext.length).toBeGreaterThan(0);
      expect(d.web.length).toBeGreaterThan(0);
      expect(d.flyers.length).toBeGreaterThanOrEqual(4);
      expect(d.trail.length).toBeGreaterThan(0);
      expect(d.cornerProp.length).toBeGreaterThan(0);
    }
  });
});

describe('SeasonalDecor wrapper', () => {
  it('renders nothing for the default "none" theme', () => {
    hoisted.theme = 'none';
    const { container } = render(<SeasonalDecor />);
    expect(container.querySelector('.seasonal-decor')).toBeNull();
  });

  it('tags the wrapper with the active theme class + data attribute', () => {
    hoisted.theme = 'halloween';
    const { container } = render(<SeasonalDecor />);
    const root = container.querySelector('.seasonal-decor');
    expect(root).toBeTruthy();
    expect(root!.className).toContain('theme-halloween');
    expect(root!.getAttribute('data-theme')).toBe('halloween');
  });

  it('uses the same structural markup for a different theme (Christmas)', () => {
    hoisted.theme = 'christmas';
    render(<SeasonalDecor />);
    expect(screen.getByTestId('seasonal-hero')).toBeTruthy();
    expect(screen.getByTestId('seasonal-footer')).toBeTruthy();
    expect(screen.getByTestId('seasonal-hero-sign').textContent).toMatch(/CHRISTMAS/);
  });
});

describe('SeasonalHeroBanner (Halloween)', () => {
  beforeEach(() => {
    hoisted.theme = 'halloween';
  });

  it('exposes the required id, non-blocking wrapper, chains and copy', () => {
    const { container } = render(<SeasonalDecor />);
    expect(screen.getByTestId('seasonal-hero')).toBeTruthy();
    // The required id lives on the swinging sign container.
    expect(container.querySelector('#halloween-hero-banner')).toBeTruthy();
    expect(container.querySelector('.chain-left')).toBeTruthy();
    expect(container.querySelector('.chain-right')).toBeTruthy();
    expect(screen.getByText(/HAPPY HALLOWEEN!/)).toBeTruthy();
    expect(screen.getByText('Spooky savings & eerie repairs await!')).toBeTruthy();
    // Cobwebs + bats are present.
    expect(container.querySelectorAll('.seasonal-hero-web').length).toBe(4);
    expect(container.querySelectorAll('.seasonal-hero-flyer').length).toBe(4);
  });

  it('shakes when the sign is clicked', () => {
    const { container } = render(<SeasonalHeroBanner theme="halloween" />);
    const sign = screen.getByTestId('seasonal-hero-sign');
    expect(sign.className).not.toContain('is-shaking');
    fireEvent.click(container.querySelector('.sign-face')!);
    expect(screen.getByTestId('seasonal-hero-sign').className).toContain('is-shaking');
  });

  it('dismisses on × with a fade/collapse, persists per theme, and unmounts', () => {
    vi.useFakeTimers();
    render(<SeasonalHeroBanner theme="halloween" />);
    fireEvent.click(screen.getByTestId('seasonal-hero-close'));

    // Collapsing class is applied for the fade-out, then it unmounts.
    expect(screen.getByTestId('seasonal-hero').className).toContain('is-closing');
    expect(localStorage.getItem(decorDismissKey('halloween'))).toBe('1');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId('seasonal-hero')).toBeNull();
    vi.useRealTimers();
  });

  it('stays dismissed on remount but not for a different theme', () => {
    vi.useFakeTimers();
    const { rerender } = render(<SeasonalHeroBanner theme="halloween" />);
    fireEvent.click(screen.getByTestId('seasonal-hero-close'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId('seasonal-hero')).toBeNull();

    rerender(<SeasonalHeroBanner theme="halloween" />);
    expect(screen.queryByTestId('seasonal-hero')).toBeNull();

    rerender(<SeasonalHeroBanner theme="christmas" />);
    expect(screen.getByTestId('seasonal-hero')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('SeasonalFooterDecor (Halloween)', () => {
  it('exposes the required id, corner props, a sweet trail and crawlers', () => {
    const { container } = render(<SeasonalFooterDecor theme="halloween" />);
    expect(container.querySelector('#halloween-footer-decor')).toBeTruthy();
    expect(container.querySelectorAll('.seasonal-footer-prop').length).toBe(2);
    expect(container.querySelectorAll('.seasonal-footer-sweet').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.seasonal-footer-spook').length).toBe(2);
    expect(container.querySelectorAll('.seasonal-footer-crawler').length).toBe(2);
  });

  it('renders nothing without a theme', () => {
    const { container } = render(<SeasonalFooterDecor theme="none" />);
    expect(container.querySelector('#halloween-footer-decor')).toBeNull();
  });
});
