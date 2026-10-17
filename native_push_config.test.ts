import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkNativePushConfigs } from './scripts/check-native-push-config.mjs';

const roots: string[] = [];
const root = () => {
  const directory = mkdtempSync(join(tmpdir(), 'stakeys-fcm-'));
  roots.push(directory);
  return directory;
};
afterEach(() => { for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const client = (flavor: string, project = 'real-test-project') => ({
  project_info: { project_id: project, project_number: '123456789' },
  client: [{
    client_info: {
      mobilesdk_app_id: '1:123456789:android:example',
      android_client_info: { package_name: `uk.co.stakeyscycles.${flavor}` },
    },
    api_key: [{ current_key: 'test-only-key' }],
  }],
});
const encoded = (config: unknown) => Buffer.from(JSON.stringify(config)).toString('base64');

describe('native push build preflight', () => {
  it('blocks a build that would silently ship without Firebase client registration', () => {
    expect(() => checkNativePushConfigs(root(), ['staff', 'customer'], {})).toThrow(/Missing Firebase config for staff/);
  });

  it('rejects a client file registered for the wrong Android package', () => {
    const directory = root();
    const path = join(directory, 'android/app/src/staff');
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'google-services.json'), JSON.stringify(client('customer')));
    expect(() => checkNativePushConfigs(directory, ['staff'], {})).toThrow(/does not register uk.co.stakeyscycles.staff/);
  });

  it('rejects mismatched Firebase projects before writing either CI secret to disk', () => {
    const directory = root();
    expect(() => checkNativePushConfigs(directory, ['staff', 'customer'], {
      FIREBASE_STAFF_GOOGLE_SERVICES_JSON_BASE64: encoded(client('staff', 'project-a')),
      FIREBASE_CUSTOMER_GOOGLE_SERVICES_JSON_BASE64: encoded(client('customer', 'project-b')),
    })).toThrow(/same project/);
    expect(existsSync(join(directory, 'android/app/src/staff/google-services.json'))).toBe(false);
  });

  it('accepts both registered clients and writes ignored flavor configs for Gradle', () => {
    const directory = root();
    const configured = checkNativePushConfigs(directory, ['staff', 'customer'], {
      FIREBASE_STAFF_GOOGLE_SERVICES_JSON_BASE64: encoded(client('staff')),
      FIREBASE_CUSTOMER_GOOGLE_SERVICES_JSON_BASE64: encoded(client('customer')),
    });
    expect(configured.map(item => item.flavor)).toEqual(['staff', 'customer']);
    for (const flavor of ['staff', 'customer']) {
      const config = JSON.parse(readFileSync(join(directory, `android/app/src/${flavor}/google-services.json`), 'utf8'));
      expect(config.client[0].client_info.android_client_info.package_name).toBe(`uk.co.stakeyscycles.${flavor}`);
    }
  });
});
