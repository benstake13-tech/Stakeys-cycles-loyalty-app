import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  BluetoothOff,
  Lock,
  LockOpen,
  Lightbulb,
  Gauge,
  BatteryCharging,
  Zap,
  AlertTriangle,
  Cpu,
  Radio,
  Loader2,
  ShieldAlert,
  Download,
  HardDriveDownload,
  Activity,
  ClipboardList,
  CheckCircle2,
  XCircle,
  CircleAlert,
} from 'lucide-react';
import {
  createEmptyTelemetry,
  ScooterBleSession,
  SCOOTER_CONNECT_BRANDS,
  detectDriver,
  errorTextFor,
  type BluetoothHost,
  type ScooterDriver,
  type ScooterFamily,
  type ScooterConnectBrand,
  type ScooterTelemetry,
  type VersionReading,
} from '../utils/scooterProtocols';
import { createNativeBluetoothHost } from '../utils/bleHost';
import {
  compareFirmware,
  findFirmwareEntry,
  captureAndSaveBackup,
  canFlash,
  downloadFirmware,
  defaultFirmwareDeps,
  summarizeComparisons,
  type FirmwareComparison,
  type FirmwareDeps,
  type FirmwareFile,
} from '../utils/scooterFirmware';
import { evaluateBrick } from '../utils/scooterBrickDetector';
import { runDiagnosticSweep, type ScooterDiagnosticReport } from '../utils/scooterDiagnostics';

interface EscooterDiagnosticTileProps {
  /**
   * Bluetooth host. Defaults to `navigator.bluetooth`. Injected in tests (and by
   * any environment that provides its own transport) so the tile is exercisable
   * without a radio.
   */
  bluetoothHost?: BluetoothHost;
  /** Open in simulator mode — useful for training and demos. */
  startInDemo?: boolean;
  /** Firmware-service dependencies (hashing, fetch, file save). Injected in tests. */
  firmwareDeps?: FirmwareDeps;
}

/** Read the browser's Bluetooth host, if it exposes one. */
function getNavigatorBluetooth(): BluetoothHost | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothHost }).bluetooth;
}

/**
 * Resolve a Bluetooth transport: an explicitly injected host, then Web
 * Bluetooth, then the native Android BLE plugin (async). Returns undefined when
 * none is available.
 */
async function resolveBluetoothHost(injected?: BluetoothHost): Promise<BluetoothHost | undefined> {
  if (injected) return injected;
  const web = getNavigatorBluetooth();
  if (web) return web;
  return createNativeBluetoothHost();
}

const tone: Record<ScooterTelemetry['protocolFamily'], string> = {
  'Xiaomi/Ninebot': 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  MiniRobot: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
  'Generic UART': 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Disconnected: 'text-neutral-400 border-neutral-700 bg-neutral-800/40',
};

export const EscooterDiagnosticTile: React.FC<EscooterDiagnosticTileProps> = ({
  bluetoothHost,
  startInDemo = false,
  firmwareDeps,
}) => {
  const host = useMemo(() => bluetoothHost ?? getNavigatorBluetooth(), [bluetoothHost]);
  const [telemetry, setTelemetry] = useState<ScooterTelemetry>(createEmptyTelemetry);
  const [isScanning, setIsScanning] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(startInDemo);
  const [status, setStatus] = useState<string>('');
  const [family, setFamily] = useState<ScooterFamily | 'Disconnected'>('Disconnected');
  const [selectedBrand, setSelectedBrand] = useState<ScooterConnectBrand | ''>('');

  // Firmware / backup / brick / diagnostics state.
  const deps = useMemo(() => firmwareDeps ?? defaultFirmwareDeps(), [firmwareDeps]);
  const [model, setModel] = useState('');
  const [versions, setVersions] = useState<VersionReading[]>([]);
  const [backupTaken, setBackupTaken] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [firmwareMsg, setFirmwareMsg] = useState<string>('');
  const [report, setReport] = useState<ScooterDiagnosticReport | null>(null);

  const sessionRef = useRef<ScooterBleSession | null>(null);
  const demoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    if (demoRef.current) {
      clearInterval(demoRef.current);
      demoRef.current = null;
    }
  }, []);

  useEffect(() => teardown, [teardown]);

  // Simulator engine — drives the same telemetry shape as real hardware.
  useEffect(() => {
    if (!isDemoMode) return;
    teardown();
    setFamily('Xiaomi/Ninebot');
    setStatus('Simulator active — no radio in use.');
    setTelemetry({
      ...createEmptyTelemetry(),
      connected: true,
      deviceName: 'SIMULATED-M365-PRO',
      protocolFamily: 'Xiaomi/Ninebot',
      speedKmh: 18.4,
      batteryPercent: 78,
      voltage: 38.2,
      currentAmps: 4.1,
      controllerTempC: 34,
      headlightOn: true,
      errorCode: 14,
      errorMessage: errorTextFor('Xiaomi/Ninebot', 14),
      rawHexRx: '55 aa 0c 20 20 00 38 07 4e 0f 22 0e 02 6d',
    });
    demoRef.current = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        speedKmh: Number((15 + Math.random() * 5).toFixed(1)),
        batteryPercent: Math.max(10, prev.batteryPercent - (Math.random() > 0.8 ? 1 : 0)),
        voltage: Number((36 + Math.random() * 2).toFixed(1)),
      }));
    }, 2000);
    return () => {
      if (demoRef.current) clearInterval(demoRef.current);
      demoRef.current = null;
    };
  }, [isDemoMode, teardown]);

  const connect = useCallback(async () => {
    if (!selectedBrand) {
      setStatus('Choose the scooter brand first so the correct discovery method can be used.');
      return;
    }
    setIsScanning(true);
    setStatus('Requesting device…');
    const resolved = host ?? (await resolveBluetoothHost());
    if (!resolved) {
      setIsScanning(false);
      setStatus('Web Bluetooth is not available here. Use Chrome or Edge on desktop, or open the simulator.');
      return;
    }
    try {
      const session = new ScooterBleSession(resolved, {
        onTelemetry: (patch) => setTelemetry((prev) => ({ ...prev, ...patch })),
        onDisconnect: () => {
          setTelemetry(createEmptyTelemetry());
          setFamily('Disconnected');
          setStatus('Scooter disconnected. No live controller session is active.');
        },
      });
      sessionRef.current = session;
      const connectedFamily = await session.connect(selectedBrand);
      if (!session.connected) throw new Error('Scooter disconnected before setup finished.');
      setFamily(connectedFamily);
      setTelemetry((prev) => ({
        ...prev,
        connected: true,
        protocolFamily: connectedFamily,
        deviceName: session.deviceName || session.activeDriver.label,
      }));
      setStatus(session.connectionNote || `Connected via ${session.activeDriver.label}.`);
    } catch (err) {
      setStatus(err instanceof Error ? `Connection failed: ${err.message}` : 'Connection failed.');
      setTelemetry(createEmptyTelemetry());
      setFamily('Disconnected');
    } finally {
      setIsScanning(false);
    }
  }, [host, selectedBrand]);

  const disconnect = useCallback(() => {
    teardown();
    setTelemetry(createEmptyTelemetry());
    setFamily('Disconnected');
    setVersions([]);
    setBackupTaken(false);
    setRiskAccepted(false);
    setReport(null);
    setFirmwareMsg('');
    setStatus('Disconnected.');
  }, [teardown]);

  const toggleLock = useCallback(async () => {
    const next = !telemetry.isLocked;
    if (isDemoMode) {
      setTelemetry((prev) => ({ ...prev, isLocked: next }));
      return;
    }
    const ok = await sessionRef.current?.setLock(next);
    if (ok) setTelemetry((prev) => ({ ...prev, isLocked: next }));
    else setStatus('This protocol has no lock command.');
  }, [telemetry.isLocked, isDemoMode]);

  const toggleHeadlight = useCallback(async () => {
    const next = !telemetry.headlightOn;
    if (isDemoMode) {
      setTelemetry((prev) => ({ ...prev, headlightOn: next }));
      return;
    }
    const ok = await sessionRef.current?.setHeadlight(next);
    if (ok) setTelemetry((prev) => ({ ...prev, headlightOn: next }));
    else setStatus('This protocol has no headlight command.');
  }, [telemetry.headlightOn, isDemoMode]);

  const driver: ScooterDriver = sessionRef.current?.activeDriver ?? detectDriver(telemetry.deviceName, []);
  const unsupportedProtocol = !isDemoMode && family === 'Generic UART';

  const catalogueEntry = useMemo(() => findFirmwareEntry(model), [model]);
  const comparisons: FirmwareComparison[] = useMemo(
    () =>
      compareFirmware(catalogueEntry, {
        esc: versions.find((v) => v.target === 'esc')?.version ?? null,
        bms: versions.find((v) => v.target === 'bms')?.version ?? null,
        ble: versions.find((v) => v.target === 'ble')?.version ?? null,
      }),
    [catalogueEntry, versions]
  );
  const gate = canFlash({ connected: telemetry.connected && !unsupportedProtocol, backupTaken, riskAccepted });
  const brick = useMemo(
    () =>
      evaluateBrick({
        protocolSupported: !unsupportedProtocol,
        advertised: telemetry.connected,
        gattConnected: telemetry.connected,
        statusReadable: telemetry.voltage > 0,
        versionsRead: versions.length,
        errorCode: telemetry.errorCode,
        escVersion: versions.find((v) => v.target === 'esc')?.version ?? null,
      }),
    [telemetry, versions, unsupportedProtocol]
  );

  const readVersions = useCallback(async () => {
    setFirmwareMsg('');
    if (isDemoMode) {
      setVersions([
        { target: 'esc', version: '1.3.9', rawHex: '55 aa 08 20 9a 20 01 03 09' },
        { target: 'bms', version: '1.2.7', rawHex: '55 aa 08 20 9b 22 01 02 07' },
      ]);
      setFirmwareMsg('Simulator: read ESC 1.3.9 and BMS 1.2.7.');
      return;
    }
    const session = sessionRef.current;
    if (!session) {
      setFirmwareMsg('Connect to a scooter first.');
      return;
    }
    setBusy('versions');
    const found = await session.readAllVersions();
    setVersions(found);
    setFirmwareMsg(found.length ? `Read ${found.length} version(s).` : 'No version responses — the controller did not answer.');
    setBusy('');
  }, [isDemoMode]);

  const takeBackup = useCallback(async () => {
    setFirmwareMsg('');
    setBusy('backup');
    try {
      const res = await captureAndSaveBackup(deps, {
        deviceName: telemetry.deviceName || driver.label,
        protocolFamily: family,
        model: model || driver.label,
        versions,
        telemetry: unsupportedProtocol ? { rawHexRx: telemetry.rawHexRx } : {
          batteryPercent: telemetry.batteryPercent,
          voltage: telemetry.voltage,
          controllerTempC: telemetry.controllerTempC,
          errorCode: telemetry.errorCode,
          isLocked: telemetry.isLocked,
          headlightOn: telemetry.headlightOn,
        },
        catalogueId: catalogueEntry?.id ?? null,
      });
      setBackupTaken(true);
      setFirmwareMsg(`Diagnostic snapshot saved: ${res.filename} (sha256 ${res.sha256.slice(0, 12)}…). This is not a firmware image backup.`);
    } catch (err) {
      setFirmwareMsg(err instanceof Error ? `Backup failed: ${err.message}` : 'Backup failed.');
    } finally {
      setBusy('');
    }
  }, [deps, telemetry, family, model, versions, catalogueEntry, driver.label, unsupportedProtocol]);

  const flashTargets = useMemo(() => {
    const stock = catalogueEntry?.stock ?? {};
    return (['esc', 'bms', 'ble'] as const)
      .map((target) => ({ target, file: stock[target] }))
      .filter((t) => t.file?.downloadUrl) as Array<{ target: 'esc' | 'bms' | 'ble'; file: { version: string; downloadUrl: string; sha256?: string } }>;
  }, [catalogueEntry]);

  const runDownload = useCallback(
    async (target: 'esc' | 'bms' | 'ble', file: FirmwareFile) => {
      setFirmwareMsg('');
      if (unsupportedProtocol) {
        setFirmwareMsg('Firmware downloads are unavailable for an unidentified controller protocol.');
        return;
      }
      if (!riskAccepted) {
        setFirmwareMsg('Tick the flashing warning before downloading a firmware file.');
        return;
      }
      setBusy(`download:${target}`);
      const res = await downloadFirmware(deps, file, { connected: telemetry.connected || isDemoMode, backupTaken, riskAccepted }, telemetry.deviceName || driver.label);
      setFirmwareMsg(
        res.ok
          ? `Saved ${res.filename} (${res.bytes} bytes, sha256 ${res.sha256.slice(0, 12)}…${res.checksumVerified === true ? ', checksum verified' : ''}).`
          : `Download blocked/failed: ${res.error}`
      );
      setBusy('');
    },
    [deps, riskAccepted, backupTaken, telemetry.connected, telemetry.deviceName, isDemoMode, driver.label, unsupportedProtocol]
  );

  const downloadManual = useCallback(async () => {
    const url = manualUrl.trim();
    if (!url) {
      setFirmwareMsg('Paste a firmware URL first.');
      return;
    }
    await runDownload('esc', { target: 'esc', version: 'manual', url });
  }, [manualUrl, runDownload]);

  const runSweep = useCallback(async () => {
    setReport(null);
    setBusy('sweep');
    if (isDemoMode) {
      setReport(
        runDiagnosticSweep
          ? await runDiagnosticSweep(
              {
                session: {
                  connected: true,
                  activeDriver: { family: 'Xiaomi/Ninebot', label: driver.label },
                  readAllVersions: async () => [
                    { target: 'esc', version: '1.5.1', rawHex: '' },
                    { target: 'bms', version: '1.4.1', rawHex: '' },
                  ],
                },
                getDeviceName: () => telemetry.deviceName,
                getModel: () => model || 'M365 Pro 2',
                getTelemetry: () => telemetry,
                advertised: true,
              },
              (s) => setFirmwareMsg(s)
            )
          : null
      );
      setBusy('');
      return;
    }
    const session = sessionRef.current;
    if (!session) {
      setFirmwareMsg('Connect to a scooter first.');
      setBusy('');
      return;
    }
    try {
      const result = await runDiagnosticSweep(
        {
          session,
          getDeviceName: () => telemetry.deviceName || driver.label,
          getModel: () => model || driver.label,
          getTelemetry: () => telemetry,
          advertised: true,
        },
        (s) => setFirmwareMsg(s)
      );
      setReport(result);
      setVersions(result.versions);
      setFirmwareMsg(result.verdict === 'unsupported' ? 'Sweep complete — controller protocol unsupported; health not assessed.' : `Sweep complete — ${result.verdict} (${result.score}/100).`);
    } catch (err) {
      setFirmwareMsg(err instanceof Error ? `Sweep failed: ${err.message}` : 'Sweep failed.');
    } finally {
      setBusy('');
    }
  }, [isDemoMode, driver.label, telemetry, model]);

  const verdictTone: Record<string, string> = {
    healthy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    attention: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    faulty: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    suspicious: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    'soft-bricked': 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    unresponsive: 'border-neutral-600 bg-neutral-800/40 text-neutral-300',
    unsupported: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                E-Scooter BLE Diagnostic Bench
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Connect to a live controller over Bluetooth Low Energy to read speed, battery, voltage, temperature
                and fault codes, and to send lock / headlight commands. Frame builders and parsers run locally.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span
              data-testid="escooter-status-dot"
              className={`w-2.5 h-2.5 rounded-full ${telemetry.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
            />
            <div className="text-right">
              <div className="font-mono text-xs text-white" data-testid="escooter-device">
                {telemetry.connected ? telemetry.deviceName : 'No device paired'}
              </div>
              <div className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${tone[family]}`}>
                {family}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-800 flex flex-wrap items-center gap-3">
          {!telemetry.connected && !isDemoMode && (
            <label className="min-w-[220px] text-[10px] font-black uppercase tracking-wider text-neutral-400">
              Scooter brand · choose before scan
              <select
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value as ScooterConnectBrand | '')}
                disabled={isScanning}
                data-testid="escooter-brand"
                className="mt-1 block w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs font-bold normal-case tracking-normal text-white"
              >
                <option value="">Choose a brand…</option>
                {SCOOTER_CONNECT_BRANDS.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
              </select>
            </label>
          )}
          {telemetry.connected && !isDemoMode ? (
            <button
              type="button"
              onClick={disconnect}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isScanning || isDemoMode || !selectedBrand}
              data-testid="escooter-connect"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-black text-xs uppercase tracking-wide cursor-pointer"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
              {isScanning ? 'Scanning…' : 'Scan BLE'}
            </button>
          )}

          <label className="inline-flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              data-testid="escooter-demo-toggle"
              className="accent-emerald-500"
            />
            Simulator mode (no hardware)
          </label>

          {status && <span data-testid="escooter-status" className="text-[11px] text-neutral-500 font-mono">{status}</span>}
        </div>
        {!telemetry.connected && !isDemoMode && selectedBrand && (
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-500" data-testid="escooter-brand-guidance">
            {SCOOTER_CONNECT_BRANDS.find((profile) => profile.id === selectedBrand)?.note}
            {selectedBrand === 'windgoo-youfs' && ' Power on the scooter and press its Bluetooth/pair button if fitted.'}
          </p>
        )}
      </div>

      {/* Fault banner */}
      {telemetry.errorCode !== null && (
        <div className="rounded-3xl border border-rose-600/50 bg-rose-950/40 p-5 flex items-start gap-3" data-testid="escooter-fault">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-rose-300 font-black text-sm uppercase tracking-wide">
              Hardware fault code {telemetry.errorCode}
            </div>
            <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">{telemetry.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Brick signature */}
      <div className={`rounded-3xl border p-5 flex items-start gap-3 ${verdictTone[brick.verdict]}`} data-testid="escooter-brick">
        <Activity className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-black text-sm uppercase tracking-wide">
            Brick check · {brick.verdict}
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">{brick.recommendation}</p>
          <ul className="mt-2 space-y-1">
            {brick.evidence.map((e) => (
              <li key={e.label} className="text-[11px] flex items-start gap-2 opacity-90">
                {e.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span><strong>{e.label}:</strong> {e.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Firmware / backup / flashing */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4" data-testid="escooter-firmware">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
            <HardDriveDownload className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display text-lg font-black text-white tracking-tight">Firmware, backup &amp; flashing</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Read supported firmware versions, compare them to stock, save a diagnostic snapshot, then download the
              stock file to this device to flash with the vendor tool. A diagnostic snapshot is not a firmware image backup. The bench never writes flash itself.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[11px] text-neutral-400 font-mono uppercase">
            Model (for stock lookup)
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. M365 Pro 2"
              data-testid="escooter-model"
              className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white font-sans normal-case"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={readVersions}
              disabled={busy === 'versions' || unsupportedProtocol}
              data-testid="escooter-read-versions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wide cursor-pointer"
            >
              {busy === 'versions' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              Read versions
            </button>
          </div>
        </div>

        {/* Version comparison */}
        <div className="rounded-2xl border border-neutral-800 divide-y divide-neutral-800">
          {comparisons.map((c) => (
            <div key={c.target} className="flex items-center justify-between px-4 py-2 text-xs" data-testid={`escooter-fw-${c.target}`}>
              <span className="font-mono uppercase text-neutral-400">{c.target}</span>
              <span className="font-mono text-neutral-200">{c.current ?? '—'}</span>
              <span className="font-mono text-neutral-500">→ {c.expected ?? 'n/a'}</span>
              <span className={`font-bold ${c.status === 'outdated' ? 'text-amber-300' : c.status === 'up-to-date' ? 'text-emerald-300' : c.status === 'newer' ? 'text-sky-300' : 'text-neutral-500'}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500 font-mono">{summarizeComparisons(comparisons)}</p>
        {catalogueEntry && (
          <p className="text-[10px] text-neutral-600">
            Stock reference:{' '}
            <a href={catalogueEntry.source} target="_blank" rel="noreferrer" className="underline hover:text-neutral-400">
              {catalogueEntry.source}
            </a>
            {catalogueEntry.note ? ` — ${catalogueEntry.note}` : ''}
          </p>
        )}

        {/* Backup — always required */}
        <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4 space-y-2">
          <div className="text-xs font-black uppercase tracking-wide text-emerald-300">Step 1 — save diagnostic snapshot</div>
          <p className="text-[11px] text-emerald-200/80 leading-relaxed">
            Save the available versions and telemetry to this device. This JSON snapshot does not contain firmware and cannot restore a controller.
          </p>
          <button
            type="button"
            onClick={takeBackup}
            disabled={busy === 'backup'}
            data-testid="escooter-backup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wide cursor-pointer"
          >
            {busy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
            {backupTaken ? 'Snapshot saved — take again' : 'Save diagnostic snapshot'}
          </button>
        </div>

        {/* Flashing warning + downloads */}
        <div className="rounded-2xl border border-amber-600/40 bg-amber-950/20 p-4 space-y-3">
          <div className="text-xs font-black uppercase tracking-wide text-amber-300">Step 2 — download stock firmware for the vendor tool</div>
          <label className="flex items-start gap-2 text-[11px] text-amber-100/90 cursor-pointer">
            <input
              type="checkbox"
              checked={riskAccepted}
              onChange={(e) => setRiskAccepted(e.target.checked)}
              data-testid="escooter-risk"
              className="accent-amber-500 mt-0.5"
            />
            I understand flashing the wrong image, or interrupting a flash, can brick the controller. I will flash with
            the vendor tool and keep the backup.
          </label>

          {!gate.allowed && (
            <ul className="text-[11px] text-amber-200/80 list-disc pl-5 space-y-0.5" data-testid="escooter-gate">
              {gate.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {flashTargets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {flashTargets.map(({ target, file }) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => runDownload(target, { target, version: file.version, url: file.downloadUrl, sha256: file.sha256 })}
                  disabled={busy === `download:${target}`}
                  data-testid={`escooter-download-${target}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-neutral-950 font-black text-[11px] uppercase tracking-wide cursor-pointer"
                >
                  {busy === `download:${target}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download stock {target.toUpperCase()} {file.version}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="…or paste a firmware file URL"
              data-testid="escooter-manual-url"
              className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
            <button
              type="button"
              onClick={downloadManual}
              disabled={busy === 'download:esc'}
              data-testid="escooter-download-manual"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 disabled:opacity-50 text-neutral-200 font-bold text-[11px] uppercase cursor-pointer"
            >
              {busy === 'download:esc' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download
            </button>
          </div>
        </div>

        {/* Full diagnostic sweep */}
        <div className="rounded-2xl border border-neutral-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-wide text-neutral-300">Full diagnostic sweep</div>
            <button
              type="button"
              onClick={runSweep}
              disabled={busy === 'sweep'}
              data-testid="escooter-sweep"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wide cursor-pointer"
            >
              {busy === 'sweep' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              Run full diagnostic
            </button>
          </div>
          {report && (
            <div data-testid="escooter-report" className="space-y-2">
              <div className={`inline-flex px-3 py-1 rounded-full text-[11px] font-black uppercase border ${verdictTone[report.verdict]}`}>
                {report.verdict === 'unsupported' ? 'Protocol unsupported · health not assessed' : `${report.verdict} · ${report.score}/100`}
              </div>
              <ul className="space-y-1">
                {report.checks.map((c) => (
                  <li key={c.id} className="text-[11px] flex items-start gap-2 text-neutral-300" data-testid={`escooter-check-${c.id}`}>
                    {c.status === 'pass' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" /> : c.status === 'fail' ? <XCircle className="w-3.5 h-3.5 mt-0.5 text-rose-400 shrink-0" /> : c.status === 'warn' ? <CircleAlert className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" /> : <CircleAlert className="w-3.5 h-3.5 mt-0.5 text-neutral-500 shrink-0" />}
                    <span><strong>{c.label}:</strong> {c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {firmwareMsg && <p className="text-[11px] text-neutral-400 font-mono" data-testid="escooter-firmware-msg">{firmwareMsg}</p>}
      </div>

      {/* Telemetry gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricGauge label="Battery" icon={<BatteryCharging className="w-4 h-4" />} value={unsupportedProtocol ? '—' : `${telemetry.batteryPercent}%`} accent="text-emerald-400" testid="escooter-battery" />
        <MetricGauge label="Voltage" icon={<Zap className="w-4 h-4" />} value={telemetry.voltage ? `${telemetry.voltage} V` : '—'} accent="text-sky-400" testid="escooter-voltage" />
        <MetricGauge label="Speed" icon={<Gauge className="w-4 h-4" />} value={unsupportedProtocol ? '—' : `${telemetry.speedKmh} km/h`} accent="text-amber-400" testid="escooter-speed" />
        <MetricGauge label="Controller" icon={<Cpu className="w-4 h-4" />} value={telemetry.controllerTempC ? `${telemetry.controllerTempC} °C` : '—'} accent="text-fuchsia-400" testid="escooter-temp" />
      </div>

      {unsupportedProtocol && (
        <p className="text-xs text-amber-300" data-testid="escooter-unsupported">
          Bluetooth is connected. This controller protocol is not supported yet: battery, speed, fault checks, firmware versions, lock and lights are unavailable. No data received does not mean the scooter is damaged.
        </p>
      )}
      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={toggleLock}
          disabled={!telemetry.connected || (!isDemoMode && !driver.buildLockCommand)}
          data-testid="escooter-lock"
          className={`inline-flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            telemetry.isLocked
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
          }`}
        >
          {telemetry.isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
          {telemetry.isLocked ? 'Locked (motor cut)' : 'Lock scooter'}
        </button>

        <button
          type="button"
          onClick={toggleHeadlight}
          disabled={!telemetry.connected || (!isDemoMode && !driver.buildHeadlightCommand)}
          data-testid="escooter-headlight"
          className={`inline-flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            telemetry.headlightOn
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          {telemetry.headlightOn ? 'Headlight on' : 'Toggle headlight'}
        </button>
      </div>

      {/* Raw bus readout */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-neutral-500 mb-1.5">
          <BluetoothOff className="w-3.5 h-3.5" /> Raw HEX bus readout
        </div>
        <code className="text-[12px] font-mono text-emerald-400/90 break-all block" data-testid="escooter-raw">
          {telemetry.rawHexRx || 'Waiting for scooter data — no bytes received.'}
        </code>
        <div className="mt-2 text-[11px] text-neutral-500 font-mono">
          Driver: {driver.label}
        </div>
      </div>

      {!isDemoMode && sessionRef.current && (
        <div className="rounded-2xl border border-amber-500/30 p-4 space-y-3" data-testid="escooter-gatt-profile">
          <h4 className="font-bold text-sm">BLE connection evidence</h4>
          <p className="text-xs text-neutral-400">Records the selected device’s advertising data, Bluetooth channels, connection timing and incoming packets. Export remains available after an unexpected disconnect.</p>
          <details>
            <summary className="cursor-pointer text-xs text-amber-300">Show Bluetooth profile</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-neutral-400">{JSON.stringify(sessionRef.current.diagnosticCapture(), null, 2)}</pre>
          </details>
          <button type="button" className="text-xs font-bold text-emerald-300" data-testid="escooter-export-ble" onClick={() => {
            const capture = sessionRef.current?.diagnosticCapture();
            if (!capture) return;
            try {
              deps.saver.save(new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' }), 'stakeys-ble-connection.json');
              setStatus('BLE connection report exported. Share this JSON to investigate the controller protocol.');
            } catch {
              setStatus('Report export failed. Open Show Bluetooth profile to view the connection evidence.');
            }
          }}>Export BLE connection report</button>
        </div>
      )}
      {/* Safety notice — this writes to real hardware */}
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 flex items-start gap-3 text-xs text-amber-200/90">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-amber-300 block mb-0.5">Workshop safety</strong>
          Only connect to a machine on the bench with the wheel clear of the ground and the rider off it. Lock and
          headlight commands write to the live controller — never send them to a customer's scooter that is switched on
          and in use. Web Bluetooth needs Chrome or Edge; iOS Safari does not support it.
        </div>
      </div>
    </div>
  );
};

const MetricGauge: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: string;
  accent: string;
  testid: string;
}> = ({ label, icon, value, accent, testid }) => (
  <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-500 mb-1.5">
      {icon} {label}
    </div>
    <div className={`font-display text-xl font-black ${accent}`} data-testid={testid}>
      {value}
    </div>
  </div>
);

export default EscooterDiagnosticTile;
