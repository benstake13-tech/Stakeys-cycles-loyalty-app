import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The banner only needs `seasonalTheme`; the mock is mutable so each test can
// pin the active theme without pulling in the whole ShopContext.
let mockTheme: string = 'none';
vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ seasonalTheme: mockTheme }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { ThemeBanner } from './src/components/ThemeBanner';
import { THEME_BANNERS, themeBannerFor } from './src/utils/themeBanners';
import { HOLIDAY_THEME_IDS } from './src/utils/holidayCalendar';

beforeEach(() => {
  localStorage.clear();
  mockTheme = 'none';
});

describe('theme celebration banner', () => {
  it('renders nothing for the default "none" theme', () => {
    mockTheme = 'none';
    const { container } = render(<ThemeBanner />);
    expect(container.querySelector('[data-testid="theme-banner"]')).toBeNull();
  });

  it('shows the Happy Halloween banner when Halloween is active', () => {
    mockTheme = 'halloween';
    render(<ThemeBanner />);
    const banner = screen.getByTestId('theme-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByText('Happy Halloween!')).toBeTruthy();
    expect(banner.getAttribute('aria-label')).toMatch(/Halloween/);
  });

  it('can be dismissed and stays dismissed for that theme only', () => {
    mockTheme = 'halloween';
    const { rerender } = render(<ThemeBanner />);
    fireEvent.click(screen.getByLabelText('Dismiss banner'));
    expect(screen.queryByTestId('theme-banner')).toBeNull();

    // Still hidden if the same theme is re-rendered.
    rerender(<ThemeBanner />);
    expect(screen.queryByTestId('theme-banner')).toBeNull();

    // A different theme shows its own banner (dismissal is per-theme).
    mockTheme = 'christmas';
    rerender(<ThemeBanner />);
    expect(screen.getByText('Merry Christmas!')).toBeTruthy();
  });

  it('celebrates without throwing when the CTA is pressed', async () => {
    const confetti = (await import('canvas-confetti')).default as unknown as ReturnType<typeof vi.fn>;
    mockTheme = 'diwali';
    render(<ThemeBanner />);
    fireEvent.click(screen.getByText('Celebrate'));
    expect(confetti).toHaveBeenCalled();
  });
});

describe('theme banner registry', () => {
  it('has a banner for every concrete seasonal theme', () => {
    for (const id of HOLIDAY_THEME_IDS) {
      expect(THEME_BANNERS[id as keyof typeof THEME_BANNERS], `banner for ${id}`).toBeTruthy();
    }
  });

  it('maps "none"/unknown to null and keeps greetings unique-ish', () => {
    expect(themeBannerFor('none')).toBeNull();
    expect(themeBannerFor(undefined)).toBeNull();
    expect(themeBannerFor('nonsense')).toBeNull();
    expect(themeBannerFor('christmas')?.greeting).toContain('Christmas');
  });
});
