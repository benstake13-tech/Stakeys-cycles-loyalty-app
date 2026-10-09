import { VehicleCategory } from '../types/bikeShop';

// Brand / model / e-bike data lives in bikeBrands.ts; re-exported so every
// existing `from '../data/bikeCatalog'` import keeps working.
export * from './bikeBrands';

export interface BikeCategoryOption {
  id: VehicleCategory;
  title: string;
  subtitle: string;
  iconName: string;
  popularExamples: string;
}

export const BIKE_CATEGORY_OPTIONS: BikeCategoryOption[] = [
  {
    id: 'cycle',
    title: 'Standard Bicycle (Road, Mountain, or Hybrid)',
    subtitle: 'Pedal cycles with standard gears and brakes. Drop-bar, flat-bar, or suspension.',
    iconName: 'Bike',
    popularExamples: 'Trek Marlin, Carrera Subway, Specialized Sirrus, Boardman SLR',
  },
  {
    id: 'ebike',
    title: 'Electric Bicycle (E-Bike)',
    subtitle: 'Battery and electric motor assisted bicycle (pedal assist or throttle).',
    iconName: 'Zap',
    popularExamples: 'Specialized Turbo, Trek Powerfly, Carrera E, Bosch/Shimano drive',
  },
  {
    id: 'electric_scooter',
    title: 'Electric Scooter (E-Scooter)',
    subtitle: 'Standing commuter or folding electric scooter.',
    iconName: 'Zap',
    popularExamples: 'Xiaomi Mi Pro 2 / M365, Segway-Ninebot Max, Pure Electric, Vsett, Apollo, Dualtron, Kaabo',
  },
  {
    id: 'cargo',
    title: 'Kids Bike / Cargo / Other',
    subtitle: 'Children’s bicycles, cargo family bikes, tricycles, or custom builds.',
    iconName: 'Bike',
    popularExamples: 'Frog 53, Islabikes, Tern Cargo, Raleigh Pop',
  },
];

// Friendly symptom-based issues for people with no cycle knowledge
export interface FriendlyProblemOption {
  id: string;
  serviceId: string;
  category: VehicleCategory;
  headline: string;
  symptom: string;
  estimatedPrice: number;
  duration: string;
}

export const FRIENDLY_SERVICE_OPTIONS: FriendlyProblemOption[] = [
  {
    id: 'opt-general-tune',
    serviceId: 'cycle-tune',
    category: 'cycle',
    headline: 'General Safety Check & Tune-Up (Most Popular)',
    symptom: 'Ideal if your bike feels loose, has been in the shed, or needs a check before riding. Brakes adjusted, gears tuned, bolts torqued, and chain lubricated.',
    estimatedPrice: 40,
    duration: '45 mins',
  },
  {
    id: 'opt-flat-tyre',
    serviceId: 'cycle-puncture',
    category: 'cycle',
    headline: 'Flat Tyre / Puncture Repair',
    symptom: 'Tyre is deflated, punctured, or losing pressure. We supply & fit a fresh inner tube and check the tyre for thorns, glass, or debris.',
    estimatedPrice: 15,
    duration: '20 mins',
  },
  {
    id: 'opt-brakes',
    serviceId: 'cycle-hydraulic',
    category: 'cycle',
    headline: 'Brake Problem (Squeaking, Spongy, or Not Stopping)',
    symptom: 'Brakes making a loud squeal, rubbing against the wheel, or levers pulling all the way to handlebars. Includes pad inspection, adjustment or fluid bleed.',
    estimatedPrice: 30,
    duration: '35 mins',
  },
  {
    id: 'opt-gears',
    serviceId: 'cycle-tune',
    category: 'cycle',
    headline: 'Gears Slipping or Chain Falling Off',
    symptom: 'Gears crunching, jumping under pedal pressure, chain dropping, or refusing to shift into certain speeds.',
    estimatedPrice: 25,
    duration: '30 mins',
  },
  {
    id: 'opt-full-overhaul',
    serviceId: 'cycle-overhaul',
    category: 'cycle',
    headline: 'Full Pro Overhaul & Deep Clean',
    symptom: 'Complete strip-down and rebuild: degreased drivetrain, wheels straightened, fresh stainless cables, regreased bearings, and showroom safety tune.',
    estimatedPrice: 85,
    duration: '2-3 hours',
  },
  {
    id: 'opt-ebike-service',
    serviceId: 'ebike-complete',
    category: 'ebike',
    headline: 'E-Bike Electrical & Mechanical Service',
    symptom: 'Full mechanical bicycle service plus motor check, battery connector cleaning, sensor calibration, and wiring check.',
    estimatedPrice: 70,
    duration: '90 mins',
  },
  {
    id: 'opt-conversion-check',
    serviceId: 'ebike-complete',
    category: 'ebike',
    headline: 'E-Bike Conversion Safety Inspection',
    symptom: 'For bikes converted with a motor kit: we check wiring, battery mounting, controller heat, brake cut-offs, and torque arms for a safe, legal setup.',
    estimatedPrice: 55,
    duration: '60 mins',
  },
  {
    id: 'opt-scooter-tune',
    serviceId: 'scooter-overhaul',
    category: 'electric_scooter',
    headline: 'E-Scooter Full Health Check & Tune',
    symptom: 'Stem latch tightening, brake tuning, tire pressure, wiring inspection, and electronic throttle/brake calibration.',
    estimatedPrice: 45,
    duration: '45 mins',
  },
  {
    id: 'opt-scooter-puncture',
    serviceId: 'scooter-tire',
    category: 'electric_scooter',
    headline: 'E-Scooter Flat Tyre / Solid Tyre Fitting',
    symptom: 'Inner tube replacement or upgrade to puncture-proof solid honeycomb tyres for zero flat tyres forever.',
    estimatedPrice: 25,
    duration: '30 mins',
  },
  {
    id: 'opt-scooter-battery',
    serviceId: 'scooter-battery',
    category: 'electric_scooter',
    headline: 'E-Scooter Battery or Won’t Turn On',
    symptom: 'Scooter cuts out, won’t charge, shows an error code, or throttle is unresponsive.',
    estimatedPrice: 35,
    duration: '45 mins',
  },
  {
    id: 'opt-unsure',
    serviceId: 'cycle-tune',
    category: 'cycle',
    headline: 'I’m Not Sure / Strange Noise (Free In-Store Inspection)',
    symptom: 'Something rattles, clicks, or just doesn’t feel safe. Bring it to the workshop; Ben or Chloe will diagnose it with you on the spot and agree on any price before work starts.',
    estimatedPrice: 0,
    duration: '15 mins',
  },
];
