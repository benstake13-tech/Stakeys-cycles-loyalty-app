import { describe, it, expect } from 'vitest';
import bridgeSql from './supabase/migrations/20261006_repair_app_bridge.sql?raw';

describe('Repair App Bridge SQL', () => {
  it('links the loyalty profile store to Supabase Auth', () => {
    expect(bridgeSql).toContain('public.bridge_diagnostics()');
    expect(bridgeSql).toContain('public.confirm_pending_logins()');
    expect(bridgeSql).toContain('public.link_member_login(');
    expect(bridgeSql).toContain('public.backfill_member_logins(');
    expect(bridgeSql).toContain('auth.users');
    expect(bridgeSql).toContain('public.profiles');
  });

  it('fixes the exact failure mode: unconfirmed logins + members with no login', () => {
    // Confirms every login left unconfirmed when the confirmation email breaks.
    expect(bridgeSql).toMatch(/email_confirmed_at IS NULL/);
    expect(bridgeSql).toMatch(/SET email_confirmed_at = COALESCE\(email_confirmed_at, now\(\)\)/);
    // Backfills a login for every profile that has none.
    expect(bridgeSql).toMatch(/profiles_without_login/);
    expect(bridgeSql).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM auth\.users/);
  });

  it('keeps the two stores on the same uuid', () => {
    // Reuses the profile's uuid so profiles.id === auth.users.id after repair.
    expect(bridgeSql).toMatch(/v_id := v_profile_id/);
    expect(bridgeSql).toContain('gen_random_uuid()');
    expect(bridgeSql).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('re-asserts the surrounding bridge (trigger, grants, RLS)', () => {
    expect(bridgeSql).toContain('public.handle_new_loyalty_user()');
    expect(bridgeSql).toContain('CREATE TRIGGER on_auth_user_created_loyalty');
    expect(bridgeSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated');
    expect(bridgeSql).toContain('profiles_bridge_all');
  });

  it('is idempotent and never destructive', () => {
    expect(bridgeSql).not.toMatch(/DROP TABLE/i);
    expect(bridgeSql).not.toMatch(/DELETE FROM/i);
    expect(bridgeSql).not.toMatch(/TRUNCATE/i);
    // Re-runnable: CREATE OR REPLACE + guarded policy.
    expect(bridgeSql).toContain('CREATE OR REPLACE FUNCTION');
    expect(bridgeSql).toMatch(/DROP TRIGGER IF EXISTS on_auth_user_created_loyalty/);
  });

  it('does not let a customer anon key mint logins or reset passwords', () => {
    expect(bridgeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.link_member_login\(text, text, text, text\) FROM PUBLIC, anon, authenticated/
    );
    expect(bridgeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.backfill_member_logins\(text\) FROM PUBLIC, anon, authenticated/
    );
    // But the read-only report stays callable by the app.
    expect(bridgeSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.bridge_diagnostics\(\) TO anon, authenticated/);
  });
});
