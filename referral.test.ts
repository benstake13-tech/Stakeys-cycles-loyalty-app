import { describe, it, expect } from 'vitest';
import {
  REFERRER_REWARD,
  FRIEND_REWARD,
  isFullService,
  normaliseReferralCode,
  formatReferralCode,
  buildReferralCode,
  buildReferralLink,
  referralCodeFromSearch,
  findReferralByCode,
  findReferralByOwner,
  friendRewardEligible,
  applyReferralReward,
  describeFriendReward,
  describeReferrerReward,
} from './src/utils/referral';
import type { ReferralRecord } from './src/types/bikeShop';

const record = (over: Partial<ReferralRecord> = {}): ReferralRecord => ({
  id: 'ref-1',
  ownerUid: 'owner-1',
  ownerName: 'Ada Rider',
  code: 'STK-REF-123456',
  link: 'https://stakeyswheels.co.uk/?ref=STK-REF-123456',
  timesShared: 0,
  rewardsEarned: 0,
  rewards: [],
  referredFriends: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('refer a friend rewards', () => {
  it('pays the referrer £5 and gives the friend £15 off', () => {
    expect(REFERRER_REWARD).toBe(5);
    expect(FRIEND_REWARD).toBe(15);
    expect(describeReferrerReward()).toBe('£5 credit');
    expect(describeFriendReward()).toBe('£15 off a full service');
  });
});

describe('referral codes', () => {
  it('normalises case and separators so a code matches however it is typed', () => {
    expect(normaliseReferralCode(' stk-ref-123456 ')).toBe('STKREF123456');
    expect(normaliseReferralCode('Stk Ref 123456')).toBe('STKREF123456');
  });

  it('builds a readable code from a membership number', () => {
    expect(buildReferralCode('STK-839201')).toBe('STK-REF-839201');
  });

  it('builds a shareable link pointing at the public site with the code', () => {
    expect(buildReferralLink('STK-REF-123456', 'https://stakeyswheels.co.uk/')).toBe(
      'https://stakeyswheels.co.uk/?ref=STK-REF-123456'
    );
  });

  it('reads a code out of a ?ref= query string', () => {
    expect(referralCodeFromSearch('?ref=stk-ref-999999')).toBe('STK-REF-999999');
    expect(referralCodeFromSearch('?utm=x&ref=abc123')).toBe('ABC123');
    expect(referralCodeFromSearch('')).toBe('');
  });

  it('tidies a code for display without changing its meaning', () => {
    expect(formatReferralCode(' stk ref 123456 ')).toBe('STKREF123456');
  });

  it('finds a record by code regardless of formatting, and by owner', () => {
    const list = [record()];
    expect(findReferralByCode('stk ref 123456', list)?.id).toBe('ref-1');
    expect(findReferralByCode('NOPE', list)).toBeNull();
    expect(findReferralByOwner('owner-1', list)?.id).toBe('ref-1');
    expect(findReferralByOwner('someone-else', list)).toBeNull();
  });
});

describe('what counts as a full service', () => {
  it('recognises the full-service ids and headlines', () => {
    expect(isFullService('cycle-overhaul')).toBe(true);
    expect(isFullService(undefined, 'Full Pro Overhaul')).toBe(true);
    expect(isFullService(undefined, 'Full Service')).toBe(true);
  });

  it('does not treat a single-symptom repair as a full service', () => {
    expect(isFullService('cycle-tune', 'Brakes: Replace pads')).toBe(false);
    expect(isFullService('cycle-puncture', 'Wheels: Flat / Puncture')).toBe(false);
  });
});

describe('friend reward eligibility', () => {
  const base = {
    serviceId: 'cycle-overhaul',
    serviceTitle: 'Full Pro Overhaul',
    customerId: 'friend-1',
    referralCode: 'STK-REF-123456',
  };

  it('allows a new customer booking a full service with a code', () => {
    expect(friendRewardEligible({ booking: base, ownerUid: 'owner-1' }).ok).toBe(true);
  });

  it('refuses the referrer using their own code', () => {
    const res = friendRewardEligible({
      booking: { ...base, customerId: 'owner-1' },
      ownerUid: 'owner-1',
    });
    expect(res.ok).toBe(false);
  });

  it('refuses a booking that is not a full service', () => {
    const res = friendRewardEligible({
      booking: { ...base, serviceId: 'cycle-tune', serviceTitle: 'Brakes repair' },
      ownerUid: 'owner-1',
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/full service/i);
  });

  it('refuses when there is no code or the reward is already used', () => {
    expect(friendRewardEligible({ booking: { ...base, referralCode: undefined } }).ok).toBe(false);
    expect(
      friendRewardEligible({
        booking: base,
        ownerUid: 'owner-1',
        friendReward: { status: 'redeemed' },
      }).ok
    ).toBe(false);
  });
});

describe('granting the £5 referrer reward', () => {
  const booking = {
    id: 'bk-900',
    customerId: 'friend-1',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    serviceId: 'cycle-overhaul',
    serviceTitle: 'Full Pro Overhaul',
  };
  const now = '2026-10-06T12:00:00.000Z';

  it('marks the friend reward redeemed and appends the referrer credit', () => {
    const applied = applyReferralReward(record(), booking, now);
    expect(applied).not.toBeNull();
    const { record: updated, reward } = applied!;
    expect(reward).toMatchObject({ id: 'refrw-bk-900', amount: 5, status: 'earned', friendName: 'Sam Carter' });
    expect(updated.rewards).toHaveLength(1);
    expect(updated.rewardsEarned).toBe(1);
    const friend = updated.referredFriends.find((f) => f.friendUid === 'friend-1')!;
    expect(friend.rewardGranted).toBe(true);
    expect(friend.bookingApproved).toBe(true);
    expect(friend.bookingId).toBe('bk-900');
    expect(friend.friendReward).toMatchObject({ discount: 15, status: 'redeemed' });
  });

  it('is idempotent — approving the same booking twice never double-pays', () => {
    const first = applyReferralReward(record(), booking, now)!;
    expect(applyReferralReward(first.record, booking, now)).toBeNull();
    expect(first.record.rewards).toHaveLength(1);
  });

  it('updates the friend entry that signed up earlier rather than duplicating it', () => {
    const withFriend = record({
      referredFriends: [
        {
          friendUid: 'friend-1',
          friendName: 'Sam Carter',
          friendEmail: 'sam@example.com',
          joinedAt: '2026-09-01T00:00:00.000Z',
          bookingApproved: false,
          rewardGranted: false,
        },
      ],
    });
    const applied = applyReferralReward(withFriend, booking, now)!;
    expect(applied.record.referredFriends).toHaveLength(1);
    expect(applied.record.referredFriends[0].rewardGranted).toBe(true);
  });
});
