/**
 * Universal e-scooter / e-bike BLE protocol engine.
 *
 * Each protocol family is a `ScooterDriver`: it knows its GATT UUIDs, how to
 * build the frames the controller expects, and how to parse the notification
 * bytes it sends back. Frame construction, byte parsing and the checksum are
 * plain pure functions, so they can be exercised in tests without hardware;
 * only `ScooterBleSession` touches `navigator.bluetooth`, and it takes the
 * Bluetooth host as an injected dependency for the same reason.
 *
 * Protocol references:
 * - Xiaomi / Ninebot (M365 family): `55 AA` framed serial protocol carried over
 *   the Nordic UART GATT service. Frames are `55 AA | len | addr | cmd | payload
 *   | checksum(2, little-endian)`, where the checksum is the 16-bit one's
 *   complement of the byte sum (`0xFFFF - sum`).
 * - MiniRobot / AOVO clones: `A5` framed fixed-layout telemetry.
 * - Generic UART: passthrough, hex only.
 */

export type ScooterFamily = 'Xiaomi/Ninebot' | 'MiniRobot' | 'Generic UART';

export interface ScooterTelemetry {
  connected: boolean;
  deviceName: string;
  protocolFamily: ScooterFamily | 'Disconnected';
  speedKmh: number;
  batteryPercent: number;
  voltage: number;
  currentAmps: number;
  controllerTempC: number;
  isLocked: boolean;
  headlightOn: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  rawHexRx: string;
}

export function createEmptyTelemetry(): ScooterTelemetry {
  return {
    connected: false,
    deviceName: '',
    protocolFamily: 'Disconnected',
    speedKmh: 0,
    batteryPercent: 0,
    voltage: 0,
    currentAmps: 0,
    controllerTempC: 0,
    isLocked: false,
    headlightOn: false,
    errorCode: null,
    errorMessage: null,
    rawHexRx: '',
  };
}

/** Human-readable fault text for the Xiaomi / Ninebot ESC fault codes. */
export const XIAOMI_NINEBOT_ERRORS: Record<number, string> = {
  10: 'BMS communication error (check battery data cable / pinout)',
  14: 'Throttle hall sensor error (check accelerator wiring and lever)',
  15: 'Brake hall sensor error (check brake lever wiring and sensor)',
  18: 'Motor hall sensor fault (check motor phase lines and hall connectors)',
  21: 'BMS communications fault (check battery cable pinout)',
  24: 'System supply voltage abnormal (check battery voltage under load)',
  35: 'Throttle hall sensor error (check accelerator wiring and lever)',
  39: 'Temperature sensor error',
  40: 'Controller over-temperature threshold exceeded (cool and retest)',
};

/** Fault bit values for MiniRobot / AOVO clone controllers. */
export const MINIROBOT_ERRORS: Record<number, string> = {
  1: 'Motor phase cable fault',
  2: 'Throttle sensor abnormal',
  3: 'Brake lever sensor fault',
  4: 'Battery low-voltage cutoff',
  5: 'Controller over-temperature',
  6: 'Motor hall sensor signal loss',
};

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Read a DataView into a plain byte array honouring the view's own offset and
 * length. `characteristicvaluechanged` hands back a DataView that can sit inside
 * a larger ArrayBuffer, so `new Uint8Array(view.buffer)` alone would read the
 * wrong bytes.
 */
export function dataViewToBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

// ---------------------------------------------------------------------------
// Driver contract
// ---------------------------------------------------------------------------

export interface ParsedNotification extends Partial<ScooterTelemetry> {
  rawHexRx: string;
}

/** Which processor on the scooter a firmware version belongs to. */
export type FirmwareTarget = 'esc' | 'bms' | 'ble';

/** A single firmware-version reading returned by a controller. */
export interface VersionReading {
  target: FirmwareTarget;
  /** Dotted version string, e.g. "1.5.1". */
  version: string;
  rawHex: string;
}

export interface ScooterDriver {
  family: ScooterFamily;
  label: string;
  serviceUuid: string;
  writeUuid: string;
  notifyUuid: string;
  /** True when the advertised name / service UUIDs look like this family. */
  matches(deviceName: string, serviceUuids: string[]): boolean;
  parseNotification(view: DataView): ParsedNotification;
  /** Encode a status notification. Used by the simulator and round-trip tests. */
  encodeStatus(telemetry: ScooterTelemetry): Uint8Array;
  buildLockCommand?(locked: boolean): Uint8Array;
  buildHeadlightCommand?(on: boolean): Uint8Array;
  /**
   * Build the frame that asks the controller for a processor's firmware
   * version. Returns `null` for targets this protocol cannot read (the caller
   * then reports "not readable", never a guessed version).
   */
  buildVersionQuery?(target: FirmwareTarget): Uint8Array | null;
  /** Decode a version reply, or `null` if the frame is not a version reply. */
  parseVersionResponse?(view: DataView): VersionReading | null;
  /** Encode a version reply. Used by the simulator and round-trip tests. */
  encodeVersionResponse?(target: FirmwareTarget, version: string): Uint8Array;
}

const NORDIC_UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

// ---------------------------------------------------------------------------
// Driver 1: Xiaomi / Ninebot (0x55 0xAA framed)
// ---------------------------------------------------------------------------

const XIAOMI_HEADER = [0x55, 0xaa];
/** Status notification command byte for the 0x20 read-status response. */
const XIAOMI_CMD_STATUS = 0x20;
const XIAOMI_ADDR_ESC = 0x20;

/**
 * Version-read command bytes (address 0x20). The reply carries the same command
 * byte with bit 7 set, e.g. a 0x1A query is answered by a 0x9A reply.
 */
const XIAOMI_VERSION_CMD: Record<FirmwareTarget, number> = { esc: 0x1a, bms: 0x1b, ble: 0x1c };
/** The address byte that identifies each target inside a version frame. */
const XIAOMI_VERSION_TARGET_BYTE: Record<FirmwareTarget, number> = { esc: 0x20, bms: 0x22, ble: 0x24 };
const XIAOMI_VERSION_CMD_REPLY = new Set(Object.values(XIAOMI_VERSION_CMD).map((c) => c | 0x80));
const XIAOMI_TARGET_BY_REPLY_CMD: Record<number, FirmwareTarget> = {
  0x9a: 'esc',
  0x9b: 'bms',
  0x9c: 'ble',
};

/** Encode a 4-byte payload: target, major, minor, patch. */
function encodeVersionPayload(target: FirmwareTarget, version: string): number[] {
  const [maj = 0, min = 0, patch = 0] = version
    .split('.')
    .map((n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0)));
  return [XIAOMI_VERSION_TARGET_BYTE[target], maj, min, patch];
}

/** Decode a version payload: binary [maj,min,patch] or ASCII ("1.5.1"). */
function decodeVersionPayload(payload: Uint8Array): string | null {
  if (payload.length < 3) return null;
  // A printable leading digit means the controller sent an ASCII version.
  if (payload[0] >= 0x30 && payload[0] <= 0x39) {
    return Array.from(payload.slice(0, 4))
      .filter((b) => b !== 0)
      .map((b) => String.fromCharCode(b))
      .join('');
  }
  return `${payload[0]}.${payload[1]}.${payload[2]}`;
}

export const XiaomiNinebotDriver: ScooterDriver = {
  family: 'Xiaomi/Ninebot',
  label: 'Xiaomi / Ninebot (M365 family)',
  serviceUuid: NORDIC_UART,
  writeUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  notifyUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',

  matches(name, serviceUuids) {
    const n = name.toLowerCase();
    if (/nb-|xiaomi|ninebot|m365|mi scooter|segway|mi[-_ ]?pro|mi[-_ ]?essential|mi[-_ ]?3|mi[-_ ]?4/.test(n)) return true;
    return serviceUuids.includes(NORDIC_UART);
  },

  parseNotification(view: DataView): ParsedNotification {
    const bytes = dataViewToBytes(view);
    const rawHexRx = bytesToHex(bytes);
    if (bytes.length < 9 || bytes[0] !== XIAOMI_HEADER[0] || bytes[1] !== XIAOMI_HEADER[1]) {
      return { rawHexRx };
    }
    const cmd = bytes[4];
    if (cmd !== XIAOMI_CMD_STATUS) return { rawHexRx };

    const payload = bytes.slice(5, bytes.length - 2);
    if (payload.length < 8) return { rawHexRx };

    const speedRaw = payload[0] | (payload[1] << 8);
    const voltageRaw = payload[3] | (payload[4] << 8);
    const flags = payload[7];
    const errorCode = payload[6];

    return {
      speedKmh: Number((speedRaw / 1000).toFixed(1)),
      batteryPercent: Math.min(100, Math.max(0, payload[2])),
      voltage: Number((voltageRaw / 100).toFixed(1)),
      controllerTempC: payload[5],
      isLocked: (flags & 0x01) !== 0,
      headlightOn: (flags & 0x02) !== 0,
      errorCode: errorCode !== 0 ? errorCode : null,
      errorMessage:
        errorCode !== 0 ? XIAOMI_NINEBOT_ERRORS[errorCode] || `Unknown hardware fault (code ${errorCode})` : null,
      rawHexRx,
    };
  },

  encodeStatus(t): Uint8Array {
    const speedRaw = Math.round(t.speedKmh * 1000) & 0xffff;
    const voltageRaw = Math.round(t.voltage * 100) & 0xffff;
    const flags = (t.isLocked ? 0x01 : 0) | (t.headlightOn ? 0x02 : 0);
    const payload = [
      speedRaw & 0xff,
      (speedRaw >> 8) & 0xff,
      Math.max(0, Math.min(100, Math.round(t.batteryPercent))),
      voltageRaw & 0xff,
      (voltageRaw >> 8) & 0xff,
      Math.max(0, Math.min(255, Math.round(t.controllerTempC))),
      t.errorCode ? t.errorCode & 0xff : 0,
      flags,
    ];
    const body = [payload.length + 2, XIAOMI_ADDR_ESC, XIAOMI_CMD_STATUS, ...payload];
    const checksum = xiaomiChecksum(body);
    return new Uint8Array([...XIAOMI_HEADER, ...body, ...checksum]);
  },

  buildLockCommand(locked: boolean): Uint8Array {
    const body = [0x05, XIAOMI_ADDR_ESC, 0x70, locked ? 0x01 : 0x00];
    return new Uint8Array([...XIAOMI_HEADER, ...body, ...xiaomiChecksum(body)]);
  },

  buildHeadlightCommand(on: boolean): Uint8Array {
    const body = [0x05, XIAOMI_ADDR_ESC, 0x71, on ? 0x01 : 0x00];
    return new Uint8Array([...XIAOMI_HEADER, ...body, ...xiaomiChecksum(body)]);
  },

  buildVersionQuery(target: FirmwareTarget): Uint8Array {
    // Payload is a single target byte; the body length field is payload + 2.
    const body = [0x03, XIAOMI_ADDR_ESC, XIAOMI_VERSION_CMD[target], XIAOMI_VERSION_TARGET_BYTE[target]];
    return new Uint8Array([...XIAOMI_HEADER, ...body, ...xiaomiChecksum(body)]);
  },

  parseVersionResponse(view: DataView): VersionReading | null {
    const bytes = dataViewToBytes(view);
    if (bytes.length < 9 || bytes[0] !== XIAOMI_HEADER[0] || bytes[1] !== XIAOMI_HEADER[1]) return null;
    const cmd = bytes[4];
    if (!XIAOMI_VERSION_CMD_REPLY.has(cmd)) return null;
    const target = XIAOMI_TARGET_BY_REPLY_CMD[cmd];
    // byte[5] is the target address; the version bytes follow it.
    const payload = bytes.slice(6, bytes.length - 2);
    const version = decodeVersionPayload(payload);
    if (!target || !version) return null;
    return { target, version, rawHex: bytesToHex(bytes) };
  },

  encodeVersionResponse(target: FirmwareTarget, version: string): Uint8Array {
    const payload = encodeVersionPayload(target, version);
    const cmd = XIAOMI_VERSION_CMD[target] | 0x80;
    const body = [payload.length + 2, XIAOMI_ADDR_ESC, cmd, ...payload];
    return new Uint8Array([...XIAOMI_HEADER, ...body, ...xiaomiChecksum(body)]);
  },
};

/** 16-bit one's-complement checksum (`0xFFFF - sum`), little-endian. */
export function xiaomiChecksum(bytes: ArrayLike<number>): [number, number] {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum += bytes[i];
  const chk = (0xffff - (sum & 0xffff)) & 0xffff;
  return [chk & 0xff, (chk >> 8) & 0xff];
}

// ---------------------------------------------------------------------------
// Driver 2: MiniRobot / AOVO clones (0xA5 framed)
// ---------------------------------------------------------------------------

export const MiniRobotDriver: ScooterDriver = {
  family: 'MiniRobot',
  label: 'MiniRobot / AOVO clone',
  serviceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
  writeUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
  notifyUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',

  matches(name) {
    return /aovo|minirobot|hb-|smart scooter|evercross[-_ ]?h[0-9]|isinwheel[-_ ]?s[0-9]/.test(name.toLowerCase());
  },

  parseNotification(view: DataView): ParsedNotification {
    const bytes = dataViewToBytes(view);
    const rawHexRx = bytesToHex(bytes);
    if (bytes.length < 6 || (bytes[0] !== 0xa5 && bytes[0] !== 0xab)) {
      return { rawHexRx };
    }
    const statusFlags = bytes[4];
    const errBitmask = bytes[5];
    return {
      speedKmh: Number((bytes[2] || 0).toFixed(1)),
      batteryPercent: Math.min(100, Math.max(0, bytes[3] || 0)),
      isLocked: (statusFlags & 0x01) !== 0,
      headlightOn: (statusFlags & 0x02) !== 0,
      errorCode: errBitmask !== 0 ? errBitmask : null,
      errorMessage:
        errBitmask !== 0
          ? MINIROBOT_ERRORS[errBitmask] || `MiniRobot controller fault bit: ${errBitmask}`
          : null,
      rawHexRx,
    };
  },

  encodeStatus(t): Uint8Array {
    const flags = (t.isLocked ? 0x01 : 0) | (t.headlightOn ? 0x02 : 0);
    return new Uint8Array([
      0xa5,
      0x06,
      Math.max(0, Math.min(255, Math.round(t.speedKmh))),
      Math.max(0, Math.min(100, Math.round(t.batteryPercent))),
      flags,
      t.errorCode ? t.errorCode & 0xff : 0,
    ]);
  },

  buildHeadlightCommand(on: boolean): Uint8Array {
    return new Uint8Array([0xa5, 0x02, 0x01, on ? 0x01 : 0x00, 0x5a]);
  },

  buildLockCommand(locked: boolean): Uint8Array {
    return new Uint8Array([0xa5, 0x02, 0x02, locked ? 0x01 : 0x00, 0x5a]);
  },

  buildVersionQuery(target: FirmwareTarget): Uint8Array | null {
    // MiniRobot exposes ESC/BMS versions only; BLE reports "not readable".
    if (target === 'ble') return null;
    return new Uint8Array([0xa5, 0x02, 0x10, target === 'esc' ? 0x01 : 0x02, 0x5a]);
  },

  parseVersionResponse(view: DataView): VersionReading | null {
    const bytes = dataViewToBytes(view);
    if (bytes.length < 6 || bytes[0] !== 0xa5 || bytes[2] !== 0x10) return null;
    const target: FirmwareTarget = bytes[3] === 0x02 ? 'bms' : 'esc';
    return { target, version: `${bytes[4]}.${bytes[5]}.0`, rawHex: bytesToHex(bytes) };
  },

  encodeVersionResponse(target: FirmwareTarget, version: string): Uint8Array {
    const [maj = 0, min = 0] = version.split('.').map((n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0)));
    return new Uint8Array([0xa5, 0x06, 0x10, target === 'bms' ? 0x02 : 0x01, maj, min]);
  },
};

// ---------------------------------------------------------------------------
// Driver 3: Generic UART passthrough
// ---------------------------------------------------------------------------

export const GenericUartDriver: ScooterDriver = {
  family: 'Generic UART',
  label: 'Generic UART (raw passthrough)',
  serviceUuid: NORDIC_UART,
  writeUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  notifyUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  matches() {
    return true;
  },
  parseNotification(view: DataView): ParsedNotification {
    return { rawHexRx: bytesToHex(dataViewToBytes(view)) };
  },
  encodeStatus() {
    return new Uint8Array();
  },
};

export const SCOOTER_DRIVERS: ScooterDriver[] = [
  XiaomiNinebotDriver,
  MiniRobotDriver,
  GenericUartDriver,
];

/** Pick the most specific driver for a discovered device. */
export function detectDriver(deviceName: string, serviceUuids: string[] = []): ScooterDriver {
  return (
    SCOOTER_DRIVERS.find((d) => d.family !== 'Generic UART' && d.matches(deviceName, serviceUuids)) ||
    GenericUartDriver
  );
}

/** Conservative BLE admission check. UART alone is not proof of a scooter. */
export function isRecognisedScooter(name: string): boolean {
  return /(?:xiaomi|ninebot|segway|m365|mi[ -]?scooter|^nb[-_ ]|minirobot|aovo|kugoo|kukirin|iscooter|isinwheel|pure[ -]?air|e[ -]?scooter|scooter|hiboy|gotrax|joyor|vsett|inokim|dualtron|kaabo|niu[ -]?kqi|^kqi[0-9])/i.test(name.trim());
}

export function errorTextFor(family: ScooterFamily, code: number): string {
  if (family === 'MiniRobot') return MINIROBOT_ERRORS[code] || `MiniRobot controller fault bit: ${code}`;
  if (family === 'Xiaomi/Ninebot') return XIAOMI_NINEBOT_ERRORS[code] || `Unknown hardware fault (code ${code})`;
  return `Fault code ${code}`;
}

// ---------------------------------------------------------------------------
// Web Bluetooth session (dependency-injected host)
// ---------------------------------------------------------------------------

export interface BleCharacteristicLike {
  startNotifications(): Promise<BleCharacteristicLike>;
  writeValue(value: Uint8Array): Promise<void>;
  addEventListener(type: 'characteristicvaluechanged', listener: (event: { target: { value: DataView } }) => void): void;
  value?: DataView;
}

export interface BleServiceLike {
  getCharacteristic(uuid: string): Promise<BleCharacteristicLike>;
}

export interface BleServerLike {
  connected: boolean;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleServiceLike>;
}

export interface BleDeviceLike {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<BleServerLike>;
    disconnect(): void;
  };
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

export interface BluetoothHost {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[]; namePrefix?: string }>;
    optionalServices?: string[];
  }): Promise<BleDeviceLike>;
}

export interface ScooterSessionCallbacks {
  onTelemetry(patch: Partial<ScooterTelemetry>): void;
  onDisconnect(): void;
}

/**
 * Drives a live BLE session: requests a device, connects GATT, resolves the
 * right driver, subscribes to notifications and writes control frames. The
 * Bluetooth host is injected so the whole flow can be tested against a fake
 * host that exercises the real frame builders and parsers.
 */
export class ScooterBleSession {
  private host: BluetoothHost;
  private callbacks: ScooterSessionCallbacks;
  private server: BleServerLike | null = null;
  private writeChar: BleCharacteristicLike | null = null;
  private driver: ScooterDriver = GenericUartDriver;
  private versionWaiters: Array<{
    target: FirmwareTarget;
    resolve: (r: VersionReading | null) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(host: BluetoothHost, callbacks: ScooterSessionCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
  }

  get activeDriver(): ScooterDriver {
    return this.driver;
  }

  get connected(): boolean {
    return Boolean(this.server?.connected);
  }

  async connect(): Promise<ScooterTelemetry['protocolFamily']> {
    const device = await this.host.requestDevice({
      filters: [{ namePrefix: 'Ninebot' }, { namePrefix: 'Xiaomi' }, { namePrefix: 'M365' }, { namePrefix: 'AOVO' }, { namePrefix: 'Scooter' }, { namePrefix: 'Segway' }, { namePrefix: 'Kugoo' }, { namePrefix: 'iScooter' }, { namePrefix: 'NIU' }, { namePrefix: 'Mi' }, { namePrefix: 'NB-' }, { namePrefix: 'MiniRobot' }],
      optionalServices: [XiaomiNinebotDriver.serviceUuid, MiniRobotDriver.serviceUuid],
    });
    if (!isRecognisedScooter(device.name || '')) throw new Error('This Bluetooth device is not recognised as an e-scooter. Select a supported scooter broadcasting its model name.');
    if (!device.gatt) throw new Error('Device does not expose a GATT server');

    device.addEventListener('gattserverdisconnected', () => {
      this.server = null;
      this.writeChar = null;
      this.callbacks.onDisconnect();
    });

    const name = device.name || '';
    const namedDriver = detectDriver(name, []);
    // Many rebadged scooters advertise a different brand but share one of the
    // two supported GATT layouts. Probe service availability rather than
    // guessing the controller protocol from branding alone.
    const candidates = namedDriver.family === 'Generic UART'
      ? [XiaomiNinebotDriver, MiniRobotDriver]
      : [namedDriver];
    let driver: ScooterDriver = namedDriver;
    let server: BleServerLike;
    try {
      server = await device.gatt.connect();
      this.server = server;
      let notifyChar: BleCharacteristicLike | null = null;
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          const service = await server.getPrimaryService(candidate.serviceUuid);
          const notify = await service.getCharacteristic(candidate.notifyUuid);
          const write = candidate.writeUuid === candidate.notifyUuid ? notify : await service.getCharacteristic(candidate.writeUuid);
          await notify.startNotifications();
          driver = candidate;
          this.driver = candidate;
          this.writeChar = write;
          notifyChar = notify;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!notifyChar) throw new Error('No compatible Xiaomi/Ninebot or MiniRobot BLE service was found on this scooter. ' + (lastError instanceof Error ? lastError.message : ''));

      notifyChar.addEventListener('characteristicvaluechanged', (event) => {
        const reading = this.driver.parseVersionResponse?.(event.target.value) ?? null;
        if (reading) this.resolveVersion(reading);
        this.callbacks.onTelemetry(this.driver.parseNotification(event.target.value));
      });
    } catch (error) {
      this.disconnect();
      throw error;
    }

    return driver.family;
  }

  private resolveVersion(reading: VersionReading): void {
    const idx = this.versionWaiters.findIndex((w) => w.target === reading.target);
    if (idx === -1) return;
    const [waiter] = this.versionWaiters.splice(idx, 1);
    clearTimeout(waiter.timer);
    waiter.resolve(reading);
  }

  /**
   * Ask the controller for a processor's firmware version. Resolves with the
   * reading, or `null` when this protocol has no version command, or the
   * controller does not answer before `timeoutMs`. Never guesses.
   */
  async readVersion(target: FirmwareTarget, timeoutMs = 1500): Promise<VersionReading | null> {
    if (!this.writeChar || !this.driver.buildVersionQuery) return null;
    const query = this.driver.buildVersionQuery(target);
    if (!query) return null;
    return new Promise<VersionReading | null>((resolve) => {
      const timer = setTimeout(() => {
        this.versionWaiters = this.versionWaiters.filter((w) => w.timer !== timer);
        resolve(null);
      }, timeoutMs);
      // Register the waiter *before* writing: a fast controller can answer in
      // the same tick as the write, and the reply must find the waiter there.
      this.versionWaiters.push({ target, resolve, timer });
      void this.writeChar!.writeValue(query).catch(() => {
        clearTimeout(timer);
        this.versionWaiters = this.versionWaiters.filter((w) => w.timer !== timer);
        resolve(null);
      });
    });
  }

  /** Read every processor version this protocol supports, in order. */
  async readAllVersions(timeoutMs = 1500): Promise<VersionReading[]> {
    const targets: FirmwareTarget[] = ['esc', 'bms', 'ble'];
    const out: VersionReading[] = [];
    for (const target of targets) {
      const reading = await this.readVersion(target, timeoutMs);
      if (reading) out.push(reading);
    }
    return out;
  }

  disconnect(): void {
    if (this.server) this.server.disconnect();
    this.server = null;
    this.writeChar = null;
  }

  async setLock(locked: boolean): Promise<boolean> {
    if (!this.writeChar || !this.driver.buildLockCommand) return false;
    await this.writeChar.writeValue(this.driver.buildLockCommand(locked));
    return true;
  }

  async setHeadlight(on: boolean): Promise<boolean> {
    if (!this.writeChar || !this.driver.buildHeadlightCommand) return false;
    await this.writeChar.writeValue(this.driver.buildHeadlightCommand(on));
    return true;
  }
}
