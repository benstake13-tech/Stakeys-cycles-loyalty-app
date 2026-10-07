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
    linkUser: vi.fn(async () => undefined),
    registerEmail: vi.fn(async () => undefined),
    sendTestPush: async () => ({ ok: true, via: 'server', envelope: { id: 'msg-1', recipients: 1 } }),
    ...overrides,
  };
}

const CTX = { userId: 'uid-12345678', displayName: 'Ben', membershipNumber: '124', ownerEmail: 'owner@x.co' };

describe('runPushRepair — diagnostics', () => {
  it('reports every step working on a healthy setup', async () => {
    const steps = await runPushRepair(makeDeps(), CTX);
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
      CTX
    );
    const dispatch = steps.find((s) => s.id === 'dispatch');
    expect(dispatch?.status).toBe('warn');
    expect(dispatch?.hint).toMatch(/phone|Allow/i);
  });

  it('fails on a hard OneSignal error', async () => {
    const steps = await runPushRepair(
      makeDeps({ sendTestPush: async () => ({ ok: false, via: 'server', envelope: { errors: ['Invalid app_id'] } }) }),
      CTX
    );
    expect(steps.find((s) => s.id === 'dispatch')?.status).toBe('fail');
  });

  it('skips the dispatch probe when server push is off', async () => {
    const sendTestPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const steps = await runPushRepair(makeDeps({ sendTestPush }, { serverPush: false }), CTX);
    expect(sendTestPush).not.toHaveBeenCalled();
    expect(steps.find((s) => s.id === 'dispatch')?.status).toBe('warn');
  });
});
