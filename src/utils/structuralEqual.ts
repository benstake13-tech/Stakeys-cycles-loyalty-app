/**
 * Structural (value) equality for plain JSON-ish data: arrays, plain objects,
 * primitives, null. Used to stop a background poll from replacing state with a
 * fresh but identical object graph, which would re-render every consumer even
 * though nothing changed.
 */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  // Dates (and other objects with no enumerable own keys) must be compared by
  // value, otherwise two different timestamps would look "equal".
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!structurallyEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!structurallyEqual(objA[key], objB[key])) return false;
  }
  return true;
}

/**
 * React state updater that keeps the previous reference when the incoming value
 * is structurally identical, so the provider (and every context consumer) does
 * not re-render on a no-op background refresh.
 */
export function keepIfEqual<T>(prev: T, next: T): T {
  return structurallyEqual(prev, next) ? prev : next;
}
