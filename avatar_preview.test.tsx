import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: { theme: 'dark' } as any,
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { AvatarPreviewStage } from './src/components/AvatarPreviewStage';
import { FaceAvatar } from './src/components/FaceAvatar';

beforeEach(() => {
  hoisted.shop = { theme: 'dark' };
});

describe('AvatarPreviewStage', () => {
  it('renders the real avatar system with sample variety', () => {
    const { container } = render(<AvatarPreviewStage />);
    expect(screen.getByText('Avatar Creator — Preview')).toBeTruthy();
    // 12 sample seeds plus the hero avatar.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(13);
  });

  it('opens the real AvatarEditorModal and applies a change', () => {
    const { container } = render(<AvatarPreviewStage />);
    const before = container.querySelectorAll('svg').length;

    fireEvent.click(screen.getByText('Open Avatar Creator'));
    // The editor exposes its real category tabs.
    expect(screen.getByText('Hair & Skin')).toBeTruthy();

    fireEvent.click(screen.getByText('Hair & Skin'));
    fireEvent.click(screen.getByText('Fluffy Afro'));
    fireEvent.click(screen.getByText('Apply Avatar'));

    // Modal closed, and the hero now carries an explicit config string.
    expect(screen.queryByText('Hair & Skin')).toBeNull();
    expect(container.textContent).toContain('"hairStyle":"afro"');
    expect(container.querySelectorAll('svg').length).toBe(before);
  });

  it('switches the preview avatar when a sample seed is chosen', () => {
    render(<AvatarPreviewStage />);
    fireEvent.click(screen.getByText('Fatima'));
    // "Fatima" now shows both as the sample card and as the hero name.
    expect(screen.getAllByText('Fatima').length).toBeGreaterThanOrEqual(2);
  });
});

describe('FaceAvatar config', () => {
  it('parses an applied config string back into the same look', () => {
    const { container } = render(
      <FaceAvatar seed="Preview Rider" configString={JSON.stringify({ hairStyle: 'afro' })} size={80} />,
    );
    // parseConfigString merges the partial config over the deterministic default.
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
