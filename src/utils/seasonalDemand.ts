/**
 * Seasonal demand knowledge base: weather + season → the specific parts likely
 * to need attention, with a short rationale and a suggested service offer.
 *
 * Component ids come straight from the TASK-1 taxonomy so the promotions
 * planner, the identifier and the workshop all speak the same language.
 */
import type { VehicleCategory } from '../types/bikeShop';
import { ALL_SPEC_COMPONENTS, systemForComponent } from './bikeSpecTaxonomy';
import { demandSignals, seasonOf, type DemandSignal, type Season } from './repairWeatherModel';
import type { WeatherReport } from './weatherService';

export interface SeasonalPart {
  /** Taxonomy component id (see bikeSpecTaxonomy). */
  componentId: string;
  /** Display name, resolved from the taxonomy. */
  name: string;
  /** Owning taxonomy system id. */
  systemId: string;
  /** Why this part is at risk now. */
  rationale: string;
  /** Short suggested offer to put on the workshop menu. */
  offer: string;
}

interface PartRule {
  componentId: string;
  rationale: string;
  offer: string;
  categories?: VehicleCategory[];
}

/** Weather/season rules keyed by the signal id that triggers them. */
const SIGNAL_PARTS: Record<string, PartRule[]> = {
  'rain-punctures': [
    { componentId: 'rear-tyre', rationale: 'Wet roads drive debris into rubber.', offer: 'Puncture-proof tyre upgrade' },
    { componentId: 'tubes', rationale: 'Thorns and glass cut through in the wet.', offer: 'Puncture repair & tube swap' },
    { componentId: 'brake-pads', rationale: 'Grit grinds pads down fast when wet.', offer: 'Brake pad replacement' },
  ],
  'rain-corrosion': [
    { componentId: 'chain', rationale: 'A wet chain rusts and stretches.', offer: 'Chain check, clean & lube' },
    { componentId: 'cassette', rationale: 'Wet grit chews cassettes and chainrings.', offer: 'Drivetrain overhaul' },
    { componentId: 'gear-cables', rationale: 'Water ingress seizes gear cables.', offer: 'Cable replacement service' },
    { componentId: 'bottom-bracket', rationale: 'Standing water seizes bottom brackets.', offer: 'Bottom bracket service' },
  ],
  'cold-battery-ebike': [
    { componentId: 'battery', rationale: 'Cold cells lose capacity and range.', offer: 'E-bike battery health check' },
    { componentId: 'charger', rationale: 'Charging faults spike in the cold.', offer: 'Charger & port diagnostic' },
    { componentId: 'wiring', rationale: 'Cold stiffens and cracks connectors.', offer: 'Wiring & connector service' },
  ],
  'cold-battery-scooter': [
    { componentId: 'battery', rationale: 'Range drops sharply when cold.', offer: 'E-scooter battery check' },
    { componentId: 'controller', rationale: 'Cold stress trips controllers.', offer: 'Controller diagnostic' },
  ],
  'frost-salt': [
    { componentId: 'rotors', rationale: 'Road salt corrodes brake rotors.', offer: 'Rotor clean & replace' },
    { componentId: 'frame', rationale: 'Salt attacks paint and alloy.', offer: 'Frame wash & protective coat' },
    { componentId: 'chain', rationale: 'Gritted roads accelerate chain wear.', offer: 'Winter drivetrain service' },
  ],
  'heat-wear': [
    { componentId: 'front-tyre', rationale: 'Heat and UV age rubber.', offer: 'Tyre replacement' },
    { componentId: 'brake-pads', rationale: 'Hot braking wears pads quickly.', offer: 'Brake pad replacement' },
    { componentId: 'fork-travel', rationale: 'Heat thins fork and shock oil.', offer: 'Suspension seal & oil service' },
  ],
  'heat-riders': [
    { componentId: 'chain', rationale: 'More miles mean more chain wear.', offer: 'Full service & safety check' },
    { componentId: 'gears', rationale: 'Peak riding stretches shift performance.', offer: 'Gear indexing & tune-up' },
  ],
  'dry-mild-riding': [
    { componentId: 'front-light', rationale: 'More riders out buying lights.', offer: 'Light set fitting' },
    { componentId: 'lock', rationale: 'New riders want security.', offer: 'Lock fitting & advice' },
    { componentId: 'rack', rationale: 'Commuters add carrying capacity.', offer: 'Rack & pannier fitting' },
  ],
  'season-winter': [
    { componentId: 'battery', rationale: 'Winter is battery-care season.', offer: 'Winter battery care' },
    { componentId: 'chain', rationale: 'Winter grinds drivetrains.', offer: 'Winter drivetrain service' },
  ],
  'season-spring': [
    { componentId: 'chain', rationale: 'Post-winter chains need replacing.', offer: 'Spring overhaul' },
    { componentId: 'brake-pads', rationale: 'Spring is brake service time.', offer: 'Brake service' },
  ],
  'season-summer': [
    { componentId: 'brake-pads', rationale: 'Peak braking wears pads.', offer: 'Brake check & replace' },
    { componentId: 'rear-tyre', rationale: 'Summer mileage wears tyres.', offer: 'Tyre replacement' },
  ],
  'season-autumn': [
    { componentId: 'mudguards', rationale: 'Autumn is mudguard season.', offer: 'Mudguard fitting' },
    { componentId: 'front-light', rationale: 'Shorter days need lights.', offer: 'Light set fitting' },
  ],
};

const NAME_BY_ID = new Map(ALL_SPEC_COMPONENTS.map((c) => [c.id, c.name]));

function partFromRule(rule: PartRule): SeasonalPart | null {
  const name = NAME_BY_ID.get(rule.componentId);
  if (!name) return null;
  const systemId = systemForComponent(rule.componentId)?.id || 'frame';
  return { componentId: rule.componentId, name, systemId, rationale: rule.rationale, offer: rule.offer };
}

/** The parts implied by a single signal (deduped, in taxonomy order). */
export function partsForSignal(signal: DemandSignal): SeasonalPart[] {
  const rules = SIGNAL_PARTS[signal.id];
  if (!rules) return [];
  return rules.map(partFromRule).filter((p): p is SeasonalPart => p != null);
}

/** Fallback parts for a bare season, using the base season signal. */
export function partsForSeason(season: Season): SeasonalPart[] {
  const base = SIGNAL_PARTS[`season-${season}`];
  if (!base) return [];
  return base.map(partFromRule).filter((p): p is SeasonalPart => p != null);
}

/**
 * The full seasonal-demand view for a forecast: the ranked signals plus the
 * concrete parts each one puts at risk. Purely derived from the weather model.
 */
export function seasonalDemand(
  report: WeatherReport | null | undefined,
  today: Date = new Date()
): { season: Season; signals: DemandSignal[]; parts: SeasonalPart[] } {
  const season = seasonOf(today.getMonth());
  const signals = demandSignals(report, today);
  const seen = new Set<string>();
  const parts: SeasonalPart[] = [];
  for (const signal of signals) {
    const signalParts = partsForSignal(signal).length ? partsForSignal(signal) : [];
    for (const p of signalParts) {
      if (seen.has(p.componentId)) continue;
      seen.add(p.componentId);
      parts.push(p);
    }
  }
  if (!parts.length) parts.push(...partsForSeason(season));
  return { season, signals, parts };
}
