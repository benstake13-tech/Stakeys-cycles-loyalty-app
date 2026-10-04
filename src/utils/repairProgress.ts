import type {
  BookingStatus,
  RepairProgressEvent,
  RepairStageId,
  ServiceBooking,
} from '../types/bikeShop';

export interface RepairStageMeta {
  id: RepairStageId;
  title: string;
  short: string;
  description: string;
  estimate: string;
}

/**
 * The workshop journey a bike moves through. Customers see exactly where their
 * repair is; staff advance it one stage at a time from the bench.
 */
export const REPAIR_STAGES: RepairStageMeta[] = [
  {
    id: 'received',
    title: 'Received at Workshop',
    short: 'Received',
    description: 'Your bike has been logged in and is waiting for the bench.',
    estimate: 'Drop-off window',
  },
  {
    id: 'diagnosing',
    title: 'Diagnostics & Safety Check',
    short: 'Diagnostics',
    description: 'workshop mechanic inspecting the frame, drivetrain and brakes.',
    estimate: '20–30 mins',
  },
  {
    id: 'awaiting_approval',
    title: 'Awaiting Your Approval',
    short: 'Approval',
    description: 'We have found the faults and sent you a quote to approve.',
    estimate: 'Waiting on you',
  },
  {
    id: 'parts_ordered',
    title: 'Parts Ordered',
    short: 'Parts',
    description: 'Replacement components are ordered and on their way to the shop.',
    estimate: '1–3 days',
  },
  {
    id: 'on_the_bench',
    title: 'On the Workshop Bench',
    short: 'On Bench',
    description: 'Parts being fitted, wheels trued, cables tensioned and calibrated.',
    estimate: '45–90 mins',
  },
  {
    id: 'quality_check',
    title: 'Quality Control & Road Test',
    short: 'Quality Check',
    description: 'Torque specs verified, braking tested under load, final wipe down.',
    estimate: 'Final sign-off',
  },
  {
    id: 'ready_for_pickup',
    title: 'Ready for Collection',
    short: 'Ready',
    description: 'All work complete — collect your bike from the shop counter.',
    estimate: 'Pickup today',
  },
  {
    id: 'collected',
    title: 'Collected',
    short: 'Collected',
    description: 'Handed back to you. Thanks for trusting us with your bike!',
    estimate: 'Complete',
  },
];

export const REPAIR_STAGE_ORDER: RepairStageId[] = REPAIR_STAGES.map((s) => s.id);

export const REPAIR_STAGE_MAP: Map<RepairStageId, RepairStageMeta> = new Map(
  REPAIR_STAGES.map((s) => [s.id, s])
);

export function repairStageIndex(stage: RepairStageId | undefined): number {
  const idx = stage ? REPAIR_STAGE_ORDER.indexOf(stage) : -1;
  return idx < 0 ? 0 : idx;
}

export function repairStageLabel(stage: RepairStageId | undefined): string {
  return (stage && REPAIR_STAGE_MAP.get(stage)?.title) || REPAIR_STAGES[0].title;
}

export function repairProgressPercent(stage: RepairStageId | undefined): number {
  return Math.round((repairStageIndex(stage) / (REPAIR_STAGE_ORDER.length - 1)) * 100);
}

export function nextRepairStage(stage: RepairStageId | undefined): RepairStageId | null {
  const idx = repairStageIndex(stage);
  if (idx >= REPAIR_STAGE_ORDER.length - 1) return null;
  return REPAIR_STAGE_ORDER[idx + 1];
}

/**
 * Resolve the effective stage for a booking. An explicit `repairStage` always
 * wins; otherwise we fall back to the coarse `BookingStatus` so older bookings
 * (and bookings where staff have not advanced the tracker yet) still show a
 * sensible position.
 */
export function deriveRepairStage(booking: Pick<ServiceBooking, 'repairStage' | 'status'>): RepairStageId {
  if (booking.repairStage && REPAIR_STAGE_MAP.has(booking.repairStage)) {
    return booking.repairStage;
  }
  return stageForStatus(booking.status);
}

export function stageForStatus(status: BookingStatus): RepairStageId {
  switch (status) {
    case 'pending':
      return 'received';
    case 'confirmed':
      return 'diagnosing';
    case 'in_progress':
      return 'on_the_bench';
    case 'ready_for_pickup':
      return 'ready_for_pickup';
    case 'completed':
      return 'collected';
    case 'cancelled':
    case 'declined':
    default:
      return 'received';
  }
}

/** Keep the coarse status consistent whenever a fine-grained stage is set. */
export function statusForStage(stage: RepairStageId): BookingStatus {
  switch (stage) {
    case 'received':
    case 'diagnosing':
      return 'confirmed';
    case 'awaiting_approval':
    case 'parts_ordered':
    case 'on_the_bench':
    case 'quality_check':
      return 'in_progress';
    case 'ready_for_pickup':
      return 'ready_for_pickup';
    case 'collected':
      return 'completed';
    default:
      return 'in_progress';
  }
}

export function makeRepairEvent(input: {
  stage?: RepairStageId;
  kind?: RepairProgressEvent['kind'];
  label?: string;
  note?: string;
  photoUrl?: string;
  createdBy?: string;
}): RepairProgressEvent {
  const kind = input.kind ?? 'stage';
  const stage = input.stage;
  return {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    stage,
    label: input.label || (stage ? repairStageLabel(stage) : 'Update'),
    note: input.note?.trim() || undefined,
    photoUrl: input.photoUrl,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Match a repair against a free-text query. Supports booking id (with or
 * without the `bk-` prefix), the last digits of a phone number, an email, a
 * membership number or a customer name. Used by the public tracker lookup so
 * guests can check progress without an account.
 */
export function matchesRepairQuery(booking: ServiceBooking, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;

  const id = booking.id.toLowerCase();
  const idDigits = id.replace(/[^0-9]/g, '');
  const qDigits = q.replace(/[^0-9]/g, '');

  if (id === q || id === `bk-${q}` || (idDigits && qDigits === idDigits)) return true;

  const phoneDigits = (booking.customerPhone || '').replace(/[^0-9]/g, '');
  if (qDigits.length >= 4 && phoneDigits && phoneDigits.includes(qDigits)) return true;

  if (booking.customerEmail && booking.customerEmail.toLowerCase().includes(q)) return true;
  if (booking.membershipNumber && booking.membershipNumber.toLowerCase() === q) return true;
  if (booking.customerName && booking.customerName.toLowerCase().includes(q)) return true;

  return false;
}
