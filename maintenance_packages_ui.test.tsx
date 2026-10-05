import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MaintenancePackagesPanel } from './src/components/MaintenancePackagesPanel';

describe('MaintenancePackagesPanel', () => {
  it('shows the seasonal packages for a pedal bike', () => {
    render(<MaintenancePackagesPanel vehicleCategory="cycle" onSelect={() => {}} />);
    expect(screen.getByText('Winterization Check')).toBeTruthy();
    expect(screen.getByText('Pre-Summer Safety Tune')).toBeTruthy();
    // Scooter-only audit must not appear for a pedal bike.
    expect(screen.queryByText('E-Scooter Battery & Brake Safety Audit')).toBeNull();
  });

  it('shows the scooter battery & brake audit for an e-scooter', () => {
    render(<MaintenancePackagesPanel vehicleCategory="electric_scooter" onSelect={() => {}} />);
    expect(screen.getByText('E-Scooter Battery & Brake Safety Audit')).toBeTruthy();
  });

  it('reveals the checklist when "what&apos;s included" is expanded', () => {
    render(<MaintenancePackagesPanel vehicleCategory="cycle" onSelect={() => {}} />);
    expect(screen.queryByText(/Chain clean & re-lubrication/)).toBeNull();
    const toggles = screen.getAllByText(/What's included/);
    fireEvent.click(toggles[0]);
    expect(screen.getByText(/Chain clean & re-lubrication/)).toBeTruthy();
    expect(screen.getByText(/Brake adjustment & pad inspection/)).toBeTruthy();
  });

  it('calls onSelect with the chosen package', () => {
    const onSelect = vi.fn();
    render(<MaintenancePackagesPanel vehicleCategory="cycle" onSelect={onSelect} />);
    const buttons = screen.getAllByText('Book this package');
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe('pkg-winterization');
  });
});
