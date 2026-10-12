import { describe, it, expect, vi } from 'vitest';
import {
  XiaomiNinebotDriver,
  MiniRobotDriver,
  GenericUartDriver,
  detectDriver,
  xiaomiChecksum,
  bytesToHex,
  hexToBytes,
  dataViewToBytes,
  createEmptyTelemetry,
  ScooterBleSession,
  type BluetoothHost,
  type BleCharacteristicLike,
  type ScooterTelemetry,
} from './src/utils/scooterProtocols';

/** Wrap bytes in a DataView that sits inside a larger buffer at an offset. */
function viewAt(bytes: number[], offset = 0): DataView {
  const buf = new Uint8Array(offset + bytes.length + 3);
  buf.set(bytes, offset);
  return new DataView(buf.buffer, offset, bytes.length);
}

function sampleTelemetry(over: Partial<ScooterTelemetry> = {}): ScooterTelemetry {
  return {
    ...createEmptyTelemetry(),
    connected: true,
    deviceName: 'M365',
    protocolFamily: 'Xiaomi/Ninebot',
    speedKmh: 18.4,
    batteryPercent: 78,
    voltage: 38.2,
    controllerTempC: 34,
    isLocked: false,
    headlightOn: true,
    errorCode: 14,
    ...over,
  };
}

describe('scooter byte helpers', () => {
  it('round-trips bytes to hex and back', () => {
    const bytes = [0x55, 0xaa, 0x00, 0x0f, 0xff];
    expect(bytesToHex(new Uint8Array(bytes))).toBe('55 aa 00 0f ff');
    expect(Array.from(hexToBytes('55 aa 00 0f ff'))).toEqual(bytes);
  });

  it('reads a DataView honouring its byteOffset', () => {
    const view = viewAt([0xaa, 0xbb, 0xcc], 4);
    expect(Array.from(dataViewToBytes(view))).toEqual([0xaa, 0xbb, 0xcc]);
  });
});

describe('xiaomi checksum', () => {
  it('is the 16-bit one\u2019s complement of the byte sum, little-endian', () => {
    // 0x05+0x20+0x70+0x01 = 0x96 -> 0xFFFF-0x96 = 0xFF69 -> [0x69, 0xFF]
    expect(xiaomiChecksum([0x05, 0x20, 0x70, 0x01])).toEqual([0x69, 0xff]);
  });

  it('produces a frame whose checksum makes the whole body sum to 0xFFFF', () => {
    const frame = XiaomiNinebotDriver.buildLockCommand!(true);
    const body = Array.from(frame.slice(2, frame.length - 2));
    const lo = frame[frame.length - 2];
    const hi = frame[frame.length - 1];
    const checksum16 = lo | (hi << 8);
    const sum = body.reduce((a, b) => a + b, 0) + checksum16;
    expect(sum).toBe(0xffff);
  });
});

describe('Xiaomi / Ninebot driver', () => {
  it('builds exact lock and headlight frames', () => {
    expect(Array.from(XiaomiNinebotDriver.buildLockCommand!(true))).toEqual([0x55, 0xaa, 0x05, 0x20, 0x70, 0x01, 0x69, 0xff]);
    expect(Array.from(XiaomiNinebotDriver.buildLockCommand!(false))).toEqual([0x55, 0xaa, 0x05, 0x20, 0x70, 0x00, 0x6a, 0xff]);
    const light = XiaomiNinebotDriver.buildHeadlightCommand!(true);
    expect(Array.from(light.slice(0, 5))).toEqual([0x55, 0xaa, 0x05, 0x20, 0x71]);
  });

  it('round-trips telemetry through encode -> parse', () => {
    const t = sampleTelemetry();
    const frame = XiaomiNinebotDriver.encodeStatus(t);
    const parsed = XiaomiNinebotDriver.parseNotification(viewAt(Array.from(frame)));
    expect(parsed.speedKmh).toBe(18.4);
    expect(parsed.batteryPercent).toBe(78);
    expect(parsed.voltage).toBe(38.2);
    expect(parsed.controllerTempC).toBe(34);
    expect(parsed.isLocked).toBe(false);
    expect(parsed.headlightOn).toBe(true);
    expect(parsed.errorCode).toBe(14);
    expect(parsed.errorMessage).toMatch(/Throttle hall sensor/);
    expect(parsed.rawHexRx.startsWith('55 aa')).toBe(true);
  });

  it('decodes lock + headlight flags and clears the error when code is 0', () => {
    const frame = XiaomiNinebotDriver.encodeStatus(
      sampleTelemetry({ isLocked: true, headlightOn: false, errorCode: null })
    );
    const parsed = XiaomiNinebotDriver.parseNotification(viewAt(Array.from(frame)));
    expect(parsed.isLocked).toBe(true);
    expect(parsed.headlightOn).toBe(false);
    expect(parsed.errorCode).toBeNull();
    expect(parsed.errorMessage).toBeNull();
  });

  it('ignores frames that are not the 55 AA status response', () => {
    const noise = XiaomiNinebotDriver.parseNotification(viewAt([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]));
    expect(noise.errorCode).toBeUndefined();
    expect(noise.rawHexRx).toBe('01 02 03 04 05 06 07 08 09');
  });
});

describe('MiniRobot driver', () => {
  it('builds the headlight frame and decodes telemetry + fault bits', () => {
    expect(Array.from(MiniRobotDriver.buildHeadlightCommand!(true))).toEqual([0xa5, 0x02, 0x01, 0x01, 0x5a]);
    const parsed = MiniRobotDriver.parseNotification(viewAt([0xa5, 0x06, 20, 55, 0x03, 0x02]));
    expect(parsed.speedKmh).toBe(20);
    expect(parsed.batteryPercent).toBe(55);
    expect(parsed.isLocked).toBe(true);
    expect(parsed.headlightOn).toBe(true);
    expect(parsed.errorCode).toBe(2);
    expect(parsed.errorMessage).toMatch(/Throttle sensor/);
  });
});

describe('driver detection', () => {
  it('picks the family from the advertised name', () => {
    expect(detectDriver('Mi Scooter Pro 2').family).toBe('Xiaomi/Ninebot');
    expect(detectDriver('NB-1234').family).toBe('Xiaomi/Ninebot');
    expect(detectDriver('AOVO ES80').family).toBe('MiniRobot');
    expect(detectDriver('Some Unknown BLE Device').family).toBe('Generic UART');
  });

  it('falls back to the Nordic UART service UUID for Xiaomi', () => {
    expect(detectDriver('', ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']).family).toBe('Xiaomi/Ninebot');
  });

  it('generic passthrough only reports raw hex', () => {
    expect(GenericUartDriver.parseNotification(viewAt([0xde, 0xad, 0xbe, 0xef]))).toEqual({
      rawHexRx: 'de ad be ef',
    });
  });
});

// ---------------------------------------------------------------------------
// Live session against a fake Bluetooth host (exercises real builders/parsers)
// ---------------------------------------------------------------------------

class FakeCharacteristic implements BleCharacteristicLike {
  written: Uint8Array[] = [];
  listeners: Array<(e: { target: { value: DataView } }) => void> = [];
  started = false;

  async startNotifications() {
    this.started = true;
    return this;
  }
  async writeValue(value: Uint8Array) {
    this.written.push(value);
  }
  addEventListener(_t: 'characteristicvaluechanged', l: (e: { target: { value: DataView } }) => void) {
    this.listeners.push(l);
  }
  emit(view: DataView) {
    this.listeners.forEach((l) => l({ target: { value: view } }));
  }
}

class FakeServer {
  connected = true;
  constructor(private chars: Record<string, FakeCharacteristic>) {}
  async getPrimaryService() {
    return {
      getCharacteristic: async (uuid: string) => this.chars[uuid],
    };
  }
  disconnect() {
    this.connected = false;
  }
}

function makeFakeHost(name: string) {
  const chars: Record<string, FakeCharacteristic> = {};
  const add = (uuid: string) => (chars[uuid] = new FakeCharacteristic());
  add(XiaomiNinebotDriver.notifyUuid);
  add(XiaomiNinebotDriver.writeUuid);
  add(MiniRobotDriver.notifyUuid);
  const server = new FakeServer(chars);
  const host: BluetoothHost = {
    requestDevice: async () => ({
      name,
      gatt: { connected: true, connect: async () => server, disconnect: () => server.disconnect() },
      addEventListener: () => {},
    }),
  };
  return { host, chars, server };
}

describe('ScooterBleSession', () => {
  it('connects, subscribes and streams parsed telemetry', async () => {
    const { host, chars } = makeFakeHost('Mi Scooter Pro 2');
    const onTelemetry = vi.fn();
    const session = new ScooterBleSession(host, { onTelemetry, onDisconnect: vi.fn() });

    const family = await session.connect();
    expect(family).toBe('Xiaomi/Ninebot');
    expect(session.connected).toBe(true);

    const frame = XiaomiNinebotDriver.encodeStatus(sampleTelemetry({ errorCode: 21 }));
    chars[XiaomiNinebotDriver.notifyUuid].emit(viewAt(Array.from(frame)));

    expect(onTelemetry).toHaveBeenCalledTimes(1);
    const patch = onTelemetry.mock.calls[0][0];
    expect(patch.speedKmh).toBe(18.4);
    expect(patch.errorCode).toBe(21);
    expect(patch.errorMessage).toMatch(/BMS/);
  });

  it('writes a real lock frame when setLock is called', async () => {
    const { host, chars } = makeFakeHost('NB-4567');
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect();

    expect(await session.setLock(true)).toBe(true);
    const written = chars[XiaomiNinebotDriver.writeUuid].written.at(-1)!;
    expect(Array.from(written)).toEqual([0x55, 0xaa, 0x05, 0x20, 0x70, 0x01, 0x69, 0xff]);
  });

  it('reports a disconnect back to the caller', async () => {
    const { host } = makeFakeHost('AOVO ES80');
    const onDisconnect = vi.fn();
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect });
    await session.connect();
    expect(session.activeDriver.family).toBe('MiniRobot');
    session.disconnect();
    expect(onDisconnect).not.toHaveBeenCalled(); // disconnect() is the caller's own action
    expect(session.connected).toBe(false);
  });
});
