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
}

const NORDIC_UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

// ---------------------------------------------------------------------------
// Driver 1: Xiaomi / Ninebot (0x55 0xAA framed)
// ---------------------------------------------------------------------------

const XIAOMI_HEADER = [0x55, 0xaa];
/** Status notification command byte for the 0x20 read-status response. */
const XIAOMI_CMD_STATUS = 0x20;
const XIAOMI_ADDR_ESC = 0x20;

export const XiaomiNinebotDriver: ScooterDriver = {
  family: 'Xiaomi/Ninebot',
  label: 'Xiaomi / Ninebot (M365 family)',
  serviceUuid: NORDIC_UART,
  writeUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  notifyUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',

  matches(name, serviceUuids) {
    const n = name.toLowerCase();
    if (/nb-|xiaomi|ninebot|m365|mi scooter|segway/.test(n)) return true;
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
    return /aovo|minirobot|hb-|smart scooter/.test(name.toLowerCase());
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
    filters?: Array<{ services?: string[] }>;
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
      acceptAllDevices: true,
      optionalServices: [XiaomiNinebotDriver.serviceUuid, MiniRobotDriver.serviceUuid],
    });
    if (!device.gatt) throw new Error('Device does not expose a GATT server');

    device.addEventListener('gattserverdisconnected', () => {
      this.server = null;
      this.writeChar = null;
      this.callbacks.onDisconnect();
    });

    const server = await device.gatt.connect();
    this.server = server;

    const name = device.name || 'Unknown scooter';
    const driver = detectDriver(name, []);
    this.driver = driver;

    const service = await server.getPrimaryService(driver.serviceUuid);
    const notifyChar = await service.getCharacteristic(driver.notifyUuid);
    this.writeChar = driver.writeUuid === driver.notifyUuid ? notifyChar : await service.getCharacteristic(driver.writeUuid);

    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', (event) => {
      const parsed = this.driver.parseNotification(event.target.value);
      this.callbacks.onTelemetry(parsed);
    });

    return driver.family;
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
