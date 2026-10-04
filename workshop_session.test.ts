import { describe, it, expect, beforeEach } from 'vitest';
import {
  persistWorkshopUser,
  readRestoredWorkshopUser,
  isWorkshopRole,
  RESTORE_USER_KEY,
} from './src/context/ShopContext';
import type { UserProfile } from './src/types/bikeShop';

function user(over: Partial<UserProfile>): UserProfile {
  return {
    uid: 'u1',
    email: 'a@b.com',
    displayName: 'A',
    role: 'customer',
    membershipNumber: 'STK-1',
    stamps: 0,
    tickets: 0,
    points: 0,
    bikes: [],
    createdAt: new Date(),
    lastStampedAt: null,
    ...over,
  } as UserProfile;
}

beforeEach(() => localStorage.clear());

describe('workshop session persistence', () => {
  it('recognises only staff/admin as workshop roles', () => {
    expect(isWorkshopRole('admin')).toBe(true);
    expect(isWorkshopRole('staff')).toBe(true);
    expect(isWorkshopRole('customer')).toBe(false);
    expect(isWorkshopRole(undefined)).toBe(false);
  });

  it('remembers an admin so the device auto-signs-in next time', () => {
    persistWorkshopUser(user({ uid: 'admin-1', role: 'admin' }));
    expect(readRestoredWorkshopUser()?.uid).toBe('admin-1');
  });

  it('does NOT remember a customer session', () => {
    persistWorkshopUser(user({ uid: 'cust-1', role: 'customer' }));
    expect(localStorage.getItem(RESTORE_USER_KEY)).toBeNull();
    expect(readRestoredWorkshopUser()).toBeNull();
  });

  it('clears a stored workshop session on sign-out', () => {
    persistWorkshopUser(user({ uid: 'admin-1', role: 'admin' }));
    persistWorkshopUser(null);
    expect(readRestoredWorkshopUser()).toBeNull();
  });

  it('ignores a corrupt stored session', () => {
    localStorage.setItem(RESTORE_USER_KEY, '{not json');
    expect(readRestoredWorkshopUser()).toBeNull();
  });
});
