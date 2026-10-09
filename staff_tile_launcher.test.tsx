import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Bike, Wrench } from 'lucide-react';

const TILE_CSS = readFileSync('src/index.css', 'utf8');

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ theme: 'dark' }),
}));

import { TileButton } from './src/components/tiles/TileButton';
import { TileGrid } from './src/components/tiles/TileGrid';
import { TileGroup } from './src/components/tiles/TileGroup';

beforeEach(() => cleanup());

describe('tile primitives', () => {
  it('renders a tile with label, hint and fires onSelect', () => {
    const onSelect = vi.fn();
    render(<TileButton icon={Wrench} label="Bookings" hint="Workshop bookings" onSelect={onSelect} testId="t" />);
    const tile = screen.getByTestId('t');
    expect(tile).toBeTruthy();
    expect(screen.getByText('Bookings')).toBeTruthy();
    expect(tile.getAttribute('title')).toBe('Workshop bookings');
    expect(tile.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tile);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows a badge only when non-zero and reflects the active state', () => {
    const { rerender } = render(
      <TileButton icon={Bike} label="Members" badge={0} onSelect={() => {}} testId="t" />
    );
    expect(screen.queryByText('0')).toBeNull();

    rerender(<TileButton icon={Bike} label="Members" badge={7} active onSelect={() => {}} testId="t" />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByTestId('t').getAttribute('aria-pressed')).toBe('true');
  });

  it('disables the tile when disabled', () => {
    const onSelect = vi.fn();
    render(<TileButton label="Locked" disabled onSelect={onSelect} testId="t" />);
    const tile = screen.getByTestId('t') as HTMLButtonElement;
    expect(tile.disabled).toBe(true);
    fireEvent.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('groups tiles under a heading with an optional action', () => {
    render(
      <TileGroup label="Operations" action={<span data-testid="bell">bell</span>}>
        <TileGrid>
          <TileButton label="Till" onSelect={() => {}} />
          <TileButton label="Bookings" onSelect={() => {}} />
        </TileGrid>
      </TileGroup>
    );
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByTestId('bell')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows a clear call-to-action and a descriptive accessible name', () => {
    render(
      <TileButton
        icon={Wrench}
        label="Members"
        hint="Customer directory"
        actionLabel="Manage"
        onSelect={() => {}}
        testId="t"
      />
    );
    expect(screen.getByText('Manage')).toBeTruthy();
    expect(screen.getByTestId('t').getAttribute('aria-label')).toBe('Members — Customer directory');
  });

  it('staggers the entrance animation by index', () => {
    render(
      <TileGrid>
        <TileButton label="A" onSelect={() => {}} testId="a" />
        <TileButton label="B" onSelect={() => {}} testId="b" />
      </TileGrid>
    );
    expect(screen.getByTestId('a').style.animationDelay).toBe('0ms');
    expect(screen.getByTestId('b').style.animationDelay).toBe('35ms');
  });

  it('brands the tile with a tone-coloured panel, glow and animated logo', () => {
    const { container } = render(
      <TileButton icon={Wrench} label="Till" tone="amber" onSelect={() => {}} testId="t" />
    );
    const tile = screen.getByTestId('t');
    // Tone is exposed as a CSS variable that the panel/bloom/spin consume.
    expect(tile.style.getPropertyValue('--tile-glow')).toBe('245,158,11');
    // The branded layers are present.
    expect(container.querySelector('.tile-panel')).toBeTruthy();
    expect(container.querySelector('.tile-bloom')).toBeTruthy();
    expect(container.querySelector('.tile-spin')).toBeTruthy();
    expect(container.querySelector('.tile-glyph')).toBeTruthy();
    // The glyph is wrapped in the pulsing icon chip.
    expect(container.querySelector('.tile-icon .tile-glyph')).toBeTruthy();
  });

  it('does not keep a repaint-heavy animation running on every tile (no forever box-shadow / conic rotation)', () => {
    // Any perpetual box-shadow or large conic-layer rotation is a per-frame
    // full-tile repaint that can make a full launcher look jittery. The
    // "breathing" halo and colour sweep must be opacity/transform-only at rest
    // and only resume rotating on hover.
    expect(TILE_CSS).not.toMatch(/@keyframes\s+tile[^{]*\{[^}]*box-shadow\s*:\s*0 0 0 \d+px/);
    expect(TILE_CSS).not.toMatch(/tile-badge-pulse/);
    expect(TILE_CSS).toMatch(/\.tile\s+\.tile-spin\s*\{[^}]*animation:\s*tile-spin-in\s+[\d.]+s\s+ease-out\s+both/);
    expect(TILE_CSS).toMatch(/tile-badge-breathe/);
    expect(TILE_CSS).toMatch(/tile-spin-in/);
    expect(TILE_CSS).toMatch(/\.tile:hover:not\(:disabled\) \.tile-spin\s*{[^}]*tile-spin/);
  });
});
