import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { WORLD_CATALOG, worldFor } from './src/components/theme/worldCatalog';
import { HOLIDAY_THEME_IDS } from './src/utils/holidayCalendar';
import { ThemeWorld } from './src/components/theme/ThemeWorld';
afterEach(cleanup);
describe('rendered seasonal shop scenes', () => {
  it('covers every calendar holiday and leaves unknown themes empty', () => {
    expect(Object.keys(WORLD_CATALOG).sort()).toEqual([...HOLIDAY_THEME_IDS].sort());
    expect(worldFor('none')).toBeNull();
    expect(worldFor('missing')).toBeNull();
  });
  it.each(['christmas', 'easter', 'halloween'])('uses only a still shop photograph for %s in previews and live scenes', theme => {
    for (const preview of [true, false]) {
      const view = render(<ThemeWorld theme={theme} preview={preview} />);
      expect(view.container.querySelector('image')?.getAttribute('href')).toBe(`/seasonal/${theme}.jpg`);
      expect(view.container.querySelector('canvas')).toBeNull();
      expect(view.container.querySelector('button')).toBeNull();
      expect(view.container.querySelector('.theme-particles')).toBeNull();
      expect(view.container.querySelector('.theme-world')?.getAttribute('data-motion')).toBe('still');
      view.unmount();
    }
  });
});
