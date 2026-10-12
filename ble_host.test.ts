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
});
