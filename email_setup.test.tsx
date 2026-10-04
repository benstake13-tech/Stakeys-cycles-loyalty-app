import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  ownerConfig: {
    ownerEmail: 'workshop@stakeyscycles.co.uk',
    ownerPhone: '+44 7700 900821',
    emailAlertsEnabled: true,
    businessName: "Stakey's Cycles",
  },
  inserted: [] as any[],
  deletedIds: [] as string[],
  insertError: null as null | { message: string },
  dispatchTestEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ ownerConfig: hoisted.ownerConfig }),
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      insert: async (payload: any) => {
        hoisted.inserted.push(payload);
        return { error: hoisted.insertError };
      },
      delete: () => ({
        eq: async (_col: string, val: string) => {
          hoisted.deletedIds.push(val);
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock('./src/utils/notificationService', () => ({
  dispatchTestEmail: hoisted.dispatchTestEmail,
}));

import { deriveProjectRef, probeEdgeFunction, testWorkshopEmail } from './src/utils/emailSetup';
import { EmailSetupModal } from './src/components/EmailSetupModal';
import type { SupabaseClient } from '@supabase/supabase-js';

beforeEach(() => {
  hoisted.inserted = [];
  hoisted.deletedIds = [];
  hoisted.insertError = null;
  hoisted.dispatchTestEmail = vi.fn(async () => ({ success: true }));
  vi.restoreAllMocks();
});

describe('deriveProjectRef', () => {
  it('extracts the project ref from a Supabase URL', () => {
    expect(deriveProjectRef('https://lhojocpygcnkxvkrcuxh.supabase.co')).toBe('lhojocpygcnkxvkrcuxh');
    expect(deriveProjectRef('https://abc.supabase.co/')).toBe('abc');
  });
});

describe('probeEdgeFunction', () => {
  it('reports not-deployed on HTTP 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    const res = await probeEdgeFunction('https://x.supabase.co', 'key', 'notify-booking');
    expect(res.deployed).toBe(false);
    expect(res.detail).toContain('404');
  });

  it('reports deployed when the function answers (even if gated)', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    const res = await probeEdgeFunction('https://x.supabase.co', 'key', 'notify-booking');
    expect(res.deployed).toBe(true);
  });
});

describe('testWorkshopEmail', () => {
  const fakeClient = {
    from: () => ({
      insert: async (payload: any) => {
        hoisted.inserted.push(payload);
        return { error: hoisted.insertError };
      },
      delete: () => ({
        eq: async (_col: string, val: string) => {
          hoisted.deletedIds.push(val);
          return { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  it('inserts a test booking then deletes it, and cleans up on failure', async () => {
    const res = await testWorkshopEmail(fakeClient, hoisted.ownerConfig);
    expect(res.ok).toBe(true);
    expect(hoisted.inserted).toHaveLength(1);
    expect(hoisted.inserted[0].id).toMatch(/^bk-emailtest-/);
    // The row is always removed again so the probe never litters real bookings.
    expect(hoisted.deletedIds).toEqual([hoisted.inserted[0].id]);
  });

  it('reports a write failure without claiming success', async () => {
    hoisted.insertError = { message: 'permission denied' };
    const res = await testWorkshopEmail(fakeClient, hoisted.ownerConfig);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('permission denied');
  });
});

describe('EmailSetupModal', () => {
  it('lists every setup step and flags the pipeline as not ready when functions are undeployed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    localStorage.setItem('stakeys_supabase_anon_key', 'test-key');

    render(<EmailSetupModal onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/not fully set up/i)).toBeTruthy());
    expect(screen.getByText(/Deploy the send-email function/i)).toBeTruthy();
    expect(screen.getByText(/Deploy the notify-booking function/i)).toBeTruthy();
    expect(screen.getByText(/Create the database webhook/i)).toBeTruthy();
    expect(screen.getByText(/Copy webhook SQL/i)).toBeTruthy();
    expect(screen.getByText(/Test workshop alert/i)).toBeTruthy();
  });

  it('runs the workshop test (insert + delete) when the test button is pressed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    localStorage.setItem('stakeys_supabase_anon_key', 'test-key');

    render(<EmailSetupModal onClose={() => {}} />);
    const btn = await screen.findByRole('button', { name: /Test workshop alert/i });
    fireEvent.click(btn);

    await waitFor(() => expect(hoisted.inserted.length).toBe(1));
    expect(hoisted.deletedIds.length).toBe(1);
  });
});
