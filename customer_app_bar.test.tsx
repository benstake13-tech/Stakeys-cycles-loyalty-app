import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomerDesktopNavigation } from './src/components/customer/CustomerDesktopNavigation';

describe('customer app bar', () => {
  it('keeps Apps and the combined customer ID inside one glass navigation bar', () => {
    const onSelect = vi.fn();
    render(<CustomerDesktopNavigation active="garage" onSelect={onSelect} />);
    const bar = screen.getByRole('navigation', { name: 'Customer app navigation' });
    expect(within(bar).getAllByRole('button').map(button => button.getAttribute('aria-label')))
      .toEqual(['Apps', 'Customer ID']);
    fireEvent.click(within(bar).getByRole('button', { name: 'Apps' }));
    expect(onSelect).toHaveBeenCalledWith('more');
    fireEvent.click(within(bar).getByRole('button', { name: 'Customer ID' }));
    expect(onSelect).toHaveBeenCalledWith('stamps');
  });
});
