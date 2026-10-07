import { describe, expect, it } from 'vitest';
import { vehicleNouns, bookingVehicleNouns } from './src/utils/vehicleType';

describe('vehicleNouns', () => {
  it('maps each category to a specific noun', () => {
    expect(vehicleNouns('cycle').noun).toBe('bike');
    expect(vehicleNouns('ebike').noun).toBe('e-bike');
    expect(vehicleNouns('electric_scooter').noun).toBe('e-scooter');
  });

  it('capitalises the noun for sentence starts', () => {
    expect(vehicleNouns('cycle').Noun).toBe('Bike');
    expect(vehicleNouns('ebike').Noun).toBe('E-Bike');
    expect(vehicleNouns('electric_scooter').Noun).toBe('E-Scooter');
  });

  it('uses the correct indefinite article', () => {
    expect(vehicleNouns('cycle').article).toBe('a bike');
    expect(vehicleNouns('ebike').article).toBe('an e-bike');
    expect(vehicleNouns('electric_scooter').article).toBe('an e-scooter');
  });

  it('falls back to bike for unknown or missing categories', () => {
    expect(vehicleNouns(undefined).noun).toBe('bike');
    expect(vehicleNouns('').noun).toBe('bike');
    expect(vehicleNouns('hoverboard').noun).toBe('bike');
  });

  it('treats cargo bikes as bikes', () => {
    expect(vehicleNouns('cargo').noun).toBe('bike');
  });
});

describe('bookingVehicleNouns', () => {
  it('reads the category off a booking', () => {
    expect(bookingVehicleNouns({ vehicleCategory: 'electric_scooter' }).noun).toBe('e-scooter');
    expect(bookingVehicleNouns({ vehicleCategory: 'ebike' }).noun).toBe('e-bike');
  });

  it('falls back safely when the booking is missing', () => {
    expect(bookingVehicleNouns(undefined).noun).toBe('bike');
  });
});
