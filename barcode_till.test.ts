import { describe, it, expect } from 'vitest';
import {
  encodeMembership,
  normalizeScannedCode,
  resolveCustomer,
} from './src/utils/membershipCode';
import type { UserProfile } from './src/types/bikeShop';

function customer(over: Partial<UserProfile>): UserProfile {
  return {
    uid: 'uid-1',
    email: 'a@b.com',
    displayName: 'Alice',
    role: 'customer',
    membershipNumber: 'STK-100001',
    stamps: 0,
    tickets: 0,
    points: 0,
    ...over,
  } as UserProfile;
}

describe('barcode / QR membership codes', () => {
  it('encodes a membership token into a scannable payload', () => {
    expect(encodeMembership('STK-100001')).toContain('STK-100001');
    expect(encodeMembership('stk-100001')).toContain('STK-100001');
  });

  it('normalises bare tokens, encoded payloads and URLs to the same code', () => {
    const expected = 'STK-100002';
    expect(normalizeScannedCode('STK-100002')).toBe(expected);
    expect(normalizeScannedCode('stk 100002')).toBe(expected);
    expect(normalizeScannedCode(encodeMembership('STK-100002'))).toBe(expected);
    expect(normalizeScannedCode('https://shop.example.com/member/STK-100002')).toBe(expected);
  });

  it('resolves a scanned barcode to exactly the right account', () => {
    const roster = [
      customer({ uid: 'uid-alice', displayName: 'Alice', membershipNumber: 'STK-100001' }),
      customer({ uid: 'uid-bob', displayName: 'Bob', membershipNumber: 'STK-100002' }),
    ];

    const match = resolveCustomer(encodeMembership('STK-100002'), roster);
    expect(match.status).toBe('match');
    if (match.status === 'match') {
      expect(match.customer.uid).toBe('uid-bob');
      expect(match.customer.displayName).toBe('Bob');
    }
  });

  it('reports no match for an unknown barcode', () => {
    const roster = [customer({ membershipNumber: 'STK-100001' })];
    expect(resolveCustomer('STK-999999', roster).status).toBe('none');
  });

  it('flags ambiguous codes so the till does not credit the wrong account', () => {
    const roster = [
      customer({ uid: 'uid-1', email: 'alice@shop.com', displayName: 'Alice', membershipNumber: 'STK-200001' }),
      customer({ uid: 'uid-2', email: 'alicia@shop.com', displayName: 'Alicia', membershipNumber: 'STK-200002' }),
    ];
    // "ali" appears in both display names -> must not silently pick one.
    expect(resolveCustomer('ali', roster).status).toBe('multiple');
  });
});
