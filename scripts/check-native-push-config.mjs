#!/usr/bin/env node
/** Refuse to package an Android app without its real Firebase client registration. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageIds = {
  staff: 'uk.co.stakeyscycles.staff',
  customer: 'uk.co.stakeyscycles.customer',
};

export function validateClientConfig(config, flavor) {
  const packageId = packageIds[flavor];
  if (!packageId) throw new Error(`Unknown Android flavor: ${flavor}`);
  const project = config?.project_info;
  if (!project?.project_id || !/^\d+$/.test(String(project.project_number || ''))) {
    throw new Error('Firebase project_info must include project_id and project_number');
  }
  const clients = Array.isArray(config.client) ? config.client : [];
  const client = clients.find(item => item?.client_info?.android_client_info?.package_name === packageId);
  if (!client) throw new Error(`Firebase config does not register ${packageId}`);
  if (!client.client_info.mobilesdk_app_id || !Array.isArray(client.api_key) || !client.api_key.some(key => key?.current_key)) {
    throw new Error(`Firebase registration for ${packageId} lacks mobilesdk_app_id or api_key`);
  }
  return { projectId: project.project_id, projectNumber: String(project.project_number) };
}

function readConfig(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { throw new Error(`Invalid Firebase client JSON at ${file}`); }
}

function decodeConfiguredClient(encoded, flavor) {
  const normalized = encoded.replace(/\s/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error(`Invalid base64 Firebase client config for ${flavor}`);
  }
  const raw = Buffer.from(normalized, 'base64');
  if (raw.toString('base64') !== normalized) throw new Error(`Invalid base64 Firebase client config for ${flavor}`);
  let config;
  try { config = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error(`Invalid Firebase client JSON for ${flavor}`); }
  validateClientConfig(config, flavor);
  return raw;
}

export function checkNativePushConfigs(root, flavors, environment = process.env) {
  const app = join(root, 'android', 'app');
  const shared = join(app, 'google-services.json');
  const configured = [];
  const pendingWrites = [];
  for (const flavor of flavors) {
    if (!packageIds[flavor]) throw new Error(`Unknown Android flavor: ${flavor}`);
    const file = join(app, 'src', flavor, 'google-services.json');
    const envName = `FIREBASE_${flavor.toUpperCase()}_GOOGLE_SERVICES_JSON_BASE64`;
    const encoded = environment[envName];
    const raw = encoded ? decodeConfiguredClient(encoded, flavor) : null;
    const source = raw ? file : existsSync(file) ? file : shared;
    if (!raw && !existsSync(source)) {
      throw new Error(`Missing Firebase config for ${flavor} (${packageIds[flavor]}). Add ${file} or set ${envName}. No push-capable APK was built.`);
    }
    const project = validateClientConfig(raw ? JSON.parse(raw.toString('utf8')) : readConfig(source), flavor);
    configured.push({ flavor, source, project });
    if (raw) pendingWrites.push({ file, raw });
  }
  if (configured.some(({ project }) => project.projectId !== configured[0].project.projectId || project.projectNumber !== configured[0].project.projectNumber)) {
    throw new Error('Staff and customer Firebase clients must belong to the same project for the shared OneSignal Android app');
  }
  for (const { file, raw } of pendingWrites) {
    mkdirSync(resolve(file, '..'), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    writeFileSync(temporary, raw, { mode: 0o600 });
    renameSync(temporary, file);
  }
  return configured;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const flavors = process.argv.slice(2);
    if (!flavors.length) throw new Error('Specify staff and/or customer');
    const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
    const configured = checkNativePushConfigs(root, flavors);
    for (const { flavor, project } of configured) {
      console.log(`Firebase client verified for ${flavor} (${packageIds[flavor]}, project ${project.projectId})`);
    }
  } catch (error) {
    console.error(`Native push build blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
