import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  runBootScan: vi.fn(),
  executeRepairTarget: vi.fn(async () => {}),
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ theme: 'dark' }) }));
vi.mock('./src/utils/featureDiagnostics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./src/utils/featureDiagnostics')>()),
  runBootScan: hoisted.runBootScan,
}));
vi.mock('./src/utils/repairRunner', () => ({ executeRepairTarget: hoisted.executeRepairTarget }));

import { StaffHealthBanner } from './src/components/StaffHealthBanner';

const result = (over: Record<string, unknown>) => ({
  id: 'x',
  area: 'logic',
  label: 'x',
  status: 'pass',
  detail: '',
  ms: 1,
  ...over,
});

beforeEach(() => {
  cleanup();
  hoisted.runBootScan.mockReset();
  hoisted.executeRepairTarget.mockClear();
});

describe('StaffHealthBanner', () => {
  it('shows a healthy line when the scan is clean, and opens the Test Bench on click', async () => {
    hoisted.runBootScan.mockResolvedValue({
      healthy: true,
      counts: { pass: 42, fail: 0, warn: 0, skipped: 0 },
      problems: [],
    });
    const onOpen = vi.fn();
    render(<StaffHealthBanner onOpenTestBench={onOpen} />);
    await waitFor(() => expect(screen.getByTestId('staff-health-banner').dataset.state).toBe('healthy'));
    expect(screen.getByText(/All systems healthy/i)).toBeTruthy();
    expect(screen.getByText(/42 checks passed/i)).toBeTruthy();
    expect(screen.queryByTestId('staff-health-fix')).toBeNull();
    fireEvent.click(screen.getByTestId('staff-health-banner'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('builds a Supabase Fix button from a failing DB area and runs the repair', async () => {
    hoisted.runBootScan.mockResolvedValue({
      healthy: false,
      counts: { pass: 1, fail: 1, warn: 0, skipped: 0 },
      failingArea: 'members',
      problems: [result({ id: 'loyalty-read', area: 'members', status: 'fail', label: 'Members read', detail: 'permission denied', tables: ['profiles'] })],
    });
    render(<StaffHealthBanner onOpenTestBench={vi.fn()} />);
    const fix = await screen.findByTestId('staff-health-fix');
    expect(fix.textContent).toMatch(/Open Supabase SQL Editor/i);
    expect(screen.getByText(/Members read/i)).toBeTruthy();
    fireEvent.click(fix);
    await waitFor(() => expect(hoisted.executeRepairTarget).toHaveBeenCalledTimes(1));
    const target = hoisted.executeRepairTarget.mock.calls[0][0] as { service: string };
    expect(target.service).toBe('supabase');
  });

  it('labels the Fix button for a push area', async () => {
    hoisted.runBootScan.mockResolvedValue({
      healthy: false,
      counts: { pass: 1, fail: 1, warn: 0, skipped: 0 },
      failingArea: 'reach',
      problems: [result({ id: 'push-reach', area: 'reach', status: 'fail', label: 'Push reach', detail: 'no subscription' })],
    });
    render(<StaffHealthBanner onOpenTestBench={vi.fn()} />);
    const fix = await screen.findByTestId('staff-health-fix');
    expect(fix.textContent).toMatch(/Repair push notifications/i);
  });
});
