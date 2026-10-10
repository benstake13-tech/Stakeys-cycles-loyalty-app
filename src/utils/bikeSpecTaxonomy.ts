/**
 * The Bike Spec Taxonomy: a single source of truth for "every part a mechanic
 * checks". The vision prompt, the response schema and the identifier UI all
 * derive from this list so the AI sweeps the *whole* bike instead of listing
 * whatever it happened to notice.
 *
 * Pure data + tiny helpers only (no React) so it is cheap to unit-test.
 */
import type { BikeComponentSpec } from '../types/bikeShop';

/** One component in the checklist. */
export interface SpecComponentDef {
  /** Stable kebab id, unique across the whole taxonomy. */
  id: string;
  /** Display name, e.g. "Bottom bracket". */
  name: string;
  /** Back-compat bucket used by BikeComponentSpec. */
  category: BikeComponentSpec['category'];
}

/** A system groups related components, in inspection order. */
export interface SpecSystemDef {
  id: string;
  label: string;
  /** Back-compat bucket every component in this system maps to. */
  category: BikeComponentSpec['category'];
  components: { id: string; name: string }[];
}

/**
 * The ordered checklist. Order matters: the model is instructed to walk it top
 * to bottom, and the UI renders grouped by system in this order.
 */
export const SPEC_SYSTEMS: SpecSystemDef[] = [
  {
    id: 'frame',
    label: 'Frame & Structure',
    category: 'Cockpit & Controls',
    components: [
      { id: 'frame', name: 'Frame' },
      { id: 'fork', name: 'Fork' },
      { id: 'headset', name: 'Headset' },
      { id: 'bottom-bracket', name: 'Bottom bracket' },
      { id: 'rear-triangle', name: 'Rear triangle & dropouts' },
      { id: 'frame-bearings', name: 'Frame pivot bearings' },
      { id: 'kickstand', name: 'Kickstand' },
    ],
  },
  {
    id: 'wheels',
    label: 'Wheels & Tyres',
    category: 'Wheels & Tires',
    components: [
      { id: 'front-rim', name: 'Front rim' },
      { id: 'rear-rim', name: 'Rear rim' },
      { id: 'front-hub', name: 'Front hub' },
      { id: 'rear-hub', name: 'Rear hub' },
      { id: 'spokes', name: 'Spokes' },
      { id: 'front-tyre', name: 'Front tyre' },
      { id: 'rear-tyre', name: 'Rear tyre' },
      { id: 'tubes', name: 'Inner tubes' },
      { id: 'valves', name: 'Valve type' },
      { id: 'wheel-size', name: 'Wheel size' },
    ],
  },
  {
    id: 'brakes',
    label: 'Brakes',
    category: 'Brakes',
    components: [
      { id: 'front-brake', name: 'Front brake' },
      { id: 'rear-brake', name: 'Rear brake' },
      { id: 'brake-levers', name: 'Brake levers' },
      { id: 'rotors', name: 'Brake rotors / discs' },
      { id: 'brake-pads', name: 'Brake pads' },
      { id: 'brake-cables', name: 'Brake cables / hoses' },
    ],
  },
  {
    id: 'drivetrain',
    label: 'Drivetrain',
    category: 'Drivetrain',
    components: [
      { id: 'crankset', name: 'Crankset & chainrings' },
      { id: 'pedals', name: 'Pedals' },
      { id: 'chain', name: 'Chain' },
      { id: 'cassette', name: 'Cassette / freewheel' },
      { id: 'front-derailleur', name: 'Front derailleur' },
      { id: 'rear-derailleur', name: 'Rear derailleur' },
      { id: 'shifters', name: 'Shifters' },
      { id: 'gears', name: 'Number of gears' },
      { id: 'gear-cables', name: 'Gear cables' },
    ],
  },
  {
    id: 'cockpit',
    label: 'Cockpit & Steering',
    category: 'Cockpit & Controls',
    components: [
      { id: 'handlebar', name: 'Handlebar' },
      { id: 'stem', name: 'Stem' },
      { id: 'grips', name: 'Grips / bar tape' },
      { id: 'headset-spacers', name: 'Headset spacers' },
      { id: 'computer-mount', name: 'Computer / phone mount' },
    ],
  },
  {
    id: 'seating',
    label: 'Seating',
    category: 'Cockpit & Controls',
    components: [
      { id: 'saddle', name: 'Saddle' },
      { id: 'seatpost', name: 'Seatpost' },
      { id: 'seat-clamp', name: 'Seat clamp' },
      { id: 'dropper', name: 'Dropper post' },
    ],
  },
  {
    id: 'suspension',
    label: 'Suspension',
    category: 'Suspension / Fork',
    components: [
      { id: 'suspension-fork', name: 'Suspension fork' },
      { id: 'rear-shock', name: 'Rear shock' },
      { id: 'fork-travel', name: 'Fork travel' },
    ],
  },
  {
    id: 'electric',
    label: 'Electric System',
    category: 'Electrical / Battery',
    components: [
      { id: 'motor', name: 'Motor' },
      { id: 'battery', name: 'Battery' },
      { id: 'controller', name: 'Controller' },
      { id: 'display', name: 'Display / console' },
      { id: 'wiring', name: 'Wiring & connectors' },
      { id: 'charger', name: 'Charger' },
    ],
  },
  {
    id: 'accessories',
    label: 'Accessories & Lights',
    category: 'Electrical / Battery',
    components: [
      { id: 'front-light', name: 'Front light' },
      { id: 'rear-light', name: 'Rear light' },
      { id: 'rack', name: 'Rack' },
      { id: 'mudguards', name: 'Mudguards' },
      { id: 'bell', name: 'Bell' },
      { id: 'basket', name: 'Basket / panniers' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Security',
    category: 'Cockpit & Controls',
    components: [
      { id: 'lock', name: 'Lock' },
      { id: 'reflectors', name: 'Reflectors' },
      { id: 'serial-number', name: 'Frame serial number' },
    ],
  },
];

/** Flat, ordered list of every component in the taxonomy. */
export const ALL_SPEC_COMPONENTS: SpecComponentDef[] = SPEC_SYSTEMS.flatMap((system) =>
  system.components.map((component) => ({
    id: component.id,
    name: component.name,
    category: system.category,
  }))
);

const COMPONENT_SYSTEM = new Map<string, SpecSystemDef>();
for (const system of SPEC_SYSTEMS) {
  for (const component of system.components) COMPONENT_SYSTEM.set(component.id, system);
}

/** The system a component id belongs to, or `undefined` if unknown. */
export function systemForComponent(componentId: string): SpecSystemDef | undefined {
  return COMPONENT_SYSTEM.get(componentId);
}

/** System id an item belongs to, resolving by id then by fuzzy name match. */
export function systemIdForItem(item: {
  systemId?: string;
  componentId?: string;
  componentName?: string;
}): string | undefined {
  if (item.systemId && SPEC_SYSTEMS.some((s) => s.id === item.systemId)) return item.systemId;
  if (item.componentId && COMPONENT_SYSTEM.has(item.componentId)) {
    return COMPONENT_SYSTEM.get(item.componentId)!.id;
  }
  const needle = (item.componentName || '').toLowerCase().trim();
  if (needle) {
    const hit = ALL_SPEC_COMPONENTS.find(
      (c) => c.name.toLowerCase() === needle || needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle)
    );
    if (hit) return COMPONENT_SYSTEM.get(hit.id)!.id;
  }
  return undefined;
}

export interface SpecCoverage {
  detected: number;
  total: number;
  /** 0-100 rounded percentage of the taxonomy that was detected. */
  pct: number;
  /** Detected component count per system id. */
  perSystem: Record<string, { detected: number; total: number }>;
}

/**
 * Scores how much of the taxonomy a set of detected items covers. Items that are
 * present but marked "not visible" do not count toward coverage.
 */
export function specCoverage(
  items: { systemId?: string; componentId?: string; componentName?: string; visibility?: string }[]
): SpecCoverage {
  const detectedIds = new Set<string>();
  const perSystem: Record<string, { detected: number; total: number }> = {};
  for (const system of SPEC_SYSTEMS) perSystem[system.id] = { detected: 0, total: system.components.length };

  for (const item of items || []) {
    if (item?.visibility === 'not_visible') continue;
    const systemId = systemIdForItem(item);
    if (!systemId) continue;
    const key = item.componentId || item.componentName || `${systemId}:${detectedIds.size}`;
    if (detectedIds.has(key)) continue;
    detectedIds.add(key);
    if (perSystem[systemId]) perSystem[systemId].detected += 1;
  }

  const detected = Object.values(perSystem).reduce((n, s) => n + s.detected, 0);
  const total = ALL_SPEC_COMPONENTS.length;
  return { detected, total, pct: total ? Math.round((detected / total) * 100) : 0, perSystem };
}

/** Human label for a system id (falls back to the raw id). */
export function systemLabel(systemId: string): string {
  return SPEC_SYSTEMS.find((s) => s.id === systemId)?.label || systemId;
}
