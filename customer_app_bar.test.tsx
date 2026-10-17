import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomerDesktopNavigation } from './src/components/customer/CustomerDesktopNavigation';

describe('customer app bar', () => {
  it('keeps the five customer destinations inside one glass navigation bar', () => {
    const onSelect = vi.fn();
    render(<CustomerDesktopNavigation active="garage" onSelect={onSelect} />);
    const bar = screen.getByRole('navigation', { name: 'Customer app navigation' });
    expect(within(bar).getAllByRole('button').map(button => button.getAttribute('aria-label')))
      .toEqual(['Garage', 'Book', 'Repairs', 'Pass', 'More']);
    fireEvent.click(within(bar).getByRole('button', { name: 'More' }));
    expect(onSelect).toHaveBeenCalledWith('more');
  });
});
