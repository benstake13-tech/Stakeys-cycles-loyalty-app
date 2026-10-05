import { BikeComponentSpec, BikeScrapeResult, VehicleCategory } from '../types/bikeShop';

export interface KnownBikeSpec {
  brand: string;
  model: string;
  year?: string;
  category: VehicleCategory;
  msrpOriginal?: string;
  frameMaterial: string;
  sourceUrl: string;
  components: {
    category: 'Drivetrain' | 'Brakes' | 'Suspension / Fork' | 'Wheels & Tires' | 'Cockpit & Controls' | 'Electrical / Battery';
    componentName: string;
    stockOEM: string;
  }[];
}

export const KNOWN_BIKE_DATABASE: KnownBikeSpec[] = [
  {
    brand: 'Trek',
    model: 'Marlin 7',
    year: '2023',
    category: 'cycle',
    msrpOriginal: '£875',
    frameMaterial: 'Alpha Silver Aluminum, internal routing',
    sourceUrl: 'https://trekbikes.com/gb/en_GB/archive-specs/marlin-7-gen-2',
    components: [
      { category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: 'Shimano Deore M5120, long cage' },
      { category: 'Drivetrain', componentName: 'Shifter', stockOEM: 'Shimano Deore M4100, 10-speed' },
      { category: 'Drivetrain', componentName: 'Crankset & Chainring', stockOEM: 'FSA Alpha Drive, 28T steel ring, 73mm Boost' },
      { category: 'Drivetrain', componentName: 'Cassette', stockOEM: 'Shimano Deore M4100, 11-46, 10-speed' },
      { category: 'Drivetrain', componentName: 'Chain', stockOEM: 'KMC X10, 10-speed' },
      { category: 'Brakes', componentName: 'Hydraulic Disc Brakes', stockOEM: 'Shimano MT200 hydraulic disc, RT26 160mm/180mm rotors' },
      { category: 'Suspension / Fork', componentName: 'Suspension Fork', stockOEM: 'RockShox Judy Silver, Solo Air, TurnKey lockout, 100mm travel' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: 'Bontrager Kovee, double-wall, tubeless-ready, 28-hole' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Bontrager XR2 Comp, wire bead, 30 tpi, 29x2.20"' },
      { category: 'Cockpit & Controls', componentName: 'Handlebar', stockOEM: 'Bontrager alloy, 31.8mm, 5mm rise, 720mm width' },
      { category: 'Cockpit & Controls', componentName: 'Saddle & Post', stockOEM: 'Bontrager Arvada & Bontrager alloy 31.6mm' },
    ],
  },
  {
    brand: 'Specialized',
    model: 'Sirrus X 3.0',
    year: '2022',
    category: 'cycle',
    msrpOriginal: '£950',
    frameMaterial: 'Specialized A1 SL Premium Aluminum, Fitness Geometry',
    sourceUrl: 'https://specialized.com/gb/en/sirrus-x-3-0/p/200213',
    components: [
      { category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: 'MicroSHIFT Advent 9-speed, clutch' },
      { category: 'Drivetrain', componentName: 'Shifter', stockOEM: 'MicroSHIFT Advent trigger, 9-speed' },
      { category: 'Drivetrain', componentName: 'Crankset', stockOEM: 'Forged 3-piece alloy arms, 40T narrow-wide' },
      { category: 'Drivetrain', componentName: 'Cassette', stockOEM: 'MicroSHIFT Advent 9-speed, 11-42T' },
      { category: 'Drivetrain', componentName: 'Chain', stockOEM: 'KMC X9EPT anti-rust 9-speed' },
      { category: 'Brakes', componentName: 'Hydraulic Disc Brakes', stockOEM: 'Tektro HD-R280 hydraulic disc, flat mount, 160mm/140mm' },
      { category: 'Suspension / Fork', componentName: 'Rigid Fork', stockOEM: 'A1 SL Premium Aluminum rigid fork, flat mount disc, Plug + Play fender mounts' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: '700C disc, double-wall alloy, 32h' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Pathfinder Sport, 700x42mm, wire bead' },
      { category: 'Cockpit & Controls', componentName: 'Handlebar', stockOEM: 'Mini Rise, double-butted alloy, 9-degree backsweep, 680mm' },
      { category: 'Cockpit & Controls', componentName: 'Saddle & Post', stockOEM: 'Bridge Sport saddle 155mm, Alloy 2-bolt 27.2mm' },
    ],
  },
  {
    brand: 'Specialized',
    model: 'Stumpjumper EVO',
    year: '2023',
    category: 'cycle',
    msrpOriginal: '£4,250',
    frameMaterial: 'FACT 11m carbon chassis and rear-end, asymmetrical design',
    sourceUrl: 'https://specialized.com/gb/en/stumpjumper-evo-comp/p/199786',
    components: [
      { category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: 'SRAM GX Eagle, 12-speed mechanical' },
      { category: 'Drivetrain', componentName: 'Shifter', stockOEM: 'SRAM GX Eagle trigger, 12-speed' },
      { category: 'Drivetrain', componentName: 'Crankset', stockOEM: 'SRAM Descendant 6K, DUB, 30T alloy ring' },
      { category: 'Drivetrain', componentName: 'Cassette', stockOEM: 'SRAM XG-1275, 12-speed, 10-52T' },
      { category: 'Brakes', componentName: 'Hydraulic Disc Brakes', stockOEM: 'SRAM Code RS, 4-piston caliper, 200mm CenterLine rotors' },
      { category: 'Suspension / Fork', componentName: 'Suspension Fork', stockOEM: 'FOX FLOAT 36 Rhythm, GRIP damper, 160mm travel, 44mm offset' },
      { category: 'Suspension / Fork', componentName: 'Rear Shock', stockOEM: 'FOX FLOAT X Performance, Rx Trail Tune, EVOL air can, 2-position lever' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: 'Specialized 29/27.5, hookless alloy, 30mm inner width, tubeless ready' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Butcher GRID TRAIL T9 front 29x2.3 / Eliminator GRID TRAIL T7 rear 29x2.3' },
      { category: 'Cockpit & Controls', componentName: 'Dropper Post', stockOEM: 'X-Fusion Manic, infinite adjustable, remote lever, 150mm/170mm' },
    ],
  },
  {
    brand: 'Giant',
    model: 'Escape 3',
    year: '2022',
    category: 'cycle',
    msrpOriginal: '£499',
    frameMaterial: 'ALUXX-Grade Aluminum',
    sourceUrl: 'https://giant-bicycles.com/gb/escape-3-2022',
    components: [
      { category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: 'Shimano Tourney TY300 7-speed' },
      { category: 'Drivetrain', componentName: 'Front Derailleur', stockOEM: 'Shimano Tourney TY510 3-speed' },
      { category: 'Drivetrain', componentName: 'Shifters', stockOEM: 'Shimano EF41 3x7 speed EZ Fire Plus' },
      { category: 'Drivetrain', componentName: 'Crankset', stockOEM: 'Forged alloy 28/38/48 with chainguard' },
      { category: 'Drivetrain', componentName: 'Freewheel', stockOEM: 'MF-TZ500, 14x34T mega-range, 7-speed' },
      { category: 'Brakes', componentName: 'Brakes', stockOEM: 'Linear pull alloy V-brakes with alloy levers' },
      { category: 'Suspension / Fork', componentName: 'Rigid Fork', stockOEM: 'High-tensile steel, rack mount eyelets' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: 'Giant double-wall aluminum rims, nutted alloy hubs' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Giant S-X3, puncture protect, 700x38c' },
      { category: 'Cockpit & Controls', componentName: 'Handlebar & Stem', stockOEM: 'Giant Sport XC, 25.4mm, alloy' },
    ],
  },
  {
    brand: 'Cannondale',
    model: 'Topstone 2',
    year: '2023',
    category: 'cycle',
    msrpOriginal: '£1,700',
    frameMaterial: 'SmartForm C2 Alloy, 12x142 thru-axle, tapered headtube',
    sourceUrl: 'https://cannondale.com/en-gb/bikes/road/gravel/topstone-alloy/topstone-2',
    components: [
      { category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: 'Shimano GRX 400, Shadow RD+, 10-speed' },
      { category: 'Drivetrain', componentName: 'Front Derailleur', stockOEM: 'Shimano GRX 400, braze-on' },
      { category: 'Drivetrain', componentName: 'Shifters / Brake Levers', stockOEM: 'Shimano GRX 400 hydraulic disc shifters, 10-speed' },
      { category: 'Drivetrain', componentName: 'Crankset', stockOEM: 'FSA Omega AGX+ Alloy, 46/30T' },
      { category: 'Drivetrain', componentName: 'Cassette', stockOEM: 'Shimano HG500, 11-34, 10-speed' },
      { category: 'Brakes', componentName: 'Hydraulic Disc Brakes', stockOEM: 'Shimano GRX 400 hydraulic flat mount, 160/160mm RT54 rotors' },
      { category: 'Suspension / Fork', componentName: 'Fork', stockOEM: 'Topstone Carbon, 1-1/8" to 1.5" steerer, 55mm OutFront offset, 12x100 thru-axle' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: 'WTB ST i23 TCS, 28h, tubeless ready' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'WTB Riddler TCS Light, 700x37c, tubeless ready' },
      { category: 'Cockpit & Controls', componentName: 'Handlebar', stockOEM: 'Cannondale 3, butted 6061 Alloy, 16 deg flare drop' },
    ],
  },
  {
    brand: 'Brompton',
    model: 'C Line Explore',
    year: '2023',
    category: 'cycle',
    msrpOriginal: '£1,525',
    frameMaterial: 'Precision drawn heat-treated steel tubing with hand brazing',
    sourceUrl: 'https://brompton.com/c-line-explore',
    components: [
      { category: 'Drivetrain', componentName: 'Gearing / Hub', stockOEM: 'Brompton 6-speed Wide Range (2-speed derailleur + BWR 3-speed internal hub)' },
      { category: 'Drivetrain', componentName: 'Chainset', stockOEM: 'Brompton 50T chainring with integrated chainguard' },
      { category: 'Brakes', componentName: 'Dual Pivot Calipers', stockOEM: 'Brompton Dual Pivot Caliper brakes with Fibrax SwissStop pads' },
      { category: 'Wheels & Tires', componentName: 'Wheelset', stockOEM: '16" (349) double-wall alloy rims, Brompton front hub, BWR rear' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Schwalbe Marathon Racer, 35-349, reflective sidewalls' },
      { category: 'Cockpit & Controls', componentName: 'Handlebar', stockOEM: 'Mid or High riser aluminium bar, lock-on grips' },
      { category: 'Cockpit & Controls', componentName: 'Seatpost', stockOEM: 'Brompton extended chrome-moly steel seatpost, Pentaclip saddle mount' },
    ],
  },
  {
    brand: 'Xiaomi',
    model: 'Mi Pro 2',
    year: '2022',
    category: 'electric_scooter',
    msrpOriginal: '£599',
    frameMaterial: 'Aerospace-grade high-strength aluminium alloy folding chassis',
    sourceUrl: 'https://mi.com/global/mi-electric-scooter-pro-2',
    components: [
      { category: 'Electrical / Battery', componentName: 'Hub Motor', stockOEM: '300W brushless DC motor (600W peak output)' },
      { category: 'Electrical / Battery', componentName: 'Lithium Battery Pack', stockOEM: '474Wh (12.8Ah 37V) 18650 Li-ion cells, smart BMS' },
      { category: 'Electrical / Battery', componentName: 'Display & Controller', stockOEM: 'Integrated multi-function dashboard LED, Bluetooth BLE 4.1' },
      { category: 'Brakes', componentName: 'Dual Braking System', stockOEM: 'Front E-ABS regenerative electronic brake + rear 120mm dual-pad disc brake' },
      { category: 'Wheels & Tires', componentName: 'Pneumatic Wheels', stockOEM: '8.5-inch front and rear shock-absorbing pneumatic tires with inner tubes' },
      { category: 'Cockpit & Controls', componentName: 'Throttle & Levers', stockOEM: 'Thumb throttle push-lever, ergonomic bell, high-luminosity LED headlight' },
    ],
  },
  {
    brand: 'Segway',
    model: 'Ninebot Max G30',
    year: '2023',
    category: 'electric_scooter',
    msrpOriginal: '£749',
    frameMaterial: 'Aviation-grade aluminum alloy with IPX5 water resistance',
    sourceUrl: 'https://segway.com/ninebot-kickscooter-max',
    components: [
      { category: 'Electrical / Battery', componentName: 'Rear Motor', stockOEM: '350W nominal brushless motor (700W peak) rear-wheel drive' },
      { category: 'Electrical / Battery', componentName: 'Battery Unit', stockOEM: '551Wh (36V 15.3Ah) with built-in 3A fast charger' },
      { category: 'Electrical / Battery', componentName: 'Display Panel', stockOEM: 'Full LED dashboard with speed, riding modes (Eco/Drive/Sport), error codes' },
      { category: 'Brakes', componentName: 'Dual Brake Assembly', stockOEM: 'Front mechanical drum brake + Rear regenerative electronic brake' },
      { category: 'Wheels & Tires', componentName: 'Tires', stockOEM: '10-inch self-healing tubeless tires with puncture-proof sealant layer' },
    ],
  },
];

/**
 * Heuristic upgrade detection words
 */
const UPGRADE_INDICATORS = [
  'XT', 'XTR', 'GX', 'X01', 'XX1', 'AXS', 'WIRELESS', 'KASHIMA', 'FACTORY',
  'MAGURA', 'HOPE', 'CHRIS KING', 'CARBON', 'TUBELESS', 'MAXXIS', 'MINION',
  'SCHWALBE', 'CONTINENTAL GP', 'CERAMICSPEED', 'GARBARUK', 'ONEUP',
  'RENTHAL', 'DEITY', 'CODE RSC', 'CURA', 'PIKE', 'LYRIK', 'ZEB', 'FOX 38',
  'CUSTOM', 'UPGRADED', 'SOLID TIRE', 'MONORIM', '1000W'
];

/**
 * Run simulated stock scraper query against database or intelligent model synthesizer
 */
export async function scrapeBikeStockSpecs(
  brandInput: string,
  modelInput: string,
  yearInput?: string,
  categoryInput: VehicleCategory = 'cycle'
): Promise<BikeScrapeResult> {
  // Simulate network scrape latency (e.g. 600ms)
  await new Promise((res) => setTimeout(res, 650));

  const cleanBrand = brandInput.trim().toLowerCase();
  const cleanModel = modelInput.trim().toLowerCase();

  // 1. Direct match in curated database
  const match = KNOWN_BIKE_DATABASE.find((item) => {
    const brandMatch = item.brand.toLowerCase() === cleanBrand || cleanBrand.includes(item.brand.toLowerCase());
    const modelMatch = item.model.toLowerCase().includes(cleanModel) || cleanModel.includes(item.model.toLowerCase());
    return brandMatch && modelMatch;
  });

  if (match) {
    const components: BikeComponentSpec[] = match.components.map((comp, idx) => ({
      id: `comp-${idx + 1}`,
      category: comp.category,
      componentName: comp.componentName,
      stockOEM: comp.stockOEM,
      currentPart: comp.stockOEM, // by default equal to stock until user or mechanic modifies
      isUpgraded: false,
      condition: 'good',
    }));

    return {
      brand: match.brand,
      model: match.model,
      year: yearInput || match.year,
      category: match.category,
      msrpOriginal: match.msrpOriginal,
      frameMaterial: match.frameMaterial,
      sourceUrl: match.sourceUrl,
      components,
      detectedUpgradesCount: 0,
      totalEstimatedUpgradeValue: 0,
      scrapedAt: new Date().toISOString(),
    };
  }

  // 2. Intelligent Spec Synthesizer for arbitrary bike/scooter models
  const isScooter = categoryInput === 'electric_scooter' || cleanModel.includes('scooter') || cleanModel.includes('pro');
  const isEbike = categoryInput === 'ebike' || cleanModel.includes('e-') || cleanModel.includes('electric') || cleanModel.includes('turbo');
  const isCarbon = cleanModel.includes('carbon') || cleanModel.includes('advanced') || cleanModel.includes('sl');

  const synthesizedComponents: BikeComponentSpec[] = [];

  if (isScooter) {
    synthesizedComponents.push(
      { id: 'comp-1', category: 'Electrical / Battery', componentName: 'Hub Motor', stockOEM: '350W Brushless DC Front/Rear hub motor', currentPart: '350W Brushless DC Front/Rear hub motor', isUpgraded: false, condition: 'good' },
      { id: 'comp-2', category: 'Electrical / Battery', componentName: 'Battery Pack', stockOEM: '36V 10.4Ah Lithium-Ion Pack (approx 375Wh)', currentPart: '36V 10.4Ah Lithium-Ion Pack (approx 375Wh)', isUpgraded: false, condition: 'good' },
      { id: 'comp-3', category: 'Brakes', componentName: 'Braking System', stockOEM: 'Electronic Regenerative + Rear 120mm Mechanical Disc Brake', currentPart: 'Electronic Regenerative + Rear 120mm Mechanical Disc Brake', isUpgraded: false, condition: 'good' },
      { id: 'comp-4', category: 'Wheels & Tires', componentName: 'Tires', stockOEM: '8.5" or 10" Pneumatic tube tires (standard factory rubber)', currentPart: '8.5" or 10" Pneumatic tube tires (standard factory rubber)', isUpgraded: false, condition: 'good' },
      { id: 'comp-5', category: 'Cockpit & Controls', componentName: 'Folding Stem & Latch', stockOEM: 'Reinforced quick-fold alloy latch with safety collar', currentPart: 'Reinforced quick-fold alloy latch with safety collar', isUpgraded: false, condition: 'good' }
    );
  } else {
    synthesizedComponents.push(
      { id: 'comp-1', category: 'Drivetrain', componentName: 'Rear Derailleur', stockOEM: cleanModel.includes('marlin') || cleanModel.includes('trail') ? 'Shimano Deore M5100 11-Speed' : 'Shimano / SRAM OEM standard cage derailleur', currentPart: 'Shimano / SRAM OEM standard cage derailleur', isUpgraded: false, condition: 'good' },
      { id: 'comp-2', category: 'Drivetrain', componentName: 'Shifter & Cassette', stockOEM: 'Shimano Hyperglide compatible 10/11-speed 11-46T', currentPart: 'Shimano Hyperglide compatible 10/11-speed 11-46T', isUpgraded: false, condition: 'good' },
      { id: 'comp-3', category: 'Brakes', componentName: 'Hydraulic Brakeset', stockOEM: 'Shimano MT200 / Tektro Hydraulic Disc with 160mm/180mm rotors', currentPart: 'Shimano MT200 / Tektro Hydraulic Disc with 160mm/180mm rotors', isUpgraded: false, condition: 'good' },
      { id: 'comp-4', category: 'Suspension / Fork', componentName: 'Fork / Front Shock', stockOEM: cleanModel.includes('evo') || cleanModel.includes('fuel') ? 'RockShox Recon Silver RL 120mm / 140mm Air' : 'Alloy rigid fork or SR Suntour XCM 100mm coil', currentPart: 'Alloy rigid fork or SR Suntour XCM 100mm coil', isUpgraded: false, condition: 'good' },
      { id: 'comp-5', category: 'Wheels & Tires', componentName: 'Rims & Hubs', stockOEM: 'Double-wall alloy 32H disc rims with sealed bearing hubs', currentPart: 'Double-wall alloy 32H disc rims with sealed bearing hubs', isUpgraded: false, condition: 'good' },
      { id: 'comp-6', category: 'Wheels & Tires', componentName: 'Tires', stockOEM: 'Factory wire-bead all-terrain 2.20" / 700x38c tires with tubes', currentPart: 'Factory wire-bead all-terrain 2.20" / 700x38c tires with tubes', isUpgraded: false, condition: 'good' },
      { id: 'comp-7', category: 'Cockpit & Controls', componentName: 'Handlebar & Stem', stockOEM: 'OEM alloy 31.8mm clamp, standard sweep bar', currentPart: 'OEM alloy 31.8mm clamp, standard sweep bar', isUpgraded: false, condition: 'good' }
    );
  }

  return {
    brand: brandInput.trim(),
    model: modelInput.trim(),
    year: yearInput || 'Current Gen',
    category: categoryInput,
    msrpOriginal: 'Est. £650 - £1,450 (Factory OEM Spec)',
    frameMaterial: isCarbon ? 'Toray / High-Modulus Carbon Fiber' : '6061-T6 Double Butted Aluminum',
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`${brandInput} ${modelInput} stock specs archive`)}`,
    components: synthesizedComponents,
    detectedUpgradesCount: 0,
    totalEstimatedUpgradeValue: 0,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates whether a component string appears upgraded compared to stock
 */
export function analyzeUpgrade(stockSpec: string, currentPart: string): {
  isUpgraded: boolean;
  estimatedValue: number;
  reason?: string;
} {
  const stockClean = stockSpec.toLowerCase();
  const currentClean = currentPart.toLowerCase();

  if (stockClean === currentClean || !currentPart.trim()) {
    return { isUpgraded: false, estimatedValue: 0 };
  }

  // Check against known upgrade keywords
  const matchedKeyword = UPGRADE_INDICATORS.find((kw) => currentClean.includes(kw.toLowerCase()));
  if (matchedKeyword) {
    let estVal = 85;
    if (['wireless', 'axs', 'kashima', 'carbon', 'fox 38', 'hope', 'xtr', 'xx1'].some(k => currentClean.includes(k))) {
      estVal = 220;
    } else if (['xt', 'gx', 'magura', 'garbaruk', 'tubeless', 'minion'].some(k => currentClean.includes(k))) {
      estVal = 110;
    }
    return {
      isUpgraded: true,
      estimatedValue: estVal,
      reason: `Detected premium aftermarket component (${matchedKeyword}) replacing OEM ${stockSpec.slice(0, 30)}...`,
    };
  }

  return {
    isUpgraded: true,
    estimatedValue: 45,
    reason: 'Part differs from factory manufacturer assembly.',
  };
}
