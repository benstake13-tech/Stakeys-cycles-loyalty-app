import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectedColumns, generateRepairSqlForTables } from './src/utils/schemaSync';
import { parseConfigString, getDeterministicConfig, FaceAvatarConfig } from './src/components/FaceAvatar';

describe('profiles avatar persistence', () => {
  it('declares avatar_color on profiles so the write is never silently dropped', () => {
    // The avatar editor writes profiles.avatar_color via updateUserProfileInDb.
    // If the column is missing from EXPECTED_SCHEMA, "Create fix SQL" emits
    // nothing and the save fails — so this is the regression guard.
    expect(expectedColumns('profiles')).toContain('avatar_color');
  });

  it('emits an idempotent avatar_color repair for profiles', () => {
    const sql = generateRepairSqlForTables(['profiles']);
    expect(sql).toContain('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT;');
  });

  it('ships avatar_color in complete_setup.sql for fresh installs', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'complete_setup.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.profiles \([\s\S]*?avatar_color TEXT/);
    expect(sql).toContain('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT;');
  });
});

describe('avatar config parsing', () => {
  it('merges a partial saved config over the deterministic default', () => {
    const parsed = parseConfigString(JSON.stringify({ hairStyle: 'afro' }), 'Preview Rider');
    const fallback = getDeterministicConfig('Preview Rider');
    expect(parsed.hairStyle).toBe('afro');
    // Every other field is filled in rather than left undefined.
    (Object.keys(fallback) as (keyof FaceAvatarConfig)[]).forEach((key) => {
      expect(parsed[key]).toBeDefined();
    });
  });

  it('keeps a full config exactly as saved', () => {
    const full = getDeterministicConfig('Aisha');
    expect(parseConfigString(JSON.stringify(full), 'Someone Else')).toEqual(full);
  });

  it('falls back to a deterministic look for a legacy hex colour', () => {
    const parsed = parseConfigString('#05C147', 'Legacy Rider');
    expect(parsed.backdrop).toBe('emerald');
    expect(parsed.hairStyle).toBeDefined();
  });
});

describe('avatar roster mapping', () => {
  // The avatar editor writes profiles.avatar_color, but if the roster mapper
  // (fetchAllProfilesFromDbDetailed) drops the column, the save looks lost after
  // the next profiles re-fetch resets `users`. This guard pins the mapping.
  it('maps avatar_color when copying every profile row', async () => {
    vi.resetModules();
    const rows = [
      { id: 'u1', email: 'a@x.co', display_name: 'A', avatar_color: '#05C147', stamps: 0, completed_cards: 0, merit_points: 0 },
    ];
    vi.doMock('./src/lib/supabase', () => ({
      getSupabaseClient: () => ({
        from: () => {
          const chain: any = {
            select: () => Promise.resolve({ data: rows, error: null }),
          };
          return chain;
        },
      }),
    }));
    const { fetchAllProfilesFromDbDetailed } = await import('./src/api/backendDataService');
    const { profiles } = await fetchAllProfilesFromDbDetailed();
    expect(profiles[0].avatarColor).toBe('#05C147');
    vi.doUnmock('./src/lib/supabase');
  });
});
