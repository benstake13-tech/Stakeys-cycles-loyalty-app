/**
 * Express SOS Mode.
 *
 * A single-screen, icon-first emergency booking for delivery riders who are
 * broken down mid-shift and may not read English comfortably. It collapses the
 * normal four-step booking wizard into three taps:
 *
 *   1. tap the issue tile,
 *   2. tap "Use my location" (or type an address),
 *   3. tap the SOS call-out button.
 *
 * Everything here is pure so the customer booking screen, the staff panel and
 * the tests share one definition of the six categories, their translations and
 * the rider-facing copy.
 */
import { SOS_SURCHARGE } from './sosRepair';

/** Flat express surcharge for an SOS call-out. */
export const EXPRESS_SOS_SURCHARGE = SOS_SURCHARGE;

/** Longest voice note we capture (seconds). */
export const SOS_VOICE_MAX_SECONDS = 15;

export type ExpressSosTileId =
  | 'brakes'
  | 'gears'
  | 'wheels'
  | 'ebike'
  | 'snapped'
  | 'other';

export type ExpressSosTone = 'rose' | 'amber' | 'sky' | 'violet' | 'orange' | 'neutral';

export interface ExpressSosTile {
  id: ExpressSosTileId;
  /** Large pictogram so the tile reads without any words. */
  emoji: string;
  label: string;
  /** Plain, non-technical hint under the label. */
  hint: string;
  tone: ExpressSosTone;
  /** Diagnostic tag written to the booking so staff can triage instantly. */
  tag: string;
  /**
   * Symptom ids from the main `bikeIssuesCatalog` this tile stands for, so the
   * mechanic still receives the precise checklist items they already know.
   * "Other" intentionally maps to none — the rider's own words carry it.
   */
  issueIds: string[];
}

export const EXPRESS_SOS_TILES: ExpressSosTile[] = [
  {
    id: 'brakes',
    emoji: '🛑',
    label: 'Brakes',
    hint: "Won't stop · squeaks · loose lever",
    tone: 'rose',
    tag: 'Brakes',
    issueIds: ['brakes-squeaky', 'brakes-weak', 'brakes-pull-handlebar'],
  },
  {
    id: 'gears',
    emoji: '⚙️',
    label: 'Gears & Chain',
    hint: 'Snapped chain · skipping · stuck pedals',
    tone: 'amber',
    tag: 'Gears & Chain',
    issueIds: ['gears-chain-drop', 'gears-slipping', 'gears-pedals-stiff'],
  },
  {
    id: 'wheels',
    emoji: '🚲',
    label: 'Tires & Wheels',
    hint: 'Flat tire · puncture · bent wheel',
    tone: 'sky',
    tag: 'Tires & Wheels',
    issueIds: ['wheels-flat-puncture', 'wheels-wobbly-untrue', 'wheels-broken-spoke'],
  },
  {
    id: 'ebike',
    emoji: '⚡',
    label: 'E-Bike / Battery',
    hint: 'No power · motor cuts out',
    tone: 'violet',
    tag: 'E-Bike / Battery',
    issueIds: ['ebike-motor-cutout', 'ebike-battery-range', 'ebike-error-code'],
  },
  {
    id: 'snapped',
    emoji: '💥',
    label: 'Snapped Part',
    hint: 'Broken cable · pedal · stem',
    tone: 'orange',
    tag: 'Snapped Part',
    issueIds: ['frame-loose-handlebars', 'gears-chain-stuck', 'noise-rattling-frame'],
  },
  {
    id: 'other',
    emoji: '❓',
    label: 'Other / Total Breakdown',
    hint: 'Not sure · everything stopped',
    tone: 'neutral',
    tag: 'Other / Breakdown',
    issueIds: [],
  },
];

export function expressSosTileFor(id: string | undefined | null): ExpressSosTile | undefined {
  return EXPRESS_SOS_TILES.find((t) => t.id === id);
}

/** Symptom ids for a selected tile (empty for "Other"). */
export function expressSosIssueIds(tileId: string | undefined | null): string[] {
  return expressSosTileFor(tileId)?.issueIds ?? [];
}

/** Rider languages for the icon tooltips. English is the source, always shown. */
export interface SosLanguage {
  code: string;
  label: string;
  /** Whether the script is right-to-left (affects the tooltip alignment). */
  rtl?: boolean;
}

export const SOS_RIDER_LANGUAGES: SosLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ro', label: 'Română' },
  { code: 'ur', label: 'اردو', rtl: true },
  { code: 'ar', label: 'العربية', rtl: true },
];

/**
 * Short translations of each tile's hint. Deliberately tiny, everyday phrases
 * so a rider recognises the fault at a glance; English remains the fallback.
 */
export const SOS_TILE_TOOLTIPS: Record<string, Record<ExpressSosTileId, string>> = {
  es: {
    brakes: 'No frena · chirría · palanca floja',
    gears: 'Cadena rota · salta · pedales atascados',
    wheels: 'Rueda pinchada · llanta torcida',
    ebike: 'Sin corriente · el motor se corta',
    snapped: 'Cable · pedal · potencia rota',
    other: 'No estoy seguro · todo se paró',
  },
  pt: {
    brakes: 'Não trava · chia · manete solta',
    gears: 'Corrente partida · salta · pedal preso',
    wheels: 'Pneu furado · roda empenada',
    ebike: 'Sem energia · motor corta',
    snapped: 'Cabo · pedal · mesa quebrada',
    other: 'Não sei · tudo parou',
  },
  ro: {
    brakes: 'Nu frânează · scârțâie · manetă slabă',
    gears: 'Lanț rupt · sare · pedale blocate',
    wheels: 'Anvelopă spartă · roată îndoită',
    ebike: 'Fără curent · motorul se oprește',
    snapped: 'Cablul · pedala · pipa ruptă',
    other: 'Nu știu · totul s-a oprit',
  },
  ur: {
    brakes: 'بریک نہیں لگتی · چیختی ہے · لیور ڈھیلا',
    gears: 'چین ٹوٹی · پھسلتی ہے · پیڈل پھنسے',
    wheels: 'پنکچر · پہیہ ٹیڑھا',
    ebike: 'بجلی نہیں · موٹر رک جاتی ہے',
    snapped: 'کیبل · پیڈل · اسٹیم ٹوٹا',
    other: 'پتہ نہیں · سب بند ہو گیا',
  },
  ar: {
    brakes: 'لا يتوقف · صرير · ذراع مرتخي',
    gears: 'سلسلة مقطوعة · تنزلق · دواسات عالقة',
    wheels: 'إطار مثقوب · عجلة منحنية',
    ebike: 'لا طاقة · المحرك يتوقف',
    snapped: 'كيبل · دواسة · عمود مكسور',
    other: 'لست متأكدًا · توقف كل شيء',
  },
};

/** The translated hint for a tile, falling back to the English hint. */
export function sosTileHint(tile: ExpressSosTile, lang: string): string {
  if (lang === 'en') return tile.hint;
  return SOS_TILE_TOOLTIPS[lang]?.[tile.id] || tile.hint;
}

/**
 * The shared `isSosBooking` helper looks for the classic marker in the notes, so
 * every express note must also carry it or downstream SOS handling would treat
 * the job as an ordinary booking.
 */
const EXPRESS_SOS_LEGACY_MARKER = 'SOS EXPRESS REPAIR';

/** Marker written into booking notes so an express SOS job is unmistakable. */
export const EXPRESS_SOS_MARKER = 'EXPRESS SOS CALL-OUT';

export interface ExpressSosNoteFields {
  tileId: ExpressSosTileId;
  /** Rider's own words (optional for a named tile, required for "Other"). */
  faultText?: string;
  /** GPS or typed location. */
  location: string;
  /** Which saved bike was auto-selected, if any. */
  vehicleLabel?: string;
  /** Whether a photo was captured in the app. */
  photoAttached?: boolean;
  /** Whether a voice note was recorded in the app. */
  voiceAttached?: boolean;
  /** Uploaded media URLs once storage accepts them. */
  photoUrl?: string | null;
  voiceUrl?: string | null;
}

/**
 * Build the structured note block stored on the booking. Kept human-readable
 * (one fact per line) so the staff panel can parse the same lines it already
 * relies on for the classic SOS flow.
 */
export function buildExpressSosNote(fields: ExpressSosNoteFields): string {
  const tile = expressSosTileFor(fields.tileId);
  const lines: string[] = [
    `🚨 ${EXPRESS_SOS_LEGACY_MARKER} · ${EXPRESS_SOS_MARKER} — PRIORITY CALL-OUT (skips the workshop queue)`,
    `Issue category: ${tile ? `${tile.emoji} ${tile.tag}` : 'Unknown'}`,
  ];
  if (fields.vehicleLabel) lines.push(`Vehicle: ${fields.vehicleLabel}`);
  lines.push(`Fault: ${(fields.faultText || tile?.hint || '').trim() || 'Rider could not describe it'}`);
  lines.push(`Rider location: ${fields.location.trim()}`);
  lines.push(`Express surcharge: £${EXPRESS_SOS_SURCHARGE.toFixed(2)} (added to the confirmed quote)`);
  if (fields.photoAttached || fields.photoUrl) {
    lines.push(`Photo: ${fields.photoUrl ? fields.photoUrl : 'captured in the app'}`);
  }
  if (fields.voiceAttached || fields.voiceUrl) {
    lines.push(`Voice note: ${fields.voiceUrl ? fields.voiceUrl : `recorded in the app (max ${SOS_VOICE_MAX_SECONDS}s)`}`);
  }
  return lines.join('\n');
}

/**
 * Format a browser geolocation fix into a copyable location string. The
 * coordinates always go through so the mechanic can paste them into a map even
 * when reverse-geocoding is unavailable.
 */
export function formatGpsLocation(
  coords: { latitude: number; longitude: number },
  place?: string | null
): string {
  const lat = coords.latitude.toFixed(5);
  const lon = coords.longitude.toFixed(5);
  const point = `${lat}, ${lon}`;
  return place ? `${place} (${point})` : point;
}

/** Copy for the primary SOS call-out button. */
export function expressSosCtaLabel(surcharge: number = EXPRESS_SOS_SURCHARGE): string {
  return `Request Immediate SOS Call-Out — £${surcharge.toFixed(0)} Express`;
}

/** The three-tap checklist shown as a live status strip above the CTA. */
export function expressSosStepsComplete(args: {
  tileSelected: boolean;
  locationSet: boolean;
  contactSet: boolean;
}): { done: number; total: number } {
  const done = [args.tileSelected, args.locationSet, args.contactSet].filter(Boolean).length;
  return { done, total: 3 };
}
