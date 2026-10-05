import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LegalDisclaimerSections } from './src/components/LegalDisclaimers';

describe('LegalDisclaimerSections (accordion)', () => {
  it('lists every section heading but hides the body until expanded', () => {
    render(<LegalDisclaimerSections variant="accordion" />);
    expect(screen.getByText('2. Mobile Call-Out & Service Fee Disclaimer')).toBeTruthy();
    expect(screen.queryByText(/starts at £10/)).toBeNull();
  });

  it('reveals the call-out terms when the section is expanded', () => {
    render(<LegalDisclaimerSections variant="accordion" />);
    fireEvent.click(screen.getByText('2. Mobile Call-Out & Service Fee Disclaimer'));
    expect(screen.getByText(/starts at £10/)).toBeTruthy();
    expect(screen.getByText(/Non-Refundable Fee/)).toBeTruthy();
    expect(screen.getByText(/safe, dry, and flat/)).toBeTruthy();
  });

  it('renders everything up-front in the plain (modal) variant', () => {
    render(<LegalDisclaimerSections variant="plain" />);
    expect(screen.getByText(/proven mechanical negligence/)).toBeTruthy();
    expect(screen.getByText(/speed-unlocking/)).toBeTruthy();
    expect(screen.getByText(/14 days/)).toBeTruthy();
  });
});
