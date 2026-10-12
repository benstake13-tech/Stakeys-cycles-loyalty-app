/**
 * Native BLE transport for the Android app.
 *
 * The web build talks to `navigator.bluetooth` (Web Bluetooth). Android's
 * WebView has no Web Bluetooth, so inside the Capacitor shell we adapt the
 * `@capacitor-community/bluetooth-le` plugin to the same `BluetoothHost`
 * interface the diagnostic bench already uses. The protocol engine and the UI
 * are then identical on web and Android — only the transport differs.
 *
 * Both imports are dynamic so the plugin (and Capacitor) never load in the
 * browser build or in tests, where `Capacitor.isNativePlatform()` is false.
 */
import type {
  BluetoothHost,
  BleCharacteristicLike,
  BleDeviceLike,
  BleServerLike,
  BleServiceLike,
} from './scooterProtocols';

type BleClientLike = {
  initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>;
  requestDevice(options?: { optionalServices?: string[] }): Promise<{ deviceId: string; name?: string }>;
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void
  ): Promise<void>;
  write(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>;
};

function toDataView(value: Uint8Array): DataView {
  return new DataView(value.buffer, value.byteOffset, value.byteLength);
}

class CapacitorCharacteristic implements BleCharacteristicLike {
  private listeners: Array<(event: { target: { value: DataView } }) => void> = [];

  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    private serviceUuid: string,
    private charUuid: string
  ) {}

  async startNotifications(): Promise<BleCharacteristicLike> {
    await this.ble.startNotifications(this.deviceId, this.serviceUuid, this.charUuid, (value) => {
      this.listeners.forEach((l) => l({ target: { value } }));
    });
    return this;
  }

  async writeValue(value: Uint8Array): Promise<void> {
    await this.ble.write(this.deviceId, this.serviceUuid, this.charUuid, toDataView(value));
  }

  addEventListener(
    _type: 'characteristicvaluechanged',
    listener: (event: { target: { value: DataView } }) => void
  ): void {
    this.listeners.push(listener);
  }
}

class CapacitorService implements BleServiceLike {
  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    private serviceUuid: string
  ) {}

  async getCharacteristic(uuid: string): Promise<BleCharacteristicLike> {
    return new CapacitorCharacteristic(this.ble, this.deviceId, this.serviceUuid, uuid);
  }
}

class CapacitorServer implements BleServerLike {
  connected = true;

  constructor(
    private ble: BleClientLike,
    private deviceId: string
  ) {}

  async getPrimaryService(uuid: string): Promise<BleServiceLike> {
    return new CapacitorService(this.ble, this.deviceId, uuid);
  }

  disconnect(): void {
    this.connected = false;
    void this.ble.disconnect(this.deviceId).catch(() => {});
  }
}

class CapacitorDevice implements BleDeviceLike {
  private disconnectListeners: Array<() => void> = [];
  gatt: BleDeviceLike['gatt'];

  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    public name?: string
  ) {
    this.gatt = {
      connected: false,
      connect: async () => {
        await this.ble.connect(this.deviceId, () => this.disconnectListeners.forEach((l) => l()));
        this.gatt!.connected = true;
        return new CapacitorServer(this.ble, this.deviceId);
      },
      disconnect: () => {
        this.gatt!.connected = false;
        void this.ble.disconnect(this.deviceId).catch(() => {});
      },
    };
  }

  addEventListener(_type: 'gattserverdisconnected', listener: () => void): void {
    this.disconnectListeners.push(listener);
  }
}

export class CapacitorBluetoothHost implements BluetoothHost {
  constructor(private ble: BleClientLike) {}

  async requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[] }>;
    optionalServices?: string[];
  }): Promise<BleDeviceLike> {
    const device = await this.ble.requestDevice({ optionalServices: options.optionalServices });
    return new CapacitorDevice(this.ble, device.deviceId, device.name);
  }
}

/**
 * Build the native Bluetooth host when running inside the Android shell.
 * Returns `undefined` in a browser or test environment so callers can fall back
 * to Web Bluetooth.
 */
export async function createNativeBluetoothHost(): Promise<BluetoothHost | undefined> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return undefined;
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    const ble = BleClient as unknown as BleClientLike;
    await ble.initialize({ androidNeverForLocation: true });
    return new CapacitorBluetoothHost(ble);
  } catch {
    return undefined;
  }
}

export function isNativeApp(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (globalThis as any).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}
