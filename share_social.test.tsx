import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialBrandIcon, socialBrandSlug } from './src/components/SocialBrandIcon';
import { ShareMenu } from './src/components/ShareMenu';

describe('social brand icons', () => {
  it('maps common platform labels (and aliases) to official brand slugs', () => {
    expect(socialBrandSlug('Instagram')).toBe('instagram');
    expect(socialBrandSlug('FB')).toBe('facebook');
    expect(socialBrandSlug('WhatsApp')).toBe('whatsapp');
    expect(socialBrandSlug('Twitter')).toBe('x');
    expect(socialBrandSlug('Tik Tok')).toBe('tiktok');
    expect(socialBrandSlug('Telegram')).toBe('telegram');
    expect(socialBrandSlug('something custom')).toBeUndefined();
  });

  it('renders a real brand glyph for known platforms', () => {
    const { container } = render(<SocialBrandIcon platform="WhatsApp" className="w-4 h-4" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('path')?.getAttribute('d')).toBeTruthy();
    expect(screen.getByLabelText('WhatsApp logo')).toBeTruthy();
  });

  it('falls back to a neutral glyph for an unknown platform', () => {
    const { container } = render(<SocialBrandIcon platform="MySpace" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByLabelText('MySpace logo')).toBeNull();
  });
});

describe('ShareMenu', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('opens with official share links and a copy action', async () => {
    render(<ShareMenu title="Carrera Vengeance" text="Check this bike" url="https://shop.test/bike/1" isDark />);

    // Menu is closed until asked for.
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Share Carrera Vengeance/i }));

    const whatsapp = screen.getByRole('menuitem', { name: /WhatsApp/i }) as HTMLAnchorElement;
    expect(whatsapp.href).toContain('wa.me');
    expect(decodeURIComponent(whatsapp.href)).toContain('https://shop.test/bike/1');

    const facebook = screen.getByRole('menuitem', { name: /Facebook/i }) as HTMLAnchorElement;
    expect(facebook.href).toContain('facebook.com/sharer');

    const x = screen.getByRole('menuitem', { name: /X$/i }) as HTMLAnchorElement;
    expect(x.href).toContain('twitter.com/intent/tweet');

    const telegram = screen.getByRole('menuitem', { name: /Telegram/i }) as HTMLAnchorElement;
    expect(telegram.href).toContain('t.me/share');

    const email = screen.getByRole('menuitem', { name: /Email/i }) as HTMLAnchorElement;
    expect(email.href).toContain('mailto:');

    fireEvent.click(screen.getByRole('menuitem', { name: /Copy link/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://shop.test/bike/1')
    );
    await waitFor(() => expect(screen.getByText('Link copied')).toBeTruthy());
  });
});
