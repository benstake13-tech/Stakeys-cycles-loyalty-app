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
import JSZip from 'jszip';
import forge from 'node-forge';

/** Env var names carrying the Apple Pass Type ID signing material. */
export const APPLE_ENV_NAMES = {
  passTypeId: 'APPLE_PASS_TYPE_ID',
  teamId: 'APPLE_TEAM_ID',
  certP12: 'APPLE_PASS_CERT_P12',
  certPassword: 'APPLE_PASS_CERT_PASSWORD',
  /** Optional PEM bundle of the Apple WWDR intermediate certificate(s). */
  wwdr: 'APPLE_WWDR_CERT_PEM',
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

/* -------------------------------------------------------------------------- *
 * Apple Wallet `.pkpass`
 *
 * A pass is a zip of pass.json + images + manifest.json, with a detached
 * PKCS#7 (CMS) signature over the manifest. The Pass Type ID certificate and
 * its private key live in a password-protected `.p12` supplied as a base64
 * env var; we unzip it with node-forge and sign the manifest. Everything here
 * is server-only — the certificate never reaches the browser.
 * -------------------------------------------------------------------------- */

function passBackground(hex) {
  // #RRGGBB → Apple's "rgb(r, g, b)" field colour string.
  const clean = String(hex).replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Unzips the base64 `.p12` into a forge certificate + private key. */
export function loadAppleSigningIdentity(env = process.env) {
  const p12Base64 = read(env, APPLE_ENV_NAMES.certP12);
  const password = read(env, APPLE_ENV_NAMES.certPassword) || '';
  if (!p12Base64) throw new Error('Apple Wallet certificate is not configured');

  const der = forge.util.decode64(p12Base64.replace(/\s+/g, ''));
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const cert = certBags[0]?.cert;
  const key = keyBags[0]?.key;
  if (!cert || !key) throw new Error('Apple Wallet certificate is missing its key');

  return { cert, key, certificatePem: forge.pki.certificateToPem(cert), privateKeyPem: forge.pki.privateKeyToPem(key) };
}

/**
 * Builds a signed Apple Wallet loyalty `.pkpass` for one member. Returns a
 * Buffer of the zip. Throws when Apple Wallet is not configured.
 */
export async function buildApplePass(member, env = process.env) {
  const cfg = resolveWalletConfig(env);
  if (!cfg.apple.configured) throw new Error('Apple Wallet is not configured');

  const { cert, key } = loadAppleSigningIdentity(env);
  const { passTypeId, teamId } = cfg.apple;

  const bg = passBackground('#0b0e13');
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    serialNumber: String(member.membershipNumber || member.serialNumber || Date.now()),
    organizationName: 'Stakey’s Cycles & Scooter',
    description: 'Stakey’s Cycles loyalty & service card',
    logoText: 'Stakey’s Cycles',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: bg,
    labelColor: 'rgb(5, 193, 71)',
    storeCard: {
      primaryFields: [
        { key: 'member', label: 'MEMBER', value: member.displayName || 'Stakeys Member' },
      ],
      secondaryFields: [
        { key: 'stamps', label: 'STAMPS', value: String(Number(member.stamps) || 0) },
        { key: 'points', label: 'POINTS', value: String(Number(member.points) || 0) },
      ],
      auxiliaryFields: [
        { key: 'membership', label: 'MEMBERSHIP', value: String(member.membershipNumber || '') },
      ],
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: String(member.membershipNumber || 'member'),
        messageEncoding: 'iso-8859-1',
        altText: String(member.membershipNumber || ''),
      },
    ],
  };

  const { images } = member;
  const zip = new JSZip();
  zip.file('pass.json', JSON.stringify(passJson));
  zip.file('icon.png', images?.icon || A_1X1_PNG_BUFFER, { binary: true });
  zip.file('icon@2x.png', images?.icon2x || images?.icon || A_1X1_PNG_BUFFER, { binary: true });
  zip.file('logo.png', images?.logo || A_1X1_PNG_BUFFER, { binary: true });
  zip.file('logo@2x.png', images?.logo2x || images?.logo || A_1X1_PNG_BUFFER, { binary: true });

  // manifest.json = SHA-1 of every other file in the bundle.
  const allFiles = zip.files;
  const manifest = {};
  for (const name of Object.keys(allFiles)) {
    if (name === 'manifest.json' || allFiles[name].dir) continue;
    const bytes = await allFiles[name].async('uint8array');
    manifest[name] = crypto.createHash('sha1').update(bytes).digest('hex');
  }
  zip.file('manifest.json', JSON.stringify(manifest));

  // Detached PKCS#7 signature over manifest.json, with the WWDR chain included.
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(JSON.stringify(manifest), 'utf8');
  p7.addCertificate(cert);
  const wwdr = read(env, APPLE_ENV_NAMES.wwdr);
  if (wwdr) {
    for (const pem of String(wwdr).split(/\n(?=-----BEGIN)/)) {
      if (/-----BEGIN CERTIFICATE-----/.test(pem)) p7.addCertificate(forge.pki.certificateFromPem(pem));
    }
  }
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toString() },
    ],
  });
  p7.sign({ detached: true });
  const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  zip.file('signature', Buffer.from(signatureDer, 'binary'), { binary: true });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** A valid 1×1 transparent PNG, used when no artwork is supplied. */
const A_1X1_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
