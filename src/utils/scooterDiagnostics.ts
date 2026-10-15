/**
 * Full diagnostic sweep for the BLE bench.
 *
 * Runs a staged, read-only pass over a connected scooter and returns a single
 * report the tech can save to the customer record: connection, firmware
 * versions, active fault codes, battery/voltage, controller temperature, the
 * brick signature and the firmware-vs-stock comparison.
 *
 * `runDiagnosticSweep` orchestrates through a small injected session interface
 * so the whole sweep is testable against a fake, and `buildDiagnosticReport`
 * is pure so the scoring can be asserted directly.
 */
import type { FirmwareTarget, ScooterTelemetry, VersionReading } from '../utils/scooterProtocols';
import {
  compareFirmware,
  findFirmwareEntry,
  summarizeComparisons,
  type FirmwareComparison,
} from './scooterFirmware';
import { evaluateBrick, type BrickObservation, type BrickReport } from './scooterBrickDetector';
import { XIAOMI_NINEBOT_ERRORS, MINIROBOT_ERRORS } from './scooterProtocols';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ScooterDiagnosticReport {
  generatedAt: string;
  deviceName: string;
  protocolFamily: string;
  model: string;
  checks: DiagnosticCheck[];
  comparisons: FirmwareComparison[];
  versions: VersionReading[];
  brick: BrickReport;
  /** 0..100 — share of non-info checks that passed. */
  score: number;
  verdict: 'healthy' | 'attention' | 'faulty' | 'unsupported';
}

export interface DiagnosticInput {
  deviceName: string;
  protocolFamily: string;
  model: string;
  advertised: boolean;
  gattConnected: boolean;
  telemetry: Partial<ScooterTelemetry>;
  versions: VersionReading[];
  now?: string;
}

function versionFor(versions: VersionReading[], target: FirmwareTarget): string | null {
  return versions.find((v) => v.target === target)?.version ?? null;
}

function faultText(family: string, code: number): string {
  if (family === 'MiniRobot') return MINIROBOT_ERRORS[code] || `MiniRobot fault bit ${code}`;
  return XIAOMI_NINEBOT_ERRORS[code] || `Controller fault code ${code}`;
}

/** Build the report from collected observations. Pure. */
export function buildDiagnosticReport(input: DiagnosticInput): ScooterDiagnosticReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const entry = findFirmwareEntry(input.model);
  const comparisons = compareFirmware(
    entry,
    { esc: versionFor(input.versions, 'esc'), bms: versionFor(input.versions, 'bms'), ble: versionFor(input.versions, 'ble') }
  );
  const brick = evaluateBrick({
    protocolSupported: input.protocolFamily !== 'Generic UART',
    advertised: input.advertised,
    gattConnected: input.gattConnected,
    statusReadable: input.telemetry.voltage !== undefined && input.telemetry.voltage! > 0,
    versionsRead: input.versions.length,
    errorCode: input.telemetry.errorCode ?? null,
    escVersion: versionFor(input.versions, 'esc'),
  });

  const checks: DiagnosticCheck[] = [];

  checks.push({
    id: 'connection',
    label: 'Connection',
    status: input.gattConnected ? 'pass' : 'fail',
    detail: input.gattConnected ? `Connected to ${input.deviceName}.` : 'No GATT connection.',
  });

  checks.push({
    id: 'versions',
    label: 'Firmware versions',
    status: input.versions.length > 0 ? 'pass' : 'warn',
    detail:
      input.versions.length > 0
        ? input.versions.map((v) => `${v.target.toUpperCase()} ${v.version}`).join(' · ')
        : 'No version responses — the application may not be running.',
  });

  const errorCode = input.telemetry.errorCode ?? null;
  checks.push({
    id: 'faults',
    label: 'Active fault codes',
    status: errorCode === null ? 'pass' : 'fail',
    detail: errorCode === null ? 'No active fault reported.' : `Fault ${errorCode}: ${faultText(input.protocolFamily, errorCode)}`,
  });

  const battery = input.telemetry.batteryPercent;
  checks.push({
    id: 'battery',
    label: 'Battery & voltage',
    status: battery === undefined || battery > 20 ? 'pass' : battery > 5 ? 'warn' : 'fail',
    detail:
      battery === undefined
        ? 'Battery not reported.'
        : `${battery}% at ${input.telemetry.voltage ?? 0} V${battery <= 20 ? ' — charge before load testing.' : ''}`,
  });

  const temp = input.telemetry.controllerTempC;
  checks.push({
    id: 'temperature',
    label: 'Controller temperature',
    status: temp === undefined || temp < 65 ? 'pass' : temp < 80 ? 'warn' : 'fail',
    detail: temp === undefined ? 'Temperature not reported.' : `${temp} °C${temp >= 65 ? ' — hot; let it cool before load testing.' : ''}`,
  });

  const outdated = comparisons.filter((c) => c.status === 'outdated');
  checks.push({
    id: 'firmware-stock',
    label: 'Firmware vs stock',
    status: entry === undefined ? 'info' : outdated.length ? 'warn' : 'pass',
    detail: summarizeComparisons(comparisons),
  });

  checks.push({
    id: 'brick',
    label: 'Brick signature',
    status: brick.verdict === 'unsupported' ? 'info' : brick.verdict === 'healthy' ? 'pass' : brick.verdict === 'suspicious' ? 'warn' : 'fail',
    detail: `${brick.verdict} — ${brick.recommendation}`,
  });

  if (input.protocolFamily === 'Generic UART') {
    for (const check of checks) {
      if (['versions', 'faults', 'battery', 'temperature', 'firmware-stock'].includes(check.id)) {
        check.status = 'info';
        check.detail = 'Not assessed: this controller protocol is not supported by the app.';
      }
    }
  }
  const graded = checks.filter((c) => c.status !== 'info');
  const passed = graded.filter((c) => c.status === 'pass').length;
  const score = graded.length ? Math.round((passed / graded.length) * 100) : 0;
  const verdict: ScooterDiagnosticReport['verdict'] = input.protocolFamily === 'Generic UART' ? 'unsupported' : graded.some((c) => c.status === 'fail')
    ? 'faulty'
    : graded.some((c) => c.status === 'warn')
      ? 'attention'
      : 'healthy';

  return {
    generatedAt,
    deviceName: input.deviceName,
    protocolFamily: input.protocolFamily,
    model: input.model,
    checks,
    comparisons,
    versions: input.versions,
    brick,
    score,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Sweep runner (injected session)
// ---------------------------------------------------------------------------

export interface ScooterSessionLike {
  connected: boolean;
  readAllVersions(timeoutMs?: number): Promise<VersionReading[]>;
  activeDriver: { family: string; label: string };
}

export interface SweepDeps {
  session: ScooterSessionLike;
  getDeviceName(): string;
  getModel(): string;
  getTelemetry(): Partial<ScooterTelemetry>;
  advertised: boolean;
  now?(): string;
}

/** Run the staged read-only sweep and return the report. */
export async function runDiagnosticSweep(
  deps: SweepDeps,
  onProgress?: (step: string) => void
): Promise<ScooterDiagnosticReport> {
  onProgress?.('Reading firmware versions…');
  const versions = await deps.session.readAllVersions();
  onProgress?.('Checking fault codes and battery…');
  const telemetry = deps.getTelemetry();
  onProgress?.('Scoring brick signature…');
  return buildDiagnosticReport({
    deviceName: deps.getDeviceName(),
    protocolFamily: deps.session.activeDriver.family,
    model: deps.getModel(),
    advertised: deps.advertised,
    gattConnected: deps.session.connected,
    telemetry,
    versions,
    now: deps.now?.(),
  });
}
