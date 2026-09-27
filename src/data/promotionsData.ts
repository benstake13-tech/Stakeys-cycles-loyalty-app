import { ShopPromotion } from '../types/bikeShop';

export const INITIAL_PROMOTIONS: ShopPromotion[] = [
  {
    id: 'promo-spring-tune',
    title: 'Spring Season Drivetrain Overhaul',
    subtitle: 'Free ultrasonic degrease & ceramic chain lube with any Full Cycle Service',
    code: 'SPRINGDRIVE26',
    discountPercentage: 20,
    badgeText: 'Active Now',
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2026-04-30',
    eligibleCategories: ['cycle', 'ebike'],
    bgGradient: 'from-emerald-950/80 via-[#0e1713] to-neutral-900',
    featured: true,
    termsAndConditions: [
      'Valid for in-store bookings and advance online workshop appointments.',
      'Includes complete ultrasonic cleaning of cassette, chainrings, and chain.',
      'Labour only; replacement worn components (chains, cassettes) charged separately at trade prices.',
      'Cannot be combined with £40 Stamp Card Service Voucher simultaneously.',
      'One redemption per loyalty member / customer.',
    ],
  },
  {
    id: 'promo-scooter-puncture',
    title: 'Solid Tire Conversion & Safety Check',
    subtitle: '15% off anti-puncture solid honeycomb tire fitting for Xiaomi & Pure scooters',
    code: 'NOSLOWDOWN',
    discountAmount: 15,
    badgeText: 'Popular',
    status: 'active',
    startDate: '2026-02-15',
    endDate: '2026-05-31',
    eligibleCategories: ['electric_scooter'],
    bgGradient: 'from-blue-950/80 via-[#0c1624] to-neutral-900',
    featured: true,
    termsAndConditions: [
      'Applies to standard 8.5" and 10" e-scooter solid tire installations.',
      'Includes stem bolt torque calibration and brake pad electronic sensor alignment.',
      'Excludes severe hub motor rim damage requiring alloy wheel straightening.',
      'Customer must supply battery key or allow technician safety pin check.',
    ],
  },
  {
    id: 'promo-ebike-diagnostic',
    title: 'Upcoming: E-Bike Summer Battery Health & Firmware Audit',
    subtitle: 'Full Bosch, Shimano Steps, & Bafang diagnostic report with motor telemetry printout',
    code: 'VOLTREADY',
    discountPercentage: 25,
    badgeText: 'Upcoming · Starts May 1',
    status: 'upcoming',
    startDate: '2026-05-01',
    endDate: '2026-06-30',
    eligibleCategories: ['ebike'],
    bgGradient: 'from-amber-950/70 via-[#1c140a] to-neutral-900',
    featured: false,
    termsAndConditions: [
      'Advance pre-booking opens 7 days prior to May 1st launch.',
      'Valid for certified Bosch Active/Performance, Shimano EP8/E8000, and standard 36V/48V Bafang systems.',
      'Printout includes battery cell balancing health, charging cycle count, and firmware patch report.',
      'Walk-in slots subject to diagnostic bench availability.',
    ],
  },
  {
    id: 'promo-winter-brake-flush',
    title: 'Winter Mineral Brake Bleed & Rotor Truing',
    subtitle: 'Dual-caliper hydraulic bleed and rotor degrease discount for harsh weather riders',
    code: 'WINTERBLEED',
    discountAmount: 10,
    badgeText: 'Archived Promo',
    status: 'expired',
    startDate: '2025-11-01',
    endDate: '2026-01-31',
    eligibleCategories: ['cycle', 'ebike'],
    bgGradient: 'from-neutral-900 via-neutral-950 to-neutral-900',
    featured: false,
    termsAndConditions: [
      'This seasonal promotion has concluded for the current cycle year.',
      'Standard hydraulic service rates currently apply.',
      'Check back during autumn for seasonal brake tune packages.',
    ],
  },
];

/**
 * Evaluates promotions against the current local date:
 * - Marks promotions whose endDate has passed as 'expired'
 * - Activates promotions whose startDate has arrived and endDate has not passed
 * - Marks future promotions as 'upcoming'
 */
export function evaluatePromotionsExpiry(
  promos: ShopPromotion[],
  referenceDate = new Date()
): ShopPromotion[] {
  const todayStr = referenceDate.toISOString().split('T')[0];

  return promos.map((promo) => {
    let updatedStatus: 'active' | 'upcoming' | 'expired' = promo.status;
    let badge = promo.badgeText;

    if (promo.endDate < todayStr) {
      updatedStatus = 'expired';
      badge = 'Expired';
    } else if (promo.startDate <= todayStr && promo.endDate >= todayStr) {
      updatedStatus = 'active';
      if (promo.endDate.slice(0, 7) === todayStr.slice(0, 7)) {
        badge = 'Ending Soon';
      } else if (!badge || badge === 'Upcoming') {
        badge = 'Active Now';
      }
    } else if (promo.startDate > todayStr) {
      updatedStatus = 'upcoming';
      badge = `Starts ${promo.startDate}`;
    }

    return {
      ...promo,
      status: updatedStatus,
      badgeText: badge,
    };
  });
}
