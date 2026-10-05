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

vi.mock('./src/shared/context/ShopContext', () => ({
  useShop: () => ({ ownerConfig: hoisted.ownerConfig }),
}));

vi.mock('./src/shared/utils/pushNotifications', () => ({
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
  checkPushOrigin,
  normalizeOrigin,
  supabaseSecretsBlock,
  isLegacyPushWorker,
  unregisterLegacyPushWorkers,
} from './src/shared/utils/pushSetup';
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
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
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
  it('reads the server push flag and web config from the backend', async () => {
    const cfg = await fetchPushConfig(
      async () =>
        new Response(
          JSON.stringify({ appId: 'a', serverPush: true, webConfig: { chromeWebOrigin: 'https://www.example.com' } })
        )
    );
    expect(cfg.appId).toBe('a');
    expect(cfg.serverPush).toBe(true);
    expect(cfg.webConfig).toEqual({ chromeWebOrigin: 'https://www.example.com' });
  });
  it('falls back to not-configured when the backend is unreachable', async () => {
    const cfg = await fetchPushConfig(async () => {
      throw new Error('network');
    });
    expect(cfg.serverPush).toBe(false);
    expect(cfg.webConfig).toBeNull();
  });
});

describe('checkPushOrigin', () => {
  it('passes when the configured origin matches the site', () => {
    const res = checkPushOrigin('https://www.stakeyswheels.co.uk', {
      chromeWebOrigin: 'https://www.stakeyswheels.co.uk',
    });
    expect(res.status).toBe('ok');
  });

  it('flags the apex-vs-www mismatch that blocks the SDK from starting', () => {
    const res = checkPushOrigin('https://www.stakeyswheels.co.uk', {
      chromeWebOrigin: 'https://stakeyswheels.co.uk',
      restrictOrigin: true,
    });
    expect(res.status).toBe('mismatch');
    expect(res.configuredOrigin).toBe('https://stakeyswheels.co.uk');
  });

  it('treats a mismatch as fine when origin restriction is off', () => {
    const res = checkPushOrigin('https://www.stakeyswheels.co.uk', {
      chromeWebOrigin: 'https://stakeyswheels.co.uk',
      restrictOrigin: false,
    });
    expect(res.status).toBe('ok');
  });

  it('reports unknown when the web config could not be read', () => {
    expect(checkPushOrigin('https://www.stakeyswheels.co.uk', null).status).toBe('unknown');
  });

  it('normalises trailing slashes and default ports', () => {
    expect(normalizeOrigin('https://www.example.com/')).toBe('https://www.example.com');
    expect(normalizeOrigin('https://www.example.com:443')).toBe('https://www.example.com');
    expect(checkPushOrigin('https://www.example.com', { chromeWebOrigin: 'https://www.example.com/' }).status).toBe('ok');
  });
});

describe('permissionLabel', () => {
  it('describes each permission state', () => {
    expect(permissionLabel('granted')).toMatch(/Allowed/);
    expect(permissionLabel('denied')).toMatch(/Blocked/);
    expect(permissionLabel('not_configured')).toMatch(/app id/i);
  });
});

describe('supabaseSecretsBlock', () => {
  it('emits the app id and a placeholder API key when server push is unset', () => {
    const block = supabaseSecretsBlock({ projectRef: 'ref123', appId: 'app-1', serverPush: false });
    expect(block).toContain('ONESIGNAL_APP_ID=app-1');
    expect(block).toContain('ONESIGNAL_API_KEY=os_v2_app_your-app-api-key');
    expect(block).toContain('BOOKING_WEBHOOK_SECRET=');
    expect(block).toContain('dashboard/project/ref123/settings/functions');
  });

  it('notes that the key is already set and falls back for missing values', () => {
    const block = supabaseSecretsBlock({ projectRef: '', appId: null, serverPush: true });
    expect(block).toContain('# ONESIGNAL_API_KEY is already set on the server.');
    expect(block).toContain('ONESIGNAL_APP_ID=<your-onesignal-app-id>');
    expect(block).toContain('<project-ref>');
  });
});

describe('ensureRootServiceWorker', () => {
  it('registers the shim at root scope when none exists', async () => {
    const { register } = installServiceWorker([], [{ scope: 'https://example.com/' }]);
    const ok = await ensureRootServiceWorker(navigator.serviceWorker);
    expect(ok).toBe(true);
    expect(register).toHaveBeenCalledWith('/OneSignalSDKWorker.js', { scope: '/' });
  });
  it('does not register twice when a root worker already exists', async () => {
    const { register } = installServiceWorker([{ scope: 'https://example.com/' }]);
    const ok = await ensureRootServiceWorker(navigator.serviceWorker);
    expect(ok).toBe(true);
    expect(register).not.toHaveBeenCalled();
  });
});

describe('isLegacyPushWorker', () => {
  it('matches the PushEngage worker and not the OneSignal shim', () => {
    expect(isLegacyPushWorker('https://x/service-worker.js?v=3.0.78&appId=abc')).toBe(true);
    expect(isLegacyPushWorker('/service-worker.js')).toBe(true);
    expect(isLegacyPushWorker('https://x/OneSignalSDKWorker.js')).toBe(false);
    expect(isLegacyPushWorker('https://x/service-worker.js/OneSignalSDKWorker')).toBe(false);
    expect(isLegacyPushWorker(null)).toBe(false);
  });
});

describe('unregisterLegacyPushWorkers', () => {
  /** Installs a fake SW container whose registrations carry scriptURL + unregister. */
  function installWithScripts(entries: Array<{ scriptURL: string }>) {
    const unregister = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn(async () =>
          entries.map((e) => ({ active: { scriptURL: e.scriptURL }, unregister }))
        ),
        register: vi.fn(async () => ({}) as ServiceWorkerRegistration),
      },
    });
    return { unregister };
  }

  it('unregisters a leftover PushEngage worker', async () => {
    const { unregister } = installWithScripts([
      { scriptURL: 'https://x/service-worker.js?v=3.0.78&appId=23a65358' },
    ]);
    expect(await unregisterLegacyPushWorkers(navigator.serviceWorker)).toBe(1);
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('leaves the OneSignal worker alone', async () => {
    const { unregister } = installWithScripts([{ scriptURL: 'https://x/OneSignalSDKWorker.js' }]);
    expect(await unregisterLegacyPushWorkers(navigator.serviceWorker)).toBe(0);
    expect(unregister).not.toHaveBeenCalled();
  });

  it('ensureRootServiceWorker clears the legacy worker then registers OneSignal', async () => {
    let regs: Array<{ scope: string; active: { scriptURL: string }; unregister: any }> = [];
    const unregister = vi.fn(async () => {
      regs = [];
      return true;
    });
    regs = [
      { scope: 'https://x/', active: { scriptURL: 'https://x/service-worker.js?v=3' }, unregister },
    ];
    const register = vi.fn(async () => {
      regs = [{ scope: 'https://x/', active: { scriptURL: 'https://x/OneSignalSDKWorker.js' }, unregister }];
      return {} as ServiceWorkerRegistration;
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn(async () => regs),
        register,
      },
    });
    const ok = await ensureRootServiceWorker(navigator.serviceWorker);
    expect(ok).toBe(true);
    expect(unregister).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith('/OneSignalSDKWorker.js', { scope: '/' });
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
    expect(screen.getByText(/OneSignal origin matches this site/i)).toBeTruthy();
    expect(screen.getByText(/Server push key is configured/i)).toBeTruthy();
    // One Check and one Test per step; three Fix buttons plus the env-line copy.
    expect(screen.getAllByRole('button', { name: /^Check$/i })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /^Test$/i })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /^Fix$/i })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Copy env line/i })).toBeTruthy();
  });

  it('reports the OneSignal origin as unknown when the app config is unreadable', async () => {
    await renderSettled();
    expect(screen.getByText(/web origin could not be read/i)).toBeTruthy();
  });

  it('detects an origin mismatch and links to the OneSignal dashboard', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            appId: 'app',
            serverPush: true,
            webConfig: { chromeWebOrigin: 'https://stakeyswheels.co.uk', restrictOrigin: true },
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;
    await renderSettled();
    await waitFor(() => expect(screen.getByText(/OneSignal is locked to https:\/\/stakeyswheels\.co\.uk/i)).toBeTruthy());
    expect(screen.getByRole('link', { name: /Open OneSignal dashboard/i })).toBeTruthy();
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
    fireEvent.click(screen.getAllByRole('button', { name: /^Test$/i })[3]);
    await waitFor(() => expect(hoisted.sendPushToUser).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Server push test passed/i)).toBeTruthy());
  });

  it('copies a paste-ready Supabase secrets block from the server-key step', async () => {
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /Copy keys for Supabase/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(copied).toContain('ONESIGNAL_APP_ID=app');
    expect(copied).toContain('ONESIGNAL_API_KEY');
    expect(copied).toContain('lhojocpygcnkxvkrcuxh');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Copied$/i })).toBeTruthy());
  });
});
