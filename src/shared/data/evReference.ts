/**
 * E-scooter / e-bike / conversion-kit reference library.
 *
 * Structured, workshop-facing reference data so staff and riders get the full
 * picture: which voltages a brand runs, what battery and motor it uses, which
 * reputable kit makers exist and what the UK rules are. Kept separate from
 * bikeBrands.ts (which powers the pickers) so the large reference tables can be
 * edited on their own.
 *
 * Figures are typical/representative specs for the family, not a per-serial
 * datasheet — always confirm against the actual battery label and charger.
 */

export type EvType = 'e-scooter' | 'e-bike' | 'kit';

export interface VoltageClass {
  /** Nominal pack voltage, e.g. "36 V". */
  voltage: string;
  /** Series cell count, e.g. "10S". */
  series: string;
  /** Full-charge voltage, e.g. "42.0 V". */
  fullCharge: string;
  /** What this class is typically found on. */
  whereSeen: string;
}

export interface EvBrandSpec {
  name: string;
  type: EvType;
  country: string;
  /** Nominal voltages this brand's range runs at. */
  voltages: string[];
  /** Typical battery capacities / watt-hours. */
  battery: string;
  /** Typical motor rating and drive type. */
  motor: string;
  /** Representative models. */
  models: string;
  /** One-line workshop note. */
  note: string;
}

export interface EvKitMaker {
  name: string;
  country: string;
  system: string;
  voltages: string[];
  bestFor: string;
  note: string;
}

export interface EvSafetyPoint {
  title: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Voltage classes — the fastest way to sanity-check a battery label.
// ---------------------------------------------------------------------------
export const EV_VOLTAGE_CLASSES: VoltageClass[] = [
  {
    voltage: '24 V',
    series: '7S',
    fullCharge: '29.4 V',
    whereSeen: 'Older/small city & folding e-bikes and budget hub kits; largely superseded.',
  },
  {
    voltage: '36 V',
    series: '10S',
    fullCharge: '42.0 V',
    whereSeen:
      'The mainstream standard — most e-bikes (Bosch, Shimano, Brose, Yamaha, Giant) and most e-scooters (Xiaomi, Segway-Ninebot, Pure).',
  },
  {
    voltage: '48 V',
    series: '13S',
    fullCharge: '54.6 V',
    whereSeen:
      'Performance hub/mid kits and faster scooters — Bafang BBS02/BBSHD, Cyclotricity Stealth, NIU KQi3, many 25–40 mph scooters.',
  },
  {
    voltage: '52 V',
    series: '14S',
    fullCharge: '58.8 V',
    whereSeen:
      'High-output/hot-rod kits and large scooters — big Bafang HD builds, Kaabo, high-end Dualtron. More heat, more to inspect.',
  },
  {
    voltage: '60 V / 72 V',
    series: '16S / 20S',
    fullCharge: '67.2 V / 84.0 V',
    whereSeen:
      'High-speed performance scooters (some Kaabo Wolf, Dualtron Thunder, NAMI). Almost always outside UK road-legal limits.',
  },
];

// ---------------------------------------------------------------------------
// E-scooter brands
// ---------------------------------------------------------------------------
export const ESCOOTER_BRANDS: EvBrandSpec[] = [
  {
    name: 'Xiaomi',
    type: 'e-scooter',
    country: 'China',
    voltages: ['36 V'],
    battery: '7.8–12.8 Ah (280–474 Wh)',
    motor: '250–350 W rear hub',
    models: 'M365, 1S, Pro 2, Essential, Electric Scooter 3 / 4 Pro',
    note: 'The most common brand we see; 36 V/42 V chargers are widely interchangeable — check polarity.',
  },
  {
    name: 'Segway-Ninebot',
    type: 'e-scooter',
    country: 'China / USA',
    voltages: ['36 V'],
    battery: '5.1–15.3 Ah (up to 551 Wh)',
    motor: '250–500 W rear hub',
    models: 'MAX G30 / G30P, MAX G2, F40 / F30 / F25, E25 / E45, D28 / D38',
    note: 'Ninebot MAX uses a 36 V 551 Wh pack; controller is sealed — diagnose before opening.',
  },
  {
    name: 'NIU',
    type: 'e-scooter',
    country: 'China',
    voltages: ['36 V', '48 V'],
    battery: '365–486 Wh',
    motor: '300–350 W rear hub',
    models: 'KQi2 Pro (36 V), KQi3 Pro / Max (48 V), KQi Air (carbon, 36 V)',
    note: 'KQi3 moved to 48 V — do not fit a 36 V charger.',
  },
  {
    name: 'Pure Electric',
    type: 'e-scooter',
    country: 'UK',
    voltages: ['36 V'],
    battery: '7.2–10.4 Ah',
    motor: '250 W nominal (higher peak) rear hub',
    models: 'Pure Air (Gen 1 / 2), Pure Air Pro, Pure Advance / Advance Flex',
    note: 'UK brand, strong parts support; Advance has a distinctive folding chassis.',
  },
  {
    name: 'Bird',
    type: 'e-scooter',
    country: 'USA',
    voltages: ['36 V'],
    battery: '9–12.8 Ah',
    motor: '250–350 W rear hub',
    models: 'Bird One, Bird Air, Bird Flex',
    note: 'Rental-fleet heritage; consumer models are 36 V.',
  },
  {
    name: 'Apollo Scooters',
    type: 'e-scooter',
    country: 'Canada',
    voltages: ['48 V', '52 V', '60 V'],
    battery: '13–30 Ah',
    motor: '500–1200 W (single/dual)',
    models: 'City, Ghost, Phantom, Pro',
    note: 'Performance class — dual motors, hydraulic brakes; check torque arms and brake bleed.',
  },
  {
    name: 'Dualtron (Minimotors)',
    type: 'e-scooter',
    country: 'South Korea',
    voltages: ['60 V', '72 V'],
    battery: 'Large packs, 24–40 Ah',
    motor: 'High-output dual hub (1000–4000 W+)',
    models: 'Thunder, Victor, X2, Storm',
    note: 'High-voltage performance scooters — not UK road-legal; treat as off-road.',
  },
  {
    name: 'Kaabo',
    type: 'e-scooter',
    country: 'China',
    voltages: ['48 V', '60 V', '72 V'],
    battery: '18–35 Ah',
    motor: 'Dual hub, 800–2000 W+',
    models: 'Mantis 8 / 10, Wolf Warrior, Wolf King',
    note: 'Popular performance brand; suspension and controller work is common.',
  },
  {
    name: 'InMotion',
    type: 'e-scooter',
    country: 'China',
    voltages: ['36 V', '48 V', '60 V', '72 V'],
    battery: '8–30 Ah',
    motor: '250–1200 W',
    models: 'S1, S1 Pro, Climber, RS',
    note: 'Runs the full voltage spread across its range — always confirm the model.',
  },
  {
    name: 'Vsett',
    type: 'e-scooter',
    country: 'China',
    voltages: ['48 V', '52 V', '60 V', '72 V'],
    battery: '13–32 Ah',
    motor: '500–2000 W (dual)',
    models: 'Vsett 8, 9, 10, 11',
    note: 'Performance/value brand; voltage rises quickly up the range.',
  },
  {
    name: 'GoTrax',
    type: 'e-scooter',
    country: 'USA',
    voltages: ['36 V'],
    battery: '5.2–10.4 Ah',
    motor: '250–300 W rear hub',
    models: 'GXL V2, XR Elite, Apex',
    note: 'Budget commuter scooters; 36 V throughout.',
  },
  {
    name: 'Unagi',
    type: 'e-scooter',
    country: 'USA',
    voltages: ['36 V'],
    battery: '~9.6 Ah',
    motor: '250–450 W rear hub',
    models: 'Model One, Model Eleven',
    note: 'Lightweight magnesium frame; single-motor commuter.',
  },
  {
    name: 'Micro',
    type: 'e-scooter',
    country: 'Switzerland',
    voltages: ['36 V'],
    battery: '7.8–10 Ah',
    motor: '250 W rear hub',
    models: 'Merlin, Explorer, Condor',
    note: 'Premium Swiss commuter brand; quality components.',
  },
  {
    name: 'Razor',
    type: 'e-scooter',
    country: 'USA',
    voltages: ['24 V'],
    battery: 'Sealed lead-acid or small li-ion',
    motor: '100–250 W',
    models: 'E300, Ecosmart Metro, Power Core',
    note: 'Mostly 24 V and often lead-acid — very different from modern li-ion.',
  },
  {
    name: 'Okai',
    type: 'e-scooter',
    country: 'China',
    voltages: ['36 V'],
    battery: '7.5–10 Ah',
    motor: '250–350 W rear hub',
    models: 'ES400, Neon, Ranger',
    note: 'OEM for several rental fleets; 36 V.',
  },
  {
    name: 'Swifty',
    type: 'e-scooter',
    country: 'UK',
    voltages: ['36 V'],
    battery: '~8 Ah',
    motor: '250 W rear hub',
    models: 'SwiftyONE, SwiftyAir',
    note: 'UK brand; simple commuter builds.',
  },
];

// ---------------------------------------------------------------------------
// E-scooter / e-bike battery-capacity and range rules of thumb
// ---------------------------------------------------------------------------
export const EV_RANGE_RULES: string[] = [
  'Range ≈ battery Wh ÷ 15–25 Wh per mile (higher figure = hills, headwind, heavy rider, cold).',
  'A 36 V 10 Ah pack is ~360 Wh → roughly 15–25 miles in real mixed riding.',
  'A 48 V 13 Ah pack is ~624 Wh → roughly 25–40 miles.',
  'Cold weather (below ~10 °C) can cut usable capacity by 20–30%.',
  'A battery that drops sharply under load, or only charges to ~70%, is on its way out.',
];

// ---------------------------------------------------------------------------
// Factory e-bike drive systems (the motor makers behind most OEM e-bikes)
// ---------------------------------------------------------------------------
export const EBIKE_DRIVE_SYSTEMS: EvBrandSpec[] = [
  {
    name: 'Bosch',
    type: 'e-bike',
    country: 'Germany',
    voltages: ['36 V'],
    battery: '300–750 Wh (PowerPack / PowerTube)',
    motor: '250 W mid-drive; Active Line / Performance Line / CX / Speed',
    models: 'Active Line Plus, Performance Line, Performance Line CX, Cargo Line',
    note: 'Dominant OEM system. Diagnostics usually need the Bosch dealer tool.',
  },
  {
    name: 'Shimano STEPS',
    type: 'e-bike',
    country: 'Japan',
    voltages: ['36 V'],
    battery: '400–630 Wh',
    motor: '250 W mid-drive; E5000 / E6100 / E7000 / E8000 / EP8',
    models: 'E5000 (city), E6100 (trekking), E8000 / EP8 (MTB)',
    note: 'Widely fitted by Giant, Merida, Canyon and others.',
  },
  {
    name: 'Brose',
    type: 'e-bike',
    country: 'Germany',
    voltages: ['36 V'],
    battery: '400–750 Wh',
    motor: '250 W mid-drive; Drive C / Drive S Mag',
    models: 'Drive S Mag, Drive C',
    note: 'Quiet, high-torque; used by Specialized, Riese & Müller, some Kalkhoff.',
  },
  {
    name: 'Yamaha',
    type: 'e-bike',
    country: 'Japan',
    voltages: ['36 V'],
    battery: '400–600 Wh',
    motor: '250 W mid-drive; PW-SE / PW-X',
    models: 'PW-SE, PW-X, PW-X2',
    note: 'Also the basis of Giant SyncDrive.',
  },
  {
    name: 'Giant SyncDrive',
    type: 'e-bike',
    country: 'Taiwan',
    voltages: ['36 V'],
    battery: '400–625 Wh (EnergyPak)',
    motor: '250 W mid-drive (Yamaha-based)',
    models: 'SyncDrive Core / Sport / Pro / Life',
    note: 'Giant-branded Yamaha system with Giant EnergyPak batteries.',
  },
  {
    name: 'Specialized',
    type: 'e-bike',
    country: 'USA',
    voltages: ['36 V'],
    battery: '320–710 Wh (Turbo)',
    motor: '250 W mid-drive (Turbo full-power) or Mahle hub (SL)',
    models: 'Turbo 1.2 / 2.2 (full power), Turbo SL (Mahle)',
    note: 'Two families: full-power mid-drive and lightweight SL hub.',
  },
  {
    name: 'Mahle',
    type: 'e-bike',
    country: 'Germany',
    voltages: ['36 V'],
    battery: '250–350 Wh (in-frame / range-extender)',
    motor: '250 W rear hub; X35 / X20',
    models: 'X35, X20 (Smartbike)',
    note: 'Lightweight hub system used by many light e-bikes and Specialized SL.',
  },
  {
    name: 'Fazua',
    type: 'e-bike',
    country: 'Germany',
    voltages: ['36 V'],
    battery: '250–430 Wh (removable)',
    motor: '250 W mid-drive (removable unit); Ride 50 / Ride 60',
    models: 'Ride 50, Ride 60',
    note: 'Removable motor+battery for light e-bikes; good for commuter/gravel.',
  },
  {
    name: 'TQ',
    type: 'e-bike',
    country: 'Germany',
    voltages: ['36 V'],
    battery: '~360 Wh',
    motor: '250 W mid-drive (HPR50)',
    models: 'HPR50',
    note: 'Compact, light mid-drive used on premium light e-bikes.',
  },
  {
    name: 'Panasonic',
    type: 'e-bike',
    country: 'Japan',
    voltages: ['36 V'],
    battery: '400–600 Wh',
    motor: '250 W mid-drive; GX0 / GX Ultimate',
    models: 'GX0, GX Ultimate',
    note: 'Common on European city/trekking bikes.',
  },
  {
    name: 'Bafang (factory OEM)',
    type: 'e-bike',
    country: 'China',
    voltages: ['36 V', '48 V'],
    battery: '400–800 Wh',
    motor: '250–1000 W mid-drive; M-series',
    models: 'M400, M500, M600, M620',
    note: 'Same maker as the famous conversion kits — OEM mid-drives are a different line.',
  },
];

// ---------------------------------------------------------------------------
// Conversion-kit makers (aftermarket)
// ---------------------------------------------------------------------------
export const CONVERSION_KIT_MAKERS: EvKitMaker[] = [
  {
    name: 'Bafang',
    country: 'China',
    system: 'Mid-drive (BBS) + hub kits',
    voltages: ['36 V', '48 V', '52 V'],
    bestFor: 'The default DIY mid-drive; huge parts availability.',
    note: 'BBS01 250–350 W (36 V), BBS02 500–750 W (36/48 V), BBSHD 1000–1500 W (48/52 V).',
  },
  {
    name: 'Tongsheng',
    country: 'China',
    system: 'Mid-drive (torque-sensing)',
    voltages: ['36 V', '48 V'],
    bestFor: 'Riders who want natural, torque-sensing pedal assist on a budget.',
    note: 'TSDZ2 250–750 W; needs a firmware/config to feel right.',
  },
  {
    name: 'Cyclotricity',
    country: 'UK',
    system: 'Front & rear hub kits',
    voltages: ['36 V', '48 V'],
    bestFor: 'UK buyers wanting local support and a range of hub kits.',
    note: 'Revo (front hub), Stealth (rear hub); 250–1000 W.',
  },
  {
    name: 'Swytch',
    country: 'UK',
    system: 'Front-wheel, quick-swap',
    voltages: ['36 V'],
    bestFor: 'Non-technical riders converting an existing bike in minutes.',
    note: '36 V 250 W; battery in a handlebar bag; removable to keep it light.',
  },
  {
    name: 'Pendix',
    country: 'Germany',
    system: 'Mid-drive (OEM-grade)',
    voltages: ['48 V'],
    bestFor: 'A premium, clean conversion of a quality frame.',
    note: 'eDrive / eDrive S; made for retrofitting high-end bikes.',
  },
  {
    name: 'Dillenger',
    country: 'Australia',
    system: 'Front & rear hub kits',
    voltages: ['36 V', '48 V'],
    bestFor: 'Complete, well-documented hub-kit packages.',
    note: 'Plug-and-play kits with battery and controller included.',
  },
  {
    name: 'Voilamart',
    country: 'China',
    system: 'Budget hub kits',
    voltages: ['36 V', '48 V'],
    bestFor: 'Cheap entry-level conversions (build quality varies).',
    note: '250–1500 W; check wiring, connectors and torque arms carefully.',
  },
  {
    name: 'Grin Technologies',
    country: 'Canada',
    system: 'Hub motors + Cycle Analyst',
    voltages: ['36 V', '48 V', '52 V'],
    bestFor: 'Engineers wanting precise control and instrumentation.',
    note: 'Cycle Analyst is a respected aftermarket display/limiter.',
  },
  {
    name: 'Crystalyte',
    country: 'Canada',
    system: 'High-power hub motors',
    voltages: ['48 V', '52 V', '72 V'],
    bestFor: 'High-power/high-speed builds.',
    note: 'Often paired with large controllers; check torque arms and brakes.',
  },
  {
    name: 'Golden Motor',
    country: 'China',
    system: 'Hub motors (Magic Pie)',
    voltages: ['36 V', '48 V'],
    bestFor: 'Self-contained hub kits with integrated controller.',
    note: 'Magic Pie range; popular for simple builds.',
  },
  {
    name: 'CYC',
    country: 'China / Hong Kong',
    system: 'High-power mid-drive',
    voltages: ['48 V', '52 V', '72 V'],
    bestFor: 'Performance mid-drive builds that need big torque.',
    note: 'X1 Pro / Photon; serious drivetrain loads — inspect the chain and freewheel.',
  },
];

// ---------------------------------------------------------------------------
// UK legal position (2026)
// ---------------------------------------------------------------------------
export const EV_LEGAL_NOTES: string[] = [
  'E-bike (EAPC): legal on the road if the motor is ≤ 250 W, pedal-assist cuts out at 15.5 mph (25 km/h), and any throttle only drives up to 4 mph (6 km/h). No licence, insurance or tax needed; minimum rider age 14.',
  'E-scooter: private e-scooters are illegal to ride on public roads, pavements or cycle lanes in the UK. Only government-approved rental trial scooters are legal, and only in participating areas.',
  'Riding a private e-scooter illegally risks a fine, penalty points and having the scooter seized.',
  'Insurance for private e-scooters is effectively unavailable, so a crash is an uninsured loss.',
  'A converted e-bike must still meet the EAPC limits to stay road-legal — a 1000 W+ kit is not.',
];

// ---------------------------------------------------------------------------
// Battery safety (workshop + customer guidance)
// ---------------------------------------------------------------------------
export const EV_BATTERY_SAFETY: EvSafetyPoint[] = [
  {
    title: 'Charge on a hard, non-flammable surface',
    detail: 'Never charge on carpet, wood or in a hallway by an exit. Lithium fires spread fast.',
  },
  {
    title: 'Never charge unattended overnight',
    detail: 'Charge while you are awake and present; unplug when the charger turns green.',
  },
  {
    title: 'Match the charger to the pack',
    detail: 'A 48 V pack needs a 54.6 V charger — a 36 V/42 V charger will never fully charge it, and the wrong voltage can damage cells.',
  },
  {
    title: 'Check for damage and swelling',
    detail: 'Swollen, punctured, water-damaged or very hot packs should be removed from service and stored away from anything flammable.',
  },
  {
    title: 'Store long-term at ~50%',
    detail: 'For winter storage, leave the pack around half charge and keep it cool and dry — not fully charged or fully flat.',
  },
  {
    title: 'Use reputable cells and BMS',
    detail: 'Budget kits with unbranded cells and no proper battery-management board are the highest fire risk. Recommend known makers.',
  },
];

/** Every brand in the reference library, for search and lookups. */
export const EV_BRAND_SPECS: EvBrandSpec[] = [...ESCOOTER_BRANDS, ...EBIKE_DRIVE_SYSTEMS];

/** Case-insensitive lookup of a brand's reference spec (scooter, e-bike or kit). */
export function evSpecForBrand(name: string): EvBrandSpec | undefined {
  const lower = (name || '').trim().toLowerCase();
  if (!lower) return undefined;
  return EV_BRAND_SPECS.find((b) => b.name.toLowerCase() === lower);
}

/** All nominal voltages mentioned anywhere in the reference data. */
export function allEvVoltages(): string[] {
  const set = new Set<string>();
  for (const v of EV_VOLTAGE_CLASSES) set.add(v.voltage);
  for (const b of EV_BRAND_SPECS) for (const v of b.voltages) set.add(v);
  for (const k of CONVERSION_KIT_MAKERS) for (const v of k.voltages) set.add(v);
  return [...set].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/** Flat, de-duplicated list of voltage values used by the booking form select. */
export const EV_SYSTEM_VOLTAGE_OPTIONS: string[] = [
  '24 V (7S)',
  '36 V (10S)',
  '48 V (13S)',
  '52 V (14S)',
  '60 V (16S)',
  '72 V (20S)',
  'Not Sure',
];
