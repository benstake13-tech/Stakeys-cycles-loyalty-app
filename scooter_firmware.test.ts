import { describe, it, expect, vi } from 'vitest';
import {
  XiaomiNinebotDriver,
  MiniRobotDriver,
  GenericUartDriver,
  ScooterBleSession,
  type BluetoothHost,
  type BleCharacteristicLike,
} from './src/utils/scooterProtocols';
import {
  compareVersions,
  compareFirmware,
  findFirmwareEntry,
  buildBackup,
  backupFilename,
  captureAndSaveBackup,
  canFlash,
  downloadFirmware,
  firmwareFilename,
  summarizeComparisons,
  type FirmwareDeps,
  type FirmwareFile,
} from './src/utils/scooterFirmware';

function viewAt(bytes: number[]): DataView {
  const buf = new Uint8Array(bytes);
  return new DataView(buf.buffer);
}

// ---------------------------------------------------------------------------
// Version frames
// ---------------------------------------------------------------------------

describe('firmware version frames', () => {
  it('builds a Xiaomi ESC version query and round-trips the reply', () => {
    const q = XiaomiNinebotDriver.buildVersionQuery!('esc')!;
    expect(q[0]).toBe(0x55);
    expect(q[1]).toBe(0xaa);
    expect(q[4]).toBe(0x1a);
    const reply = XiaomiNinebotDriver.encodeVersionResponse!('esc', '1.5.1');
    const parsed = XiaomiNinebotDriver.parseVersionResponse!(viewAt(Array.from(reply)));
    expect(parsed).toMatchObject({ target: 'esc', version: '1.5.1' });
  });

  it('decodes an ASCII version reply too', () => {
    // 55 aa | len addr cmd(target 0x9b=bms) | '1' '.' '5' | crc lo hi
    const frame = [0x55, 0xaa, 0x05, 0x20, 0x9b, 0x22, 0x31, 0x2e, 0x35, 0x00, 0x00];
    const parsed = XiaomiNinebotDriver.parseVersionResponse!(viewAt(frame));
    expect(parsed?.target).toBe('bms');
    expect(parsed?.version).toBe('1.5');
  });

  it('ignores status frames and unknown commands', () => {
    const status = XiaomiNinebotDriver.encodeStatus({
      connected: true,
      deviceName: 'x',
      protocolFamily: 'Xiaomi/Ninebot',
      speedKmh: 0,
      batteryPercent: 50,
      voltage: 36,
      currentAmps: 0,
      controllerTempC: 20,
      isLocked: false,
      headlightOn: false,
      errorCode: null,
      errorMessage: null,
      rawHexRx: '',
    });
    expect(XiaomiNinebotDriver.parseVersionResponse!(viewAt(Array.from(status)))).toBeNull();
    expect(GenericUartDriver.parseVersionResponse).toBeUndefined();
  });

  it('MiniRobot exposes ESC/BMS versions but not BLE', () => {
    expect(MiniRobotDriver.buildVersionQuery!('ble')).toBeNull();
    const reply = MiniRobotDriver.encodeVersionResponse!('bms', '1.6.0');
    expect(MiniRobotDriver.parseVersionResponse!(viewAt(Array.from(reply)))).toMatchObject({ target: 'bms', version: '1.6.0' });
  });
});

// ---------------------------------------------------------------------------
// Live version read against a fake host
// ---------------------------------------------------------------------------

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
  const server = {
    connected: true,
    getPrimaryService: async () => ({ getCharacteristic: async (u: string) => chars[u] }),
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
  return { host, chars };
}

describe('ScooterBleSession.readVersion', () => {
  it('resolves the reading when the controller replies to the query', async () => {
    const { host, chars } = makeHost('Mi Scooter Pro 2');
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect();
    const p = session.readVersion('esc');
    // The controller answers right after the query is written.
    chars[XiaomiNinebotDriver.notifyUuid].emit(viewAt(Array.from(XiaomiNinebotDriver.encodeVersionResponse!('esc', '1.3.9'))));
    await expect(p).resolves.toMatchObject({ target: 'esc', version: '1.3.9' });
  });

  it('resolves null on timeout and never guesses', async () => {
    vi.useFakeTimers();
    const { host } = makeHost('Mi Scooter Pro 2');
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect();
    const p = session.readVersion('bms', 50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(p).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('readAllVersions collects every supported reply', async () => {
    const { host, chars } = makeHost('Mi Scooter Pro 2');
    const session = new ScooterBleSession(host, { onTelemetry: vi.fn(), onDisconnect: vi.fn() });
    await session.connect();
    const p = session.readAllVersions(200);
    chars[XiaomiNinebotDriver.notifyUuid].emit(viewAt(Array.from(XiaomiNinebotDriver.encodeVersionResponse!('esc', '1.5.1'))));
    await new Promise((r) => setTimeout(r, 0));
    chars[XiaomiNinebotDriver.notifyUuid].emit(viewAt(Array.from(XiaomiNinebotDriver.encodeVersionResponse!('bms', '1.2.7'))));
    const all = await p;
    expect(all.map((v) => v.target)).toEqual(['esc', 'bms']);
  });
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

describe('firmware comparison', () => {
  it('orders dotted versions numerically', () => {
    expect(compareVersions('1.5.1', '1.5.1')).toBe(0);
    expect(compareVersions('1.3.9', '1.5.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  });

  it('finds a catalogue entry by exact, partial or BLE-hint model', () => {
    expect(findFirmwareEntry('M365 Pro 2')?.id).toBe('xiaomi:m365-pro2');
    expect(findFirmwareEntry('M365 Pro')?.id).toBe('xiaomi:m365-pro');
    expect(findFirmwareEntry('mystery scooter')).toBeUndefined();
  });

  it('marks outdated, newer and unknown targets', () => {
    const entry = findFirmwareEntry('M365')!;
    const out = compareFirmware(entry, { esc: '1.3.9', bms: '1.2.7', ble: null });
    expect(out.find((c) => c.target === 'esc')).toMatchObject({ status: 'outdated', expected: '1.5.1' });
    expect(out.find((c) => c.target === 'bms')?.status).toBe('up-to-date');
    expect(out.find((c) => c.target === 'ble')?.status).toBe('unknown');
  });

  it('is "unknown" for every target when the model is not catalogued', () => {
    const out = compareFirmware(undefined, { esc: '9.9.9' });
    expect(out.every((c) => c.status === 'unknown')).toBe(true);
  });

  it('summarises the headline', () => {
    const out = compareFirmware(findFirmwareEntry('M365'), { esc: '1.3.9' });
    expect(summarizeComparisons(out)).toMatch(/Outdated: ESC 1\.3\.9 → 1\.5\.1/);
  });
});

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

const hashStub = async (data: string) => `hash-${data.length}`;

describe('firmware backup', () => {
  it('builds a JSON backup with the right schema and filename', async () => {
    const artifact = await buildBackup(
      {
        deviceName: 'Mi Scooter Pro 2',
        protocolFamily: 'Xiaomi/Ninebot',
        model: 'M365 Pro 2',
        versions: [{ target: 'esc', version: '1.3.9', rawHex: '55 aa' }],
        telemetry: { batteryPercent: 64, voltage: 38.2 },
        catalogueId: 'xiaomi:m365-pro2',
        now: '2026-10-12T10:00:00.000Z',
      },
      hashStub
    );
    expect(artifact.backup.schema).toBe('stakeys.scooter.backup.v1');
    expect(JSON.parse(artifact.json).deviceName).toBe('Mi Scooter Pro 2');
    expect(artifact.filename).toBe('stakeys-backup-Mi-Scooter-Pro-2-2026-10-12T10-00-00-000Z.json');
    expect(artifact.sha256).toMatch(/^hash-/);
  });

  it('sanitises odd device names in the filename', () => {
    expect(backupFilename('a/b:c*d', '2026-01-01T00:00:00Z')).toContain('a-b-c-d');
    expect(backupFilename('', '2026-01-01T00:00:00Z')).toContain('scooter');
  });

  it('writes the backup to the device via the injected saver', async () => {
    const saved: Array<{ name: string }> = [];
    const deps: FirmwareDeps = {
      ...baseDeps(),
      saver: { save: (_d, name) => void saved.push({ name }) },
    };
    const res = await captureAndSaveBackup(deps, {
      deviceName: 'AOVO Pro',
      protocolFamily: 'MiniRobot',
      model: 'AOVO Pro',
      versions: [],
      telemetry: {},
      now: '2026-10-12T10:00:00Z',
    });
    expect(res.saved).toBe(true);
    expect(saved[0].name).toContain('AOVO-Pro');
  });
});

// ---------------------------------------------------------------------------
// Flashing gate + download
// ---------------------------------------------------------------------------

function baseDeps(over: Partial<FirmwareDeps> = {}): FirmwareDeps {
  return {
    hash: hashStub,
    hashBytes: async () => 'abc123',
    fetchBytes: async () => new Uint8Array([1, 2, 3, 4]),
    saver: { save: vi.fn() },
    ...over,
  };
}

describe('flashing gate — backups are always required', () => {
  it('blocks when not connected, then when no backup, then when risk unaccepted', () => {
    expect(canFlash({ connected: false, backupTaken: false, riskAccepted: false }).allowed).toBe(false);
    const noBackup = canFlash({ connected: true, backupTaken: false, riskAccepted: true });
    expect(noBackup.allowed).toBe(false);
    expect(noBackup.blockers.join(' ')).toMatch(/backup/i);
    const noRisk = canFlash({ connected: true, backupTaken: true, riskAccepted: false });
    expect(noRisk.allowed).toBe(false);
    expect(noRisk.blockers.join(' ')).toMatch(/brick/i);
    expect(canFlash({ connected: true, backupTaken: true, riskAccepted: true }).allowed).toBe(true);
  });

  it('refuses to download without a backup even if everything else is set', async () => {
    const save = vi.fn();
    const file: FirmwareFile = { target: 'esc', version: '1.5.1', url: 'https://example.com/fw.bin' };
    const res = await downloadFirmware(baseDeps({ saver: { save } }), file, { connected: true, backupTaken: false, riskAccepted: true }, 'M365');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/backup/i);
    expect(save).not.toHaveBeenCalled();
  });

  it('downloads and verifies the checksum when a backup has been taken', async () => {
    const save = vi.fn();
    const res = await downloadFirmware(
      baseDeps({ saver: { save }, hashBytes: async () => 'deadbeef' }),
      { target: 'esc', version: '1.5.1', url: 'https://example.com/fw.bin', sha256: 'deadbeef' },
      { connected: true, backupTaken: true, riskAccepted: true },
      'M365 Pro 2'
    );
    expect(res.ok).toBe(true);
    expect(res.checksumVerified).toBe(true);
    expect(res.filename).toBe('stakeys-fw-M365-Pro-2-esc-1.5.1.bin');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save a file whose checksum does not match', async () => {
    const save = vi.fn();
    const res = await downloadFirmware(
      baseDeps({ saver: { save }, hashBytes: async () => 'aaaa' }),
      { target: 'esc', version: '1.5.1', url: 'u', sha256: 'bbbb' },
      { connected: true, backupTaken: true, riskAccepted: true },
      'M365'
    );
    expect(res.ok).toBe(false);
    expect(res.checksumVerified).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('reports a download failure without throwing', async () => {
    const res = await downloadFirmware(
      baseDeps({ fetchBytes: async () => { throw new Error('offline'); } }),
      { target: 'esc', version: '1.5.1', url: 'u' },
      { connected: true, backupTaken: true, riskAccepted: true },
      'M365'
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/offline/);
  });

  it('builds a predictable firmware filename', () => {
    expect(firmwareFilename('AOVO Pro', { target: 'bms', version: '1.0.0', url: 'u' })).toBe('stakeys-fw-AOVO-Pro-bms-1.0.0.bin');
  });
});
