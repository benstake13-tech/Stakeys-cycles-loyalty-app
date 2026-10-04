import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  ownerConfig: { ownerEmail: 'workshop@stakeyscycles.co.uk', ownerPhone: '+44 7700 900821', emailAlertsEnabled: true },
  getPushPermission: vi.fn(async () => 'default' as const),
  requestPushPermission: vi.fn(async () => 'granted' as const),
  getSubscriptionId: vi.fn(async () => 'sub-123'),
  sendPushToUser: vi.fn(async () => ({ ok: true, via: 'server' as const })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ ownerConfig: hoisted.ownerConfig }),
}));

vi.mock('./src/utils/pushNotifications', () => ({
  getPushPermission: hoisted.getPushPermission,
  requestPushPermission: hoisted.requestPushPermission,
  getSubscriptionId: hoisted.getSubscriptionId,
  sendPushToUser: hoisted.sendPushToUser,
}));

import {
  hasRootScopeServiceWorker,
  fetchPushConfig,
  permissionLabel,
  ensureRootServiceWorker,
} from './src/utils/pushSetup';
import { PushSetupModal } from './src/components/PushSetupModal';

/** Installs a fake service worker container on navigator for jsdom. */
function installServiceWorker(initial: Array<{ scope: string }>, afterRegister?: Array<{ scope: string }>) {
  const registrations = [...initial];
  const register = vi.fn(async () => {
    if (afterRegister) registrations.splice(0, registrations.length, ...afterRegister);
    return {} as ServiceWorkerRegistration;
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistrations: vi.fn(async () => registrations),
      register,
    },
  });
  return { register };
}

beforeEach(() => {
  // Reset call history/implementations in place — the module mock captured these
  // exact references, so reassigning them would detach the mock.
  hoisted.getPushPermission.mockReset().mockResolvedValue('default');
  hoisted.requestPushPermission.mockReset().mockResolvedValue('granted');
  hoisted.getSubscriptionId.mockReset().mockResolvedValue('sub-123');
  hoisted.sendPushToUser.mockReset().mockResolvedValue({ ok: true, via: 'server' });
  localStorage.setItem('stakeys_supabase_url', 'https://lhojocpygcnkxvkrcuxh.supabase.co');
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ appId: 'app', serverPush: true }), { status: 200 })) as unknown as typeof fetch;
  installServiceWorker([]);
});

describe('hasRootScopeServiceWorker', () => {
  it('detects a worker registered at the root scope', () => {
    expect(hasRootScopeServiceWorker([{ scope: 'https://example.com/' }])).toBe(true);
    expect(hasRootScopeServiceWorker([{ scope: '/' }])).toBe(true);
  });
  it('rejects non-root scopes and empty lists', () => {
    expect(hasRootScopeServiceWorker([{ scope: 'https://example.com/app/' }])).toBe(false);
    expect(hasRootScopeServiceWorker([])).toBe(false);
    expect(hasRootScopeServiceWorker(null)).toBe(false);
  });
});

describe('fetchPushConfig', () => {
  it('reads the server push flag from the backend', async () => {
    const cfg = await fetchPushConfig(async () => new Response(JSON.stringify({ appId: 'a', serverPush: true })));
    expect(cfg).toEqual({ appId: 'a', serverPush: true });
  });
  it('falls back to not-configured when the backend is unreachable', async () => {
    const cfg = await fetchPushConfig(async () => {
      throw new Error('network');
    });
    expect(cfg.serverPush).toBe(false);
  });
});

describe('permissionLabel', () => {
  it('describes each permission state', () => {
    expect(permissionLabel('granted')).toMatch(/Allowed/);
    expect(permissionLabel('denied')).toMatch(/Blocked/);
    expect(permissionLabel('not_configured')).toMatch(/app id/i);
  });
});

describe('ensureRootServiceWorker', () => {
  it('registers the shim at root scope when none exists', async () => {
    const { register } = installServiceWorker([], [{ scope: 'https://example.com/' }]);
    const ok = await ensureRootServiceWorker(navigator.serviceWorker);
    expect(ok).toBe(true);
    expect(register).toHaveBeenCalledWith('/service-worker.js', { scope: '/' });
  });
  it('does not register twice when a root worker already exists', async () => {
    const { register } = installServiceWorker([{ scope: 'https://example.com/' }]);
    const ok = await ensureRootServiceWorker(navigator.serviceWorker);
    expect(ok).toBe(true);
    expect(register).not.toHaveBeenCalled();
  });
});

describe('PushSetupModal', () => {
  /** Renders and waits until the initial live checks have all settled. */
  async function renderSettled() {
    render(<PushSetupModal onClose={() => {}} />);
    await waitFor(() => expect(screen.queryAllByText(/^Checking…$/).length).toBe(0));
  }

  it('renders every step with its own Check, Fix and Test buttons', async () => {
    await renderSettled();
    expect(screen.getByText(/Allow notifications on this device/i)).toBeTruthy();
    expect(screen.getByText(/Root service worker is registered/i)).toBeTruthy();
    expect(screen.getByText(/Server push key is configured/i)).toBeTruthy();
    // One Check and one Test per step; two "Fix" buttons plus the env-line copy.
    expect(screen.getAllByRole('button', { name: /^Check$/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Test$/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Fix$/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Copy env line/i })).toBeTruthy();
  });

  it('fixes only the step that was pressed (step 1 requests permission and subscribes)', async () => {
    await renderSettled();
    fireEvent.click(screen.getAllByRole('button', { name: /^Fix$/i })[0]);
    await waitFor(() => expect(hoisted.requestPushPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/subscribed \(id sub-123\)/i)).toBeTruthy());
  });

  it('tests the service worker step and reports success', async () => {
    installServiceWorker([{ scope: 'https://example.com/' }]);
    await renderSettled();
    fireEvent.click(screen.getAllByRole('button', { name: /^Test$/i })[1]);
    await waitFor(() => expect(screen.getByText(/Service worker test passed/i)).toBeTruthy());
  });

  it('sends a real push when the server-key step test is pressed', async () => {
    await renderSettled();
    fireEvent.click(screen.getAllByRole('button', { name: /^Test$/i })[2]);
    await waitFor(() => expect(hoisted.sendPushToUser).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Server push test passed/i)).toBeTruthy());
  });
});
