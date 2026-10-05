import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture RPC calls so we can assert the payloads the staff-login helpers send.
const hoisted = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: any }[],
  rpcResults: [] as any[],
}));

vi.mock('./src/shared/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: (fn: string, args: any) => {
      hoisted.rpcCalls.push({ fn, args });
      return Promise.resolve(hoisted.rpcResults.shift() ?? { data: null, error: null });
    },
  }),
}));

import {
  fetchStaffAccountsFromDb,
  createStaffAccountViaRpc,
  setStaffRoleViaRpc,
  staffAccountsInstalled,
} from './src/shared/api/backendDataService';

beforeEach(() => {
  hoisted.rpcCalls = [];
  hoisted.rpcResults = [];
});

describe('createStaffAccountViaRpc', () => {
  it('calls the admin-gated RPC with normalised email and the chosen role', async () => {
    hoisted.rpcResults.push({ data: 'new-user-id', error: null });
    const res = await createStaffAccountViaRpc('  Sam@Shop.CO.UK ', 'secret123', ' Sam ', 'staff');

    expect(res).toEqual({ success: true, id: 'new-user-id' });
    expect(hoisted.rpcCalls).toHaveLength(1);
    expect(hoisted.rpcCalls[0].fn).toBe('create_staff_account');
    expect(hoisted.rpcCalls[0].args).toMatchObject({
      p_email: 'sam@shop.co.uk',
      p_password: 'secret123',
      p_display_name: 'Sam',
      p_role: 'staff',
    });
  });

  it('returns the server error message when the account already exists', async () => {
    hoisted.rpcResults.push({ data: null, error: { message: 'An account with this email already exists' } });
    const res = await createStaffAccountViaRpc('sam@shop.co.uk', 'secret123', 'Sam', 'staff');
    expect(res.success).toBe(false);
    expect(res.message).toContain('already exists');
  });
});

describe('setStaffRoleViaRpc', () => {
  it('passes the user id and role through to the RPC', async () => {
    hoisted.rpcResults.push({ data: true, error: null });
    const res = await setStaffRoleViaRpc('uid-1', 'admin');
    expect(res.success).toBe(true);
    expect(hoisted.rpcCalls[0]).toEqual({
      fn: 'set_staff_role',
      args: { p_user_id: 'uid-1', p_role: 'admin' },
    });
  });

  it('surfaces the last-admin guard error', async () => {
    hoisted.rpcResults.push({ data: null, error: { message: 'Cannot remove the last admin' } });
    const res = await setStaffRoleViaRpc('uid-1', 'customer');
    expect(res.success).toBe(false);
    expect(res.message).toContain('last admin');
  });
});

describe('fetchStaffAccountsFromDb', () => {
  it('maps snake_case RPC rows to the app shape', async () => {
    hoisted.rpcResults.push({
      data: [
        { id: 'a', email: 'admin@shop.co.uk', display_name: 'Boss', role: 'admin', created_at: '2026-01-01' },
        { id: 'b', email: 'sam@shop.co.uk', display_name: '', role: 'staff', created_at: '2026-01-02' },
      ],
      error: null,
    });
    const accounts = await fetchStaffAccountsFromDb();
    expect(hoisted.rpcCalls[0].fn).toBe('list_staff_accounts');
    expect(accounts).toEqual([
      { id: 'a', email: 'admin@shop.co.uk', displayName: 'Boss', role: 'admin', createdAt: '2026-01-01' },
      { id: 'b', email: 'sam@shop.co.uk', displayName: '', role: 'staff', createdAt: '2026-01-02' },
    ]);
  });

  it('returns an empty list when the RPC is not installed yet', async () => {
    hoisted.rpcResults.push({ data: null, error: { message: 'function does not exist' } });
    expect(await fetchStaffAccountsFromDb()).toEqual([]);
  });
});

describe('staffAccountsInstalled', () => {
  it('is true when list_staff_accounts responds without error', async () => {
    hoisted.rpcResults.push({ data: [], error: null });
    expect(await staffAccountsInstalled()).toBe(true);
  });

  it('is false when the function is missing', async () => {
    hoisted.rpcResults.push({ data: null, error: { message: 'Could not find the function public.list_staff_accounts in the schema cache' } });
    expect(await staffAccountsInstalled()).toBe(false);
  });

  it('is true for a non-missing-function error (e.g. permission denied)', async () => {
    hoisted.rpcResults.push({ data: null, error: { message: 'permission denied for function list_staff_accounts' } });
    expect(await staffAccountsInstalled()).toBe(true);
  });
});
