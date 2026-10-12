/**
 * Firmware service for the BLE diagnostic bench: read versions, compare to the
 * stock catalogue, take a mandatory backup, and download a firmware file to the
 * user's device for flashing in the vendor tool.
 *
 * Nothing here writes to a controller's flash memory. The bench's job is to
 * (1) back up what is on the machine, (2) say what stock should be, and
 * (3) hand the tech the file to flash with the vendor's own tool. That split is
 * deliberate: an interrupted over-the-air flash bricks the controller, and the
 * stock images are not ours to redistribute.
 *
 * Every external effect (network fetch, file save, hashing) is injected so the
 * whole flow can be tested without a radio, a network or a real download.
 */
import { bytesToHex, type FirmwareTarget, type ScooterTelemetry, type VersionReading } from '../utils/scooterProtocols';
import {
  compareFirmware,
  compareVersions,
  findFirmwareEntry,
  type FirmwareCatalogEntry,
  type FirmwareComparison,
} from '../data/firmwareCatalog';

export type { FirmwareTarget, VersionReading };
export { compareFirmware, compareVersions, findFirmwareEntry };
export type { FirmwareCatalogEntry, FirmwareComparison } from '../data/firmwareCatalog';

/** Copy a typed array into a standalone ArrayBuffer (keeps lib.dom happy). */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export interface FirmwareBackup {
  schema: 'stakeys.scooter.backup.v1';
  capturedAt: string;
  deviceName: string;
  protocolFamily: string;
  /** Catalogue entry the device was matched to, when one was found. */
  catalogueId: string | null;
  model: string;
  versions: VersionReading[];
  telemetry: Partial<ScooterTelemetry>;
}

export interface BackupArtifact {
  backup: FirmwareBackup;
  /** Pretty-printed JSON that is written to the device. */
  json: string;
  sha256: string;
  filename: string;
}

export interface BackupInput {
  deviceName: string;
  protocolFamily: string;
  model: string;
  versions: VersionReading[];
  telemetry: Partial<ScooterTelemetry>;
  catalogueId?: string | null;
  now?: string;
}

/** A backup filename that sorts by date and names the device. */
export function backupFilename(deviceName: string, capturedAt: string): string {
  const safe = (deviceName || 'scooter').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'scooter';
  const stamp = capturedAt.replace(/[:.]/g, '-');
  return `stakeys-backup-${safe}-${stamp}.json`;
}

/**
 * Build the JSON backup payload and hash it. Pure apart from the injected
 * hasher, so it can be asserted byte-for-byte.
 */
export async function buildBackup(
  input: BackupInput,
  hash: (data: string) => Promise<string>
): Promise<BackupArtifact> {
  const capturedAt = input.now ?? new Date().toISOString();
  const backup: FirmwareBackup = {
    schema: 'stakeys.scooter.backup.v1',
    capturedAt,
    deviceName: input.deviceName,
    protocolFamily: input.protocolFamily,
    catalogueId: input.catalogueId ?? null,
    model: input.model,
    versions: input.versions,
    telemetry: input.telemetry,
  };
  const json = JSON.stringify(backup, null, 2);
  return {
    backup,
    json,
    sha256: await hash(json),
    filename: backupFilename(input.deviceName, capturedAt),
  };
}

// ---------------------------------------------------------------------------
// Effects (injected)
// ---------------------------------------------------------------------------

export interface FileSaver {
  /** Trigger a download of `data` to the user's device under `filename`. */
  save(data: Blob, filename: string): void;
}

export interface FirmwareDeps {
  hash(data: string): Promise<string>;
  hashBytes(data: Uint8Array): Promise<string>;
  fetchBytes(url: string): Promise<Uint8Array>;
  saver: FileSaver;
  now?(): string;
}

/** Best-effort SHA-256 over a string, using Web Crypto. */
export async function sha256Hex(data: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(data));
}

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return bytesToHex(new Uint8Array(digest)).replace(/ /g, '');
}

/** Real browser file saver: an object URL behind a synthetic anchor click. */
export function browserFileSaver(): FileSaver {
  return {
    save(data: Blob, filename: string) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  };
}

export function defaultFirmwareDeps(): FirmwareDeps {
  return {
    hash: sha256Hex,
    hashBytes: sha256Bytes,
    async fetchBytes(url: string) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Firmware download failed (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    },
    saver: browserFileSaver(),
    now: () => new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Backup flow
// ---------------------------------------------------------------------------

export interface CaptureResult extends BackupArtifact {
  saved: boolean;
}

/**
 * Capture a backup and write it to the device. This is the step that must
 * succeed before any flashing is offered.
 */
export async function captureAndSaveBackup(deps: FirmwareDeps, input: BackupInput): Promise<CaptureResult> {
  const artifact = await buildBackup(input, deps.hash);
  deps.saver.save(new Blob([artifact.json], { type: 'application/json' }), artifact.filename);
  return { ...artifact, saved: true };
}

// ---------------------------------------------------------------------------
// Flashing gate (backups are always required)
// ---------------------------------------------------------------------------

export interface FlashGateState {
  /** Whether a backup has been captured for the current device/session. */
  backupTaken: boolean;
  /** The tech has read and accepted the flashing warning. */
  riskAccepted: boolean;
  /** The bench is connected to a device. */
  connected: boolean;
}

export interface FlashGateResult {
  allowed: boolean;
  /** Why flashing is blocked, in the order the tech must clear them. */
  blockers: string[];
}

/**
 * Decide whether the "download for flashing" action may proceed. The rules are
 * deliberately strict: no backup, no flashing — regardless of anything else.
 */
export function canFlash(state: FlashGateState): FlashGateResult {
  const blockers: string[] = [];
  if (!state.connected) blockers.push('Connect to the scooter first.');
  if (!state.backupTaken) blockers.push('Take a backup of the current firmware before flashing.');
  if (!state.riskAccepted) blockers.push('Confirm you understand flashing can brick the controller.');
  return { allowed: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// Firmware download
// ---------------------------------------------------------------------------

export interface FirmwareFile {
  target: FirmwareTarget;
  version: string;
  url: string;
  /** Expected SHA-256 of the file, when known. Verified after download. */
  sha256?: string;
  source?: string;
}

export interface DownloadResult {
  ok: boolean;
  filename: string;
  /** SHA-256 of the bytes actually saved to the device. */
  sha256: string;
  bytes: number;
  /** True when an expected hash was supplied and matched. */
  checksumVerified: boolean | null;
  error?: string;
}

export function firmwareFilename(deviceName: string, file: FirmwareFile): string {
  const safe = (deviceName || 'scooter').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'scooter';
  return `stakeys-fw-${safe}-${file.target}-${file.version}.bin`;
}

/**
 * Download a firmware file to the user's device. Refuses to run unless the
 * flashing gate is satisfied, so a backup is always taken first. Verifies the
 * SHA-256 against `file.sha256` when one is supplied.
 */
export async function downloadFirmware(
  deps: FirmwareDeps,
  file: FirmwareFile,
  gate: FlashGateState,
  deviceName: string
): Promise<DownloadResult> {
  const filename = firmwareFilename(deviceName, file);
  const decision = canFlash(gate);
  if (!decision.allowed) {
    return { ok: false, filename, sha256: '', bytes: 0, checksumVerified: null, error: decision.blockers.join(' ') };
  }
  try {
    const data = await deps.fetchBytes(file.url);
    const sha256 = await deps.hashBytes(data);
    const checksumVerified = file.sha256 ? sha256.toLowerCase() === file.sha256.toLowerCase() : null;
    if (checksumVerified === false) {
      return {
        ok: false,
        filename,
        sha256,
        bytes: data.byteLength,
        checksumVerified,
        error: `Checksum mismatch — expected ${file.sha256}, got ${sha256}. File not saved.`,
      };
    }
    deps.saver.save(new Blob([toArrayBuffer(data)], { type: 'application/octet-stream' }), filename);
    return { ok: true, filename, sha256, bytes: data.byteLength, checksumVerified };
  } catch (err) {
    return {
      ok: false,
      filename,
      sha256: '',
      bytes: 0,
      checksumVerified: null,
      error: err instanceof Error ? err.message : 'Download failed.',
    };
  }
}

/** Reduce a comparison list to the headline the UI shows. */
export function summarizeComparisons(comparisons: FirmwareComparison[]): string {
  const outdated = comparisons.filter((c) => c.status === 'outdated');
  if (outdated.length === 0) {
    const known = comparisons.some((c) => c.status !== 'unknown');
    return known ? 'Firmware matches stock.' : 'No stock reference for this model.';
  }
  return `Outdated: ${outdated.map((c) => `${c.target.toUpperCase()} ${c.current} → ${c.expected}`).join(', ')}`;
}
