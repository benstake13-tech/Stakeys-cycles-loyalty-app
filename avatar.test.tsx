import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AvatarStudio } from './src/components/AvatarStudio';
import { AvatarModel } from './src/components/AvatarModel';
import { AvatarSVG } from './src/components/AvatarSVG';
import {
  buildBitmojiRider,
  avatarToLook,
  riderLook,
} from './src/components/SeasonalThemeCanvas';
import {
  DEFAULT_AVATAR,
  normalizeAvatar,
  normalizeAvatarImage,
  MAX_AVATAR_IMAGE_CHARS,
  randomAvatar,
  skinHex,
  hairHex,
  clothingHex,
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
} from './src/shared/types/avatar';
import { buildAvatarPrompt, AVATAR_STYLE_PREAMBLE } from './src/shared/utils/avatarPrompt';
import { AvatarLikenessStudio } from './src/components/AvatarLikenessStudio';

describe('avatar model', () => {
  it('normalizes a corrupt blob back to a valid config', () => {
    const a = normalizeAvatar({ skinTone: 42, hairStyle: 'nonsense', expression: null });
    expect(a.skinTone).toBe(DEFAULT_AVATAR.skinTone);
    expect(a.hairStyle).toBe(DEFAULT_AVATAR.hairStyle);
    expect(a.expression).toBe(DEFAULT_AVATAR.expression);
  });

  it('returns the default when given nothing', () => {
    expect(normalizeAvatar(undefined)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
  });

  it('keeps valid choices and free-form colours', () => {
    const a = normalizeAvatar({ skinTone: '#101010', hairColor: '#123456', clothingStyle: 'jacket' });
    expect(a.skinTone).toBe('#101010');
    expect(a.hairColor).toBe('#123456');
    expect(a.clothingStyle).toBe('jacket');
  });

  it('generates valid random avatars', () => {
    for (let i = 0; i < 25; i++) {
      const a = randomAvatar();
      expect(SKIN_TONES.some((s) => s.hex === a.skinTone)).toBe(true);
      expect(HAIR_STYLES.some((h) => h.id === a.hairStyle)).toBe(true);
      expect(HAIR_COLORS.some((c) => c.hex === a.hairColor)).toBe(true);
      expect(normalizeAvatar(a)).toEqual(a);
    }
  });

  it('resolves named catalogue ids to hex and passes raw hex through', () => {
    expect(skinHex(SKIN_TONES[3].id)).toBe(SKIN_TONES[3].hex);
    expect(hairHex(HAIR_COLORS[1].id)).toBe(HAIR_COLORS[1].hex);
    expect(clothingHex('#ABCDEF')).toBe('#ABCDEF');
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
    fireEvent.click(screen.getByText('Taper Fade'));
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave.mock.calls[0][0].hairStyle).toBe('fadeCut');
  });

  it('switches tabs and reflects an apparel choice', () => {
    const onSave = vi.fn();
    render(<AvatarStudio value={DEFAULT_AVATAR} onSave={onSave} />);
    fireEvent.click(screen.getByText('Apparel'));
    fireEvent.click(screen.getByText('All-Weather Riding Jacket'));
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave.mock.calls[0][0].clothingStyle).toBe('jacket');
  });

  it('resets back to the default config', () => {
    const onSave = vi.fn();
    render(<AvatarStudio value={{ ...DEFAULT_AVATAR, hairStyle: 'quiff' }} onSave={onSave} />);
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByText('Save avatar'));
    expect(onSave.mock.calls[0][0].hairStyle).toBe(DEFAULT_AVATAR.hairStyle);
  });
});

describe('Stakeys SVG avatar', () => {
  it('renders an SVG honouring the chosen colours', () => {
    const { container } = render(
      <AvatarSVG config={{ ...DEFAULT_AVATAR, hairColor: '#10B981', propBike: 'none' }} />
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 500 600');
    expect(container.innerHTML).toContain('#10B981');
  });

  it('renders each bike prop', () => {
    for (const propBike of ['roadBike', 'mountainBike', 'eScooter'] as const) {
      const { container } = render(<AvatarSVG config={{ ...DEFAULT_AVATAR, propBike }} />);
      expect(container.querySelector('svg')).not.toBeNull();
    }
  });

  it('renders the avatar model wrapper around the SVG', () => {
    render(<AvatarModel config={{ ...DEFAULT_AVATAR, skinTone: SKIN_TONES[5].hex }} size={80} />);
    const el = screen.getByTestId('avatar-model');
    expect(el.querySelector('svg')).not.toBeNull();
  });
});

describe('bitmoji 3D riders (themes)', () => {
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

  it('maps a saved avatar config onto a rider look for the themes', () => {
    const look = avatarToLook({
      ...DEFAULT_AVATAR,
      skinTone: SKIN_TONES[4].hex,
      clothingColor: '#DC2626',
    });
    expect(look.skin).toBe(SKIN_TONES[4].hex);
    expect(look.jersey).toBe('#DC2626');
  });
});

describe('avatar image (HD likeness portrait)', () => {
  it('accepts a well-formed data URL and drops junk', () => {
    const ok = normalizeAvatarImage({
      dataUrl: 'data:image/png;base64,AAAA',
      prompt: 'p',
      model: 'm',
      createdAt: '2026-10-04T00:00:00.000Z',
    });
    expect(ok?.dataUrl).toBe('data:image/png;base64,AAAA');
    expect(ok?.model).toBe('m');

    expect(normalizeAvatarImage(null)).toBeUndefined();
    expect(normalizeAvatarImage({ dataUrl: 'https://example.com/x.png' })).toBeUndefined();
    expect(normalizeAvatarImage({ dataUrl: 123 })).toBeUndefined();
  });

  it('rejects payloads over the size cap', () => {
    const huge = `data:image/png;base64,${'A'.repeat(MAX_AVATAR_IMAGE_CHARS)}`;
    expect(normalizeAvatarImage({ dataUrl: huge })).toBeUndefined();
  });
});

describe('avatar prompt', () => {
  it('includes the house style preamble and framing clause', () => {
    const prompt = buildAvatarPrompt({ config: DEFAULT_AVATAR });
    expect(prompt).toContain(AVATAR_STYLE_PREAMBLE);
    expect(prompt).toContain('Centered bust-up portrait');
  });

  it('reflects the chosen hair, skin and clothing colours', () => {
    const prompt = buildAvatarPrompt({
      config: {
        ...DEFAULT_AVATAR,
        hairStyle: 'quiff',
        skinTone: SKIN_TONES[5].hex,
        clothingColor: '#2563EB',
      },
    });
    expect(prompt).toContain('quiff');
    expect(prompt).toContain(SKIN_TONES[5].hex);
    expect(prompt).toContain('#2563EB');
  });

  it('includes the customer brief when provided and omits it otherwise', () => {
    const withBrief = buildAvatarPrompt({ config: DEFAULT_AVATAR, brief: 'female, late 20s' });
    expect(withBrief).toContain('female, late 20s');
    const without = buildAvatarPrompt({ config: DEFAULT_AVATAR, brief: '   ' });
    expect(without).not.toContain('Customer brief');
  });

  it('mentions the bike prop only when one is selected', () => {
    const withBike = buildAvatarPrompt({ config: { ...DEFAULT_AVATAR, propBike: 'roadBike' } });
    expect(withBike).toContain('road bike');
    const without = buildAvatarPrompt({ config: { ...DEFAULT_AVATAR, propBike: 'none' } });
    expect(without).not.toContain('Props:');
  });
});

describe('avatar likeness studio', () => {
  it('shows a saved portrait and offers to remove it', () => {
    const onSave = vi.fn();
    render(
      <AvatarLikenessStudio
        config={DEFAULT_AVATAR}
        image={{
          dataUrl: 'data:image/png;base64,AAAA',
          prompt: 'p',
          model: 'm',
          createdAt: '2026-10-04T00:00:00.000Z',
        }}
        onSave={onSave}
      />
    );
    expect(screen.getByAltText('Generated avatar portrait')).toBeTruthy();
    fireEvent.click(screen.getByText('Remove'));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('renders the vector fallback when no portrait exists', () => {
    render(<AvatarLikenessStudio config={DEFAULT_AVATAR} image={null} onSave={vi.fn()} />);
    expect(screen.queryByAltText('Generated avatar portrait')).toBeNull();
    expect(screen.getByTestId('avatar-model')).toBeTruthy();
  });
});

