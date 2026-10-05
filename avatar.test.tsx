import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Avatar } from './src/components/Avatar';
import { AvatarStudio } from './src/components/AvatarStudio';
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

describe('Avatar', () => {
  it('renders an SVG using the configured skin and jersey colours', () => {
    render(<Avatar config={{ ...DEFAULT_AVATAR, skinTone: 'deep', topColor: 'red' }} size={80} />);
    const svg = screen.getByTestId('rider-avatar');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const html = svg.outerHTML;
    expect(html).toContain(skinHex('deep'));
    expect(html).toContain(topHex('red'));
  });

  it('renders the jersey number when set', () => {
    render(<Avatar config={{ ...DEFAULT_AVATAR, jerseyNumber: '07' }} />);
    expect(screen.getByText('07')).toBeTruthy();
  });

  it('falls back to the default avatar when config is missing', () => {
    render(<Avatar config={null} />);
    expect(screen.getByTestId('rider-avatar')).toBeTruthy();
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
