import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  refreshCustomerGarageForStaff: vi.fn(async () => ({ found: 0, removed: 0, reassigned: 0 })),
  users: [] as any[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: {
      uid: 'staff-1', role: 'staff', displayName: 'Ben', email: 'b@x.co',
      membershipNumber: 'STK-000001', stamps: 0, tickets: 0, createdAt: '',
    },
    users: hoisted.users,
    bookings: [],
    stampLogs: [],
    addStamp: vi.fn(),
    redeemReward: vi.fn(),
    updateCustomerPoints: vi.fn(),
    addCustomerBikeForUser: vi.fn(),
    refreshCustomerGarageForStaff: hoisted.refreshCustomerGarageForStaff,
    updateBookingStatus: vi.fn(),
  }),
}));

vi.mock('./src/api/firebaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./src/api/firebaseService')>()),
  canCustomerReceiveStampToday: () => ({ allowed: true, reason: '' }),
}));

import { CustomerAccountDossier } from './src/components/CustomerAccountDossier';

const chloe = {
  uid: 'chloe-1', role: 'customer', displayName: 'Chloe Lawrence', email: 'chloe@x.co',
  membershipNumber: 'STK-5341', stamps: 3, tickets: 0, createdAt: '', bikes: [],
};

beforeEach(() => {
  hoisted.refreshCustomerGarageForStaff.mockClear();
  hoisted.users = [chloe];
});

describe('customer dossier garage auto-load', () => {
  it("pulls this customer's garage from the database when the dossier opens", async () => {
    // The roster only ever loaded bikes for the signed-in account, so opening
    // another customer's dossier showed an empty garage despite rows existing.
    render(<CustomerAccountDossier customer={chloe as any} onBack={vi.fn()} onScanAnother={vi.fn()} />);
    await waitFor(() =>
      expect(hoisted.refreshCustomerGarageForStaff).toHaveBeenCalledWith('chloe-1', { deleteStale: false })
    );
  });

  it('loads the garage only once per customer', async () => {
    render(<CustomerAccountDossier customer={chloe as any} onBack={vi.fn()} onScanAnother={vi.fn()} />);
    await waitFor(() => expect(hoisted.refreshCustomerGarageForStaff).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(hoisted.refreshCustomerGarageForStaff).toHaveBeenCalledTimes(1);
  });
});
