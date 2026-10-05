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

import { AvatarCreatorTab } from './src/components/AvatarCreatorTab';
import { DEFAULT_STAKEY_AVATAR } from './src/shared/data/stakeyAvatar';

describe('AvatarCreatorTab', () => {
  beforeEach(() => {
    hoisted.updateStakeyAvatar = vi.fn();
    hoisted.state = {
      stakeyAvatar: { ...DEFAULT_STAKEY_AVATAR },
      updateStakeyAvatar: hoisted.updateStakeyAvatar,
    };
  });

  it('renders the live preview and every editing section', () => {
    render(<AvatarCreatorTab />);
    expect(screen.getByText(/Virtual Stakey — Avatar Creator/i)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Stakey/i })).toBeTruthy();
    for (const label of ['Helper name', 'Character', 'Build', 'Hair / headwear', 'Skin tone', 'Style', 'Voice style']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('saves the edited name to the shared backend', () => {
    render(<AvatarCreatorTab />);
    const nameInput = screen.getByPlaceholderText('Stakey');
    fireEvent.change(nameInput, { target: { value: 'Bolt' } });
    fireEvent.click(screen.getByRole('button', { name: /Save avatar/i }));
    expect(hoisted.updateStakeyAvatar).toHaveBeenCalledTimes(1);
    expect(hoisted.updateStakeyAvatar.mock.calls[0][0].name).toBe('Bolt');
  });

  it('reflects a species switch in the live preview label', () => {
    render(<AvatarCreatorTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Robot' }));
    expect(screen.getByText(/robot ·/i)).toBeTruthy();
  });
});
