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
} from 'lucide-react';
import {
  createEmptyTelemetry,
  ScooterBleSession,
  detectDriver,
  errorTextFor,
  type BluetoothHost,
  type ScooterDriver,
  type ScooterFamily,
  type ScooterTelemetry,
} from '../utils/scooterProtocols';
import { createNativeBluetoothHost } from '../utils/bleHost';

interface EscooterDiagnosticTileProps {
  /**
   * Bluetooth host. Defaults to `navigator.bluetooth`. Injected in tests (and by
   * any environment that provides its own transport) so the tile is exercisable
   * without a radio.
   */
  bluetoothHost?: BluetoothHost;
  /** Open in simulator mode — useful for training and demos. */
  startInDemo?: boolean;
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
}) => {
  const host = useMemo(() => bluetoothHost ?? getNavigatorBluetooth(), [bluetoothHost]);
  const [telemetry, setTelemetry] = useState<ScooterTelemetry>(createEmptyTelemetry);
  const [isScanning, setIsScanning] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(startInDemo);
  const [status, setStatus] = useState<string>('');
  const [family, setFamily] = useState<ScooterFamily | 'Disconnected'>('Disconnected');

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
          setStatus('Device disconnected.');
        },
      });
      sessionRef.current = session;
      const connectedFamily = await session.connect();
      setFamily(connectedFamily);
      setTelemetry((prev) => ({
        ...prev,
        connected: true,
        protocolFamily: connectedFamily,
        deviceName: session.activeDriver.label,
      }));
      setStatus(`Connected via ${session.activeDriver.label}.`);
    } catch (err) {
      setStatus(err instanceof Error ? `Connection failed: ${err.message}` : 'Connection failed.');
      setTelemetry(createEmptyTelemetry());
      setFamily('Disconnected');
    } finally {
      setIsScanning(false);
    }
  }, [host]);

  const disconnect = useCallback(() => {
    teardown();
    setTelemetry(createEmptyTelemetry());
    setFamily('Disconnected');
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

  const driver: ScooterDriver = detectDriver(telemetry.deviceName, []);

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
              disabled={isScanning || isDemoMode}
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

          {status && <span className="text-[11px] text-neutral-500 font-mono">{status}</span>}
        </div>
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

      {/* Telemetry gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricGauge label="Battery" icon={<BatteryCharging className="w-4 h-4" />} value={`${telemetry.batteryPercent}%`} accent="text-emerald-400" testid="escooter-battery" />
        <MetricGauge label="Voltage" icon={<Zap className="w-4 h-4" />} value={telemetry.voltage ? `${telemetry.voltage} V` : '—'} accent="text-sky-400" testid="escooter-voltage" />
        <MetricGauge label="Speed" icon={<Gauge className="w-4 h-4" />} value={`${telemetry.speedKmh} km/h`} accent="text-amber-400" testid="escooter-speed" />
        <MetricGauge label="Controller" icon={<Cpu className="w-4 h-4" />} value={telemetry.controllerTempC ? `${telemetry.controllerTempC} °C` : '—'} accent="text-fuchsia-400" testid="escooter-temp" />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={toggleLock}
          disabled={!telemetry.connected}
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
          disabled={!telemetry.connected}
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
          {telemetry.rawHexRx || '00 00 00 00 00 00 00 00'}
        </code>
        <div className="mt-2 text-[11px] text-neutral-500 font-mono">
          Driver: {driver.label}
        </div>
      </div>

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
