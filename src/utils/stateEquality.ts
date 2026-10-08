/**
 * Structural comparison helpers used to keep the background database sync from
 * re-rendering the app when a poll returns data identical to what we already
 * hold. Without these guards the 4s poll (and every realtime event) called a
 * dozen `setState`s with freshly-deserialized objects, changing the context
 * value identity and re-rendering all ~50 `useShop()` consumers for nothing.
 *
 * `deepEqual` is deliberately plain: the synced payloads are JSON-shaped
 * (strings/numbers/booleans/null/arrays/plain objects), so we compare by
 * structure and skip function/Date identity concerns. Values that are not
 * structurally comparable (functions, Dates, class instances) fall back to
 * reference identity, which is the safe answer for "has this changed?".
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/**
 * The synced records carry real `Date` fields (`createdAt`, `lastStampedAt`,
 * `drawDate`, ...). Two Dates with the same instant are different object
 * references, so without this branch every poll looks "changed" and the
 * equality guards silently do nothing - the exact lag they were meant to fix.
 */
const isDate = (value: unknown): value is Date => value instanceof Date;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;

  if (isDate(a) || isDate(b)) {
    return isDate(a) && isDate(b) && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * True when two collections hold the same records in the same order. Used by
 * the sync loop so an unchanged list is not written back into state (which
 * would change the context identity and re-render every consumer).
 */
export function collectionsEqual<T>(a: T[], b: T[]): boolean {
  return deepEqual(a, b);
}
