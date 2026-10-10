import { describe, it, expect, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import forge from 'node-forge';
import JSZip from 'jszip';
import {
  resolveWalletConfig,
  signJwtRS256,
  buildGoogleWalletSaveUrl,
  buildApplePass,
  loadAppleSigningIdentity,
  APPLE_ENV_NAMES,
  GOOGLE_ENV_NAMES,
} from './api/wallet/_shared.js';
import configHandler from './api/wallet/config.js';
import googleHandler from './api/wallet/google.js';
import appleHandler from './api/wallet/apple.js';

/**
 * Wallet passes are gated on server-only signing material. These tests pin the
 * configuration detection and the Google "Save" JWT so an unconfigured
 * deployment never shows a dead button and a configured one produces a link.
 */

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(payload: any) {
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

/* -------------------------------------------------------------------------- *
 * Apple Wallet `.pkpass`
 *
 * A throwaway Pass Type ID identity is generated in-process with node-forge
 * (never a real secret) so the tests exercise the real p12 unzip, manifest
 * hashing and CMS signing without any external certificate.
 * -------------------------------------------------------------------------- */

function makeAppleEnv() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 31536000000);
  const attrs = [{ name: 'commonName', value: 'Pass Type ID: pass.com.stakeys.loyalty' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'testpass');
  const p12Base64 = forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes());

  return {
    [APPLE_ENV_NAMES.passTypeId]: 'pass.com.stakeys.loyalty',
    [APPLE_ENV_NAMES.teamId]: 'TEAM123',
    [APPLE_ENV_NAMES.certP12]: p12Base64,
    [APPLE_ENV_NAMES.certPassword]: 'testpass',
  };
}

describe('buildApplePass', () => {
  const env = makeAppleEnv();

  it('throws when Apple Wallet is not configured', async () => {
    await expect(buildApplePass({ membershipNumber: 'STK-1' }, {})).rejects.toThrow(/not configured/i);
  });

  it('loads the signing identity out of the p12', () => {
    const id = loadAppleSigningIdentity(env);
    expect(id.certificatePem).toContain('BEGIN CERTIFICATE');
    expect(id.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
  });

  it('builds a valid .pkpass bundle whose manifest hashes match', async () => {
    const buf = await buildApplePass(
      { membershipNumber: 'SC-000123', displayName: 'Ben Stakey', stamps: 7, points: 250 },
      env
    );
    expect(Buffer.isBuffer(buf)).toBe(true);

    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names).toContain('pass.json');
    expect(names).toContain('manifest.json');
    expect(names).toContain('signature');

    const passJson = JSON.parse(await zip.file('pass.json')!.async('string'));
    expect(passJson.passTypeIdentifier).toBe('pass.com.stakeys.loyalty');
    expect(passJson.teamIdentifier).toBe('TEAM123');
    expect(passJson.serialNumber).toBe('SC-000123');
    expect(passJson.storeCard.secondaryFields[0].value).toBe('7');

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const crypto = await import('node:crypto');
    for (const [name, hash] of Object.entries(manifest)) {
      const bytes = await zip.file(name)!.async('uint8array');
      const got = crypto.createHash('sha1').update(bytes).digest('hex');
      expect(got).toBe(hash);
    }

    // The detached CMS signature must verify against the manifest bytes.
    // node-forge cannot verify PKCS#7, so shell out to OpenSSL (present on CI).
    const signature = await zip.file('signature')!.async('nodebuffer');
    const manifestBytes = await zip.file('manifest.json')!.async('nodebuffer');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkpass-'));
    try {
      const sigPath = path.join(dir, 'signature.der');
      const manifestPath = path.join(dir, 'manifest.json');
      fs.writeFileSync(sigPath, signature);
      fs.writeFileSync(manifestPath, manifestBytes);
      const proc = spawnSync(
        'openssl',
        ['smime', '-verify', '-inform', 'DER', '-in', sigPath, '-content', manifestPath, '-noverify'],
        { encoding: 'utf8' }
      );
      expect(`${proc.stdout}${proc.stderr}`).toContain('Verification successful');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('apple wallet handler', () => {
  const env = makeAppleEnv();

  it('responds 503 when not configured', async () => {
    const res = mockRes();
    await appleHandler({ method: 'GET', query: { membership: 'STK-1' } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('responds 400 when the membership number is missing', async () => {
    Object.assign(process.env, env);
    const res = mockRes();
    await appleHandler({ method: 'GET', query: {} } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns a signed pkpass when configured', async () => {
    Object.assign(process.env, env);
    const res = mockRes();
    await appleHandler(
      { method: 'GET', query: { membership: 'SC-777', name: 'Ada Rider', stamps: '3' } } as any,
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/vnd.apple.pkpass');
    const zip = await JSZip.loadAsync(res.body);
    const passJson = JSON.parse(await zip.file('pass.json')!.async('string'));
    expect(passJson.serialNumber).toBe('SC-777');
    expect(passJson.logoText).toContain('Stakey');
  });
});
