import type { VehicleCategory } from '../types/bikeShop';

export interface BikeIssueItem {
  id: string;
  label: string;
  category: string;
  symptomDetail?: string;
  defaultPrice?: number;
}

export interface BikeIssueCategory {
  id: string;
  title: string;
  categoryKey: 'brakes' | 'drivetrain' | 'wheels' | 'noise' | 'frame' | 'ebike' | 'general' | 'scooter';
  description: string;
  isEbikeOnly?: boolean;
  /** Vehicle types this category applies to. Empty/undefined = every type. */
  vehicleCategories?: VehicleCategory[];
  items: BikeIssueItem[];
}

export const BIKE_ISSUES_CATEGORIES: BikeIssueCategory[] = [
  {
    id: 'cat-brakes',
    title: 'Brakes',
    categoryKey: 'brakes',
    description: 'Stopping power, lever feel, pads, and hydraulic calipers',
    items: [
      { id: 'brakes-squeaky', label: 'Squeaky / noisy brakes', category: 'Brakes' },
      { id: 'brakes-rubbing', label: 'Brakes rubbing against the rim or disc', category: 'Brakes' },
      { id: 'brakes-weak', label: 'Weak braking power / lever feels spongy', category: 'Brakes' },
      { id: 'brakes-pull-handlebar', label: 'Brake lever pulls all the way to the handlebar', category: 'Brakes' },
      { id: 'brakes-fluid-leak', label: 'Hydraulic brake fluid leaking', category: 'Brakes' },
      { id: 'brakes-pads-worn', label: 'Brake pads look worn down', category: 'Brakes' },
    ],
  },
  {
    id: 'cat-drivetrain',
    title: 'Drivetrain & Shifting',
    categoryKey: 'drivetrain',
    description: 'Gears, derailleur, chain, cassette, cables, and pedal rotation',
    items: [
      { id: 'gears-slipping', label: 'Gears slipping or jumping teeth while pedaling', category: 'Drivetrain & Shifting' },
      { id: 'gears-chain-drop', label: 'Chain dropping or falling off', category: 'Drivetrain & Shifting' },
      { id: 'gears-noisy-grinding', label: 'Gears noisy, clicking, or grinding', category: 'Drivetrain & Shifting' },
      { id: 'gears-unresponsive', label: 'Unresponsive shifting / sluggish gear changes', category: 'Drivetrain & Shifting' },
      { id: 'gears-chain-stuck', label: 'Chain stuck between frame and cassette/chainring', category: 'Drivetrain & Shifting' },
      { id: 'gears-pedals-stiff', label: 'Pedals feel stiff or turn roughly', category: 'Drivetrain & Shifting' },
    ],
  },
  {
    id: 'cat-wheels',
    title: 'Wheels & Tires',
    categoryKey: 'wheels',
    description: 'Punctures, inflation, spoke tension, wheel truing, and hubs',
    items: [
      { id: 'wheels-flat-puncture', label: 'Flat tire / puncture', category: 'Wheels & Tires' },
      { id: 'wheels-air-leak', label: "Tire won't stay inflated", category: 'Wheels & Tires' },
      { id: 'wheels-wobbly-untrue', label: 'Wheel is wobbling / untrue', category: 'Wheels & Tires' },
      { id: 'wheels-broken-spoke', label: 'Broken or loose spoke', category: 'Wheels & Tires' },
      { id: 'wheels-tread-worn', label: 'Tire tread worn down or cracked', category: 'Wheels & Tires' },
      { id: 'wheels-hub-loose', label: 'Hub clicking, grinding, or loose', category: 'Wheels & Tires' },
    ],
  },
  {
    id: 'cat-noise',
    title: 'Noise & Vibration',
    categoryKey: 'noise',
    description: 'Creaks, rattles, clicking, and mysterious workshop noises',
    items: [
      { id: 'noise-creak-pedaling', label: 'Squeaking, clicking, or creaking when pedaling', category: 'Noise & Vibration' },
      { id: 'noise-rattling-frame', label: 'Rattling frame or loose components', category: 'Noise & Vibration' },
      { id: 'noise-knocking-headset', label: 'Knocking or play in the handlebars / headset', category: 'Noise & Vibration' },
      { id: 'noise-bottom-bracket', label: 'Rattling or grinding from bottom bracket (crank area)', category: 'Noise & Vibration' },
    ],
  },
  {
    id: 'cat-frame',
    title: 'Frame, Steering & Comfort',
    categoryKey: 'frame',
    description: 'Cockpit alignment, saddle position, dropper post, and suspension',
    items: [
      { id: 'frame-loose-handlebars', label: 'Loose or misaligned handlebars', category: 'Frame, Steering & Comfort' },
      { id: 'frame-saddle-uncomfortable', label: 'Seat / saddle sliding or uncomfortable', category: 'Frame, Steering & Comfort' },
      { id: 'frame-dropper-post', label: 'Dropper post not working / sagging', category: 'Frame, Steering & Comfort' },
      { id: 'frame-suspension-leak', label: 'Suspension feels too soft, stiff, or leaking oil', category: 'Frame, Steering & Comfort' },
      { id: 'frame-loose-rack-fender', label: 'Loose kickstand, rack, or fender', category: 'Frame, Steering & Comfort' },
    ],
  },
  {
    id: 'cat-ebike',
    title: 'E-Bike Specifics (Optional)',
    categoryKey: 'ebike',
    description: 'Electric motors, battery range, console codes, and pedal assist sensors',
    isEbikeOnly: true,
    vehicleCategories: ['ebike'],
    items: [
      { id: 'ebike-motor-cutout', label: 'Motor cut-outs / intermittent power', category: 'E-Bike Specifics' },
      { id: 'ebike-battery-range', label: 'Battery not holding charge / reduced range', category: 'E-Bike Specifics' },
      { id: 'ebike-error-code', label: 'Display console showing error code', category: 'E-Bike Specifics' },
      { id: 'ebike-sensor-disconnect', label: 'Sensor misaligned or disconnected', category: 'E-Bike Specifics' },
    ],
  },
  {
    id: 'cat-scooter',
    title: 'E-Scooter Specifics',
    categoryKey: 'scooter',
    description: 'Motors, batteries, throttle, controller, stem and folding mechanism',
    vehicleCategories: ['electric_scooter'],
    items: [
      { id: 'scooter-motor-cutout', label: 'Motor cuts out / intermittent power', category: 'E-Scooter Specifics' },
      { id: 'scooter-battery-range', label: 'Battery not holding charge / reduced range', category: 'E-Scooter Specifics' },
      { id: 'scooter-error-code', label: 'Display showing an error code', category: 'E-Scooter Specifics' },
      { id: 'scooter-throttle', label: 'Throttle unresponsive or sticking', category: 'E-Scooter Specifics' },
      { id: 'scooter-charging', label: "Won't charge / charging port issue", category: 'E-Scooter Specifics' },
      { id: 'scooter-stem-folding', label: 'Stem or folding latch loose / rattling', category: 'E-Scooter Specifics' },
      { id: 'scooter-controller', label: 'Controller overheating or burning smell', category: 'E-Scooter Specifics' },
    ],
  },
  {
    id: 'cat-general',
    title: 'General / Other',
    categoryKey: 'general',
    description: 'Annual safety checks, comprehensive servicing, and custom requests',
    items: [
      { id: 'general-inspection-tune', label: 'Annual safety inspection / general tune-up needed', category: 'General / Other' },
      { id: 'general-unsure-multiple', label: 'Unsure / Multiple issues not listed above (please describe below)', category: 'General / Other' },
    ],
  },
];

/**
 * Issues that do not apply to a given vehicle type. E-scooters have no pedal
 * drivetrain, saddle, or suspension, so those bike-specific symptoms are hidden
 * for them (and vice versa: scooter-only faults stay off pedal cycles).
 */
const ISSUE_EXCLUSIONS: Partial<Record<VehicleCategory, string[]>> = {
  electric_scooter: [
    'gears-slipping',
    'gears-chain-drop',
    'gears-noisy-grinding',
    'gears-unresponsive',
    'gears-chain-stuck',
    'gears-pedals-stiff',
    'noise-bottom-bracket',
    'frame-saddle-uncomfortable',
    'frame-dropper-post',
    'frame-suspension-leak',
  ],
};

const SCOOTER_ONLY_ISSUE_IDS = new Set(
  (BIKE_ISSUES_CATEGORIES.find((c) => c.id === 'cat-scooter')?.items || []).map((i) => i.id)
);

/** True when an issue should be offered for the given vehicle type. */
export function issueAppliesToVehicle(issueId: string, vehicleCategory?: VehicleCategory): boolean {
  if (!vehicleCategory) return true;
  if ((ISSUE_EXCLUSIONS[vehicleCategory] || []).includes(issueId)) return false;
  if (vehicleCategory !== 'electric_scooter' && SCOOTER_ONLY_ISSUE_IDS.has(issueId)) return false;
  return true;
}

/** The issue categories offered for a vehicle type (items pre-filtered). */
export function issueCategoriesForVehicle(vehicleCategory?: VehicleCategory): BikeIssueCategory[] {
  return BIKE_ISSUES_CATEGORIES.filter(
    (cat) => !cat.vehicleCategories || cat.vehicleCategories.includes(vehicleCategory!)
  )
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => issueAppliesToVehicle(item.id, vehicleCategory)),
    }))
    .filter((cat) => cat.items.length > 0);
}

export const ALL_BIKE_ISSUES_MAP = new Map<string, BikeIssueItem>();
BIKE_ISSUES_CATEGORIES.forEach((cat) => {
  cat.items.forEach((item) => {
    ALL_BIKE_ISSUES_MAP.set(item.id, item);
  });
});
