import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TillCalculator } from './src/components/TillCalculator';

const tapKeys = (keys: string[]) => {
  for (const k of keys) {
    fireEvent.click(screen.getByRole('button', { name: k }));
  }
};

describe('TillCalculator', () => {
  it('renders a keypad and disables Add until an amount is entered', () => {
    render(<TillCalculator onAddLine={vi.fn()} />);
    expect(screen.getByText(/Till calculator/i)).toBeTruthy();
    const add = screen.getByRole('button', { name: /Enter an amount/i });
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a manually keyed job to the till with a description and category', () => {
    const onAddLine = vi.fn();
    render(<TillCalculator onAddLine={onAddLine} />);

    tapKeys(['1', '2', '.', '5', '0', '+', '7', '.', '2', '5', '=']);
    expect(screen.getByText('£19.75')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Job description/i), {
      target: { value: 'Gear service + cable' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Part' }));
    fireEvent.click(screen.getByRole('button', { name: /Add job to till/i }));

    expect(onAddLine).toHaveBeenCalledTimes(1);
    expect(onAddLine).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Gear service + cable',
        category: 'Part',
        quantity: 1,
        unitPrice: 19.75,
      })
    );
  });

  it('clears the calculator after a line is added', () => {
    const onAddLine = vi.fn();
    render(<TillCalculator onAddLine={onAddLine} />);
    tapKeys(['4', '0']);
    fireEvent.click(screen.getByRole('button', { name: /Add job to till/i }));
    expect(onAddLine).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 40, category: 'Labour' }));
    // Back to zero, and the button is disabled again.
    expect(screen.getByText('£0')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Enter an amount/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('recovers from divide-by-zero so staff can keep working', () => {
    render(<TillCalculator onAddLine={vi.fn()} />);
    tapKeys(['5', '÷', '0', '=']);
    expect(screen.getByText('£Error')).toBeTruthy();
    tapKeys(['9']);
    expect(screen.getByText('£9')).toBeTruthy();
  });
});
