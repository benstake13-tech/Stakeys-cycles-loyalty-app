/**
 * Discount code audiences.
 *
 * Two curated sets of ready-to-issue codes:
 *  - `member`  — richer offers reserved for signed-in loyalty members.
 *  - `public`  — lighter offers handed to unregistered website visitors.
 *
 * A member-only code is refused for a signed-out basket (see
 * `validateDiscountCode`), so the two sets can safely share the same catalogue.
 */
import { DiscountAudience, DiscountCode, VehicleCategory } from '../types/bikeShop';

export interface DiscountTemplate {
  /** Slug used to build a stable, human-readable code. */
  slug: string;
  title: string;
  description: string;
  type: DiscountCode['type'];
  value: number;
  minimumSpend?: number;
  eligibleCategories?: VehicleCategory[];
}

export interface DiscountSetBlueprint {
  audience: DiscountAudience;
  label: string;
  blurb: string;
  /** Prefix so generated codes are instantly recognisable on the till. */
  prefix: string;
  templates: DiscountTemplate[];
}

export const MEMBER_DISCOUNT_SET: DiscountSetBlueprint = {
  audience: 'member',
  label: 'Loyalty member set',
  blurb: 'Richer offers reserved for signed-in loyalty members.',
  prefix: 'MEM',
  templates: [
    {
      slug: '15OFF',
      title: 'Members 15% off labour',
      description: 'Loyalty member rate on workshop labour.',
      type: 'percent',
      value: 15,
      eligibleCategories: ['cycle', 'ebike'],
    },
    {
      slug: '20OFF',
      title: 'Members 20% off parts',
      description: 'Loyalty member rate on second-hand parts.',
      type: 'percent',
      value: 20,
    },
    {
      slug: '10CREDIT',
      title: 'Members £10 credit',
      description: '£10 loyalty credit on a £40+ basket.',
      type: 'fixed',
      value: 10,
      minimumSpend: 40,
    },
  ],
};

export const PUBLIC_DISCOUNT_SET: DiscountSetBlueprint = {
  audience: 'public',
  label: 'Website visitor set',
  blurb: 'Lighter welcome offers for unregistered website visitors.',
  prefix: 'WEB',
  templates: [
    {
      slug: '5OFF',
      title: 'Welcome 5% off',
      description: 'First-order welcome offer for website visitors.',
      type: 'percent',
      value: 5,
    },
    {
      slug: '5CREDIT',
      title: 'Welcome £5 off',
      description: '£5 off a £30+ click & collect order.',
      type: 'fixed',
      value: 5,
      minimumSpend: 30,
    },
  ],
};

export const DISCOUNT_SET_BLUEPRINTS: DiscountSetBlueprint[] = [
  MEMBER_DISCOUNT_SET,
  PUBLIC_DISCOUNT_SET,
];

export function blueprintFor(audience: DiscountAudience): DiscountSetBlueprint {
  return audience === 'member' ? MEMBER_DISCOUNT_SET : PUBLIC_DISCOUNT_SET;
}

/** A stable, readable code such as `MEM-15OFF`. */
export function buildCode(prefix: string, slug: string): string {
  return `${prefix}-${slug}`.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/** Turn a blueprint into concrete discount codes, ready to persist. */
export function generateDiscountSet(
  blueprint: DiscountSetBlueprint,
  options: { now?: Date } = {}
): DiscountCode[] {
  const now = options.now || new Date();
  return blueprint.templates.map((t, i) => ({
    id: `disc-${blueprint.prefix.toLowerCase()}-${t.slug.toLowerCase()}`,
    code: buildCode(blueprint.prefix, t.slug),
    title: t.title,
    description: t.description,
    type: t.type,
    value: t.value,
    status: 'active' as const,
    createdAt: now,
    timesUsed: 0,
    eligibleCategories: t.eligibleCategories || [],
    minimumSpend: t.minimumSpend,
    audience: blueprint.audience,
    // Stable id keeps regeneration idempotent instead of piling up duplicates.
    createdBy: i === 0 ? 'Discount set generator' : undefined,
  }));
}
