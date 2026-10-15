import { describe, it, expect, vi } from 'vitest';
import { evaluateBrick, FIRMWARE_FAULT_CODES } from './src/utils/scooterBrickDetector';
import { buildDiagnosticReport, runDiagnosticSweep, type ScooterSessionLike } from './src/utils/scooterDiagnostics';

// ---------------------------------------------------------------------------
// Brick detector
// ---------------------------------------------------------------------------

describe('brick detector', () => {
  it('does not diagnose an unsupported silent controller as bricked', () => {
    const r = evaluateBrick({ protocolSupported: false, advertised: true, gattConnected: true, statusReadable: false, versionsRead: 0, errorCode: null, escVersion: null });
    expect(r.verdict).toBe('unsupported');
    expect(r.recommendation).toContain('Missing data does not establish a firmware fault');
  });
  it('is unresponsive when the device never advertises', () => {
    const r = evaluateBrick({
      advertised: false,
      gattConnected: false,
      statusReadable: false,
      versionsRead: 0,
      errorCode: null,
      escVersion: null,
    });
    expect(r.verdict).toBe('unresponsive');
    expect(r.recommendation).toMatch(/power|battery/i);
  });

  it('is soft-bricked when it advertises but refuses GATT', () => {
    const r = evaluateBrick({
      advertised: true,
      gattConnected: false,
      statusReadable: false,
      versionsRead: 0,
      errorCode: null,
      escVersion: null,
    });
    expect(r.verdict).toBe('soft-bricked');
    expect(r.recommendation).toMatch(/ST-Link|UART/i);
  });

  it('is soft-bricked when it connects but runs no application', () => {
    const r = evaluateBrick({
      advertised: true,
      gattConnected: true,
      statusReadable: false,
      versionsRead: 0,
      errorCode: null,
      escVersion: null,
    });
    expect(r.verdict).toBe('soft-bricked');
    expect(r.recommendation).toMatch(/wired/i);
  });

  it('is suspicious when it reports a firmware-error fault code', () => {
    const r = evaluateBrick({
      advertised: true,
      gattConnected: true,
      statusReadable: true,
      versionsRead: 1,
      errorCode: 25,
      escVersion: '1.0.0',
    });
    expect(r.verdict).toBe('suspicious');
    expect(r.recommendation).toMatch(/fault 25/i);
    expect(FIRMWARE_FAULT_CODES[25]).toMatch(/half-flashed/i);
  });

  it('is healthy when everything answers', () => {
    const r = evaluateBrick({
      advertised: true,
      gattConnected: true,
      statusReadable: true,
      versionsRead: 3,
      errorCode: null,
      escVersion: '1.5.1',
    });
    expect(r.verdict).toBe('healthy');
    expect(r.evidence.every((e) => e.ok)).toBe(true);
  });

  it('is suspicious on partial responses', () => {
    const r = evaluateBrick({
      advertised: true,
      gattConnected: true,
      statusReadable: false,
      versionsRead: 2,
      errorCode: null,
      escVersion: '1.5.1',
    });
    expect(r.verdict).toBe('suspicious');
  });
});

// ---------------------------------------------------------------------------
// Diagnostic report
// ---------------------------------------------------------------------------

const healthy = {
  deviceName: 'Mi Scooter Pro 2',
  protocolFamily: 'Xiaomi/Ninebot',
  model: 'M365 Pro 2',
  advertised: true,
  gattConnected: true,
  telemetry: { batteryPercent: 78, voltage: 38.2, controllerTempC: 34, errorCode: null },
  versions: [
    { target: 'esc' as const, version: '1.5.1', rawHex: '' },
    { target: 'bms' as const, version: '1.4.1', rawHex: '' },
    { target: 'ble' as const, version: '1.2.7', rawHex: '' },
  ],
  now: '2026-10-12T10:00:00Z',
};

describe('diagnostic report', () => {
  it('scores a healthy, up-to-date scooter 100 and verdict healthy', () => {
    const r = buildDiagnosticReport(healthy);
    expect(r.verdict).toBe('healthy');
    expect(r.score).toBe(100);
    expect(r.comparisons.every((c) => c.status !== 'outdated')).toBe(true);
  });

  it('flags an active fault and downgrades the verdict to faulty', () => {
    const r = buildDiagnosticReport({ ...healthy, telemetry: { ...healthy.telemetry, errorCode: 14 } });
    expect(r.verdict).toBe('faulty');
    expect(r.checks.find((c) => c.id === 'faults')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'faults')?.detail).toMatch(/Throttle hall/);
  });

  it('warns on outdated firmware and low battery', () => {
    const r = buildDiagnosticReport({
      ...healthy,
      telemetry: { ...healthy.telemetry, batteryPercent: 15 },
      versions: [{ target: 'esc' as const, version: '1.3.9', rawHex: '' }],
    });
    expect(r.verdict).toBe('attention');
    expect(r.checks.find((c) => c.id === 'firmware-stock')?.status).toBe('warn');
    expect(r.checks.find((c) => c.id === 'battery')?.status).toBe('warn');
  });

  it('marks firmware-vs-stock as info when the model is not catalogued', () => {
    const r = buildDiagnosticReport({ ...healthy, model: 'Unlisted Scooter' });
    expect(r.checks.find((c) => c.id === 'firmware-stock')?.status).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// Sweep runner
// ---------------------------------------------------------------------------

describe('runDiagnosticSweep', () => {
  it('reads versions and returns a report, reporting progress', async () => {
    const session: ScooterSessionLike = {
      connected: true,
      activeDriver: { family: 'Xiaomi/Ninebot', label: 'Xiaomi / Ninebot' },
      readAllVersions: vi.fn(async () => [{ target: 'esc' as const, version: '1.5.1', rawHex: '' }]),
    };
    const steps: string[] = [];
    const report = await runDiagnosticSweep(
      {
        session,
        getDeviceName: () => 'Mi Scooter Pro 2',
        getModel: () => 'M365 Pro 2',
        getTelemetry: () => ({ batteryPercent: 80, voltage: 38, controllerTempC: 30, errorCode: null }),
        advertised: true,
        now: () => '2026-10-12T10:00:00Z',
      },
      (s) => steps.push(s)
    );
    expect(session.readAllVersions).toHaveBeenCalled();
    expect(report.versions).toHaveLength(1);
    expect(steps.length).toBeGreaterThan(0);
  });
});
