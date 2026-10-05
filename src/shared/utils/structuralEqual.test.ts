import { describe, it, expect } from 'vitest';
import { structurallyEqual, keepIfEqual } from './structuralEqual';

describe('structurallyEqual', () => {
  it('compares primitives', () => {
    expect(structurallyEqual(1, 1)).toBe(true);
    expect(structurallyEqual(1, 2)).toBe(false);
    expect(structurallyEqual('a', 'a')).toBe(true);
    expect(structurallyEqual(null, null)).toBe(true);
    expect(structurallyEqual(null, undefined)).toBe(false);
    expect(structurallyEqual(undefined, undefined)).toBe(true);
  });

  it('compares arrays by value, not identity', () => {
    const a = [{ id: 'x', stamps: 1 }, { id: 'y', stamps: 2 }];
    const b = [{ id: 'x', stamps: 1 }, { id: 'y', stamps: 2 }];
    expect(structurallyEqual(a, b)).toBe(true);
    b[1].stamps = 3;
    expect(structurallyEqual(a, b)).toBe(false);
    expect(structurallyEqual(a, [{ id: 'x', stamps: 1 }])).toBe(false);
  });

  it('compares plain objects by value', () => {
    expect(structurallyEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(structurallyEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('compares Date fields by time, not by (empty) key set', () => {
    const a = { at: new Date('2026-10-04T10:00:00Z') };
    const b = { at: new Date('2026-10-04T10:00:00Z') };
    const c = { at: new Date('2026-10-04T11:00:00Z') };
    expect(structurallyEqual(a, b)).toBe(true);
    expect(structurallyEqual(a, c)).toBe(false);
  });
});

describe('keepIfEqual', () => {
  it('returns the previous reference when values match (no re-render)', () => {
    const prev = [{ id: 'x', stamps: 1 }];
    const next = [{ id: 'x', stamps: 1 }];
    expect(keepIfEqual(prev, next)).toBe(prev);
  });

  it('returns the new reference when values differ', () => {
    const prev = [{ id: 'x', stamps: 1 }];
    const next = [{ id: 'x', stamps: 5 }];
    expect(keepIfEqual(prev, next)).toBe(next);
  });
});
