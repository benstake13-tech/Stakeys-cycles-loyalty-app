/**
 * Stock-firmware reference catalogue for the BLE diagnostic bench.
 *
 * Maps a scooter model (as the technician identifies it) to the firmware
 * versions the manufacturer ships for each processor (ESC / BMS / BLE), so the
 * bench can tell a tech "this ESC is on 1.3.9 but stock is 1.5.1".
 *
 * This is best-effort reference material, exactly like `eVehicleCodes`: the
 * manufacturer revises firmware and the same model can ship with different
 * hardware revisions, so every entry carries a `source` link and the UI shows
 * it next to the comparison. When a model is not listed the bench must say
 * "not in the catalogue" — it must never invent a target version.
 */

export type FirmwareTarget = 'esc' | 'bms' | 'ble';

export interface StockFirmware {
  /** Target version string, e.g. "1.5.1". */
  version: string;
  /**
   * Direct-download URL for the stock image, when the vendor distributes it
   * publicly. Left unset when the image is not ours to redistribute — the tech
   * then pastes a URL (or downloads from `source`) and the bench hashes it.
   */
  downloadUrl?: string;
  /** Expected SHA-256 of that image, verified after download. */
  sha256?: string;
}

export interface FirmwareCatalogEntry {
  /** Stable id, e.g. "xiaomi:m365-pro2". */
  id: string;
  brand: string;
  /** Model family as shown in the picker, e.g. "M365 Pro 2". */
  model: string;
  /** Protocol family the model speaks, for driver matching. */
  family: 'Xiaomi/Ninebot' | 'MiniRobot';
  /** Advertised-name fragments that help identify this model over BLE. */
  bleNameHints: string[];
  /** Stock version per processor. A missing key means "not applicable". */
  stock: Partial<Record<FirmwareTarget, StockFirmware>>;
  /** Public page this table was checked against. */
  source: string;
  /** Free-text caution shown to the tech (hardware revisions, regional builds). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export const FIRMWARE_SOURCES: Record<string, string> = {
  xiaomiFw: 'https://wiki.scooterhacking.org/doku.php?id=xiaomifirmware',
  ninebotFw: 'https://wiki.scooterhacking.org/doku.php?id=nbmax',
  shu: 'https://scooterhacking.org/',
  aovoFw: 'https://github.com/scooterhacking/AovoFirmware',
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const FIRMWARE_CATALOG: FirmwareCatalogEntry[] = [
  {
    id: 'xiaomi:m365',
    brand: 'Xiaomi',
    model: 'M365',
    family: 'Xiaomi/Ninebot',
    bleNameHints: ['m365', 'mi scooter', 'nb-'],
    stock: { esc: { version: '1.5.1' }, bms: { version: '1.2.7' }, ble: { version: '1.0.7' } },
    source: FIRMWARE_SOURCES.xiaomiFw,
    note: 'Early hardware revisions shipped with older ESC firmware; confirm the revision plate before flashing.',
  },
  {
    id: 'xiaomi:m365-pro',
    brand: 'Xiaomi',
    model: 'M365 Pro',
    family: 'Xiaomi/Ninebot',
    bleNameHints: ['m365 pro', 'mi pro'],
    stock: { esc: { version: '1.6.9' }, bms: { version: '1.4.0' }, ble: { version: '1.1.2' } },
    source: FIRMWARE_SOURCES.xiaomiFw,
  },
  {
    id: 'xiaomi:m365-pro2',
    brand: 'Xiaomi',
    model: 'M365 Pro 2',
    family: 'Xiaomi/Ninebot',
    bleNameHints: ['pro 2', 'pro2', 'm365 pro 2'],
    stock: { esc: { version: '1.5.1' }, bms: { version: '1.4.1' }, ble: { version: '1.2.7' } },
    source: FIRMWARE_SOURCES.xiaomiFw,
    note: 'Regional builds (EU/US) differ — match the region of the unit on the bench.',
  },
  {
    id: 'ninebot:es2',
    brand: 'Segway/Ninebot',
    model: 'ES2',
    family: 'Xiaomi/Ninebot',
    bleNameHints: ['es2', 'ninebot es'],
    stock: { esc: { version: '1.8.1' }, bms: { version: '1.6.2' }, ble: { version: '1.4.0' } },
    source: FIRMWARE_SOURCES.ninebotFw,
  },
  {
    id: 'ninebot:max-g30',
    brand: 'Segway/Ninebot',
    model: 'MAX G30',
    family: 'Xiaomi/Ninebot',
    bleNameHints: ['max g30', 'g30'],
    stock: { esc: { version: '1.6.13' }, bms: { version: '1.6.5' }, ble: { version: '1.1.3' } },
    source: FIRMWARE_SOURCES.ninebotFw,
    note: 'G30P/D variants have different DRV builds; check the model suffix.',
  },
  {
    id: 'aovo:pro',
    brand: 'AOVO',
    model: 'Pro',
    family: 'MiniRobot',
    bleNameHints: ['aovo', 'pro'],
    stock: { esc: { version: '2.4.0' }, bms: { version: '1.0.0' } },
    source: FIRMWARE_SOURCES.aovoFw,
    note: 'MiniRobot controllers do not expose a BLE version; only ESC/BMS are readable.',
  },
];

// ---------------------------------------------------------------------------
// Lookup + comparison
// ---------------------------------------------------------------------------

/** Normalise a model string for matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function findFirmwareEntry(model: string): FirmwareCatalogEntry | undefined {
  const m = norm(model);
  if (!m) return undefined;
  return (
    FIRMWARE_CATALOG.find((e) => norm(e.model) === m) ||
    FIRMWARE_CATALOG.find((e) => norm(e.model).includes(m) || m.includes(norm(e.model))) ||
    FIRMWARE_CATALOG.find((e) => e.bleNameHints.some((h) => m.includes(norm(h))))
  );
}

export type FirmwareStatus = 'up-to-date' | 'outdated' | 'newer' | 'unknown';

export interface FirmwareComparison {
  target: FirmwareTarget;
  current: string | null;
  /** Stock version from the catalogue, or null when the model is not listed. */
  expected: string | null;
  status: FirmwareStatus;
}

/** Compare two dotted version strings numerically. Returns -1/0/1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Compare the versions read from the device against the catalogue. `current`
 * is keyed by processor; a missing/None entry yields status "unknown".
 */
export function compareFirmware(
  entry: FirmwareCatalogEntry | undefined,
  current: Partial<Record<FirmwareTarget, string | null>>
): FirmwareComparison[] {
  const targets: FirmwareTarget[] = ['esc', 'bms', 'ble'];
  return targets.map((target) => {
    const cur = current[target] ?? null;
    const expected = entry?.stock[target]?.version ?? null;
    let status: FirmwareStatus;
    if (!cur || !expected) status = 'unknown';
    else {
      const d = compareVersions(cur, expected);
      status = d === 0 ? 'up-to-date' : d < 0 ? 'outdated' : 'newer';
    }
    return { target, current: cur, expected, status };
  });
}
