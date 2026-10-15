export type MilestoneKind = 'booking' | 'garage' | 'listing' | 'sale' | 'reward' | 'voucher' | 'prize' | 'welcome';
export const milestoneCopy: Record<MilestoneKind, { title: string; detail: string }> = {
  booking: { title: 'Booking received', detail: 'Ready for the team to review.' },
  garage: { title: 'Bike added to the garage', detail: 'Ready for bookings and service history.' },
  listing: { title: 'Your listing is live', detail: 'Your bike is ready to find its next rider.' },
  sale: { title: 'Bike sold', detail: 'Here’s to its next adventure.' },
  reward: { title: 'Reward unlocked', detail: 'Your next reward is ready.' },
  voucher: { title: 'Voucher received', detail: 'A little extra for your next visit.' },
  prize: { title: 'A winning moment', detail: 'You’ve won a prize.' },
  welcome: { title: 'Welcome to Stakey’s', detail: 'Your cycling journey starts here.' },
};
export const activityMilestone: Record<string, MilestoneKind> = {
  new_booking: 'booking', bike_added: 'garage', reward_ready: 'reward',
  voucher_earned: 'voucher', prize_won: 'prize', new_member: 'welcome',
};
export interface MilestoneEvent { id: string; kind: MilestoneKind; scope: string; title?: string; detail?: string }
export const MILESTONE_EVENT = 'stakeys:milestone';
export function announceMilestone(event: MilestoneEvent) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MILESTONE_EVENT, { detail: event }));
}
const memory = new Map<string, string[]>();
/** Bounded history per signed-in account. No replay on polling or remount. */
export function claimMilestone(scope: string, id: string): boolean {
  const key = `stakeys.milestones.v1:${scope}`;
  let ids = memory.get(key) ?? [];
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(saved)) ids = [...new Set([...ids, ...saved.filter(x => typeof x === 'string')])]; } catch { /* memory fallback */ }
  if (ids.includes(id)) return false;
  ids = [...ids, id].slice(-200);
  memory.set(key, ids);
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* memory fallback */ }
  return true;
}

// Prevent optimistic garage state from triggering a success before persistence.
export const pendingMilestones = new Set<string>();
