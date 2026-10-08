import { describe, it, expect } from 'vitest';
import { deepEqual, collectionsEqual } from './src/utils/stateEquality';

describe('deepEqual', () => {
  it('treats structurally identical objects as equal', () => {
    expect(deepEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('detects a changed scalar', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('detects an added or removed key', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('compares nested objects and arrays by structure', () => {
    const a = { id: 'bk-1', progress: [{ stage: 'received', at: 't1' }], tags: ['x', 'y'] };
    const b = { id: 'bk-1', progress: [{ stage: 'received', at: 't1' }], tags: ['x', 'y'] };
    const c = { id: 'bk-1', progress: [{ stage: 'approved', at: 't1' }], tags: ['x', 'y'] };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });

  it('is order-sensitive for arrays (a reordered list is a change)', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('handles null and undefined distinctly from values', () => {
    expect(deepEqual({ a: null }, { a: null })).toBe(true);
    expect(deepEqual({ a: null }, { a: undefined })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: null })).toBe(false);
  });

  it('treats a JSON round-trip of a synced payload as unchanged', () => {
    const payload = { id: 'u1', bikes: [{ id: 'b1', brand: 'Trek' }], stamps: 3, active: true };
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(deepEqual(payload, roundTripped)).toBe(true);
  });

  it('treats two Dates at the same instant as equal (the sync lag regression)', () => {
    // A poll re-deserialises every row, so `createdAt`/`lastStampedAt` become new
    // Date objects for identical data. Without this the guards never matched and
    // every poll still re-rendered the whole tree.
    const iso = '2026-10-08T12:00:00.000Z';
    expect(deepEqual(new Date(iso), new Date(iso))).toBe(true);
    expect(deepEqual({ createdAt: new Date(iso) }, { createdAt: new Date(iso) })).toBe(true);
    expect(
      deepEqual(
        { lastStampedAt: new Date(iso), id: 'u1' },
        { lastStampedAt: new Date(iso), id: 'u1' }
      )
    ).toBe(true);
  });

  it('distinguishes Dates at different instants', () => {
    expect(deepEqual(new Date('2026-10-08T12:00:00Z'), new Date('2026-10-08T12:00:01Z'))).toBe(false);
  });

  it('treats a Date and its ISO string as different (a real type change)', () => {
    const iso = '2026-10-08T12:00:00.000Z';
    expect(deepEqual(new Date(iso), iso)).toBe(false);
  });

  it('compares a synced collection of dated rows as unchanged', () => {
    const iso = '2026-10-08T12:00:00.000Z';
    const a = [{ id: 'b1', createdAt: new Date(iso), lastStampedAt: new Date(iso) }];
    const b = [{ id: 'b1', createdAt: new Date(iso), lastStampedAt: new Date(iso) }];
    expect(collectionsEqual(a, b)).toBe(true);
  });
});

describe('collectionsEqual', () => {
  it('is true for same records in same order', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
    expect(collectionsEqual(rows, JSON.parse(JSON.stringify(rows)))).toBe(true);
  });

  it('is false when a record changed', () => {
    expect(collectionsEqual([{ id: 'a', n: 1 }], [{ id: 'a', n: 2 }])).toBe(false);
  });

  it('is false when a record was added or removed', () => {
    expect(collectionsEqual([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toBe(false);
    expect(collectionsEqual([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }])).toBe(false);
  });

  it('is true for two empty lists (nothing to write back)', () => {
    expect(collectionsEqual([], [])).toBe(true);
  });
});
