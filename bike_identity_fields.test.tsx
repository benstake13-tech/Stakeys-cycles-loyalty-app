import React, { useState } from 'react';
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
  return {
    onChange,
    onChangeCalls: () => onChange.mock.calls.map((c) => c[0]),
    value,
  };
}

/** A controlled harness that actually re-renders when the picker calls back. */
function ControlledFields({ initial }: { initial: Partial<BikeIdentityValue> }) {
  const [value, setValue] = useState<BikeIdentityValue>(() => ({
    ...EMPTY_BIKE_IDENTITY,
    brand: 'Trek',
    model: 'Marlin (Mountain)',
    ...initial,
  }));
  return (
    <BikeIdentityFields
      value={value}
      onChange={(p) => setValue((prev) => ({ ...prev, ...p }))}
      idPrefix="t"
    />
  );
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

  it('filters brands to the chosen vehicle category (Step 1)', () => {
    // Default category is 'cycle' → only bike-family brands appear, no scooters.
    render(<ControlledFields initial={{}} />);
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('Bike Brands')).toBeTruthy();
    expect(screen.queryByText('E-Scooter Brands')).toBeNull();
    expect(screen.getByText('Trek')).toBeTruthy();
    expect(screen.getByText('Giant')).toBeTruthy();
    expect(screen.queryByText('Xiaomi')).toBeNull();
    expect(screen.queryByText('Segway-Ninebot')).toBeNull();

    // Switch to Electric Scooter → only scooter makers, no bike makers.
    fireEvent.click(screen.getByLabelText('Close brand search'));
    fireEvent.change(screen.getByLabelText('Vehicle Category'), {
      target: { value: 'electric_scooter' },
    });
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('E-Scooter Brands')).toBeTruthy();
    expect(screen.queryByText('Bike Brands')).toBeNull();
    expect(screen.getByText('Xiaomi')).toBeTruthy();
    expect(screen.getByText('Segway-Ninebot')).toBeTruthy();
    expect(screen.queryByText('Trek')).toBeNull();
    expect(screen.queryByText('Giant')).toBeNull();

    // E-Bike → e-bike + conversion-kit makers only.
    fireEvent.click(screen.getByLabelText('Close brand search'));
    fireEvent.change(screen.getByLabelText('Vehicle Category'), {
      target: { value: 'ebike' },
    });
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('E-Bike Brands')).toBeTruthy();
    expect(screen.getByText('Haibike')).toBeTruthy();
    expect(screen.getByText('Swytch')).toBeTruthy();
    expect(screen.queryByText('Xiaomi')).toBeNull();
    expect(screen.queryByText('Segway-Ninebot')).toBeNull();
  });

  it('resets a brand that no longer matches the chosen category', () => {
    // Start as an e-scooter with a scooter maker picked.
    render(
      <ControlledFields
        initial={{ category: 'electric_scooter', brand: 'Xiaomi', model: 'Mi Essential' }}
      />
    );
    // Existing scooter retains its stored brand on mount (no clobber).
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('Xiaomi')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close brand search'));

    // Switch to a pedal bike — Xiaomi no longer fits, so it must drop to a
    // bike maker.
    fireEvent.change(screen.getByLabelText('Vehicle Category'), {
      target: { value: 'cycle' },
    });
    expect(screen.queryByText('Xiaomi')).toBeNull();
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('Bike Brands')).toBeTruthy();
    expect(screen.getByText('Trek')).toBeTruthy();
  });
});
