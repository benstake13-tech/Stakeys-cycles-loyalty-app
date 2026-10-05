import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AvatarStudio } from './src/components/AvatarStudio';
import { AvatarModel, buildStandingBitmoji, fitCamera } from './src/components/AvatarModel';
import {
  buildBitmojiRider,
  avatarToLook,
  emptyGeo,
  merge,
  project,
  riderLook,
  v3,
} from './src/components/SeasonalThemeCanvas';
import {
  DEFAULT_AVATAR,
  normalizeAvatar,
  randomAvatar,
  skinHex,
  hairHex,
  topHex,
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
} from './src/shared/types/avatar';

describe('avatar model', () => {
  it('normalizes a corrupt blob back to a valid config', () => {
    const a = normalizeAvatar({ skinTone: 'nonsense', hairStyle: 42, eyes: null });
    expect(a.skinTone).toBe(DEFAULT_AVATAR.skinTone);
    expect(a.hairStyle).toBe(DEFAULT_AVATAR.hairStyle);
    expect(a.eyes).toBe(DEFAULT_AVATAR.eyes);
  });

  it('returns the default when given nothing', () => {
    expect(normalizeAvatar(undefined)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
  });

  it('keeps valid choices and free-form colours', () => {
    const a = normalizeAvatar({ skinTone: 'deep', hairColor: '#123456', jerseyNumber: '9' });
    expect(a.skinTone).toBe('deep');
    expect(a.hairColor).toBe('#123456');
    expect(a.jerseyNumber).toBe('9');
  });

  it('clamps the jersey number to three characters', () => {
    expect(normalizeAvatar({ jerseyNumber: '12345' }).jerseyNumber).toBe('123');
  });

  it('generates valid random avatars', () => {
    for (let i = 0; i < 25; i++) {
      const a = randomAvatar();
      expect(SKIN_TONES.some((s) => s.id === a.skinTone)).toBe(true);
      expect(HAIR_STYLES.some((h) => h.id === a.hairStyle)).toBe(true);
      expect(HAIR_COLORS.some((c) => c.id === a.hairColor)).toBe(true);
      expect(normalizeAvatar(a)).toEqual(a);
    }
  });

  it('resolves named colours to hex and passes raw hex through', () => {
    expect(skinHex('deep')).toMatch(/^#/);
    expect(hairHex('ginger')).toMatch(/^#/);
    expect(topHex('#ABCDEF')).toBe('#ABCDEF');
  });
});

describe('AvatarStudio', () => {
  it('saves the current draft when Save is clicked', () => {
    const onSave = vi.fn();
    render(<AvatarStudio value={DEFAULT_AVATAR} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(normalizeAvatar(onSave.mock.calls[0][0])).toEqual(DEFAULT_AVATAR);
  });

  it('reflects a picked hair style in the saved config', () => {
    const onSave = vi.fn();
    render(<AvatarStudio value={DEFAULT_AVATAR} onSave={onSave} />);
    fireEvent.click(screen.getByText('Mohawk'));
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave.mock.calls[0][0].hairStyle).toBe('mohawk');
  });

  it('resets back to the default config', () => {
    const onSave = vi.fn();
    render(<AvatarStudio value={{ ...DEFAULT_AVATAR, hairStyle: 'afro' }} onSave={onSave} />);
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave.mock.calls[0][0].hairStyle).toBe(DEFAULT_AVATAR.hairStyle);
  });
});

describe('bitmoji 3D models', () => {
  it('builds a rounded rider with geometry and a head above the bike', () => {
    const look = riderLook(1234);
    const g = buildBitmojiRider(look, 1.2);
    expect(g.verts.length).toBeGreaterThan(80);
    expect(g.faces.length).toBeGreaterThan(20);
    const maxY = Math.max(...g.verts.map((v) => v.y));
    expect(maxY).toBeGreaterThan(15); // oversized head sits high on the bike
  });

  it('gives each seed a stable, deterministic look', () => {
    const a = riderLook(42);
    const b = riderLook(42);
    expect(a).toEqual(b);
    expect(riderLook(43).skin).toBeDefined();
  });

  it('honours skin and jersey overrides for a customer config', () => {
    const look = riderLook(7, { skin: '#5A3720', jersey: '#ABCDEF' });
    expect(look.skin).toBe('#5A3720');
    expect(look.jersey).toBe('#ABCDEF');
  });

  it('builds a standing character with a raised waving arm', () => {
    const g = buildStandingBitmoji(riderLook(9), 0);
    expect(g.verts.length).toBeGreaterThan(100);
    const maxY = Math.max(...g.verts.map((v) => v.y));
    expect(maxY).toBeGreaterThan(20); // hand raised well above the head
  });

  it('renders the avatar model to a canvas', () => {
    render(<AvatarModel config={{ ...DEFAULT_AVATAR, skinTone: 'deep' }} size={80} />);
    const canvas = screen.getByTestId('avatar-model');
    expect(canvas.tagName.toLowerCase()).toBe('canvas');
    expect((canvas as HTMLCanvasElement).width).toBe(80);
  });

  it('maps a saved avatar config onto a rider look for the themes', () => {
    const look = avatarToLook({ ...DEFAULT_AVATAR, skinTone: 'deep', topColor: 'red' });
    expect(look.skin).toBe(skinHex('deep'));
    expect(look.jersey).toBe(topHex('red'));
  });

  it('frames the whole standing figure inside the portrait canvas', () => {
    const body = buildStandingBitmoji(riderLook(5), 0);
    const rotated = emptyGeo();
    merge(rotated, body, { pos: v3(0, 0, 0), rotY: Math.PI / 2 });
    const w = 96;
    const h = 110;
    const cam = fitCamera(rotated, w, h);
    for (const v of rotated.verts) {
      const p = project(v, w, h, cam);
      expect(p).not.toBeNull();
      expect(p!.x).toBeGreaterThanOrEqual(-1);
      expect(p!.x).toBeLessThanOrEqual(w + 1);
      expect(p!.y).toBeGreaterThanOrEqual(-1);
      expect(p!.y).toBeLessThanOrEqual(h + 1);
    }
  });
});

