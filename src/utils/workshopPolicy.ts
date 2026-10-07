/**
 * Workshop trading policy.
 *
 * These are the plain-English rules the workshop trades on. They are shown on
 * the booking flow and at the point of sale so customers see them before they
 * commit, and so staff have a written policy to point to when a price is
 * questioned or a job has to be turned away.
 *
 * Kept as pure data so every surface (website, staff till, customer app) shows
 * exactly the same wording and the strings can be unit-tested.
 */

/** Every discount code is only valid once the basket meets the code's minimum. */
export const DISCOUNT_MIN_SPEND_DISCLAIMER =
  'All discount codes are subject to a minimum spend. The minimum is shown on the code and must be met before the discount is applied.';

/** Prices are fixed by the workshop — we do not haggle. */
export const NO_HAGGLING_DISCLAIMER =
  'Prices are set by our workshop and are not negotiable. A quote reflects the parts, labour and time the job needs — please do not ask us to haggle.';

/** We can decline a job when a safety-critical part is refused. */
export const RIGHT_TO_REFUSE_DISCLAIMER =
  'If we advise that a part needs replacing for your safety and you choose not to replace it, we may refuse the job. We cannot release a vehicle we believe is unsafe to ride.';

/** Disclaimers shown with any discount / offer (booking basket, till, offers page). */
export const DISCOUNT_DISCLAIMERS: string[] = [
  DISCOUNT_MIN_SPEND_DISCLAIMER,
  'Discount codes cannot be combined unless we say so, and they cannot be applied after the job is invoiced.',
];

/** Disclaimers shown on the service booking flow. */
export const BOOKING_POLICY_DISCLAIMERS: string[] = [
  DISCOUNT_MIN_SPEND_DISCLAIMER,
  NO_HAGGLING_DISCLAIMER,
  RIGHT_TO_REFUSE_DISCLAIMER,
];

/** Disclaimers shown at the counter / point of sale. */
export const SALES_POLICY_DISCLAIMERS: string[] = [
  DISCOUNT_MIN_SPEND_DISCLAIMER,
  NO_HAGGLING_DISCLAIMER,
];

/** Short, one-line version of the refuse rule for tight spaces (invoice sign-off). */
export const RIGHT_TO_REFUSE_SHORT =
  'We may refuse a job if a recommended safety replacement is declined.';
