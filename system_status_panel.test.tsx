import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/shared/supabase', () => ({
  getStoredSupabaseUrl: () => 'https://lhojocpygcnkxvkrcuxh.supabase.co',
  getStoredSupabaseAnonKey: () => 'anon',
  getSupabaseClient: () => null,
}));
vi.mock('./src/shared/utils/pushNotifications', () => ({ getPushPermission: async () => 'granted' }));
vi.mock('./src/shared/utils/pushSetup', () => ({ fetchPushConfig: async () => ({ appId: 'a', serverPush: true }) }));

const runSystem = vi.fn();
vi.mock('./src/shared/utils/notificationDiagnostics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./src/shared/utils/notificationDiagnostics')>();
  return {
    ...actual,
    runNotificationSystemTests: (...args: unknown[]) => runSystem(...args),
  };
});

import { SystemStatusPanel } from './src/components/SystemStatusPanel';

beforeEach(() => {
  runSystem.mockReset();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: async () => [] },
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

describe('SystemStatusPanel', () => {
  it('runs the system test on mount and shows a not-ready summary', async () => {
    runSystem.mockResolvedValue([
      { id: 'config', group: 'pipeline', label: 'Supabase project configured', status: 'pass', detail: 'ok' },
      {
        id: 'fn-send-email',
        group: 'pipeline',
        label: 'Edge function "send-email" is deployed',
        status: 'fail',
        detail: 'HTTP 404 — not deployed.',
        fix: { label: 'Copy deploy command', copy: 'deploy', hint: 'Paste into a CLI.' },
      },
    ]);
    render(<SystemStatusPanel />);
    await waitFor(() => expect(screen.getByText(/Edge function "send-email" is deployed/i)).toBeTruthy());
    expect(screen.getByText(/1\/2 working/i)).toBeTruthy();
    expect(screen.getByText(/Copy deploy command/i)).toBeTruthy();
  });

  it('shows a ready banner when every check passes', async () => {
    runSystem.mockResolvedValue([
      { id: 'config', group: 'pipeline', label: 'Supabase project configured', status: 'pass', detail: 'ok' },
    ]);
    render(<SystemStatusPanel />);
    await waitFor(() => expect(screen.getByText(/System ready/i)).toBeTruthy());
  });
});
