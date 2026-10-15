import { describe, it, expect, vi } from 'vitest';
import { CapacitorBluetoothHost } from './src/utils/bleHost';
import { ScooterBleSession, XiaomiNinebotDriver, createEmptyTelemetry } from './src/utils/scooterProtocols';

/**
 * Minimal fake of the Capacitor BLE plugin, recording every call so the
 * adapter's mapping onto our BluetoothHost contract can be asserted.
 */
function makeFakeBle() {
  const calls: Record<string, unknown[]> = { initialize: [], requestDevice: [], connect: [], write: [], startNotifications: [] };
  let notifyCb: ((value: DataView) => void) | null = null;
  let onDisconnect: ((id: string) => void) | null = null;
  const ble = {
    initialize: vi.fn(async (o: unknown) => void calls.initialize.push(o)),
    requestDevice: vi.fn(async (o: unknown) => {
      calls.requestDevice.push(o);
      return { deviceId: 'AA:BB:CC', name: 'Mi Scooter Pro 2' };
    }),
    connect: vi.fn(async (id: string, cb: (d: string) => void) => {
      calls.connect.push(id);
      onDisconnect = cb;
    }),
    disconnect: vi.fn(async () => {}),
    startNotifications: vi.fn(async (_d: string, _s: string, _c: string, cb: (v: DataView) => void) => {
      notifyCb = cb;
    }),
    write: vi.fn(async (_d: string, _s: string, _c: string, v: DataView) => {
      calls.write.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    }),
  };
  return { ble, calls, emit: (v: DataView) => notifyCb?.(v), fireDisconnect: () => onDisconnect?.('AA:BB:CC') };
}

describe('CapacitorBluetoothHost', () => {
  it('captures only the selected device advertising payload and stops scanning before connection', async () => {
    vi.useFakeTimers();
    try {
      const { ble } = makeFakeBle();
      const stopLEScan = vi.fn(async () => {});
      const client = { ...ble, stopLEScan,
        requestLEScan: vi.fn(async (_options: unknown, callback: (result: any) => void) => {
          callback({ device: { deviceId: 'unrelated' }, localName: 'unrelated' });
          callback({ device: { deviceId: 'AA:BB:CC' }, localName: 'demo', rssi: -50,
            serviceData: { 'fd50': new DataView(new Uint8Array([255, 65, 2, 255]).buffer, 1, 2) } });
        }),
      };
      const pending = new CapacitorBluetoothHost(client).requestDevice({ acceptAllDevices: true });
      await vi.advanceTimersByTimeAsync(1500);
      const device = await pending;
      expect(device.advertisement?.localName).toBe('demo');
      expect(device.advertisement?.serviceData).toEqual({ fd50: '41 02' });
      expect(stopLEScan).toHaveBeenCalledOnce();
      expect(ble.connect).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('uses write without response when that is the only supported write mode', async () => {
    const { ble } = makeFakeBle();
    const writeWithoutResponse = vi.fn(async () => {});
    const client = { ...ble, writeWithoutResponse,
      getServices: vi.fn(async () => [{ uuid: 'service', characteristics: [{ uuid: 'tx', properties: { writeWithoutResponse: true } }] }]),
    };
    const device = await new CapacitorBluetoothHost(client).requestDevice({});
    const server = await device.gatt!.connect();
    const characteristic = await (await server.getPrimaryService('service')).getCharacteristic('tx');
    await characteristic.writeValue(new Uint8Array([1, 2]));
    expect(writeWithoutResponse).toHaveBeenCalledOnce();
    expect(ble.write).not.toHaveBeenCalled();
  });
  it('does not report connected if the scooter disconnects during service discovery', async () => {
    const { ble, fireDisconnect } = makeFakeBle();
    const onDisconnect = vi.fn();
    const client = { ...ble,
      requestDevice: vi.fn(async () => ({ deviceId: 'AA:BB:CC', name: 'demo' })),
      getServices: vi.fn(async () => { fireDisconnect(); return []; }),
    };
    const session = new ScooterBleSession(new CapacitorBluetoothHost(client), { onTelemetry: vi.fn(), onDisconnect });
    await expect(session.connect('windgoo-youfs')).rejects.toThrow('disconnected during Bluetooth discovery');
    expect(session.connected).toBe(false);
    expect(onDisconnect).toHaveBeenCalled();
    expect(session.diagnosticCapture().deviceName).toBe('demo');
    expect(session.diagnosticCapture().connectionEvents.map((entry) => entry.event)).toContain('gatt-disconnected');
    expect(ble.write).not.toHaveBeenCalled();
  });
  it('identifies the Tuya profile and excludes Service Changed from scooter subscriptions', async () => {
    const { ble } = makeFakeBle();
    const client = { ...ble,
      requestDevice: vi.fn(async () => ({ deviceId: 'AA:BB:CC', name: 'demo' })),
      getServices: vi.fn(async () => [
        { uuid: '00001801-0000-1000-8000-00805f9b34fb', characteristics: [{ uuid: '00002a05-0000-1000-8000-00805f9b34fb', properties: { indicate: true } }] },
        { uuid: '0000fd50-0000-1000-8000-00805f9b34fb', characteristics: [
          { uuid: '00000001-0000-1001-8001-00805f9b07d0', properties: { writeWithoutResponse: true } },
          { uuid: '00000002-0000-1001-8001-00805f9b07d0', properties: { notify: true } },
        ] },
      ]),
    };
    const session = new ScooterBleSession(new CapacitorBluetoothHost(client), { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect('windgoo-youfs');
    expect(session.diagnosticCapture().protocolHint).toBe('tuya-compatible');
    expect(ble.startNotifications).toHaveBeenCalledTimes(1);
    expect(session.connectionNote).toContain('subscribed to 1');
    expect(session.connectionNote).toContain('authenticated Tuya integration');
    expect(ble.write).not.toHaveBeenCalled();
  });
  it('captures native Windgoo GATT channels and received bytes without writing commands', async () => {
    const { ble, emit } = makeFakeBle();
    const service = '0000ffe0-0000-1000-8000-00805f9b34fb';
    const characteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';
    const client = {
      ...ble,
      requestDevice: vi.fn(async () => ({ deviceId: 'AA:BB:CC', name: 'demo' })),
      getServices: vi.fn(async () => [{ uuid: service, characteristics: [{ uuid: characteristic, properties: { notify: true } }] }]),
    };
    const session = new ScooterBleSession(new CapacitorBluetoothHost(client), { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect('windgoo-youfs');
    emit(new DataView(new Uint8Array([1, 2, 3]).buffer));
    const capture = session.diagnosticCapture();
    expect(capture.gattProfile[0]).toEqual({ service, characteristic, properties: { notify: true }, subscription: 'opened' });
    expect(capture.receivedFrames[0].hex).toBe('01 02 03');
    expect(capture.receivedFrames[0].characteristic).toBe(characteristic);
    expect(ble.write).not.toHaveBeenCalled();
  });
  it('adapts the plugin to the BluetoothHost contract end to end', async () => {
    const { ble, calls, emit } = makeFakeBle();
    const host = new CapacitorBluetoothHost(ble);
    const onTelemetry = vi.fn();
    const onDisconnect = vi.fn();

    const session = new ScooterBleSession(host, { onTelemetry, onDisconnect });
    const family = await session.connect();
    expect(family).toBe('Xiaomi/Ninebot');
    expect(calls.connect).toEqual(['AA:BB:CC']);
    expect(ble.requestDevice).toHaveBeenCalledOnce();

    const frame = XiaomiNinebotDriver.encodeStatus({ ...createEmptyTelemetry(), speedKmh: 12.5, batteryPercent: 40 });
    emit(new DataView(frame.buffer, frame.byteOffset, frame.byteLength));
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry.mock.calls[0][0].speedKmh).toBe(12.5);

    await session.setLock(true);
    const written = calls.write.at(-1) as Uint8Array;
    expect(Array.from(written)).toEqual([0x55, 0xaa, 0x05, 0x20, 0x70, 0x01, 0x69, 0xff]);
  });

  it('surfaces the plugin disconnect callback', async () => {
    const { ble, fireDisconnect } = makeFakeBle();
    const host = new CapacitorBluetoothHost(ble);
    const onDisconnect = vi.fn();
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect });
    await session.connect();
    fireDisconnect();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not hide a valid device when a brand has multiple advertised aliases', async () => {
    const { ble } = makeFakeBle();
    const host = new CapacitorBluetoothHost(ble);
    await host.requestDevice({
      filters: [{ namePrefix: 'Windgoo' }, { namePrefix: 'YOUFS' }, { namePrefix: 'YFS' }],
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'],
    });
    expect(ble.requestDevice).toHaveBeenCalledWith({ optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'] });
  });
});
