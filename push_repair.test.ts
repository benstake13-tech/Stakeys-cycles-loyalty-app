import { describe, it, expect, vi } from 'vitest';
import { runPushRepair, PushRepairDeps, PushRepairServerConfig } from './src/utils/pushRepair';

function makeDeps(overrides: Partial<PushRepairDeps> = {}, cfg?: Partial<PushRepairServerConfig>): PushRepairDeps {
  return {
    getServerConfig: async () => ({
      appId: 'app-123',
      serverPush: true,
      restKeyEnv: 'ONESIGNAL_REST_API_KEY',
      ...cfg,
    }),
    initSdk: async () => true,
    getPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    getSubscriptionId: async () => 'sub-abcdef123456',
    isSubscribed: async () => true,
    optInSubscription: async () => 'sub-abcdef123456',
    getConfiguredAppId: () => 'app-123',
    linkUser: vi.fn(async () => undefined),
    registerEmail: vi.fn(async () => undefined),
    sendTestPush: async () => ({ ok: true, via: 'server', envelope: { id: 'msg-1', recipients: 1 } }),
    ...overrides,
  };
}

const CTX = { userId: 'uid-12345678', displayName: 'Ben', membershipNumber: '124', ownerEmail: 'owner@x.co' };

describe('runPushRepair — diagnostics', () => {
  it('reports every step working on a healthy setup', async () => {
    const steps = await runPushRepair(makeDeps(), CTX, { repair: true });
    expect(steps.find((s) => s.id === 'server-config')?.status).toBe('pass');
    expect(steps.find((s) => s.id === 'sdk-loaded')?.status).toBe('pass');
    expect(steps.find((s) => s.id === 'permission')?.status).toBe('pass');
    expect(steps.find((s) => s.id === 'subscription')?.status).toBe('pass');
    expect(steps.find((s) => s.id === 'dispatch')?.status).toBe('pass');
    expect(steps.some((s) => s.status === 'fail')).toBe(false);
  });

  it('flags a missing REST key with the env names to set', async () => {
    const steps = await runPushRepair(makeDeps({}, { serverPush: false, restKeyEnv: null }), CTX);
    const cfg = steps.find((s) => s.id === 'server-config');
    expect(cfg?.status).toBe('fail');
    expect(cfg?.hint).toContain('ONESIGNAL_REST_API_KEY');
  });

  it('flags an unresolved app id', async () => {
    const steps = await runPushRepair(makeDeps({}, { appId: null }), CTX);
    expect(steps.find((s) => s.id === 'server-config')?.status).toBe('fail');
  });

  it('treats a denied permission as a failure with repair advice', async () => {
    const steps = await runPushRepair(makeDeps({ getPermission: async () => 'denied' }), CTX);
    const perm = steps.find((s) => s.id === 'permission');
    expect(perm?.status).toBe('fail');
    expect(perm?.detail).toMatch(/blocked/i);
  });

  it('warns rather than fails when permission is merely unrequested', async () => {
    const steps = await runPushRepair(makeDeps({ getPermission: async () => 'default' }), CTX);
    expect(steps.find((s) => s.id === 'permission')?.status).toBe('warn');
  });
});

describe('runPushRepair — device opt-in & app id', () => {
  it('opts a permission-granted but unsubscribed device back in', async () => {
    let subscribed = false;
    const optInSubscription = vi.fn(async () => {
      subscribed = true;
      return 'sub-xyz';
    });
    const deps = makeDeps({
      isSubscribed: async () => subscribed,
      optInSubscription,
    });
    const steps = await runPushRepair(deps, CTX, { repair: true });
    expect(optInSubscription).toHaveBeenCalledOnce();
    const sub = steps.find((s) => s.id === 'subscription');
    expect(sub?.status).toBe('fixed');
    expect(sub?.detail).toMatch(/opted in/i);
  });

  it('waits for a device token that appears just after opting in', async () => {
    let subId: string | null = null;
    const deps = makeDeps({
      getSubscriptionId: async () => subId,
      isSubscribed: async () => (subId ? true : null),
      optInSubscription: async () => {
        subId = 'sub-late-123456';
        return subId;
      },
    });
    const steps = await runPushRepair(deps, CTX, { repair: true });
    const sub = steps.find((s) => s.id === 'subscription');
    expect(sub?.status).toBe('fixed');
    expect(sub?.detail).toContain('sub-late');
  });

  it('warns about an unsubscribed device in check-only mode and does not opt in', async () => {
    const optInSubscription = vi.fn(async () => 'sub-xyz');
    const steps = await runPushRepair(makeDeps({ isSubscribed: async () => false, optInSubscription }), CTX, {
      repair: false,
    });
    expect(optInSubscription).not.toHaveBeenCalled();
    expect(steps.find((s) => s.id === 'subscription')?.status).toBe('warn');
  });

  it('does not opt in when permission is not granted', async () => {
    const optInSubscription = vi.fn(async () => 'sub-xyz');
    const steps = await runPushRepair(
      makeDeps({ isSubscribed: async () => false, optInSubscription, getPermission: async () => 'denied' }),
      CTX,
      { repair: true }
    );
    expect(optInSubscription).not.toHaveBeenCalled();
    expect(steps.find((s) => s.id === 'subscription')?.status).toBe('warn');
  });

  it('reports the configured App ID in the SDK step', async () => {
    const steps = await runPushRepair(makeDeps({ getConfiguredAppId: () => 'abcd1234-efgh' }), CTX);
    expect(steps.find((s) => s.id === 'sdk-loaded')?.detail).toContain('abcd1234');
  });
});

describe('runPushRepair — repairs', () => {
  it('requests permission when repairing and it was pending', async () => {
    let perm = 'default';
    const requestPermission = vi.fn(async () => {
      perm = 'granted';
      return 'granted' as const;
    });
    const deps = makeDeps({
      getPermission: async () => perm as any,
      requestPermission,
    });
    const steps = await runPushRepair(deps, CTX, { repair: true });
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(steps.find((s) => s.id === 'permission')?.status).toBe('pass');
  });

  it('links the user and registers the owner email as fixed steps', async () => {
    const linkUser = vi.fn(async () => undefined);
    const registerEmail = vi.fn(async () => undefined);
    const steps = await runPushRepair(makeDeps({ linkUser, registerEmail }), CTX, { repair: true });
    expect(linkUser).toHaveBeenCalledWith('uid-12345678', expect.objectContaining({ membership: '124' }));
    expect(registerEmail).toHaveBeenCalledWith('owner@x.co');
    expect(steps.find((s) => s.id === 'identity')?.status).toBe('fixed');
    expect(steps.find((s) => s.id === 'email')?.status).toBe('fixed');
  });

  it('does not mutate anything in check-only mode', async () => {
    const linkUser = vi.fn(async () => undefined);
    const registerEmail = vi.fn(async () => undefined);
    const requestPermission = vi.fn(async () => 'granted' as const);
    await runPushRepair(
      makeDeps({ linkUser, registerEmail, requestPermission, getPermission: async () => 'default' }),
      CTX,
      { repair: false }
    );
    expect(linkUser).not.toHaveBeenCalled();
    expect(registerEmail).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('runPushRepair — dispatch probe', () => {
  it('warns when OneSignal says nothing is subscribed', async () => {
    const steps = await runPushRepair(
      makeDeps({
        sendTestPush: async () => ({ ok: false, via: 'server', envelope: { id: '', errors: ['All included players are not subscribed'] } }),
      }),
      CTX,
      { repair: true }
    );
    const dispatch = steps.find((s) => s.id === 'dispatch');
    expect(dispatch?.status).toBe('warn');
    expect(dispatch?.hint).toMatch(/phone|Allow/i);
  });

  it('fails on a hard OneSignal error', async () => {
    const steps = await runPushRepair(
      makeDeps({ sendTestPush: async () => ({ ok: false, via: 'server', envelope: { errors: ['Invalid app_id'] } }) }),
      CTX,
      { repair: true }
    );
    expect(steps.find((s) => s.id === 'dispatch')?.status).toBe('fail');
  });

  it('never sends a test push during a read-only check', async () => {
    const sendTestPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const steps = await runPushRepair(makeDeps({ sendTestPush }), CTX, { repair: false });
    expect(sendTestPush).not.toHaveBeenCalled();
    const dispatch = steps.find((s) => s.id === 'dispatch');
    expect(dispatch?.status).toBe('warn');
    expect(dispatch?.detail).toMatch(/check/i);
  });

  it('skips the dispatch probe when server push is off', async () => {
    const sendTestPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const steps = await runPushRepair(makeDeps({ sendTestPush }, { serverPush: false }), CTX, { repair: true });
    expect(sendTestPush).not.toHaveBeenCalled();
    expect(steps.find((s) => s.id === 'dispatch')?.status).toBe('warn');
  });
});

describe('runPushRepair — per-step repair isolation', () => {
  it('repairs only the requested step and leaves the others untouched', async () => {
    const optInSubscription = vi.fn(async () => 'sub-xyz');
    const linkUser = vi.fn(async () => undefined);
    const registerEmail = vi.fn(async () => undefined);
    const requestPermission = vi.fn(async () => 'granted' as const);
    const deps = makeDeps({
      getPermission: async () => 'default',
      requestPermission,
      isSubscribed: async () => false,
      optInSubscription,
      linkUser,
      registerEmail,
    });
    const steps = await runPushRepair(deps, CTX, { repair: true, only: 'permission' });
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(optInSubscription).not.toHaveBeenCalled();
    expect(linkUser).not.toHaveBeenCalled();
    expect(registerEmail).not.toHaveBeenCalled();
    expect(steps).toHaveLength(7);
  });

  it('opts the device in when only the subscription step is targeted', async () => {
    let subscribed = false;
    const optInSubscription = vi.fn(async () => {
      subscribed = true;
      return 'sub-xyz';
    });
    const linkUser = vi.fn(async () => undefined);
    const deps = makeDeps({
      isSubscribed: async () => subscribed,
      optInSubscription,
      linkUser,
    });
    const steps = await runPushRepair(deps, CTX, { repair: true, only: 'subscription' });
    expect(optInSubscription).toHaveBeenCalledOnce();
    expect(linkUser).not.toHaveBeenCalled();
    expect(steps.find((s) => s.id === 'subscription')?.status).toBe('fixed');
  });

  it('exposes raw probe facts for every step', async () => {
    const steps = await runPushRepair(makeDeps(), CTX);
    for (const step of steps) {
      expect(Array.isArray(step.facts)).toBe(true);
      expect(step.facts!.length).toBeGreaterThan(0);
    }
    const sub = steps.find((s) => s.id === 'subscription');
    expect(sub?.facts?.find((f) => f.label === 'Opted in')?.ok).toBe(true);
  });
});
