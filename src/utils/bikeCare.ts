import { CustomerBike } from '../types/bikeShop';
import { toDate } from './loyaltyCard';

/**
 * Per-bike maintenance / care schedule.
 *
 * Pure and deterministic (`now` injectable) so the garage can render a plan and
 * the intervals can be unit-tested. The schedule is derived from the bike's last
 * service date plus its category — nothing is persisted.
 */

export type CareCategory = 'brakes' | 'drivetrain' | 'tyres' | 'bearings' | 'electrical';

export interface CareItem {
  id: CareCategory;
  label: string;
  /** Recommended interval in months between services of this kind. */
  intervalMonths: number;
  detail: string;
}

export interface CareScheduleEntry extends CareItem {
  /** Last serviced date for the bike (ISO), if known. */
  lastServiced: string | null;
  /** When this item is next due (null when there is no service history to anchor it). */
  dueDate: Date | null;
  /** Days until due (negative = overdue); null when not anchored. */
  daysUntilDue: number | null;
  status: 'due' | 'overdue' | 'ok' | 'unknown';
}

/** The standard service intervals for a pedal cycle. */
const PEDAL_ITEMS: CareItem[] = [
  { id: 'brakes', label: 'Brake check', intervalMonths: 6, detail: 'Pads, cable tension and stopping power' },
  { id: 'drivetrain', label: 'Drivetrain service', intervalMonths: 6, detail: 'Chain wear, gears and lubrication' },
  { id: 'tyres', label: 'Tyres & tubes', intervalMonths: 6, detail: 'Tread, pressure and sidewall condition' },
  { id: 'bearings', label: 'Bearings & safety check', intervalMonths: 12, detail: 'Hubs, headset, bottom bracket and torque check' },
];

/** Electric bikes and scooters add a battery / motor inspection. */
const ELECTRIC_ITEM: CareItem = {
  id: 'electrical',
  label: 'Battery & motor check',
  intervalMonths: 12,
  detail: 'Battery health, wiring, controller and motor mounting',
};

/** True for the categories that need the extra electrical inspection. */
export function isElectric(category: CustomerBike['category']): boolean {
  return category === 'ebike' || category === 'electric_scooter';
}

/** The care items that apply to a bike, given its category. */
export function careItemsFor(bike: CustomerBike): CareItem[] {
  return isElectric(bike.category) ? [...PEDAL_ITEMS, ELECTRIC_ITEM] : PEDAL_ITEMS;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * Builds the due/overdue care plan for one bike. Every item is anchored to the
 * bike's last service date; when there is no history the item is reported as
 * `unknown` rather than guessed.
 */
export function buildCareSchedule(bike: CustomerBike, now: Date = new Date()): CareScheduleEntry[] {
  const last = toDate(bike.lastServiceDate);
  return careItemsFor(bike).map((item) => {
    if (!last) {
      return { ...item, lastServiced: null, dueDate: null, daysUntilDue: null, status: 'unknown' as const };
    }
    const dueDate = addMonths(last, item.intervalMonths);
    const days = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const status: CareScheduleEntry['status'] = days < 0 ? 'overdue' : days <= 30 ? 'due' : 'ok';
    return {
      ...item,
      lastServiced: bike.lastServiceDate || null,
      dueDate,
      daysUntilDue: days,
      status,
    };
  });
}

/** The single most urgent status across a bike's schedule (for a summary badge). */
export function overallCareStatus(entries: CareScheduleEntry[]): 'overdue' | 'due' | 'ok' | 'unknown' {
  if (entries.some((e) => e.status === 'overdue')) return 'overdue';
  if (entries.some((e) => e.status === 'due')) return 'due';
  if (entries.every((e) => e.status === 'unknown')) return 'unknown';
  return 'ok';
}
