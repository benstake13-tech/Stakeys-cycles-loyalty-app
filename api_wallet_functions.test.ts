import { describe, it, expect, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  resolveWalletConfig,
  signJwtRS256,
  buildGoogleWalletSaveUrl,
  APPLE_ENV_NAMES,
  GOOGLE_ENV_NAMES,
} from './api/wallet/_shared.js';
import configHandler from './api/wallet/config.js';
import googleHandler from './api/wallet/google.js';

/**
 * Wallet passes are gated on server-only signing material. These tests pin the
 * configuration detection and the Google "Save" JWT so an unconfigured
 * deployment never shows a dead button and a configured one produces a link.
 */

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

// A throwaway RSA key generated per test run — never a real secret.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const FULL_ENV = {
  [APPLE_ENV_NAMES.passTypeId]: 'pass.com.stakeys.loyalty',
  [APPLE_ENV_NAMES.teamId]: 'TEAM123',
  [APPLE_ENV_NAMES.certP12]: 'BASE64CERT',
  [APPLE_ENV_NAMES.certPassword]: 'secret',
  [GOOGLE_ENV_NAMES.issuerId]: '3388000000012345678',
  [GOOGLE_ENV_NAMES.serviceAccountEmail]: 'wallet@stakeys.iam.gserviceaccount.com',
  [GOOGLE_ENV_NAMES.privateKey]: privateKey as unknown as string,
  [GOOGLE_ENV_NAMES.classId]: '3388000000012345678.stakeys_loyalty',
};

afterEach(() => {
  delete process.env[GOOGLE_ENV_NAMES.privateKey];
  delete process.env[GOOGLE_ENV_NAMES.issuerId];
  delete process.env[GOOGLE_ENV_NAMES.serviceAccountEmail];
  delete process.env[APPLE_ENV_NAMES.passTypeId];
});

describe('resolveWalletConfig', () => {
  it('reports both providers unconfigured on a bare environment', () => {
    const cfg = resolveWalletConfig({});
    expect(cfg.apple.configured).toBe(false);
    expect(cfg.google.configured).toBe(false);
  });

  it('requires the full set of Apple signing material', () => {
    // Missing the cert password -> not configured.
    const cfg = resolveWalletConfig({
      [APPLE_ENV_NAMES.passTypeId]: 'pass.x',
      [APPLE_ENV_NAMES.teamId]: 'T',
      [APPLE_ENV_NAMES.certP12]: 'C',
    });
    expect(cfg.apple.configured).toBe(false);
  });

  it('reports both providers configured when everything is present', () => {
    const cfg = resolveWalletConfig(FULL_ENV);
    expect(cfg.apple.configured).toBe(true);
    expect(cfg.google.configured).toBe(true);
    expect(cfg.google.issuerId).toBe('3388000000012345678');
  });

  it('never returns a secret value', () => {
    const cfg = resolveWalletConfig(FULL_ENV) as any;
    expect(JSON.stringify(cfg)).not.toContain('BASE64CERT');
    expect(JSON.stringify(cfg)).not.toContain('BEGIN PRIVATE KEY');
  });
});

describe('signJwtRS256', () => {
  it('produces a three-part compact JWT', () => {
    const jwt = signJwtRS256({ a: 1 }, privateKey as unknown as string);
    expect(jwt.split('.')).toHaveLength(3);
  });
});

describe('buildGoogleWalletSaveUrl', () => {
  it('throws when Google Wallet is not configured', () => {
    expect(() => buildGoogleWalletSaveUrl({ membershipNumber: 'STK-1' }, {})).toThrow(/not configured/i);
  });

  it('builds a pay.google.com save link carrying the member', () => {
    const url = buildGoogleWalletSaveUrl(
      { membershipNumber: 'STK-123456', displayName: 'Ada Rider', stamps: 7 },
      FULL_ENV
    );
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    // Decode the JWT body and check the loyalty object.
    const jwt = url.split('/save/')[1];
    const body = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    expect(body.typ).toBe('savetowallet');
    expect(body.payload.loyaltyObjects[0].accountId).toBe('STK-123456');
    expect(body.payload.loyaltyObjects[0].loyaltyPoints.balance.int).toBe(7);
  });
});

describe('wallet config handler', () => {
  it('returns configuration booleans without secrets', () => {
    const res = mockRes();
    configHandler({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      apple: { configured: false, passTypeId: null },
      google: { configured: false, issuerId: null },
    });
  });
});

describe('google wallet handler', () => {
  it('responds 503 when not configured', () => {
    const res = mockRes();
    googleHandler({ body: { member: {} } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('returns a save URL when configured', () => {
    process.env[GOOGLE_ENV_NAMES.issuerId] = FULL_ENV[GOOGLE_ENV_NAMES.issuerId];
    process.env[GOOGLE_ENV_NAMES.serviceAccountEmail] = FULL_ENV[GOOGLE_ENV_NAMES.serviceAccountEmail];
    process.env[GOOGLE_ENV_NAMES.privateKey] = privateKey as unknown as string;
    const res = mockRes();
    googleHandler({ body: { member: { membershipNumber: 'STK-9', displayName: 'Ada', stamps: 1 } } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain('pay.google.com/gp/v/save/');
  });
});
