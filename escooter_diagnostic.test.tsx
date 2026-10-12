import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EscooterDiagnosticTile } from './src/components/EscooterDiagnosticTile';
import {
  XiaomiNinebotDriver,
  MiniRobotDriver,
  createEmptyTelemetry,
  type BluetoothHost,
  type BleCharacteristicLike,
  type ScooterTelemetry,
} from './src/utils/scooterProtocols';

function viewAt(bytes: number[]): DataView {
  const buf = new Uint8Array(bytes);
  return new DataView(buf.buffer);
}

function sample(over: Partial<ScooterTelemetry> = {}): ScooterTelemetry {
  return {
    ...createEmptyTelemetry(),
    speedKmh: 18.4,
    batteryPercent: 78,
    voltage: 38.2,
    controllerTempC: 34,
    headlightOn: true,
    errorCode: 14,
    ...over,
  };
}

class FakeChar implements BleCharacteristicLike {
  written: Uint8Array[] = [];
  listeners: Array<(e: { target: { value: DataView } }) => void> = [];
  async startNotifications() {
    return this;
  }
  async writeValue(v: Uint8Array) {
    this.written.push(v);
  }
  addEventListener(_t: 'characteristicvaluechanged', l: (e: { target: { value: DataView } }) => void) {
    this.listeners.push(l);
  }
  emit(v: DataView) {
    this.listeners.forEach((l) => l({ target: { value: v } }));
  }
}

function makeHost(name: string) {
  const chars: Record<string, FakeChar> = {};
  chars[XiaomiNinebotDriver.notifyUuid] = new FakeChar();
  chars[XiaomiNinebotDriver.writeUuid] = new FakeChar();
  chars[MiniRobotDriver.notifyUuid] = new FakeChar();
  const server = {
    connected: true,
    getPrimaryService: async () => ({ getCharacteristic: async (uuid: string) => chars[uuid] }),
    disconnect() {
      this.connected = false;
    },
  };
  const host: BluetoothHost = {
    requestDevice: async () => ({
      name,
      gatt: { connected: true, connect: async () => server, disconnect: () => server.disconnect() },
      addEventListener: () => {},
    }),
  };
  return { host, chars, server };
}

describe('EscooterDiagnosticTile — simulator', () => {
  it('shows simulated telemetry and decodes the fault when simulator mode is on', () => {
    render(<EscooterDiagnosticTile startInDemo />);
    expect(screen.getByTestId('escooter-device').textContent).toContain('SIMULATED-M365-PRO');
    expect(screen.getByTestId('escooter-battery').textContent).toBe('78%');
    expect(screen.getByTestId('escooter-voltage').textContent).toBe('38.2 V');
    expect(screen.getByTestId('escooter-fault').textContent).toMatch(/Throttle hall sensor/);
    expect(screen.getByTestId('escooter-raw').textContent).toMatch(/55 aa/);
  });

  it('toggles the lock in simulator mode', () => {
    render(<EscooterDiagnosticTile startInDemo />);
    const lock = screen.getByTestId('escooter-lock');
    expect(lock.textContent).toMatch(/Lock scooter/);
    fireEvent.click(lock);
    expect(lock.textContent).toMatch(/Locked/);
  });

  it('toggles the headlight in simulator mode', () => {
    render(<EscooterDiagnosticTile startInDemo />);
    const light = screen.getByTestId('escooter-headlight');
    expect(light.textContent).toMatch(/Headlight on/);
    fireEvent.click(light);
    expect(light.textContent).toMatch(/Toggle headlight/);
  });
});

describe('EscooterDiagnosticTile — live session (fake host)', () => {
  it('connects over BLE and renders parsed telemetry from a real notification', async () => {
    const { host, chars } = makeHost('Mi Scooter Pro 2');
    render(<EscooterDiagnosticTile bluetoothHost={host} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-connect'));
    });

    expect(screen.getByTestId('escooter-device').textContent).toMatch(/Xiaomi \/ Ninebot/);

    const frame = XiaomiNinebotDriver.encodeStatus(sample({ errorCode: 21, batteryPercent: 64 }));
    await act(async () => {
      chars[XiaomiNinebotDriver.notifyUuid].emit(viewAt(Array.from(frame)));
    });

    expect(screen.getByTestId('escooter-battery').textContent).toBe('64%');
    expect(screen.getByTestId('escooter-fault').textContent).toMatch(/BMS/);
  });

  it('sends a real lock frame to the controller', async () => {
    const { host, chars } = makeHost('NB-1234');
    render(<EscooterDiagnosticTile bluetoothHost={host} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-connect'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-lock'));
    });
    const written = chars[XiaomiNinebotDriver.writeUuid].written.at(-1)!;
    expect(Array.from(written)).toEqual([0x55, 0xaa, 0x05, 0x20, 0x70, 0x01, 0x69, 0xff]);
  });

  it('explains when no Bluetooth host is available', async () => {
    // Pass an explicit undefined host while clearing navigator.bluetooth.
    const original = (navigator as Navigator & { bluetooth?: unknown }).bluetooth;
    Object.defineProperty(navigator, 'bluetooth', { value: undefined, configurable: true });
    render(<EscooterDiagnosticTile />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-connect'));
    });
    expect(screen.getByText(/Bluetooth is not available/)).toBeTruthy();
    Object.defineProperty(navigator, 'bluetooth', { value: original, configurable: true });
  });
});
