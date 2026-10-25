import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutGrid } from 'lucide-react';
import { StaffAppDrawer } from './src/components/staff/StaffAppDrawer';

const apps = [
  { id: 'bookings', label: 'Bookings', hint: 'Manage service bookings', icon: LayoutGrid },
  { id: 'promotions', label: 'Promotions', hint: 'Manage campaigns', icon: LayoutGrid },
  { id: 'settings', label: 'Settings', hint: 'App settings', icon: LayoutGrid },
  { id: 'surface:customer', label: 'Customer preview', hint: 'Preview the customer app', icon: LayoutGrid },
];

describe('StaffAppDrawer folders', () => {
  it('shows useful app descriptions and excludes the retired hanger app', () => {
    render(<StaffAppDrawer apps={[...apps,{id:'hangers',label:'Derailleur Hangers',hint:'Retired tool',icon:LayoutGrid}]} activeApp="" mode="phone" onSelect={vi.fn()} onClose={vi.fn()}/>);
    expect(screen.getByText('Manage service bookings')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Derailleur Hangers'})).toBeNull();
  });
  it('groups apps into collapsible folders and shows their counts', () => {
    render(<StaffAppDrawer apps={apps} activeApp="bookings" mode="phone" onSelect={vi.fn()} onClose={vi.fn()} />);

    const workshop = screen.getByRole('button', { name: /Workshop\s*1/i });
    expect(workshop.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bookings' })).toBeTruthy();

    fireEvent.click(workshop);
    expect(workshop.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Bookings' })).toBeNull();
    expect(screen.getByRole('button', { name: /Sales & Growth\s*1/i })).toBeTruthy();
  });

  it('opens matching folders while searching', () => {
    render(<StaffAppDrawer apps={apps} activeApp="" mode="desktop" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Previews\s*1/i }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Customer preview' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search staff apps' }), { target: { value: 'Customer' } });
    expect(screen.getByRole('button', { name: 'Customer preview' })).toBeTruthy();
  });
});
