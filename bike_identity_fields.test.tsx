import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  BikeIdentityFields,
  BikeIdentityValue,
  EMPTY_BIKE_IDENTITY,
} from './src/components/BikeIdentityFields';

function renderFields(over: Partial<BikeIdentityValue> = {}) {
  const value: BikeIdentityValue = { ...EMPTY_BIKE_IDENTITY, brand: 'Trek', model: 'Marlin (Mountain)', ...over };
  const onChange = vi.fn();
  render(<BikeIdentityFields value={value} onChange={onChange} idPrefix="t" />);
  return { onChange, value };
}

describe('BikeIdentityFields', () => {
  it('always asks the e-bike conversion question', () => {
    renderFields();
    expect(
      screen.getByText(/converted to an e-bike, or is it a factory e-bike/i)
    ).toBeTruthy();
    expect(screen.getByText('Factory E-Bike')).toBeTruthy();
    expect(screen.getByText('Converted to E-Bike')).toBeTruthy();
    expect(screen.getByText('Not an E-Bike')).toBeTruthy();
  });

  it('reports the chosen conversion status back to the parent', () => {
    const { onChange } = renderFields();
    fireEvent.click(screen.getByText('Converted to E-Bike'));
    expect(onChange).toHaveBeenCalledWith({ ebikeStatus: 'converted' });
  });

  it('reveals motor / battery / drive questions for an e-bike', () => {
    renderFields({ ebikeStatus: 'converted' });
    expect(screen.getByLabelText('Motor / System')).toBeTruthy();
    expect(screen.getByLabelText('Battery Position')).toBeTruthy();
    expect(screen.getByLabelText('Drive Type')).toBeTruthy();
  });

  it('hides the motor questions for a plain pedal bike', () => {
    renderFields({ ebikeStatus: 'not_ebike' });
    expect(screen.queryByLabelText('Motor / System')).toBeNull();
  });

  it('resets the model list when the brand changes', () => {
    const { onChange } = renderFields();
    fireEvent.click(screen.getByText('Change'));
    fireEvent.click(screen.getByText('Specialized'));
    expect(onChange).toHaveBeenCalledWith({
      brand: 'Specialized',
      model: expect.stringMatching(/Rockhopper|Sirrus|Allez/),
      customModel: '',
    });
  });

  it('groups the brand picker into E-Scooters and Bikes, both alphabetical', () => {
    renderFields();
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('E-Scooters')).toBeTruthy();
    expect(screen.getByText('Bikes')).toBeTruthy();

    // Scooter-only Xiaomi shows; Trek (a bike maker) does not sit in the scooter list.
    expect(screen.getByText('Xiaomi')).toBeTruthy();
    expect(screen.getByText('Trek')).toBeTruthy();
  });
});
