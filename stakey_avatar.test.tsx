import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StakeyAvatar } from './src/components/StakeyAvatar';
import { StakeyHelper } from './src/components/StakeyHelper';
import {
  DEFAULT_STAKEY_AVATAR,
  normalizeStakeyAvatarConfig,
} from './src/shared/data/stakeyAvatar';
import { answerStakeyLocally, STAKEY_DESTINATIONS } from './src/shared/utils/stakeyAssistant';

// jsdom has no speech engine; report unsupported so the helper runs silent.
vi.mock('./src/shared/utils/stakeyVoice', () => ({
  isSpeechSupported: () => false,
  primeVoices: vi.fn(),
  speak: vi.fn(async () => {}),
  stopSpeaking: vi.fn(),
}));

// Force the local (no-API-key) answer path so tests never hit the network.
vi.mock('./src/shared/utils/stakeyAssistant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./src/shared/utils/stakeyAssistant')>();
  return {
    ...actual,
    askStakey: vi.fn(async (input: { question: string }) => actual.answerStakeyLocally(input.question)),
  };
});

describe('normalizeStakeyAvatarConfig', () => {
  it('returns the defaults for junk input', () => {
    expect(normalizeStakeyAvatarConfig(null)).toEqual(DEFAULT_STAKEY_AVATAR);
    expect(normalizeStakeyAvatarConfig('nope')).toEqual(DEFAULT_STAKEY_AVATAR);
  });

  it('keeps valid fields and drops unknown option values', () => {
    const cfg = normalizeStakeyAvatarConfig({
      name: 'Bolt',
      voiceStyle: 'nonsense', // invalid -> falls back to default
      voiceEnabled: true,
      species: 'robot', // legacy field from the old builder -> ignored
    });
    expect(cfg.name).toBe('Bolt');
    expect(cfg.voiceStyle).toBe(DEFAULT_STAKEY_AVATAR.voiceStyle);
    expect(cfg.voiceEnabled).toBe(true);
  });

  it('trims and caps the name and persona length', () => {
    const cfg = normalizeStakeyAvatarConfig({ name: '  Spike  ', persona: 'x'.repeat(5000) });
    expect(cfg.name).toBe('Spike');
    expect(cfg.persona.length).toBe(2000);
  });
});

describe('StakeyAvatar', () => {
  it('renders the image avatar and applies the talking animation', () => {
    const { container } = render(<StakeyAvatar config={{ ...DEFAULT_STAKEY_AVATAR, name: 'Stakey' }} talking />);
    const img = screen.getByRole('img', { name: /Stakey/ }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/brand/stakeys-avatar.svg');
    // The talking class drives the CSS pulse animation.
    expect(container.querySelector('.stakeys-avatar--talking')).toBeTruthy();
    // The provided frame class wraps the artwork.
    expect(container.querySelector('.avatar-container')).toBeTruthy();
  });

  it('does not animate when idle', () => {
    const { container } = render(<StakeyAvatar config={DEFAULT_STAKEY_AVATAR} />);
    expect(container.querySelector('.stakeys-avatar--talking')).toBeNull();
  });
});

describe('answerStakeyLocally', () => {
  it('routes booking questions to the booking destination', () => {
    const r = answerStakeyLocally('How do I book a repair?');
    expect(r.action).toEqual({ type: 'navigate', target: 'booking' });
  });

  it('routes loyalty questions to the loyalty destination', () => {
    const r = answerStakeyLocally('where are my stamps?');
    expect(r.action.target).toBe('loyalty');
  });

  it('only ever returns known destinations', () => {
    const known = STAKEY_DESTINATIONS.map((d) => d.target);
    for (const q of ['book', 'stamps', 'my garage', 'offers', 'prize', 'contact', 'hello there']) {
      const target = answerStakeyLocally(q).action.target;
      if (target) expect(known).toContain(target);
    }
  });
});

describe('StakeyHelper', () => {
  beforeEach(() => {
    window.speechSynthesis = undefined as any;
  });

  it('renders nothing when the helper is disabled', () => {
    const { container } = render(
      <StakeyHelper config={{ ...DEFAULT_STAKEY_AVATAR, enabled: false }} onNavigate={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens from the launcher, greets, and navigates on a booking question', async () => {
    const onNavigate = vi.fn();
    render(<StakeyHelper config={{ ...DEFAULT_STAKEY_AVATAR, name: 'Stakey' }} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Open Stakey, your helper/i }));
    expect(screen.getByText(/Hi, I'm Stakey/i)).toBeTruthy();

    const input = screen.getByLabelText(/Ask Stakey/i);
    fireEvent.change(input, { target: { value: 'How do I book a repair?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => expect(screen.getByText(/open the booking form/i)).toBeTruthy());
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('booking'), { timeout: 1500 });
  });
});
