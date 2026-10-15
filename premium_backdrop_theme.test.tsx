import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { shopState } = vi.hoisted(() => ({
  shopState: { theme: 'dark' as string, seasonalTheme: 'none' as string },
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => shopState,
}));

import { PremiumBackdrop } from './src/components/PremiumBackdrop';

describe('seasonal theme backdrop visibility', () => {
  beforeEach(() => {
    shopState.theme = 'dark';
    shopState.seasonalTheme = 'none';
  });
  afterEach(cleanup);

  it('shows the normal backdrop when no seasonal theme is applied', () => {
    const { container } = render(<PremiumBackdrop />);
    expect(container.querySelector('.os-backdrop')).not.toBeNull();
  });

  it('removes the normal backdrop behind seasonal artwork', () => {
    shopState.seasonalTheme = 'halloween';
    const { container } = render(<PremiumBackdrop />);
    expect(container.querySelector('.os-backdrop')).toBeNull();
  });
});
