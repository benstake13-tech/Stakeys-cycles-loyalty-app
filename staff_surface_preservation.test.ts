import { describe, it, expect } from 'vitest';
import { profileMatchesUser } from './src/utils/stateEquality';

// Regression guard for the "staff/admin login drops you into the customer view"
// bug: the background sync matched the signed-in user to a roster profile with
// `u.uid === me.uid || u.membershipNumber === me.membershipNumber`. Staff/admin
// profiles carry no membership number, so that compared `undefined ===
// undefined` and matched an unrelated empty-membership profile — merging the
// wrong account over the session and flattening role -> 'customer'.
describe('profileMatchesUser', () => {
  it('matches by uid', () => {
    expect(profileMatchesUser({ uid: 'staff-1' }, { uid: 'staff-1' })).toBe(true);
  });

  it('does NOT match two profiles that both lack a membership number', () => {
    const staff = { uid: 'staff-1', membershipNumber: undefined };
    const other = { uid: 'cust-9', membershipNumber: undefined };
    expect(profileMatchesUser(staff, other)).toBe(false);
  });

  it('does NOT match when membership numbers are empty strings', () => {
    expect(profileMatchesUser({ uid: 'a', membershipNumber: '' }, { uid: 'b', membershipNumber: '' })).toBe(false);
  });

  it('matches by a real, shared membership number (legacy key)', () => {
    expect(
      profileMatchesUser({ uid: 'uuid-x', membershipNumber: 'STK-123456' }, { uid: 'uuid-x-legacy', membershipNumber: 'stk-123456' })
    ).toBe(true);
  });

  it('does NOT match when only one side carries the membership number', () => {
    expect(profileMatchesUser({ uid: 'a', membershipNumber: 'STK-1' }, { uid: 'b', membershipNumber: undefined })).toBe(false);
  });

  it('never matches a null/undefined candidate', () => {
    expect(profileMatchesUser({ uid: 'a' }, null as any)).toBe(false);
  });
});
