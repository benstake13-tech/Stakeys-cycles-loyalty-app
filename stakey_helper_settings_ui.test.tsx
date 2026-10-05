import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updateStakeyAvatar: vi.fn(),
  state: {} as any,
}));

vi.mock('./src/shared/context/ShopContext', () => ({
  useShop: () => hoisted.state,
}));

// No speech engine in jsdom.
vi.mock('./src/shared/utils/stakeyVoice', () => ({
  isSpeechSupported: () => false,
  primeVoices: vi.fn(),
  speak: vi.fn(async () => {}),
}));

import { StakeyHelperSettingsTab } from './src/components/StakeyHelperSettingsTab';
import { DEFAULT_STAKEY_AVATAR } from './src/shared/data/stakeyAvatar';

describe('StakeyHelperSettingsTab', () => {
  beforeEach(() => {
    hoisted.updateStakeyAvatar = vi.fn();
    hoisted.state = {
      stakeyAvatar: { ...DEFAULT_STAKEY_AVATAR },
      updateStakeyAvatar: hoisted.updateStakeyAvatar,
    };
  });

  it('renders the live preview and the helper settings', () => {
    render(<StakeyHelperSettingsTab />);
    expect(screen.getByText(/Virtual Stakey — Helper/i)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Stakey/i })).toBeTruthy();
    for (const label of ['Helper name', 'Voice style', 'Personality & guidance (tells the AI how to behave)']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('no longer offers the old avatar-building controls', () => {
    render(<StakeyHelperSettingsTab />);
    for (const gone of ['Character', 'Build', 'Hair / headwear', 'Skin tone', 'Business accent']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it('saves the edited name to the shared backend', () => {
    render(<StakeyHelperSettingsTab />);
    const nameInput = screen.getByPlaceholderText('Stakey');
    fireEvent.change(nameInput, { target: { value: 'Bolt' } });
    fireEvent.click(screen.getByRole('button', { name: /Save helper/i }));
    expect(hoisted.updateStakeyAvatar).toHaveBeenCalledTimes(1);
    expect(hoisted.updateStakeyAvatar.mock.calls[0][0].name).toBe('Bolt');
  });

  it('reflects a voice style change in the preview', () => {
    render(<StakeyHelperSettingsTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Calm & steady' }));
    expect(screen.getByText(/calm voice/i)).toBeTruthy();
  });
});
