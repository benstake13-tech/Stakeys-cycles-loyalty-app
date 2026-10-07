import { ServiceBooking, VehicleCategory } from '../types/bikeShop';

/**
 * The shop only ever talks about three vehicles: a bike, an e-bike or an
 * e-scooter. Every notification, status message and approval prompt derives its
 * wording from here so nothing falls back to a generic "bike" when the rider
 * booked something else.
 */
export interface VehicleNouns {
  category: VehicleCategory;
  /** Lower-case noun, e.g. `bike`, `e-bike`, `e-scooter`. */
  noun: string;
  /** Capitalised noun, e.g. `Bike`, `E-Bike`, `E-Scooter`. */
  Noun: string;
  /** Indefinite form, e.g. `a bike`, `an e-bike`, `an e-scooter`. */
  article: string;
  /** Capitalised indefinite form, e.g. `A bike`, `An e-bike`. */
  Article: string;
}

const NOUNS: Record<VehicleCategory, VehicleNouns> = {
  cycle: {
    category: 'cycle',
    noun: 'bike',
    Noun: 'Bike',
    article: 'a bike',
    Article: 'A bike',
  },
  ebike: {
    category: 'ebike',
    noun: 'e-bike',
    Noun: 'E-Bike',
    article: 'an e-bike',
    Article: 'An e-bike',
  },
  electric_scooter: {
    category: 'electric_scooter',
    noun: 'e-scooter',
    Noun: 'E-Scooter',
    article: 'an e-scooter',
    Article: 'An e-scooter',
  },
  cargo: {
    category: 'cargo',
    noun: 'bike',
    Noun: 'Bike',
    article: 'a bike',
    Article: 'A bike',
  },
};

export function vehicleNouns(category: VehicleCategory | string | undefined): VehicleNouns {
  return NOUNS[(category as VehicleCategory)] || NOUNS.cycle;
}

/** Resolves the nouns for a booking, honouring the captured category. */
export function bookingVehicleNouns(
  booking: Pick<ServiceBooking, 'vehicleCategory'> | undefined
): VehicleNouns {
  return vehicleNouns(booking?.vehicleCategory);
}
