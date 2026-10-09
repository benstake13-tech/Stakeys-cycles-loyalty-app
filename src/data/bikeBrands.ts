/**
 * Bike brand / model reference data plus the e-bike conversion questions.
 *
 * Kept separate from bikeCatalog.ts so the (large) brand tables can be edited
 * without touching the service catalogue. bikeCatalog re-exports everything
 * here, so existing imports keep working.
 */
import { VehicleCategory } from '../types/bikeShop';

/**
 * Brand profiles power the searchable brand picker: the type tags let a rider
 * filter straight to "Mountain" or "E-Bike" instead of scanning 80+ names, and
 * the country is shown as a subtitle so unfamiliar brands still feel findable.
 */
export interface BikeBrandProfile {
  name: string;
  types: BikeBrandType[];
  country: string;
}

export type BikeBrandType =
  | 'Mountain'
  | 'Road'
  | 'Hybrid'
  | 'Gravel'
  | 'E-Bike'
  | 'Kids'
  | 'City'
  | 'Folding'
  | 'Cargo'
  | 'Touring'
  | 'E-Scooter'
  | 'Conversion Kit';

export const BIKE_BRAND_TYPES: BikeBrandType[] = [
  'Mountain',
  'Road',
  'Hybrid',
  'Gravel',
  'E-Bike',
  'Kids',
  'City',
  'Folding',
  'Cargo',
  'Touring',
  'E-Scooter',
  'Conversion Kit',
];

export const BIKE_BRAND_PROFILES: BikeBrandProfile[] = [
  { name: 'Trek', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike', 'Kids'], country: 'USA' },
  { name: 'Specialized', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike', 'Kids'], country: 'USA' },
  { name: 'Giant', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike'], country: 'Taiwan' },
  { name: 'Cannondale', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike'], country: 'USA' },
  { name: 'Scott', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike'], country: 'Switzerland' },
  { name: 'Cube', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike', 'Touring'], country: 'Germany' },
  { name: 'Merida', types: ['Mountain', 'Road', 'Hybrid', 'Gravel', 'E-Bike'], country: 'Taiwan' },
  { name: 'Orbea', types: ['Mountain', 'Road', 'Gravel', 'E-Bike'], country: 'Spain' },
  { name: 'Bianchi', types: ['Road', 'Gravel', 'E-Bike', 'City'], country: 'Italy' },
  { name: 'Pinarello', types: ['Road', 'Gravel'], country: 'Italy' },
  { name: 'Colnago', types: ['Road', 'Gravel'], country: 'Italy' },
  { name: 'Wilier', types: ['Road', 'Gravel'], country: 'Italy' },
  { name: 'Canyon', types: ['Mountain', 'Road', 'Gravel', 'E-Bike', 'City'], country: 'Germany' },
  { name: 'Focus', types: ['Mountain', 'Road', 'Gravel', 'E-Bike', 'City'], country: 'Germany' },
  { name: 'Bergamont', types: ['Mountain', 'Hybrid', 'E-Bike', 'City'], country: 'Germany' },
  { name: 'Ghost', types: ['Mountain', 'Hybrid', 'E-Bike'], country: 'Germany' },
  { name: 'Haibike', types: ['E-Bike', 'Mountain', 'Touring'], country: 'Germany' },
  { name: 'Kalkhoff', types: ['E-Bike', 'Touring', 'City'], country: 'Germany' },
  { name: 'Riese & Müller', types: ['E-Bike', 'Cargo', 'Touring'], country: 'Germany' },
  { name: 'KTM', types: ['Mountain', 'Hybrid', 'E-Bike'], country: 'Austria' },
  { name: 'Raleigh', types: ['Hybrid', 'City', 'E-Bike', 'Kids', 'Touring'], country: 'UK' },
  { name: 'Carrera', types: ['Mountain', 'Hybrid', 'Road', 'E-Bike', 'Kids'], country: 'UK' },
  { name: 'Boardman', types: ['Mountain', 'Hybrid', 'Road', 'Gravel', 'E-Bike'], country: 'UK' },
  { name: 'Voodoo', types: ['Mountain', 'E-Bike'], country: 'UK' },
  { name: 'Apollo', types: ['Mountain', 'Hybrid', 'Kids'], country: 'UK' },
  { name: 'Pinnacle', types: ['Mountain', 'Hybrid', 'Road', 'Gravel', 'E-Bike'], country: 'UK' },
  { name: 'Whyte', types: ['Mountain', 'Hybrid', 'Gravel', 'E-Bike'], country: 'UK' },
  { name: 'Saracen', types: ['Mountain', 'E-Bike'], country: 'UK' },
  { name: 'Orange', types: ['Mountain', 'E-Bike'], country: 'UK' },
  { name: 'Genesis', types: ['Road', 'Gravel', 'Hybrid', 'City'], country: 'UK' },
  { name: 'Ridgeback', types: ['Hybrid', 'City', 'E-Bike', 'Kids'], country: 'UK' },
  { name: 'Claud Butler', types: ['Hybrid', 'Mountain', 'E-Bike', 'City'], country: 'UK' },
  { name: 'Dawes', types: ['Hybrid', 'City', 'Touring', 'E-Bike'], country: 'UK' },
  { name: 'Ribble', types: ['Road', 'Gravel', 'E-Bike'], country: 'UK' },
  { name: 'Planet X', types: ['Road', 'Gravel', 'Mountain'], country: 'UK' },
  { name: 'Cotic', types: ['Mountain', 'Gravel'], country: 'UK' },
  { name: 'Ragley', types: ['Mountain'], country: 'UK' },
  { name: 'Calibre', types: ['Mountain'], country: 'UK' },
  { name: 'Forme', types: ['Hybrid', 'Road', 'Kids'], country: 'UK' },
  { name: 'Hoy Bikes', types: ['Kids', 'Hybrid', 'Road'], country: 'UK' },
  { name: 'Squish', types: ['Kids'], country: 'UK' },
  { name: 'Frog Bikes', types: ['Kids'], country: 'UK' },
  { name: 'Islabikes', types: ['Kids'], country: 'UK' },
  { name: 'Woom', types: ['Kids'], country: 'Austria' },
  { name: 'Tern', types: ['Folding', 'Cargo', 'E-Bike'], country: 'Taiwan' },
  { name: 'Brompton', types: ['Folding', 'E-Bike', 'City'], country: 'UK' },
  { name: 'Dahon', types: ['Folding', 'E-Bike'], country: 'USA' },
  { name: 'Gocycle', types: ['Folding', 'E-Bike'], country: 'UK' },
  { name: 'MiRider', types: ['Folding', 'E-Bike'], country: 'UK' },
  { name: 'Btwin', types: ['Mountain', 'Hybrid', 'Road', 'E-Bike', 'Kids', 'City'], country: 'France' },
  { name: 'Rockrider', types: ['Mountain', 'E-Bike'], country: 'France' },
  { name: 'Van Rysel', types: ['Road', 'Gravel'], country: 'France' },
  { name: 'Riverside', types: ['Hybrid', 'Touring'], country: 'France' },
  { name: 'Elops', types: ['City', 'E-Bike'], country: 'France' },
  { name: 'Triban', types: ['Road', 'Gravel'], country: 'France' },
  { name: 'Kona', types: ['Mountain', 'Gravel', 'E-Bike'], country: 'USA' },
  { name: 'Marin', types: ['Mountain', 'Hybrid', 'Gravel', 'E-Bike'], country: 'USA' },
  { name: 'Santa Cruz', types: ['Mountain', 'E-Bike'], country: 'USA' },
  { name: 'Yeti', types: ['Mountain', 'E-Bike'], country: 'USA' },
  { name: 'Norco', types: ['Mountain', 'Gravel', 'E-Bike'], country: 'Canada' },
  { name: 'Rocky Mountain', types: ['Mountain', 'E-Bike'], country: 'Canada' },
  { name: 'GT', types: ['Mountain', 'Hybrid', 'Kids'], country: 'USA' },
  { name: 'Mongoose', types: ['Mountain', 'Kids', 'E-Bike'], country: 'USA' },
  { name: 'Surly', types: ['Gravel', 'Touring', 'Cargo'], country: 'USA' },
  { name: 'Salsa', types: ['Gravel', 'Mountain', 'Touring'], country: 'USA' },
  { name: 'Bombtrack', types: ['Gravel', 'Touring'], country: 'Germany' },
  { name: 'Sonder', types: ['Mountain', 'Gravel'], country: 'UK' },
  { name: 'Fairlight', types: ['Road', 'Gravel'], country: 'UK' },
  { name: 'Gazelle', types: ['City', 'E-Bike', 'Touring'], country: 'Netherlands' },
  { name: 'Batavus', types: ['City', 'E-Bike', 'Touring'], country: 'Netherlands' },
  { name: 'Sparta', types: ['City', 'E-Bike'], country: 'Netherlands' },
  { name: 'VanMoof', types: ['City', 'E-Bike'], country: 'Netherlands' },
  { name: 'Cowboy', types: ['City', 'E-Bike'], country: 'Belgium' },
  { name: 'Moustache', types: ['E-Bike', 'Touring', 'Cargo'], country: 'France' },
  { name: 'Flyer', types: ['E-Bike', 'City'], country: 'Switzerland' },
  { name: 'Rad Power Bikes', types: ['E-Bike', 'Cargo', 'City'], country: 'USA' },
  { name: 'Estarli', types: ['E-Bike', 'Folding'], country: 'UK' },
  { name: 'Eovolt', types: ['E-Bike', 'Folding'], country: 'UK' },
  { name: 'Wisper', types: ['E-Bike', 'City'], country: 'UK' },
  { name: 'Volt', types: ['E-Bike', 'City'], country: 'UK' },
  { name: 'FreeGo', types: ['E-Bike', 'City'], country: 'UK' },
  { name: 'Pure Electric', types: ['E-Scooter', 'E-Bike', 'City'], country: 'UK' },
  { name: 'Xiaomi', types: ['E-Scooter'], country: 'China' },
  { name: 'Segway-Ninebot', types: ['E-Scooter'], country: 'China/USA' },
  { name: 'NIU', types: ['E-Scooter'], country: 'China' },
  { name: 'Apollo Scooters', types: ['E-Scooter'], country: 'Canada' },
  { name: 'Vsett', types: ['E-Scooter'], country: 'China' },
  { name: 'Dualtron', types: ['E-Scooter'], country: 'South Korea' },
  { name: 'Minimotors', types: ['E-Scooter'], country: 'South Korea' },
  { name: 'Kaabo', types: ['E-Scooter'], country: 'China' },
  { name: 'Nanrobot', types: ['E-Scooter'], country: 'China' },
  { name: 'InMotion', types: ['E-Scooter'], country: 'China' },
  { name: 'NAMI', types: ['E-Scooter'], country: 'Russia' },
  { name: 'Razor', types: ['E-Scooter'], country: 'USA' },
  { name: 'Bird', types: ['E-Scooter'], country: 'USA' },
  { name: 'Lime', types: ['E-Scooter'], country: 'USA' },
  { name: 'Micro', types: ['E-Scooter'], country: 'Switzerland' },
  { name: 'Unagi', types: ['E-Scooter'], country: 'USA' },
  { name: 'Hiboy', types: ['E-Scooter'], country: 'USA' },
  { name: 'GoTrax', types: ['E-Scooter'], country: 'USA' },
  { name: 'Okai', types: ['E-Scooter'], country: 'Czech Republic' },
  { name: 'Levy', types: ['E-Scooter'], country: 'USA' },
  { name: 'Boosted', types: ['E-Scooter'], country: 'USA' },
  { name: 'Fluidfreeride', types: ['E-Scooter'], country: 'USA' },
  { name: 'iScooter', types: ['E-Scooter'], country: 'China' },
  { name: 'Wheelspeed', types: ['E-Scooter'], country: 'China' },
  { name: 'Hover-1', types: ['E-Scooter'], country: 'USA' },
  { name: 'Swagtron', types: ['E-Scooter'], country: 'USA' },
  { name: 'Segway', types: ['E-Scooter'], country: 'USA' },
  { name: 'Talaria', types: ['E-Scooter', 'E-Bike'], country: 'China' },
  { name: 'Swytch', types: ['Conversion Kit', 'E-Bike'], country: 'UK' },
  { name: 'Cyclotricity', types: ['Conversion Kit', 'E-Bike'], country: 'UK' },
  { name: 'Bafang', types: ['Conversion Kit', 'E-Bike'], country: 'China' },
  { name: 'Pendix', types: ['Conversion Kit', 'E-Bike'], country: 'Germany' },
  { name: 'Dillenger', types: ['Conversion Kit', 'E-Bike'], country: 'Australia' },
  { name: 'Other / Not Listed', types: [...BIKE_BRAND_TYPES], country: '—' },
  { name: 'I Don’t Know My Brand', types: [...BIKE_BRAND_TYPES], country: '—' },
];

/** Flat, ordered brand names — kept for the simple <select> fallback and legacy callers. */
export const POPULAR_BIKE_BRANDS: string[] = BIKE_BRAND_PROFILES.map((b) => b.name);

/** Every model family we know, keyed by exact brand name. */
export const BRAND_MODELS_MAP: Record<string, string[]> = {
  Trek: [
    'Marlin (Mountain)',
    'Roscoe (Trail Mountain)',
    'X-Caliber (Cross-Country)',
    'Fuel EX (Full Suspension)',
    'Slash (Enduro)',
    'Remedy (All-Mountain)',
    'Top Fuel (XC Race)',
    'FX 1 / 2 / 3 (Hybrid Commuter)',
    'Verve (Comfort Leisure)',
    'Dual Sport (All-Terrain Hybrid)',
    'Domane (Road / Endurance)',
    'Émonda (Lightweight Road)',
    'Madone (Aero Road)',
    'Checkpoint (Gravel)',
    'Boone (Cyclocross)',
    'Rail (Electric Mountain)',
    'Powerfly (Electric Mountain)',
    'Allant+ (Electric Commuter)',
    'FX+ (Electric Hybrid)',
    'Verve+ (Electric Comfort)',
    'Precaliber (Kids)',
    'Wahoo (Kids)',
    'Other Trek Model',
    'Don’t Know Exact Model',
  ],
  Specialized: [
    'Rockhopper (Mountain)',
    'Chisel (XC Mountain)',
    'Fuse (Trail Hardtail)',
    'Stumpjumper (Full Suspension)',
    'Enduro (Enduro)',
    'Epic (XC Race)',
    'Sirrus (Hybrid Commuter)',
    'Crosstrail (Hybrid)',
    'Roll (Comfort / City)',
    'Allez (Road)',
    'Roubaix (Endurance Road)',
    'Tarmac (Performance Road)',
    'Aethos (Lightweight Road)',
    'Diverge (Gravel)',
    'Crux (Cyclocross / Gravel)',
    'Turbo Vado (Electric Commuter)',
    'Turbo Como (Electric City)',
    'Turbo Levo (Electric Mountain)',
    'Turbo Tero (Electric Trail)',
    'Riprock (Kids)',
    'Jett (Kids)',
    'Other Specialized Model',
    'Don’t Know Exact Model',
  ],
  Giant: [
    'Talon (Mountain)',
    'Fathom (Trail Mountain)',
    'Trance (Full Suspension)',
    'Reign (Enduro)',
    'Anthem (XC Race)',
    'Escape (Hybrid Commuter)',
    'Roam (All-Terrain Hybrid)',
    'Cypress (Comfort)',
    'Contend (Road)',
    'Defy (Endurance Road)',
    'TCR (Race Road)',
    'Propel (Aero Road)',
    'Revolt (Gravel)',
    'Explore E+ (Electric Hybrid)',
    'FastRoad E+ (Electric Fitness)',
    'Trance X E+ (Electric Mountain)',
    'Stance E+ (Electric Trail)',
    'Rincon (Kids)',
    'Other Giant Model',
    'Don’t Know Exact Model',
  ],
  Cannondale: [
    'Trail (Mountain)',
    'Cujo (Trail Hardtail)',
    'Habit (Full Suspension)',
    'Scalpel (XC Race)',
    'Jekyll (Enduro)',
    'Quick (Hybrid Commuter)',
    'Treadwell (City / Comfort)',
    'Synapse (Endurance Road)',
    'SuperSix EVO (Race Road)',
    'CAAD (Aluminium Road)',
    'Topstone (Gravel)',
    'SuperX (Cyclocross)',
    'Mavaro Neo (Electric City)',
    'Tesoro Neo (Electric Commuter)',
    'Moterra Neo (Electric Mountain)',
    'Kids Trail (Kids)',
    'Other Cannondale Model',
    'Don’t Know Exact Model',
  ],
  Scott: [
    'Scale (Mountain)',
    'Aspect (Mountain)',
    'Spark (Full Suspension)',
    'Genius (Trail / Enduro)',
    'Ransom (Enduro)',
    'Sub Cross (Hybrid)',
    'Sub Comfort (Comfort)',
    'Speedster (Road / Gravel)',
    'Addict (Road)',
    'Foil (Aero Road)',
    'Contessa (Women’s Range)',
    'Sub Active eRide (Electric)',
    'Aspect eRide (Electric Mountain)',
    'Genius eRide (Electric Trail)',
    'Other Scott Model',
    'Don’t Know Exact Model',
  ],
  Cube: [
    'Aim (Mountain)',
    'Attention (Mountain)',
    'Acid (Mountain)',
    'Reaction (XC Mountain)',
    'Stereo (Full Suspension)',
    'Nature (Hybrid)',
    'Kathmandu (Trekking)',
    'Touring (Trekking / Commuter)',
    'Attain (Road)',
    'Agree (Endurance Road)',
    'Litening (Race Road)',
    'Nuroad (Gravel)',
    'Stereo Hybrid (Electric MTB)',
    'Reaction Hybrid (Electric XC)',
    'Kathmandu Hybrid (Electric Tourer)',
    'Touring Hybrid (Electric Trekking)',
    'Acid Hybrid (Electric Mountain)',
    'Other Cube Model',
    'Don’t Know Exact Model',
  ],
  Merida: [
    'Big Nine (Mountain 29")',
    'Big Seven (Mountain 27.5")',
    'Matts (Mountain)',
    'One-Twenty (Full Suspension)',
    'One-Forty (Trail)',
    'Crossway (Hybrid)',
    'Speeder (Fitness Hybrid)',
    'Scultura (Road)',
    'Reacto (Aero Road)',
    'Silex (Gravel)',
    'eBig Nine (Electric Mountain)',
    'eSpresso (Electric Hybrid)',
    'Other Merida Model',
    'Don’t Know Exact Model',
  ],
  Orbea: [
    'Alma (XC Mountain)',
    'Laufey (Trail Hardtail)',
    'Occam (Trail)',
    'Rallon (Enduro)',
    'Rise (Lightweight Electric MTB)',
    'Orca (Road)',
    'Avant (Endurance Road)',
    'Terra (Gravel)',
    'Gain (Electric Road / Gravel)',
    'Katu (Electric City)',
    'Other Orbea Model',
    'Don’t Know Exact Model',
  ],
  Bianchi: [
    'Oltre (Aero Road)',
    'Specialissima (Lightweight Road)',
    'Infinito (Endurance Road)',
    'Sprint (Road)',
    'Via Nirone (Alloy Road)',
    'Impulso (Gravel / Allroad)',
    'Arcadex (Gravel)',
    'E-Omnia (Electric)',
    'C-Sport (City / Hybrid)',
    'Other Bianchi Model',
    'Don’t Know Exact Model',
  ],
  Pinarello: [
    'Dogma (Race Road)',
    'Prince (Road)',
    'Gan (Road)',
    'X (Gravel)',
    'Grevil (Gravel)',
    'Nytro (Electric)',
    'Other Pinarello Model',
    'Don’t Know Exact Model',
  ],
  Colnago: [
    'V4Rs (Race Road)',
    'C68 (Road)',
    'V3 (Road)',
    'G3-X (Gravel)',
    'G4-X (Gravel)',
    'Other Colnago Model',
    'Don’t Know Exact Model',
  ],
  Wilier: [
    'Filante (Aero Road)',
    'Zero SLR (Lightweight Road)',
    'Cento (Endurance Road)',
    'Rave (Gravel)',
    'Jena (Gravel)',
    'Other Wilier Model',
    'Don’t Know Exact Model',
  ],
  Canyon: [
    'Grand Canyon (Mountain)',
    'Stoic (Trail Hardtail)',
    'Spectral (Trail / Enduro)',
    'Neuron (Trail)',
    'Lux (XC Race)',
    'Torque (Enduro)',
    'Pathlite (Hybrid)',
    'Commuter (City)',
    'Endurace (Endurance Road)',
    'Ultimate (Road)',
    'Aeroad (Aero Road)',
    'Grail (Gravel)',
    'Inflite (Cyclocross)',
    'Neuron:ON (Electric Mountain)',
    'Grail:ON (Electric Gravel)',
    'Pathlite:ON (Electric Hybrid)',
    'Precede:ON (Electric City)',
    'Other Canyon Model',
    'Don’t Know Exact Model',
  ],
  Focus: [
    'Whistler (Mountain)',
    'Jam (Trail)',
    'Sam (Enduro)',
    'Raven (XC)',
    'Izak (Hybrid)',
    'Planet (City)',
    'Izalco (Road)',
    'Paralane (Endurance Road)',
    'Atlas (Gravel)',
    'Aventura (Electric Trekking)',
    'Thron (Electric Mountain)',
    'Jam² (Electric Trail)',
    'Other Focus Model',
    'Don’t Know Exact Model',
  ],
  Bergamont: [
    'Revox (Mountain)',
    'Contrail (Trail)',
    'Grandurance (Gravel)',
    'Vitess (Hybrid)',
    'Horizon (City / Trekking)',
    'E-Revox (Electric Mountain)',
    'E-Horizon (Electric Trekking)',
    'Other Bergamont Model',
    'Don’t Know Exact Model',
  ],
  Ghost: [
    'Kato (Mountain)',
    'Lector (XC)',
    'Riot (Trail)',
    'Square (Hybrid)',
    'E-Teru (Electric Mountain)',
    'E-Square (Electric Hybrid)',
    'Other Ghost Model',
    'Don’t Know Exact Model',
  ],
  Haibike: [
    'AllMtn (Electric Mountain)',
    'AllTrail (Electric Trail)',
    'Nduro (Electric Enduro)',
    'Trekking (Electric Trekking)',
    'SDURO (Electric)',
    'XDURO (Electric Performance)',
    'Other Haibike Model',
    'Don’t Know Exact Model',
  ],
  Kalkhoff: [
    'Endeavour (Electric Trekking)',
    'Entice (Electric City)',
    'Image (Electric City)',
    'Agattu (Electric Trekking)',
    'Other Kalkhoff Model',
    'Don’t Know Exact Model',
  ],
  'Riese & Müller': [
    'Charger (Electric Trekking)',
    'Delite (Electric Touring)',
    'Nevo (Electric Comfort)',
    'Load (Electric Cargo)',
    'Packster (Electric Cargo)',
    'Multicharger (Electric Cargo)',
    'Other Riese & Müller Model',
    'Don’t Know Exact Model',
  ],
  KTM: [
    'Ultra (Mountain)',
    'Macina (Electric Mountain / Trekking)',
    'Life (Hybrid)',
    'Other KTM Model',
    'Don’t Know Exact Model',
  ],
  Raleigh: [
    'Pioneer (Classic Hybrid)',
    'Strada (City Hybrid)',
    'Motif (Hybrid)',
    'Motus (Electric Tourer)',
    'Array (Electric Commuter)',
    'Felix (Electric Leisure)',
    'Centros (Electric City)',
    'Pop (Kids)',
    'Molli (Kids)',
    'Other Raleigh Model',
    'Don’t Know Exact Model',
  ],
  Carrera: [
    'Vengeance (Mountain)',
    'Vulcan (Mountain)',
    'Hellcat (Mountain)',
    'Kraken (Mountain)',
    'Subway (Hybrid Commuter)',
    'Crossfire (Hybrid)',
    'Parva (City Hybrid)',
    'Virtuoso (Road)',
    'Zelos (Road)',
    'Vengeance E (Electric Mountain)',
    'Crossfire E (Electric Hybrid)',
    'Subway E (Electric Commuter)',
    'Other Carrera Model',
    'Don’t Know Exact Model',
  ],
  Boardman: [
    'MHT 8.6 / 8.8 / 8.9 (Mountain Hardtail)',
    'MTR (Full Suspension)',
    'HYB 8.6 / 8.8 (Hybrid)',
    'SLR 8.6 / 8.9 (Road)',
    'ADV 8.6 / 8.9 (Adventure / Gravel)',
    'JTX (Gravel / Adventure)',
    'HYB-E (Electric Hybrid)',
    'ADV-E (Electric Adventure)',
    'Other Boardman Model',
    'Don’t Know Exact Model',
  ],
  Voodoo: [
    'Bizango (Trail Mountain)',
    'Hoodoo (Mountain)',
    'Soukri (Mountain)',
    'Bantu (Mountain)',
    'Zobop (Electric Mountain)',
    'Other Voodoo Model',
    'Don’t Know Exact Model',
  ],
  Apollo: [
    'Slant (Mountain)',
    'Transfer (Hybrid)',
    'Entice (Kids)',
    'Other Apollo Model',
    'Don’t Know Exact Model',
  ],
  Pinnacle: [
    'Ramin (Mountain)',
    'Kapu (Trail)',
    'Lithium (Hybrid)',
    'Arkose (Gravel)',
    'Laterite (Gravel)',
    'Other Pinnacle Model',
    'Don’t Know Exact Model',
  ],
  Whyte: [
    'M-Trail (Trail Mountain)',
    'G-170 (Enduro)',
    'T-140 (Trail)',
    '801 / 901 (Hybrid)',
    'R7 (Road)',
    'Friston (Gravel)',
    'Gisburn (Gravel)',
    'E-150 (Electric Enduro)',
    'E-160 (Electric Enduro)',
    'Other Whyte Model',
    'Don’t Know Exact Model',
  ],
  Saracen: [
    'Mantis (Trail)',
    'Ariel (Enduro)',
    'Zenith (XC)',
    'Other Saracen Model',
    'Don’t Know Exact Model',
  ],
  Orange: [
    'P7 (Hardtail)',
    'Clockwork (Hardtail)',
    'Stage (Trail)',
    'Five (Trail)',
    'Alpine (Enduro)',
    'Surge (Electric)',
    'Other Orange Model',
    'Don’t Know Exact Model',
  ],
  Genesis: [
    'Croix de Fer (Gravel / Touring)',
    'Vapour (Road)',
    'Equilibrium (Road)',
    'Day One (Commuter)',
    'Flyer (City)',
    'Other Genesis Model',
    'Don’t Know Exact Model',
  ],
  Ridgeback: [
    'Motion (Hybrid)',
    'Velocity (Hybrid)',
    'Element (Hybrid)',
    'Arc (City)',
    'World (Touring)',
    'Destiny (Electric)',
    'Other Ridgeback Model',
    'Don’t Know Exact Model',
  ],
  'Claud Butler': [
    'Alpine (Mountain)',
    'Haste (Hybrid)',
    'Legacy (Hybrid)',
    'Criterium (Road)',
    'Wisp (Electric)',
    'Other Claud Butler Model',
    'Don’t Know Exact Model',
  ],
  Dawes: [
    'Discovery (Hybrid)',
    'Edge (Hybrid)',
    'Galaxy (Touring)',
    'Super Galaxy (Touring)',
    'Kalahari (Trekking)',
    'Other Dawes Model',
    'Don’t Know Exact Model',
  ],
  Ribble: [
    'Endurance (Road)',
    'R872 (Road)',
    'Ultra (Aero Road)',
    'Gravel (Gravel)',
    'CGR (Gravel)',
    'Hybrid (Electric)',
    'Endurance SL e (Electric Road)',
    'Other Ribble Model',
    'Don’t Know Exact Model',
  ],
  'Planet X': [
    'Tempest (Gravel)',
    'London Road (Road)',
    'Pro Carbon (Road)',
    'On-One (Mountain)',
    'Other Planet X Model',
    'Don’t Know Exact Model',
  ],
  Cotic: [
    'Soul (Hardtail)',
    'BFe (Hardtail)',
    'Rocket (Steel Hardtail)',
    'Escapade (Gravel)',
    'Other Cotic Model',
    'Don’t Know Exact Model',
  ],
  Ragley: [
    'Mmmbop (Hardtail)',
    'Big Al (Hardtail)',
    'Piglet (Kids Mountain)',
    'Other Ragley Model',
    'Don’t Know Exact Model',
  ],
  Calibre: [
    'Line (Trail)',
    'Bossnut (Trail)',
    'Rake (Hardtail)',
    'Other Calibre Model',
    'Don’t Know Exact Model',
  ],
  Forme: [
    'Winchester (Hybrid)',
    'Curve (Road)',
    'Longcliffe (Hybrid)',
    'Other Forme Model',
    'Don’t Know Exact Model',
  ],
  'Hoy Bikes': [
    'Bonaly (Kids)',
    'Meadowmill (Kids)',
    'Cammo (Kids)',
    'Orkney (Hybrid)',
    'Other Hoy Model',
    'Don’t Know Exact Model',
  ],
  Squish: ['14 / 16 / 18 / 20 / 24 / 26 (Kids by Wheel Size)', 'Other Squish Model'],
  'Frog Bikes': [
    'Frog 40 (Ages 3-4)',
    'Frog 44 (Ages 4-5)',
    'Frog 47 (Ages 5-6)',
    'Frog 48 (Ages 5-6)',
    'Frog 53 (Ages 5-7)',
    'Frog 55 (Ages 6-8)',
    'Frog 62 (Ages 8-10)',
    'Frog 69 (Ages 10-12)',
    'Frog 73 (Ages 12-14)',
    'Frog 78 (Ages 13+)',
    'Frog Track (Track)',
    'Other Frog Model',
  ],
  Islabikes: [
    'Cnoc (First Pedal)',
    'Beinn (Multi-Purpose Junior)',
    'Luath (Road & CX Junior)',
    'Creig (Mountain Junior)',
    'Procyon (Road Junior)',
    'Other Islabikes Model',
  ],
  Woom: ['Woom 1 (Balance)', 'Woom 2 / 3 / 4 / 5 / 6 (Kids)', 'Woom Off (Junior Mountain)', 'Other Woom Model'],
  Tern: [
    'Link (Folding)',
    'Verge (Folding)',
    'Eclipse (Folding)',
    'Node (Folding)',
    'GSD (Cargo)',
    'HSD (Compact Cargo)',
    'Quick Haul (Cargo)',
    'Vektron (Electric Folding)',
    'Other Tern Model',
    'Don’t Know Exact Model',
  ],
  Brompton: [
    'C Line (Classic Folding)',
    'P Line (Lightweight Folding)',
    'T Line (Titanium Ultra-Light)',
    'A Line (Entry Folding)',
    'Electric C Line (Battery Assist)',
    'Electric P Line (Battery Assist)',
    'Other Brompton Model',
    'Don’t Know Exact Model',
  ],
  Dahon: [
    'Mariner (Folding)',
    'Speed (Folding)',
    'Vybe (Folding)',
    'Curve (Electric Folding)',
    'Other Dahon Model',
    'Don’t Know Exact Model',
  ],
  Gocycle: [
    'G4 (Electric Folding)',
    'G4i (Electric Folding)',
    'GX (Electric Folding)',
    'Other Gocycle Model',
    'Don’t Know Exact Model',
  ],
  MiRider: [
    'One (Electric Folding)',
    'One Step-Through (Electric Folding)',
    'Other MiRider Model',
    'Don’t Know Exact Model',
  ],
  Btwin: [
    'Rockrider ST (Mountain)',
    'Riverside 100 / 500 (Hybrid)',
    'Triban RC (Road)',
    'Elops 500 / 900 (City)',
    'Tilt (Folding)',
    'E-Active (Electric)',
    'Other Btwin Model',
    'Don’t Know Exact Model',
  ],
  Rockrider: [
    'ST 100 / 120 / 500 / 530 (Mountain)',
    'XC 100 / 500 (XC Mountain)',
    'AM 100 (Trail)',
    'E-ST 500 (Electric Mountain)',
    'Other Rockrider Model',
    'Don’t Know Exact Model',
  ],
  'Van Rysel': [
    'EDR (Road)',
    'NCR (Road)',
    'RCR (Aero Road)',
    'Gravel (Gravel)',
    'Other Van Rysel Model',
    'Don’t Know Exact Model',
  ],
  Riverside: [
    '100 / 120 / 500 / 900 (Hybrid / Trekking)',
    'Tour 500 / 900 (Touring)',
    'Other Riverside Model',
    'Don’t Know Exact Model',
  ],
  Elops: ['100 / 500 / 900 (City)', 'E-Active (Electric City)', 'Other Elops Model', 'Don’t Know Exact Model'],
  Triban: [
    'RC 100 / 120 / 500 / 520 (Road)',
    'RC 500 Gravel (Gravel)',
    'Other Triban Model',
    'Don’t Know Exact Model',
  ],
  Kona: [
    'Lava Dome (Hardtail)',
    'Cinder Cone (Hardtail)',
    'Process (Trail / Enduro)',
    'Hei Hei (XC)',
    'Sutra (Touring)',
    'Rove (Gravel)',
    'Libre (Gravel)',
    'Remote (Electric Mountain)',
    'Other Kona Model',
    'Don’t Know Exact Model',
  ],
  Marin: [
    'Bobcat (Trail)',
    'San Quentin (Trail)',
    'Rift Zone (Full Suspension)',
    'Fairfax (Hybrid)',
    'Muirwoods (Hybrid)',
    'Nicasio (Gravel)',
    'Four Corners (Touring)',
    'Sausalito (Electric Hybrid)',
    'Other Marin Model',
    'Don’t Know Exact Model',
  ],
  'Santa Cruz': [
    'Chameleon (Hardtail)',
    'Tallboy (Trail)',
    'Hightower (Trail)',
    'Bronson (Enduro)',
    'Megatower (Enduro)',
    'Blur (XC)',
    'Heckler (Electric Trail)',
    'Bullit (Electric Enduro)',
    'Other Santa Cruz Model',
    'Don’t Know Exact Model',
  ],
  Yeti: [
    'ARC (XC Hardtail)',
    'SB115 / SB130 / SB140 / SB150 / SB160 (Full Suspension)',
    '160E (Electric Enduro)',
    'Other Yeti Model',
    'Don’t Know Exact Model',
  ],
  Norco: [
    'Storm (Hardtail)',
    'Fluid (Trail)',
    'Sight (Trail)',
    'Range (Enduro)',
    'Search (Gravel)',
    'VLT (Electric Mountain)',
    'Other Norco Model',
    'Don’t Know Exact Model',
  ],
  'Rocky Mountain': [
    'Growler (Hardtail)',
    'Instinct (Trail)',
    'Altitude (Enduro)',
    'Element (XC)',
    'Solo (Road)',
    'Altitude Powerplay (Electric Enduro)',
    'Other Rocky Mountain Model',
    'Don’t Know Exact Model',
  ],
  GT: [
    'Avalanche (Mountain)',
    'Aggressor (Mountain)',
    'Sensor (Trail)',
    'Grade (Gravel)',
    'Traffic (Hybrid)',
    'Performer (Kids)',
    'Other GT Model',
    'Don’t Know Exact Model',
  ],
  Mongoose: [
    'Tyax (Mountain)',
    'Switchback (Mountain)',
    'Malus (Kids)',
    'Other Mongoose Model',
    'Don’t Know Exact Model',
  ],
  Surly: [
    'Cross-Check (All-Rounder)',
    'Straggler (Gravel)',
    'Midnight Special (Road / Gravel)',
    'Ogre (Touring)',
    'Troll (Touring)',
    'Big Dummy (Cargo)',
    'Ice Cream Truck (Fat Bike)',
    'Other Surly Model',
    'Don’t Know Exact Model',
  ],
  Salsa: [
    'Journeyman (Gravel)',
    'Warbird (Gravel Race)',
    'Cutthroat (Bikepacking)',
    'Timberjack (Trail)',
    'Rangefinder (Hardtail)',
    'Other Salsa Model',
    'Don’t Know Exact Model',
  ],
  Bombtrack: [
    'Hook (Gravel)',
    'Arise (Gravel)',
    'Beyond (Touring)',
    'Other Bombtrack Model',
    'Don’t Know Exact Model',
  ],
  Sonder: [
    'Frontier (Gravel)',
    'Camber (Trail)',
    'Dial (Hardtail)',
    'Transmitter (Trail)',
    'Other Sonder Model',
    'Don’t Know Exact Model',
  ],
  Fairlight: [
    'Strael (Road / Gravel)',
    'Secan (Gravel)',
    'Faran (Gravel)',
    'Other Fairlight Model',
    'Don’t Know Exact Model',
  ],
  Gazelle: [
    'Ultimate (City)',
    'Grenoble (City)',
    'Paris (City)',
    'Orange (E-Bike)',
    'Medeo (Electric City)',
    'Arroyo (Electric Trekking)',
    'Other Gazelle Model',
    'Don’t Know Exact Model',
  ],
  Batavus: ['Dinsdag (City)', 'Finez (City)', 'Fuego (Electric City)', 'Other Batavus Model', 'Don’t Know Exact Model'],
  Sparta: ['a-Shine (Electric City)', 'd-Rule (Electric City)', 'Other Sparta Model', 'Don’t Know Exact Model'],
  VanMoof: ['S3 / S4 / S5 (Electric City)', 'X3 / X4 (Electric Compact)', 'Other VanMoof Model', 'Don’t Know Exact Model'],
  Cowboy: ['Cowboy 3 / 4 (Electric City)', 'Cowboy Cruiser (Electric City)', 'Other Cowboy Model', 'Don’t Know Exact Model'],
  Moustache: [
    'Samedi (Electric Trekking)',
    'Lundi (Electric City)',
    'Xroad (Electric Gravel)',
    'Trail (Electric Mountain)',
    'Other Moustache Model',
    'Don’t Know Exact Model',
  ],
  Flyer: ['Gotour (Electric Trekking)', 'Upstreet (Electric City)', 'Other Flyer Model', 'Don’t Know Exact Model'],
  'Rad Power Bikes': [
    'RadCity (Electric City)',
    'RadRover (Electric Fat)',
    'RadRunner (Electric Utility)',
    'RadWagon (Electric Cargo)',
    'Other Rad Power Model',
    'Don’t Know Exact Model',
  ],
  Estarli: ['e20 (Electric Folding)', 'e28 (Electric City)', 'Other Estarli Model', 'Don’t Know Exact Model'],
  Eovolt: ['Afternoon (Electric Folding)', 'Morning (Electric Folding)', 'Other Eovolt Model', 'Don’t Know Exact Model'],
  Wisper: ['Wayfarer (Electric Trekking)', '905 (Electric City)', 'Other Wisper Model', 'Don’t Know Exact Model'],
  Volt: ['Metro (Electric City)', 'Pulse (Electric Folding)', 'Other Volt Model', 'Don’t Know Exact Model'],
  FreeGo: ['Regency (Electric City)', 'Eagle (Electric Trekking)', 'Other FreeGo Model', 'Don’t Know Exact Model'],
  'Pure Electric': [
    'Pure Air (Gen 1 / 2)',
    'Pure Air Pro',
    'Pure Air Pro (2nd Gen)',
    'Pure Advance',
    'Pure Advance Flex',
    'Other Pure Model',
  ],
  Xiaomi: [
    'Mi Electric Scooter Pro 2',
    'Mi Electric Scooter 1S',
    'Mi M365 (Original)',
    'Mi 3 (Electric Scooter 3)',
    'Electric Scooter 4 Pro',
    'Electric Scooter 4 Ultra',
    'Essential',
    'Other Xiaomi Model',
  ],
  'Segway-Ninebot': [
    'MAX G30 / G30P',
    'MAX G2',
    'F40 / F30 / F25 Series',
    'F2 / F2 Plus / F2 Pro',
    'E25 / E22 / E45',
    'KickScooter D28 / D38',
    'Other Segway Model',
  ],
  NIU: ['KQi2 Pro', 'KQi3 Pro / Max', 'KQi Air', 'KQi Air X', 'Other NIU Model'],
  'Apollo Scooters': ['City (2023)', 'City Pro', 'Explore', 'Ghost', 'Phantom', 'Air', 'Air Pro', 'Other Apollo Model', 'Don’t Know Exact Model'],
  Vsett: ['8', '9', '9+', '10', '10+', '11', 'Other Vsett Model', 'Don’t Know Exact Model'],
  Dualtron: ['Mini', 'Eagle', 'Victor', 'Thunder', 'Storm', 'Ultra', 'X', 'Other Dualtron Model', 'Don’t Know Exact Model'],
  Minimotors: ['Speedway', 'Speedway Mini', 'Dualtron Series', 'Other Minimotors Model', 'Don’t Know Exact Model'],
  Kaabo: ['Mantis 8', 'Mantis 10', 'Mantis Pro', 'Wolf Warrior', 'Wolf King', 'Skywalker', 'Other Kaabo Model', 'Don’t Know Exact Model'],
  Nanrobot: ['D4+', 'D5+', 'D6+', 'Lightning', 'Other Nanrobot Model', 'Don’t Know Exact Model'],
  InMotion: ['S1', 'S2', 'Climber', 'L9', 'Other InMotion Model', 'Don’t Know Exact Model'],
  NAMI: ['Burn-E', 'Burn-E 2', 'ViPER', 'Klima', 'Other NAMI Model', 'Don’t Know Exact Model'],
  Razor: ['E90 / E100', 'E300 / E300S', 'Power Core E90', 'Ecosmart Metro', 'Other Razor Model', 'Don’t Know Exact Model'],
  Bird: ['Bird One', 'Bird Two', 'Bird Air', 'Bird Flex', 'Other Bird Model', 'Don’t Know Exact Model'],
  Lime: ['Lime-S', 'Lime Gen 4', 'Other Lime Model', 'Don’t Know Exact Model'],
  Micro: ['Micro Merlin', 'Micro Explorer', 'Micro Flex', 'Other Micro Model', 'Don’t Know Exact Model'],
  Unagi: ['Model One', 'Model One Classic', 'Model Eleven', 'Other Unagi Model', 'Don’t Know Exact Model'],
  Hiboy: ['S2 Pro', 'S2 Max', 'Max 3', 'Titan', 'Other Hiboy Model', 'Don’t Know Exact Model'],
  GoTrax: ['GXL V2', 'Apex', 'XR Elite', 'XR Ultra', 'G4', 'Other GoTrax Model', 'Don’t Know Exact Model'],
  Okai: ['Neon', 'ES10', 'ES200', 'Other Okai Model', 'Don’t Know Exact Model'],
  Levy: ['Levy Plus', 'Levy Electric Original', 'Other Levy Model', 'Don’t Know Exact Model'],
  Boosted: ['Boosted Rev', 'Other Boosted Model', 'Don’t Know Exact Model'],
  Fluidfreeride: ['Horizon', 'Mosquito', 'CityRider', 'Other Fluidfreeride Model', 'Don’t Know Exact Model'],
  iScooter: ['i9', 'iX6', 'i12', 'Other iScooter Model', 'Don’t Know Exact Model'],
  Wheelspeed: ['WS1200', 'WS1500', 'WS2000', 'Other Wheelspeed Model', 'Don’t Know Exact Model'],
  'Hover-1': ['Alpha', 'Eclipse', 'Rally', 'Other Hover-1 Model', 'Don’t Know Exact Model'],
  Swagtron: ['Swagger 5', 'Swagger 7', 'Swagger Pro', 'Other Swagtron Model', 'Don’t Know Exact Model'],
  Segway: ['Ninebot MAX Series', 'Ninebot F Series', 'Ninebot D Series', 'Other Segway Model', 'Don’t Know Exact Model'],
  Talaria: ['Sting (Electric Dirt Bike)', 'Sting R (Electric Dirt Bike)', 'MX (Electric Dirt Bike)', 'Other Talaria Model', 'Don’t Know Exact Model'],
  Swytch: ['Swytch Kit (Front Wheel Conversion)', 'Swytch Max (Front Wheel Conversion)', 'Other Swytch Kit'],
  Cyclotricity: ['Revo (Front Hub Kit)', 'Stealth (Rear Hub Kit)', 'Other Cyclotricity Kit'],
  Bafang: [
    'BBS01 (Mid-Drive Kit)',
    'BBS02 (Mid-Drive Kit)',
    'BBSHD (Mid-Drive Kit)',
    'Rear Hub Kit',
    'Front Hub Kit',
    'Other Bafang Kit',
  ],
  Pendix: ['eDrive (Mid-Drive Kit)', 'eDrive S (Mid-Drive Kit)', 'Other Pendix Kit'],
  Dillenger: ['Front Hub Kit', 'Rear Hub Kit', 'Other Dillenger Kit'],
  'Other / Not Listed': ['Standard Model', 'Custom Build', 'Vintage / Classic Model', 'Don’t Know Exact Model'],
  'I Don’t Know My Brand': ['Standard Model', 'Don’t Know Exact Model'],
};

// ---------------------------------------------------------------------------
// E-Bike conversion questions
// Asked for every bike so the workshop knows what it is really dealing with —
// a factory e-bike and a self-converted one need completely different checks.
// ---------------------------------------------------------------------------

export type EbikeStatus = 'factory' | 'converted' | 'not_ebike' | 'unsure';

export interface EbikeStatusOption {
  id: EbikeStatus;
  label: string;
  description: string;
}

export const EBIKE_STATUS_OPTIONS: EbikeStatusOption[] = [
  {
    id: 'factory',
    label: 'Factory E-Bike',
    description: 'Came with the motor and battery built in from new.',
  },
  {
    id: 'converted',
    label: 'Converted to E-Bike',
    description: 'A standard bike with a motor kit fitted afterwards.',
  },
  {
    id: 'not_ebike',
    label: 'Not an E-Bike',
    description: 'Pedal power only — no motor or battery.',
  },
  {
    id: 'unsure',
    label: 'Not Sure',
    description: 'We will identify it for you at drop-off.',
  },
];

/** Motor systems seen on factory bikes and aftermarket conversion kits. */
export const EBIKE_MOTOR_SYSTEMS: string[] = [
  'Bosch (Active / Performance / CX)',
  'Shimano STEPS (E5000 / E6100 / E8000)',
  'Brose Drive',
  'Yamaha PW / PW-X',
  'Specialized (Turbo / SL)',
  'Giant (SyncDrive)',
  'Mahle (X20 / X35)',
  'Bafang BBS01 / BBS02 / BBSHD (Mid-Drive)',
  'Bafang Hub Motor (Front / Rear)',
  'Tongsheng TSDZ2 (Mid-Drive)',
  'Swytch Kit',
  'Cyclotricity Kit',
  'Pendix Kit',
  'Dillenger Kit',
  'Voilamart / Generic Hub Kit',
  'Other / Not Sure',
];

export const EBIKE_BATTERY_POSITIONS: string[] = [
  'Frame-integrated (inside the downtube)',
  'Downtube (bolt-on, external)',
  'Rear rack battery',
  'Seat-tube / behind seatpost',
  'Handlebar bag / frame bag',
  'Not Sure',
];

export const EBIKE_DRIVE_TYPES: string[] = [
  'Mid-drive (motor at the cranks)',
  'Rear hub motor',
  'Front hub motor',
  'Not Sure',
];

export const BIKE_YEAR_OPTIONS: string[] = (() => {
  const current = new Date().getFullYear();
  const years: string[] = ['Don’t Know'];
  for (let y = current; y >= current - 30; y--) years.push(String(y));
  return years;
})();

export const TIME_SLOT_OPTIONS: string[] = [
  'Midday (12:00 - 15:00)',
  'Afternoon (15:00 - 18:00)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive lookup of the model list for a brand name. */
export function modelsForBrand(brand: string): string[] {
  if (BRAND_MODELS_MAP[brand]) return BRAND_MODELS_MAP[brand];
  const key = Object.keys(BRAND_MODELS_MAP).find(
    (k) => k.toLowerCase() === (brand || '').toLowerCase()
  );
  return key ? BRAND_MODELS_MAP[key] : ['Standard Model', 'Other Model', 'Don’t Know Exact Model'];
}

/** Case-insensitive brand profile lookup, used by the searchable picker. */
export function brandProfileFor(brand: string): BikeBrandProfile | undefined {
  const lower = (brand || '').toLowerCase();
  return BIKE_BRAND_PROFILES.find((b) => b.name.toLowerCase() === lower);
}

/** True when a chosen model means "the rider will type their own". */
export function isCustomModel(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('other') || m.includes('custom build') || m.includes('vintage');
}

/** Brands that are really "not sure" escape hatches rather than real makers. */
export const UNKNOWN_BRAND_NAMES = ['Other / Not Listed', 'I Don’t Know My Brand'];

/** True when a brand builds e-scooters (a brand can build both, e.g. Pure Electric). */
export function isScooterBrand(profile: BikeBrandProfile): boolean {
  return profile.types.includes('E-Scooter');
}

/**
 * Which brand `types` a `VehicleCategory` maps to. Note the mapping is the
 * *kept* set — a brand matches a category when ANY of its types is in the set,
 * so a brand that builds both bikes and e-bikes (Giant) shows under both
 * "Bike" and "E-Bike", while a scooter-only maker (Xiaomi) only shows
 * under "E-Scooter".
 */
const CATEGORY_BRAND_TYPES: Record<VehicleCategory, BikeBrandType[]> = {
  cycle: [
    'Mountain', 'Road', 'Hybrid', 'Gravel', 'Kids', 'City', 'Folding', 'Cargo', 'Touring',
  ],
  ebike: ['E-Bike', 'Conversion Kit'],
  electric_scooter: ['E-Scooter'],
  cargo: ['Kids', 'Cargo', 'Folding', 'City'],
};

/** True when a brand builds something for the given vehicle category. */
export function brandMatchesCategory(profile: BikeBrandProfile, category: VehicleCategory): boolean {
  if (UNKNOWN_BRAND_NAMES.includes(profile.name)) return true;
  const allowed = CATEGORY_BRAND_TYPES[category];
  if (!allowed) return true;
  return profile.types.some((t) => allowed.includes(t));
}

/** Every known brand (in catalogue order) that builds something for a category. */
export function brandsForCategory(category: VehicleCategory): BikeBrandProfile[] {
  return BIKE_BRAND_PROFILES.filter((b) => brandMatchesCategory(b, category));
}

/** The first known matching brand for a category — falls back to "Other / Not Listed". */
export function firstBrandForCategory(category: VehicleCategory): string {
  const known = brandsForCategory(category).find((b) => !UNKNOWN_BRAND_NAMES.includes(b.name));
  return known ? known.name : UNKNOWN_BRAND_NAMES[0];
}

/**
 * Splits the brand catalogue into the two digestible sections and the escape
 * hatches. Each list is sorted alphabetically so a rider can scan it quickly.
 * A brand that builds both — e.g. Pure Electric — appears in each section; a
 * scooter-only maker (Xiaomi) does not show under Bikes. The picker then
 * further narrows these sections to the vehicle type chosen in the booking
 * Step 1 (see brandMatchesCategory). Both sections keep the
 * "Other / Not Listed" escape hatches apart.
 */
export function brandSections(): { scooters: BikeBrandProfile[]; bikes: BikeBrandProfile[]; unknown: BikeBrandProfile[] } {
  const byName = (a: BikeBrandProfile, b: BikeBrandProfile) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const known = BIKE_BRAND_PROFILES.filter((b) => !UNKNOWN_BRAND_NAMES.includes(b.name));
  const isScooterOnly = (b: BikeBrandProfile) => b.types.every((t) => t === 'E-Scooter');
  return {
    scooters: known.filter(isScooterBrand).sort(byName),
    bikes: known.filter((b) => !isScooterOnly(b)).sort(byName),
    unknown: BIKE_BRAND_PROFILES.filter((b) => UNKNOWN_BRAND_NAMES.includes(b.name)),
  };
}
