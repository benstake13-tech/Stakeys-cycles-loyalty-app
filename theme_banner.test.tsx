import React from 'react';
import { describe, it, expect } from 'vitest';

import { THEME_BANNERS, themeBannerFor } from './src/utils/themeBanners';
import { HOLIDAY_THEME_IDS } from './src/utils/holidayCalendar';

// The old in-page info banner component was superseded by the graphical,
// swinging SeasonalHeroBanner; only the theme-banner data registry remains and
// is still exercised by the Test Bench diagnostics.

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
