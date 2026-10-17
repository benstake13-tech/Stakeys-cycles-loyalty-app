import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { requiresInstalledApp } from './src/utils/appAccess';
import { AppRequiredScreen } from './src/components/AppRequiredScreen';
afterEach(cleanup);
describe('installed app access', () => {
  it.each(['staff', 'customer'] as const)('covers %s browser routes but preserves native authentication', surface => {
    for (const path of ['/', '/login', '/register', '/garage']) {
      expect(requiresInstalledApp(surface, false, path)).toBe(true);
      expect(requiresInstalledApp(surface, true, path)).toBe(false);
    }
    expect(requiresInstalledApp(surface, false, '/reset-password')).toBe(false);
    expect(requiresInstalledApp(surface, false, '/reset-password/')).toBe(false);
    expect(requiresInstalledApp(surface, false, '/reset-password/login')).toBe(true);
  });
  it('keeps the public website and local development accessible', () => {
    expect(requiresInstalledApp('website', false, '/')).toBe(false);
    expect(requiresInstalledApp('full', false, '/')).toBe(false);
  });
  it.each(['staff', 'customer'] as const)('shows %s installation guidance without login inputs', audience => {
    render(<AppRequiredScreen audience={audience} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText(/current.*installation link/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: /Visit our website/ }).getAttribute('href')).toBe('https://www.stakeys.co.uk');
  });
});
