import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bike, Wrench } from 'lucide-react';

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
});
