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
  requestDevice(options?: { optionalServices?: string[]; namePrefix?: string }): Promise<{ deviceId: string; name?: string }>;
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void
  ): Promise<void>;
  write(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>;
  writeWithoutResponse?(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>;
  requestLEScan?(options: { allowDuplicates: boolean }, callback: (result: {
    device: { deviceId: string }; localName?: string; rssi?: number; uuids?: string[];
    manufacturerData?: Record<string, DataView>; serviceData?: Record<string, DataView>;
  }) => void): Promise<void>;
  stopLEScan?(): Promise<void>;
  getServices?(deviceId: string): Promise<Array<{ uuid: string; characteristics: Array<{ uuid: string; properties: { notify?: boolean; indicate?: boolean; read?: boolean; write?: boolean; writeWithoutResponse?: boolean } }> }>>;
};

function toDataView(value: Uint8Array): DataView {
  return new DataView(value.buffer, value.byteOffset, value.byteLength);
}

class CapacitorCharacteristic implements BleCharacteristicLike {
  get uuid(): string { return this.charUuid; }
  private listeners: Array<(event: { target: { value: DataView } }) => void> = [];

  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    private serviceUuid: string,
    private charUuid: string,
    public properties?: { notify?: boolean; indicate?: boolean; read?: boolean; write?: boolean; writeWithoutResponse?: boolean }
  ) {}

  async startNotifications(): Promise<BleCharacteristicLike> {
    await this.ble.startNotifications(this.deviceId, this.serviceUuid, this.charUuid, (value) => {
      this.listeners.forEach((l) => l({ target: { value } }));
    });
    return this;
  }

  async writeValue(value: Uint8Array): Promise<void> {
    if (this.properties?.writeWithoutResponse && !this.properties.write) {
      if (!this.ble.writeWithoutResponse) throw new Error('This Bluetooth transport does not support the required write-without-response mode.');
      await this.ble.writeWithoutResponse(this.deviceId, this.serviceUuid, this.charUuid, toDataView(value));
      return;
    }
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
  get uuid(): string { return this.serviceUuid; }
  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    private serviceUuid: string,
    private characteristics: Array<{ uuid: string; properties: { notify?: boolean; indicate?: boolean; read?: boolean; write?: boolean; writeWithoutResponse?: boolean } }> = []
  ) {}

  async getCharacteristic(uuid: string): Promise<BleCharacteristicLike> {
    const known = this.characteristics.find((characteristic) => characteristic.uuid.toLowerCase() === uuid.toLowerCase());
    return new CapacitorCharacteristic(this.ble, this.deviceId, this.serviceUuid, uuid, known?.properties);
  }

  async getCharacteristics(): Promise<BleCharacteristicLike[]> {
    return this.characteristics.map((characteristic) => new CapacitorCharacteristic(this.ble, this.deviceId, this.serviceUuid, characteristic.uuid, characteristic.properties));
  }
}

class CapacitorServer implements BleServerLike {
  connected = true;

  constructor(
    private ble: BleClientLike,
    private deviceId: string
  ) {}

  async getPrimaryService(uuid: string): Promise<BleServiceLike> {
    const services = await this.ble.getServices?.(this.deviceId) ?? [];
    const service = services.find((candidate) => candidate.uuid.toLowerCase() === uuid.toLowerCase());
    return new CapacitorService(this.ble, this.deviceId, uuid, service?.characteristics ?? []);
  }

  async getPrimaryServices(): Promise<BleServiceLike[]> {
    const services = await this.ble.getServices?.(this.deviceId) ?? [];
    return services.map((service) => new CapacitorService(this.ble, this.deviceId, service.uuid, service.characteristics));
  }

  disconnect(): void {
    this.connected = false;
    void this.ble.disconnect(this.deviceId).catch(() => {});
  }
}

class CapacitorDevice implements BleDeviceLike {
  advertisement: BleDeviceLike['advertisement'];
  private disconnectListeners: Array<() => void> = [];
  private server: CapacitorServer | null = null;
  gatt: BleDeviceLike['gatt'];

  constructor(
    private ble: BleClientLike,
    private deviceId: string,
    public name?: string
  ) {
    this.gatt = {
      connected: false,
      connect: async () => {
        let disconnected = false;
        await this.ble.connect(this.deviceId, () => {
          disconnected = true;
          this.gatt!.connected = false;
          if (this.server) this.server.connected = false;
          this.disconnectListeners.forEach((listener) => listener());
        });
        if (disconnected) throw new Error('Scooter disconnected while opening the Bluetooth connection.');
        this.gatt!.connected = true;
        this.server = new CapacitorServer(this.ble, this.deviceId);
        return this.server;
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
    filters?: Array<{ services?: string[]; namePrefix?: string }>;
    optionalServices?: string[];
  }): Promise<BleDeviceLike> {
    // Android's native chooser supports one name prefix at a time. When a brand
    // advertises several aliases (for example Windgoo and YouFS), leave the
    // picker unfiltered and let ScooterBleSession validate the selected name;
    // otherwise a valid YouFS-named Windgoo would never appear in the picker.
    const prefixes = [...new Set((options.filters ?? []).map((filter) => filter.namePrefix).filter((value): value is string => Boolean(value)))];
    const namePrefix = prefixes.length === 1 ? prefixes[0] : undefined;
    const device = await this.ble.requestDevice({ optionalServices: options.optionalServices, ...(namePrefix ? { namePrefix } : {}) });
    const selected = new CapacitorDevice(this.ble, device.deviceId, device.name);
    // Scan only before connecting, and retain only the selected peripheral.
    // The picker returns a name/ID but omits the protocol-identifying payload.
    if (this.ble.requestLEScan && this.ble.stopLEScan) {
      const hex = (data: DataView) => Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), (byte) => byte.toString(16).padStart(2, '0')).join(' ');
      const records = (data?: Record<string, DataView>) => Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => [key, hex(value)]));
      try {
        await this.ble.requestLEScan({ allowDuplicates: true }, (result) => {
          if (result.device.deviceId !== device.deviceId) return;
          selected.advertisement = {
            capturedAt: new Date().toISOString(), localName: result.localName,
            rssi: result.rssi, services: result.uuids ?? [],
            manufacturerData: { ...selected.advertisement?.manufacturerData, ...records(result.manufacturerData) },
            serviceData: { ...selected.advertisement?.serviceData, ...records(result.serviceData) },
          };
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch {
        // Optional evidence gathering must not prevent an ordinary connection.
      } finally {
        await this.ble.stopLEScan().catch(() => {});
      }
    }
    return selected;
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
