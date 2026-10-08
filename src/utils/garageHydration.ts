/**
 * Pure helpers for hydrating each roster member's garage from a batch read of
 * `customer_bikes`.
 *
 * The roster (`fetchAllProfilesFromDb`) does not carry bikes, so `setUsers(
 * allProfiles)` replaces every profile with one whose `bikes` is undefined. The
 * next render then shows an empty garage ("bikes show up, then disappear").
 * These helpers rebuild each profile's `bikes` from the batch result so the
 * roster swap is lossless.
 */
import type { CustomerBike } from '../types/bikeShop';

/** The raw `customer_id` keys a profile's bikes may be stored under. */
export function ownerKeysForProfile(profile: { uid: string; membershipNumber?: string }): string[] {
  const keys = [profile.uid];
  const membership = (profile.membershipNumber || '').trim();
  if (membership && membership !== profile.uid) keys.push(membership);
  return keys;
}

/** Every distinct owner key across a set of profiles, de-duplicated. */
export function ownerKeysForProfiles(profiles: Array<{ uid: string; membershipNumber?: string }>): string[] {
  const keys = new Set<string>();
  for (const p of profiles) {
    for (const k of ownerKeysForProfile(p)) keys.add(k);
  }
  return [...keys];
}

/** Reads bikes for a set of owner keys, grouped by the key they were stored under. */
export type BikesByOwnerReader = (
  ownerKeys: string[]
) => Promise<{ byOwner: Record<string, CustomerBike[]>; error?: string }>;

/**
 * Give every roster profile back its `bikes`. The roster read
 * (`fetchAllProfilesFromDb`) never carries bikes, so swapping it into state
 * would blank every garage — the "bikes show up, then disappear" bug. This
 * reads all bikes in one query and re-attaches them.
 *
 * If the batch read fails we keep whatever each profile already had (from
 * `previous`, matched by uid or membership) instead of handing back an empty
 * garage — a transient RLS/network blip must never make a customer's bikes
 * vanish. Only a successful read is allowed to produce an empty garage.
 */
export async function hydrateRosterGarages<T extends { uid: string; membershipNumber?: string }>(
  profiles: T[],
  readBikesByOwner: BikesByOwnerReader,
  previous: Array<{ uid: string; membershipNumber?: string; bikes?: CustomerBike[] }> = []
): Promise<(T & { bikes: CustomerBike[] })[]> {
  const keys = ownerKeysForProfiles(profiles);
  if (keys.length === 0) return profiles.map((p) => ({ ...p, bikes: [] }));
  const { byOwner, error } = await readBikesByOwner(keys);
  if (error) {
    return profiles.map((p) => ({
      ...p,
      bikes: previous.find((q) => q.uid === p.uid || q.membershipNumber === p.membershipNumber)?.bikes || [],
    }));
  }
  return attachBikesToProfiles(profiles, byOwner);
}

/**
 * Re-attach each profile's bikes from the batch result. A profile's bikes are
 * the union of everything stored under its UUID and its membership number (the
 * legacy key), de-duplicated by id so a row seen under both keys is not shown
 * twice. A profile with no matching rows gets `[]` — an explicit empty garage,
 * never a stale one.
 */
export function attachBikesToProfiles<T extends { uid: string; membershipNumber?: string }>(
  profiles: T[],
  byOwner: Record<string, CustomerBike[]>
): (T & { bikes: CustomerBike[] })[] {
  return profiles.map((p) => {
    const seen = new Set<string>();
    const bikes: CustomerBike[] = [];
    for (const key of ownerKeysForProfile(p)) {
      for (const bike of byOwner[key] || []) {
        if (seen.has(bike.id)) continue;
        seen.add(bike.id);
        bikes.push(bike);
      }
    }
    return { ...p, bikes };
  });
}
