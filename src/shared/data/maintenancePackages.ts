import { VehicleCategory } from '../types/bikeShop';

/**
 * Standardised preventative-maintenance & safety packages.
 *
 * These are fixed-scope seasonal tune-ups (as opposed to the symptom-driven
 * FRIENDLY_SERVICE_OPTIONS) that the workshop can sell, quote and schedule
 * consistently. Each package carries the exact checklist the mechanic works
 * through, so nothing is missed between seasons.
 */

export type MaintenanceSeason = 'winter' | 'summer' | 'all';

export interface MaintenanceCheckItem {
  id: string;
  label: string;
  /** Vehicle types this check applies to. */
  appliesTo: VehicleCategory[];
  /** Optional workshop detail shown under the check. */
  note?: string;
}

export interface MaintenancePackage {
  id: string;
  /** Backend service id used when the package is booked. */
  serviceId: string;
  name: string;
  season: MaintenanceSeason;
  seasonLabel: string;
  /** Booking-summary headline. */
  headline: string;
  tagline: string;
  description: string;
  recommendedInterval: string;
  appliesTo: VehicleCategory[];
  /** Indicative "from" price; final price is quoted on inspection. */
  indicativePrice: number;
  duration: string;
  checks: MaintenanceCheckItem[];
}

const ALL_RIDDEN: VehicleCategory[] = ['cycle', 'ebike', 'electric_scooter'];

export const MAINTENANCE_PACKAGES: MaintenancePackage[] = [
  {
    id: 'pkg-winterization',
    serviceId: 'cycle-tune',
    name: 'Winterization Check',
    season: 'winter',
    seasonLabel: 'Autumn / Winter',
    headline: 'Winterization Check (Seasonal Tune-Up)',
    tagline: 'Protect the bike through salt, rain and cold, or prep it for winter storage.',
    description:
      'A seasonal safety and preservation service that gets your bike or scooter ready for wet, gritty winter roads — or safely tucked away until spring.',
    recommendedInterval: 'Every autumn, and again before long-term winter storage.',
    appliesTo: ALL_RIDDEN,
    indicativePrice: 35,
    duration: '45 mins',
    checks: [
      {
        id: 'win-brakes',
        label: 'Brake adjustment & pad inspection',
        appliesTo: ALL_RIDDEN,
        note: 'Cable tension and pad wear set for wet-weather stopping power.',
      },
      {
        id: 'win-chain',
        label: 'Chain clean & re-lubrication (wet-weather lube)',
        appliesTo: ['cycle', 'ebike'],
        note: 'Degrease, dry and apply a wet lube that resists being washed off.',
      },
      {
        id: 'win-tyres',
        label: 'Tyre pressure check & top-up',
        appliesTo: ALL_RIDDEN,
        note: 'Set to the recommended pressure for cold, wet conditions.',
      },
      {
        id: 'win-corrosion',
        label: 'Anti-corrosion & fastener check',
        appliesTo: ALL_RIDDEN,
        note: 'Protect exposed metal and re-torque key bolts against road salt.',
      },
      {
        id: 'win-lights',
        label: 'Lights, reflectors & bell check',
        appliesTo: ALL_RIDDEN,
        note: 'Winter visibility check — batteries, contacts and aim.',
      },
      {
        id: 'win-battery',
        label: 'Battery storage & connector care',
        appliesTo: ['ebike', 'electric_scooter'],
        note: 'Charge to a healthy storage level, clean contacts and advise on cool, dry storage.',
      },
    ],
  },
  {
    id: 'pkg-presummer',
    serviceId: 'cycle-tune',
    name: 'Pre-Summer Safety Tune',
    season: 'summer',
    seasonLabel: 'Spring / Summer',
    headline: 'Pre-Summer Safety Tune (Seasonal Tune-Up)',
    tagline: 'Shake off the winter and get road-ready for the long, dry riding season.',
    description:
      'A comprehensive pre-season safety tune that wakes the bike or scooter up after winter and confirms it is safe and reliable for summer riding.',
    recommendedInterval: 'Every spring, before the main riding season starts.',
    appliesTo: ALL_RIDDEN,
    indicativePrice: 40,
    duration: '50 mins',
    checks: [
      {
        id: 'sum-brakes',
        label: 'Brake adjustment & pad wear check',
        appliesTo: ALL_RIDDEN,
        note: 'Re-set cable or hydraulic brakes and flag pads nearing the limit.',
      },
      {
        id: 'sum-chain',
        label: 'Chain lubrication & drivetrain check',
        appliesTo: ['cycle', 'ebike'],
        note: 'Re-lube the chain and check for stretched links or worn teeth.',
      },
      {
        id: 'sum-tyres',
        label: 'Tyre pressure & tread check',
        appliesTo: ALL_RIDDEN,
        note: 'Pressure set for warm-weather riding plus a tread and sidewall inspection.',
      },
      {
        id: 'sum-gears',
        label: 'Gear indexing & shifting check',
        appliesTo: ['cycle', 'ebike'],
        note: 'Index the derailleur so every gear engages cleanly.',
      },
      {
        id: 'sum-torque',
        label: 'Safety bolt torque check',
        appliesTo: ALL_RIDDEN,
        note: 'Stem, bars, seatpost, wheel and rack fasteners checked to spec.',
      },
      {
        id: 'sum-scooter',
        label: 'E-scooter brake & throttle cut-off audit',
        appliesTo: ['electric_scooter'],
        note: 'Verify both brakes and the electronic brake cut-off engage correctly.',
      },
    ],
  },
  {
    id: 'pkg-scooter-battery-audit',
    serviceId: 'scooter-battery',
    name: 'E-Scooter Battery & Brake Safety Audit',
    season: 'all',
    seasonLabel: 'All year',
    headline: 'E-Scooter Battery & Brake Safety Audit',
    tagline: 'A focused electrical and braking safety audit for standing e-scooters.',
    description:
      'A dedicated safety audit for e-scooters covering the two highest-risk systems — the battery/charging circuit and the brakes — plus the folding stem that keeps it together.',
    recommendedInterval: 'Every 6 months, and any time the scooter cuts out or feels different.',
    appliesTo: ['electric_scooter'],
    indicativePrice: 45,
    duration: '50 mins',
    checks: [
      {
        id: 'aud-battery-health',
        label: 'Battery health & voltage check',
        appliesTo: ['electric_scooter'],
        note: 'Measure pack voltage and look for sag or imbalance between cells.',
      },
      {
        id: 'aud-charging',
        label: 'Charging port, cable & BMS check',
        appliesTo: ['electric_scooter'],
        note: 'Inspect for heat, arcing or damage at the charge port and battery management board.',
      },
      {
        id: 'aud-brake-mech',
        label: 'Brake pad, disc & cable audit',
        appliesTo: ['electric_scooter'],
        note: 'Pad thickness, disc true-ness and cable tension on both brakes.',
      },
      {
        id: 'aud-brake-electronic',
        label: 'Electronic brake cut-off test',
        appliesTo: ['electric_scooter'],
        note: 'Confirm the motor cuts out the instant either brake lever is pulled.',
      },
      {
        id: 'aud-stem',
        label: 'Stem latch & folding mechanism check',
        appliesTo: ['electric_scooter'],
        note: 'Tighten and test the folding joint and stem clamp — a common failure point.',
      },
      {
        id: 'aud-tyres',
        label: 'Tyre pressure & wheel check',
        appliesTo: ['electric_scooter'],
        note: 'Pressure top-up plus a check for loose hubs and buckled rims.',
      },
    ],
  },
];

export const findMaintenancePackage = (id: string): MaintenancePackage | undefined =>
  MAINTENANCE_PACKAGES.find((p) => p.id === id);

/** Human label for a season, used on badges. */
export const seasonAccent = (season: MaintenanceSeason): string => {
  switch (season) {
    case 'winter':
      return 'sky';
    case 'summer':
      return 'amber';
    default:
      return 'emerald';
  }
};
