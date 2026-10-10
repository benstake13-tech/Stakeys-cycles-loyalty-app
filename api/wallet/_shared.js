/**
 * Shared Wallet-pass server helpers.
 *
 * Digital loyalty passes need server-signed artefacts: an Apple Wallet
 * `.pkpass` (signed with a Pass Type ID certificate) and a Google Wallet "Save
 * to Google Wallet" JWT (signed with a service-account key). Both signing
 * materials are server-only secrets and must never reach the client bundle.
 *
 * These helpers only report whether each provider is configured, and build the
 * Google save URL/JWT when it is. When a provider is unconfigured the client
 * simply hides its button — nothing is faked.
 */
import crypto from 'node:crypto';

/** Env var names carrying the Apple Pass Type ID signing material. */
export const APPLE_ENV_NAMES = {
  passTypeId: 'APPLE_PASS_TYPE_ID',
  teamId: 'APPLE_TEAM_ID',
  certP12: 'APPLE_PASS_CERT_P12',
  certPassword: 'APPLE_PASS_CERT_PASSWORD',
};

/** Env var names carrying the Google Wallet issuer material. */
export const GOOGLE_ENV_NAMES = {
  issuerId: 'GOOGLE_WALLET_ISSUER_ID',
  serviceAccountEmail: 'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
  privateKey: 'GOOGLE_WALLET_PRIVATE_KEY',
  classId: 'GOOGLE_WALLET_CLASS_ID',
};

function read(env, name) {
  const raw = env[name];
  return typeof raw === 'string' && raw.trim() ? raw.trim().replace(/^["']|["']$/g, '') : null;
}

/**
 * Reports, per provider, whether it is configured and the non-secret
 * identifiers needed to render a pass. Secrets are only checked for presence.
 */
export function resolveWalletConfig(env = process.env) {
  const applePassTypeId = read(env, APPLE_ENV_NAMES.passTypeId);
  const appleTeamId = read(env, APPLE_ENV_NAMES.teamId);
  const appleCert = read(env, APPLE_ENV_NAMES.certP12);
  const applePassword = read(env, APPLE_ENV_NAMES.certPassword);

  const googleIssuerId = read(env, GOOGLE_ENV_NAMES.issuerId);
  const googleEmail = read(env, GOOGLE_ENV_NAMES.serviceAccountEmail);
  const googleKey = read(env, GOOGLE_ENV_NAMES.privateKey);

  return {
    apple: {
      configured: Boolean(applePassTypeId && appleTeamId && appleCert && applePassword),
      passTypeId: applePassTypeId,
      teamId: appleTeamId,
    },
    google: {
      configured: Boolean(googleIssuerId && googleEmail && googleKey),
      issuerId: googleIssuerId,
      classId: read(env, GOOGLE_ENV_NAMES.classId),
    },
  };
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Signs a payload as a compact RS256 JWT using node:crypto (no extra deps). */
export function signJwtRS256(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem);
  return `${signingInput}.${base64Url(signature)}`;
}

/**
 * Builds a Google Wallet loyalty JWT for one member and returns the "Save to
 * Google Wallet" URL. Throws when the issuer is not configured.
 */
export function buildGoogleWalletSaveUrl(member, env = process.env) {
  const cfg = resolveWalletConfig(env);
  if (!cfg.google.configured) {
    throw new Error('Google Wallet is not configured');
  }
  const issuerId = cfg.google.issuerId;
  const classId = cfg.google.classId || `${issuerId}.stakeys_loyalty`;
  const objectId = `${issuerId}.${member.membershipNumber || 'member'}`;
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: read(env, GOOGLE_ENV_NAMES.serviceAccountEmail),
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    origins: [],
    payload: {
      loyaltyObjects: [
        {
          id: objectId,
          classId,
          state: 'ACTIVE',
          accountName: member.displayName || 'Stakeys Member',
          accountId: member.membershipNumber || '',
          loyaltyPoints: {
            label: 'Stamps',
            balance: { int: Number(member.stamps) || 0 },
          },
        },
      ],
    },
  };

  const jwt = signJwtRS256(payload, read(env, GOOGLE_ENV_NAMES.privateKey));
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
