/**
 * E-Scooter / E-Bike workshop error-code reference.
 *
 * A shared, expandable catalogue of the error codes used by the most common
 * electric scooters and e-bikes seen in the workshop (Ninebot/Segway, Xiaomi,
 * Pure, Apollo, Dualtron …). The staff "Error Codes" tool lets a technician pick
 * a category → brand → model and get the full list of codes that model family
 * reports, what each one means, and the usual fix — then optionally ask the AI
 * to narrow it down from a symptom description.
 *
 * The data is intentionally best-effort reference material: controller
 * manufacturers reuse code numbers with slightly different meanings, so every
 * entry carries a `src` ("bms", "controller", "display", …) and the UI always
 * shows the manual pins / connector checks next to the AI suggestion.
 */

import { VehicleCategory } from '../types/bikeShop';

export type EVehicleCategory = Extract<VehicleCategory, 'ebike' | 'electric_scooter'>;

export interface ErrorCodeSource {
  /** Where the code is reported: the battery/BMS, the controller, the display… */
  system: 'bms' | 'controller' | 'display' | 'motor' | 'throttle' | 'brake' | 'charging';
}

export interface EVehicleErrorDefinition {
  /** e.g. "E04" — display strings are normalised to upper-case for matching. */
  code: string;
  /** Human heading, e.g. "Motor Hall Sensor Fault". */
  title: string;
  /** Plain-language explanation of what the code means. */
  description: string;
  /** Low / Medium / High — how urgently it must be dealt with. */
  severity: 'Low' | 'Medium' | 'High';
  /** Workshop steps the tech should take. */
  fix: string[];
  /** Parts typically needed (often "inspect only"). */
  parts?: string[];
  /** Which subsystem raises this code. */
  system: ErrorCodeSource['system'];
  /**
   * Public source this meaning was verified against. Every code must carry one
   * so a technician can open the original rather than trusting the catalogue.
   */
  source: string;
  // --- Customer-facing "helper" fields (merged from eVehicleCustomerInfo) ---
  /** Plain-language "why this happens" for a rider. */
  why?: string;
  /** Symptoms a rider notices, used for the symptom search. */
  symptoms?: string[];
  /** How hard the fix is from a rider's point of view. */
  difficulty?: 'DIY' | 'Easy' | 'Intermediate' | 'Workshop only';
  /** Typical UK workshop cost to diagnose + fix, as [low, high] GBP. */
  costRange?: [number, number];
  /** Typical UK DIY parts-only cost, as [low, high] GBP. */
  diyCost?: [number, number];
  /** Keys into PART_CATALOG for the compatible replacement parts. */
  partKeys?: string[];
}

export interface EVehicleModelsSet {
  /** Brand name as shown in the picker (matches bikeBrands profiles where possible). */
  brand: string;
  /** All known model families for the picker. */
  models: string[];
}

export interface EVehicleBrandEntry extends EVehicleModelsSet {
  category: EVehicleCategory;
}

/** The code families (controller firmware versions) that each brand/model reports. */
export type EVehicleErrorFamily =
  | 'generic'
  | 'xiaomi'
  | 'ninebot'
  | 'pure'
  | 'apollo'
  | 'dualtron'
  | 'talaria'
  | 'bosch'
  | 'shimano'
  | 'bafang'
  | 'generic_bike'
  | 'vsett'
  | 'kaabo'
  | 'radpower'
  | 'brose'
  | 'kugoo'
  | 'ienyrid'
  | 'gotrax'
  | 'hiboy'
  | 'niu';

/**
 * Reference library. Every code's `source` field points at one of these, so the
 * UI can link straight to the public documentation the meaning came from.
 * Verified 2026-10-07.
 */
export const EVEHICLE_SOURCES: Record<string, string> = {
  xiaomi: 'https://electrazoomscooters.com/blogs/news/xiaomi-m365-and-m365-pro-electric-scooter-error-codes-explained',
  xiaomiAlt: 'https://www.electricscooterslondon.com/blogs/e-bike-e-scooter-care-maintenance-and-repair-tips/xiaomi-m365-and-m365-pro-electric-scooter-error-codes',
  ninebot: 'https://escooterhut.co.uk/blogs/ride-read/ninebot-max-g30-error-codes',
  ninebotWiki: 'https://wiki.scooterhacking.org/doku.php?id=nberrorcodes',
  segwayFleet: 'https://fleets.levyelectric.com/help/troubleshooting/segway-max-error-codes',
  dualtron: 'https://riderguide.com/guides/ey3-lcd-throttle',
  apollo: 'https://www.troubleatlas.com/emobility/e-scooters/apollo',
  pure: 'https://www.iscooterglobal.co.uk/blogs/news/electric-scooter-error-codes-list',
  bosch: 'https://upway.co/blogs/news/bosch-electric-bike-error-codes-complete-list',
  boschMagazine: 'https://www.bike-magazin.de/en/components/e-bike-motors/bosch-performance-line-cx-gen5-the-most-important-error-codes-and-their-causes',
  shimano: 'https://www.emtbforums.com/threads/shimano-ebike-motors-error-and-warning-codes-with-solutions.39610',
  bafang: 'https://fasterbikes.eu/en/info-help/bafang-error-codes',
  generic: 'https://promechbc.com/blogs/blog/electric-scooter-error-codes-explained',
  genericBike: 'https://www.dincalculator.com/bike/ebike-error-codes',
  vsett: 'https://riderguide.com/guides/qs-s4-lcd-throttle',
  kaabo: 'https://electrickicks.gorgias.help/en-US/kaabo-mantis-10-%E2%80%93-lt01-display-error-code-troubleshooting-6227202',
  radpower: 'https://upway.co/blogs/news/rad-power-bikes-error-codes-list',
  brose: 'https://upway.co/blogs/news/serial-1-electric-bike-error-codes',
  kugoo: 'https://www.iscooterglobal.co.uk/blogs/news/electric-scooter-error-codes-list',
  ienyrid: 'https://ienyrid.com/blogs/how-to/ienyrid-m4-pro-s-2024-new-version-technical-assistance-two-colors-orange-and-gold',
  gotrax: 'https://estarbikes.com/electric-scooter-error-codes/gotrax-scooter-error-codes',
  hiboy: 'https://estarbikes.com/electric-scooter-error-codes/hiboy-scooter-error-codes',
  niu: 'https://estarbikes.com/electric-scooter-error-codes/niu-scooter-error-codes',
};


export interface EVehicleModelErrors {
  category: EVehicleCategory;
  brand: string;
  model: string;
  family: EVehicleErrorFamily;
}

export const EVEHICLE_CATEGORIES: { id: EVehicleCategory; label: string; icon: string }[] = [
  { id: 'electric_scooter', label: 'E-Scooter', icon: 'Zap' },
  { id: 'ebike', label: 'E-Bike', icon: 'Bike' },
];

/** Pickers: category → the brands the workshop sees most. */
export const EVEHICLE_BRANDS: EVehicleBrandEntry[] = [
  // --- E-Scooters ---------------------------------------------------------
  { category: 'electric_scooter', brand: 'Segway / Ninebot', models: ['KickScooter ES1', 'KickScooter ES2', 'KickScooter ES4', 'KickScooter E22', 'Max G30', 'Max G30LP', 'Max G65', 'Other Ninebot Model'] },
  { category: 'electric_scooter', brand: 'Xiaomi', models: ['M365', 'M365 Pro', 'Mi Electric Scooter 3', 'Pro 2', '1S', 'Essential', 'Pro 4', 'Other Xiaomi Model'] },
  { category: 'electric_scooter', brand: 'Pure Electric', models: ['Air', 'Air Pro', 'Advance', 'Advance+', 'Other Pure Model'] },
  { category: 'electric_scooter', brand: 'Apollo', models: ['Phantom', 'Ghost', 'City', 'Explore', 'Air', 'Other Apollo Model'] },
  { category: 'electric_scooter', brand: 'Dualtron', models: ['Ultra', 'Thunder', 'Victor', 'Eagle', 'Popular', 'Other Dualtron Model'] },
  { category: 'electric_scooter', brand: 'Kaabo', models: ['Wolf Warrior', 'Wolf King', 'Skywalker', 'Mantis', 'Other Kaabo Model'] },
  { category: 'electric_scooter', brand: 'Vsett', models: ['8', '9+', '10+', '11+', 'Other Vsett Model'] },
  { category: 'electric_scooter', brand: 'Zero', models: ['10X', '11X', 'Other Zero Model'] },
  { category: 'electric_scooter', brand: 'NAMI', models: ['Burn-e', 'Blast', 'Seas', 'Other NAMI Model'] },
  { category: 'electric_scooter', brand: 'Razor', models: ['E100', 'E300', 'E Prime', 'Other Razor Model'] },
  { category: 'electric_scooter', brand: 'GoTrax', models: ['G2', 'G3', 'GXL', 'Xr Elite', 'Other GoTrax Model'] },
  { category: 'electric_scooter', brand: 'iScooter', models: ['i9', 'i9 Pro', 'i10', 'Other iScooter Model'] },
  { category: 'electric_scooter', brand: 'Okai', models: ['EA10', 'ES10', 'ESA Pro', 'Other Okai Model'] },
  { category: 'electric_scooter', brand: 'Hiboy', models: ['S2', 'S2 Pro', 'X2', 'Other Hiboy Model'] },
  { category: 'electric_scooter', brand: 'InMotion', models: ['S1', 'S2', 'L9', 'Other InMotion Model'] },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', models: ['M4', 'M4 Pro', 'G2 Pro', 'G3', 'G-Booster', 'S1', 'Other Kugoo Model'] },
  { category: 'electric_scooter', brand: 'iENYRID', models: ['M4', 'M4 Pro', 'M4 Pro S+', 'M8', 'ES Series', 'Other iENYRID Model'] },
  { category: 'electric_scooter', brand: 'NIU', models: ['KQi1', 'KQi2', 'KQi3', 'KQi Air', 'Other NIU Model'] },
  { category: 'electric_scooter', brand: 'Budget / Other', models: ['Generic Controller', 'Other / Not Listed'] },
  // --- E-Bikes ------------------------------------------------------------
  { category: 'ebike', brand: 'Bosch', models: ['Active Line', 'Active Line Plus', 'Performance Line', 'Performance CX', 'Cargo Line', 'Speed (45 km/h)', 'Other Bosch System'] },
  { category: 'ebike', brand: 'Bosch Smart System', models: ['Performance Line CX Smart', 'Performance Line Smart', 'Active Line Smart', 'Other Smart System'] },
  { category: 'ebike', brand: 'Shimano', models: ['STEPS E6100', 'STEPS E7000', 'STEPS E8000', 'STEPS EP8', 'Other STEPS System'] },
  { category: 'ebike', brand: 'Bafang', models: ['BBS01', 'BBS02', 'BBSHD', 'M400', 'M500', 'M600', 'H600', 'Other Bafang System'] },
  { category: 'ebike', brand: 'Bosch Classic (pre-2022)', models: ['Performance CX (Nyon)', 'Performance (Intuvia)', 'Active Line (Kiox)', 'Other Classic System'] },
  { category: 'ebike', brand: 'Yamaha', models: ['PW-SE', 'PW-X', 'PW-i', 'PWseries TE', 'Other Yamaha System'] },
  { category: 'ebike', brand: 'Giant EnergyPak', models: ['SyncDrive Core', 'SyncDrive Sport', 'SyncDrive Pro', 'Other Giant System'] },
  { category: 'ebike', brand: 'Specialized', models: ['Turbo Vado', 'Turbo Como', 'Turbo Levo', 'Turbo SL', 'Other Turbo System'] },
  { category: 'ebike', brand: 'Cannondale', models: ['Tesoro Neo', 'Synapse Neo', 'Trail Neo', 'Other Cannondale System'] },
  { category: 'ebike', brand: 'Bosch / Generic Motors', models: ['250 W Hub', '500 W Hub', 'Other Hub Motor'] },
  { category: 'ebike', brand: 'Swytch', models: ['Swytch Kit (Conversions)', 'Other Swytch Kit'] },
  { category: 'ebike', brand: 'Rad Power Bikes', models: ['RadCity', 'RadCity Plus', 'RadRover', 'RadRunner', 'RadMission', 'RadWagon', 'Other Rad Model'] },
  { category: 'ebike', brand: 'Brose', models: ['Drive T', 'Drive S', 'Drive C', 'Drive Mag', 'Other Brose System'] },
  { category: 'ebike', brand: 'Budget / Other', models: ['Generic Controller', 'Other / Not Listed'] },
];

/**
 * Normalised code lookup. Callers may pass "E04", "e04", "04", "ER04" — the
 * match strips letters and leading zeros so the catalogue is robust to how the
 * rider (or the AI) wrote the code.
 */
export function normalizeErrorCode(raw: string): string {
  const digits = String(raw || '')
    .toUpperCase()
    .replace(/[^0-9]/g, '');
  const trimmed = digits.replace(/^0+/, '');
  return trimmed || digits;
}


const S = EVEHICLE_SOURCES;

const CODE_FAMILIES: Record<EVehicleErrorFamily, EVehicleErrorDefinition[]> = {
  // -------------------------------------------------------------------------
  // GENERIC MOTOR-CONTROLLER CODES — the E-number codes carried by the cheap,
  // widely-cloned Chinese controllers fitted to most budget e-scooters and
  // hub-motor e-bikes. Meanings vary by brand; this is the consensus table.
  // -------------------------------------------------------------------------
  generic: [
    { code: 'E1', title: 'Throttle / Accelerator Fault', severity: 'High', system: 'throttle', source: S.generic, description: 'The throttle signal is missing or out of range. Often the throttle connector, a pinched wire, or a stuck grip.', fix: ['Restart with the throttle untouched — confirm it springs back freely.', 'Check the 3-pin throttle connector under the handlebar.', 'Measure the throttle signal (about 0.8–4.2 V sweeping with the grip).', 'Replace the throttle if the signal does not sweep.'], parts: ['Throttle'] },
    { code: 'E2', title: 'Brake Lever / Brake Sensor Fault', severity: 'High', system: 'brake', source: S.generic, description: 'The brake cut-off is permanently on — a stuck lever, a failed switch, or a brake held during power-on.', fix: ['Confirm both levers return fully and the brake is not being held at startup.', 'Unplug each brake cut-off sensor in turn to isolate a stuck switch.', 'Check the lever return spring and cable.', 'Replace the faulty lever switch.'], parts: ['Brake lever switch'] },
    { code: 'E3', title: 'Motor Phase / Motor Connection Fault', severity: 'High', system: 'motor', source: S.generic, description: 'The controller cannot drive the motor — a damaged phase wire, a loose motor connector, or a failed hall sensor.', fix: ['Check the motor cable is fully seated and undamaged.', 'Inspect the phase and hall connectors for corrosion or bent pins.', 'Test each phase for continuity and shorts to ground.', 'Replace the motor harness, then the motor if the windings are burnt.'], parts: ['Motor harness'] },
    { code: 'E4', title: 'Battery Voltage / Undervoltage Protection', severity: 'High', system: 'bms', source: S.generic, description: 'The pack is below the controller cut-off, or the BMS has tripped on low voltage.', fix: ['Charge the pack and confirm the charger LED turns red.', 'Measure the pack voltage at the charge port.', 'Test each cell group — a single dead group must not be re-balanced.', 'Replace the pack if a group is below minimum.'], parts: ['Battery pack'] },
    { code: 'E5', title: 'Controller Fault / Overheating', severity: 'High', system: 'controller', source: S.generic, description: 'The controller has overheated or an internal fault was detected — usually riding hard, or a failing MOSFET.', fix: ['Let the controller cool for 30–60 minutes.', 'Check the controller heatsink and thermal pad.', 'Check for a binding wheel or brake that overloads the controller.', 'Replace the controller if the fault returns.'], parts: ['Controller'] },
    { code: 'E6', title: 'Display / Controller Communication Fault', severity: 'Medium', system: 'display', source: S.generic, description: 'The panel and controller have lost their serial link — a loose display cable, water in the display, or bent pins.', fix: ['Power-cycle the scooter.', 'Reseat the display cable and check the handlebar harness.', 'Look for corrosion or bent pins in the connector.', 'Replace the display, then the controller, in that order.'], parts: ['Display harness'] },
    { code: 'E7', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', source: S.generic, description: 'A hall sensor inside the motor is not reporting — a disconnected hall wire, a broken sensor, or a failed controller.', fix: ['Check the motor hall connector for corrosion or bent pins.', 'Test the hall sensors with 5 V applied (they should toggle).', 'Replace the hall sensor board or the motor harness.', 'Replace the motor if the sensor board cannot be renewed.'], parts: ['Hall sensor board', 'Motor harness'] },
    { code: 'E8', title: 'Throttle Signal Abnormal', severity: 'High', system: 'throttle', source: S.generic, description: 'The throttle sends an out-of-range signal at rest — a damaged hall sensor or a bad connector.', fix: ['Check the throttle connector and cable.', 'Confirm the throttle returns to zero.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E9', title: 'Brake Failure', severity: 'High', system: 'brake', source: S.generic, description: 'The controller reports a brake fault — a lever switch or the brake wiring.', fix: ['Check both brake switches and wiring.', 'Confirm the levers return and the motor cut-off operates.', 'Replace the faulty switch or harness.'], parts: ['Brake lever switch'] },
    { code: 'E10', title: 'Communication Error (Display ↔ Controller)', severity: 'Medium', system: 'display', source: S.generic, description: 'The display cannot talk to the controller. On almost every platform this is the stem/handlebar cable.', fix: ['Check the cable between the display and controller for a loose or crushed wire.', 'Reseat the connector at both ends.', 'Replace the harness if the fault is intermittent.'], parts: ['Harness'] },
  ],

  // -------------------------------------------------------------------------
  // GENERIC E-BIKE (HUB-MOTOR CONVERSION) CODES — the six-code table used by
  // the cheap brushless controllers in most conversion kits. Worded for a
  // bicycle, which is what the generic scooter list is wrong for.
  // -------------------------------------------------------------------------
  generic_bike: [
    { code: 'E1', title: 'Throttle Fault', severity: 'High', system: 'throttle', source: S.genericBike, description: 'Throttle signal missing or out of range. Applies to the kit throttle, not the pedal sensor.', fix: ['Check the throttle connector and cable for damage.', 'Confirm the throttle returns to zero at rest.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E2', title: 'Brake Cut-Off Fault', severity: 'High', system: 'brake', source: S.genericBike, description: 'A brake sensor is stuck on, so the controller will not drive the motor.', fix: ['Check both brake sensor switches.', 'Confirm the levers return fully.', 'Replace the faulty sensor.'], parts: ['Brake sensor'] },
    { code: 'E3', title: 'Motor Hall / Phase Fault', severity: 'High', system: 'motor', source: S.genericBike, description: 'Motor hall sensor or phase wiring fault — the motor will judder or refuse to run.', fix: ['Check the motor cable and connectors.', 'Test the hall sensors.', 'Replace the hall board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E4', title: 'Battery Undervoltage', severity: 'High', system: 'bms', source: S.genericBike, description: 'The pack is below the controller cut-off voltage.', fix: ['Charge the pack.', 'Test the pack and BMS if it will not charge.', 'Replace the pack if a cell group is dead.'], parts: ['Battery pack'] },
    { code: 'E5', title: 'Controller Fault / Overcurrent', severity: 'High', system: 'controller', source: S.genericBike, description: 'The controller detected an overcurrent or internal fault — a stalled motor or a shorted MOSFET.', fix: ['Check the wheel spins freely.', 'Check the phase wires for shorts.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E6', title: 'Display / Controller Communication Fault', severity: 'Medium', system: 'display', source: S.genericBike, description: 'The display has lost its serial link to the controller.', fix: ['Reseat the display cable.', 'Check the harness for damage.', 'Replace the display then the controller.'], parts: ['Display harness'] },
  ],

  // -------------------------------------------------------------------------
  // XIAOMI (M365 / Pro / 1S / Pro 2 / Essential) — dashboard "E" codes / beeps.
  // -------------------------------------------------------------------------
  xiaomi: [
    { code: 'E10', title: 'Dashboard / Controller Communication Error', severity: 'Medium', system: 'display', source: S.xiaomi, description: 'The dashboard (or its Bluetooth module) cannot talk to the controller. Usually the connection cable between the motherboard and the display.', fix: ['Power-cycle the scooter once.', 'Inspect the display/stem cable and connector for looseness or crushing.', 'Check for water ingress or corrosion in the connector.', 'Replace the dashboard cable, then the dashboard, then the controller.'], parts: ['Display harness'] },
    { code: 'E11', title: 'Motor Phase A Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'The controller read an abnormal current in motor phase A. Most often moisture ingress into the controller or the phase connection.', fix: ['Power down and let the deck dry if water is suspected.', 'Check the phase A wire and its connector.', 'A persistent controller current fault needs board-level testing.', 'Replace the controller if the fault repeats.'], parts: ['Controller'] },
    { code: 'E12', title: 'Motor Phase B Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'Abnormal current in motor phase B. Same moisture/corrosion root as E11.', fix: ['Check the phase B wire and connector for corrosion.', 'Dry the controller if water is present.', 'Replace the controller if the fault persists.'], parts: ['Controller'] },
    { code: 'E13', title: 'Motor Phase C Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'Abnormal current in motor phase C. Usually corrosion from moisture ingress.', fix: ['Check the phase C wire and connector.', 'Dry the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E14', title: 'Throttle / Accelerator Fault', severity: 'High', system: 'throttle', source: S.xiaomi, description: 'The throttle or its cable to the controller is faulty. The accelerator contains fragile magnets that break if the scooter is dropped.', fix: ['Check the throttle, display and the cable between them.', 'Confirm the throttle returns to zero.', 'Replace the throttle if the sensor is faulty.'], parts: ['Throttle'] },
    { code: 'E15', title: 'Brake Lever Sensor Fault', severity: 'High', system: 'brake', source: S.xiaomi, description: 'The brake lever (or its cable) is faulty, or the lever was held during power-on. The lever contains brittle magnets that break in a fall.', fix: ['Check the brake lever, display and cable between them.', 'Confirm the lever returns fully and is not held at startup.', 'Replace the brake lever sensor if faulty.'], parts: ['Brake lever switch'] },
    { code: 'E16', title: 'Internal Battery MOS Change Abnormal', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The internal battery reports an abnormal charge/discharge MOS (its protection switching) — an internal battery-electronics fault.', fix: ['Restart once and re-check.', 'Check the internal battery connector.', 'Replace the internal battery if the fault persists.'], parts: ['Battery pack'] },
    { code: 'E17', title: 'External Battery MOS Change Abnormal', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The external (second) battery reports an abnormal charge/discharge MOS — an external battery-electronics fault.', fix: ['Check the external battery connector and harness.', 'Replace the external battery if the fault persists.'], parts: ['Battery pack'] },
    { code: 'E18', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'The controller receives an abnormal signal from the position sensors inside the motor. Do not ride if the motor judders.', fix: ['Inspect the external motor cable near the wheel for damage.', 'Check the motor connector contacts.', 'Replace the hall sensor board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E19', title: 'Internal Battery Voltage Abnormal', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal battery voltage is outside the expected range — a deeply discharged or failing pack, or a loose connector.', fix: ['Charge the pack and watch the charger LED.', 'Check the internal battery connector.', 'Test with a known-good battery if it will not charge.'], parts: ['Battery pack'] },
    { code: 'E20', title: 'External Battery Voltage Abnormal', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The voltage of the external (second) battery is out of range.', fix: ['Charge the external battery.', 'Check its connector and harness.', 'Replace the external battery if faulty.'], parts: [] },
    { code: 'E21', title: 'BMS Communication Fault', severity: 'High', system: 'bms', source: S.xiaomi, description: 'The controller cannot read the battery management system over its data line.', fix: ['Restart once.', 'Re-seat the battery connector under the deck.', 'Check the BMS data line and pack voltage at the charge port.', 'Replace the BMS if the pack is otherwise healthy.'], parts: ['BMS'] },
    { code: 'E22', title: 'BMS Authentication / Password Error', severity: 'High', system: 'bms', source: S.xiaomi, description: 'Bad BMS serial number or password — the battery has not authenticated with the controller (common after a battery swap).', fix: ['Confirm the battery is the correct genuine part for the model.', 'The BMS serial/password may need reprogramming.', 'Replace with a correctly provisioned pack.'], parts: ['Battery pack'] },
    { code: 'E23', title: 'BMS Serial Number / Abnormal Battery', severity: 'High', system: 'bms', source: S.xiaomi, description: 'The BMS reports a default or abnormal serial number / internal fault.', fix: ['Restart once.', 'Check the battery connector.', 'Replace the pack if the fault persists.'], parts: ['Battery pack'] },
    { code: 'E24', title: 'Supply Voltage Out of Range', severity: 'High', system: 'controller', source: S.ninebotWiki, description: 'The system supply voltage is outside the expected range — a battery, charging or controller-reading fault (not a motor short).', fix: ['Check the charger is the correct voltage for the pack.', 'Measure the pack voltage at the charge port.', 'Check the controller supply connections.', 'Replace the controller if the reading stays wrong with a known-good pack.'], parts: ['Controller', 'Battery pack'] },
    { code: 'E25', title: 'Communication Failure During Firmware Update', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'Communication failed while updating the controller firmware — the controller may be left half-flashed.', fix: ['Hard-reset the scooter (power off, then on).', 'Re-run the firmware update.', 'Re-flash the controller with ST-Link if it will not boot.'], parts: ['Controller'] },
    { code: 'E26', title: 'Controller Flash / Memory Fault', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The controller failed to save data to its flash memory.', fix: ['Power-cycle for 10 minutes.', 'Re-flash the controller firmware if supported.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E27', title: 'Controller Authentication / Password Error', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The controller has a bad password / activation or serial-number read error (seen after a controller swap).', fix: ['Confirm the controller is correct for the model.', 'Re-provision / activate the controller.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E28', title: 'MOSFET Fault (High Side)', severity: 'High', system: 'controller', source: S.xiaomi, description: 'A power MOSFET in the controller is in an invalid state — a blown output transistor.', fix: ['Inspect the controller for burnt FETs.', 'Check the phase wires for shorts that killed the FET.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E29', title: 'MOSFET Fault (Low Side)', severity: 'High', system: 'controller', source: S.xiaomi, description: 'A MOSFET is stuck in an invalid low state — a defective output transistor.', fix: ['Check the phase wiring for shorts.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E31', title: 'Controller Program / Firmware Error', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'Program/firmware execution error in the controller.', fix: ['Restart once.', 'Re-flash the official firmware.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E35', title: 'Scooter Serial Number Fault', severity: 'Medium', system: 'display', source: S.xiaomi, description: 'The scooter serial number is missing or incorrect — usually after a dashboard or controller replacement. It needs reprogramming.', fix: ['Record which parts were replaced.', 'Re-program the serial number with the correct model-specific tool/app.', 'Confirm the dashboard and controller serials match.', 'Replace the unit only if it cannot be reprogrammed.'], parts: [] },
    { code: 'E36', title: '2+4 Connector / External Battery Charge-Wire Fault', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The 2+4 connector between the battery and controller has failed, or the external battery charging wire is broken.', fix: ['Inspect the 2+4 battery/controller connector for damage or poor seating.', 'Check the external battery charging wire.', 'Replace the damaged harness or connector.'], parts: ['Harness'] },
    { code: 'E37', title: 'Charging Base / Charge-Wire Fault', severity: 'Medium', system: 'charging', source: S.ninebotWiki, description: 'The charging base failed, or the built-in battery charging wire is broken — inspect the wiring before replacing expensive parts.', fix: ['Check the charger and its cable.', 'Check the charge port and the battery charge wire.', 'Replace the charger or harness if faulty.'], parts: ['Charger'] },
    { code: 'E38', title: 'Charging Overcurrent', severity: 'Medium', system: 'charging', source: S.ninebotWiki, description: 'The charge current is above the safe limit — usually the wrong charger or power supply.', fix: ['Confirm the correct charger is used for the model.', 'Check the charger output voltage.', 'Replace a faulty or incorrect charger.'], parts: ['Charger'] },
    { code: 'E39', title: 'Battery Overheat / Temperature Sensor Fault', severity: 'Medium', system: 'bms', source: S.xiaomi, description: 'The internal battery is overheating or its temperature sensor is faulty.', fix: ['Power off and let the pack return to room temperature naturally.', 'Do not apply direct heat or charge a hot pack.', 'Replace the pack if the sensor is faulty.'], parts: ['Battery pack'] },
    { code: 'E40', title: 'Controller (ESC) Overheat / Temperature Sensor Fault', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The controller is overheating or its temperature sensor is faulty.', fix: ['Let the controller cool.', 'Check the heatsink / thermal pad.', 'Replace the controller if the sensor is faulty.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // NINEBOT / SEGWAY (ES1–ES4, E22, Max G30/G65) — dashboard numeric codes.
  // -------------------------------------------------------------------------
  ninebot: [
    { code: 'E10', title: 'Dashboard / Controller Communication Error', severity: 'Medium', system: 'display', source: S.ninebotWiki, description: 'The dashboard cannot communicate with the controller (ESC). Most often a loose wiring connection inside the stem; the controller can also be soft-bricked.', fix: ['Power-cycle and retry.', 'Check the wiring inside the stem for a loose or damaged connection.', 'Check the dashboard connector for corrosion.', 'Replace the dashboard, then the controller, if needed.'], parts: ['Display harness'] },
    { code: 'E11', title: 'Motor Phase A Current Out of Range', severity: 'High', system: 'motor', source: S.ninebotWiki, description: 'Abnormal current sampling in motor phase A. Persisting 11/12/13 usually means internal controller damage.', fix: ['Inspect the phase A wiring for frays, pinches or loose connectors.', 'Check for a shorted MOSFET.', 'Replace the controller if the fault persists.'], parts: ['Controller'] },
    { code: 'E12', title: 'Motor Phase B Current Out of Range', severity: 'High', system: 'motor', source: S.ninebotWiki, description: 'Abnormal current sampling in motor phase B. Same root as E11.', fix: ['Inspect the phase B wiring.', 'Check the controller for damage.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E13', title: 'Motor Phase C Current Out of Range', severity: 'High', system: 'motor', source: S.ninebotWiki, description: 'Abnormal current sampling in motor phase C. Same root as E11.', fix: ['Inspect the phase C wiring.', 'Check the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E14', title: 'Throttle Handle Position Out of Range', severity: 'High', system: 'throttle', source: S.ninebotWiki, description: 'The throttle is stuck, faulty or disconnected, so its signal is outside the valid range.', fix: ['Confirm the throttle moves freely and returns to zero.', 'Inspect the throttle cable, especially in the stem.', 'Replace the throttle if the sensor is faulty.'], parts: ['Throttle'] },
    { code: 'E15', title: 'Brake Handle Position Out of Range', severity: 'High', system: 'brake', source: S.ninebotWiki, description: 'The brake lever sensor reads abnormal or the lever was held during power-on.', fix: ['Release the brake fully and check it returns.', 'Inspect the brake handle magnets, wiring and connector.', 'Replace the lever sensor if it persists.'], parts: ['Brake lever switch'] },
    { code: 'E16', title: 'Internal Battery MOS Change Abnormal', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The internal battery reports an abnormal charge/discharge MOS (protection switching) — an internal battery-electronics fault.', fix: ['Restart once.', 'Check the internal battery connector.', 'Replace the internal battery if it persists.'], parts: ['Battery pack'] },
    { code: 'E17', title: 'External Battery MOS Change Abnormal', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The external (second) battery reports an abnormal charge/discharge MOS — an external battery-electronics fault.', fix: ['Check the external battery connector and harness.', 'Replace the external battery if it persists.'], parts: ['Battery pack'] },
    { code: 'E18', title: 'Motor Hall Sensors Stuck (0/1)', severity: 'High', system: 'motor', source: S.ninebotWiki, description: 'The motor Hall sensors are stuck at a fixed state. Inspect the 2×4 connector between the controller and the motor before replacing parts.', fix: ['Inspect the 2×4 motor/controller connector under the deck.', 'Test the Hall sensors.', 'Replace the Hall board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E19', title: 'Internal Battery Voltage Out of Range', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal battery voltage is below the expected range — a deeply discharged or failing pack.', fix: ['Charge the pack and watch the charger LED.', 'Check the battery connections.', 'Test with a known-good battery if it will not charge.'], parts: ['Battery pack'] },
    { code: 'E20', title: 'External Battery Voltage Out of Range', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The voltage of the external (second) battery is out of range.', fix: ['Charge the external battery.', 'Check its connector and harness.', 'Replace the external battery if faulty.'], parts: [] },
    { code: 'E21', title: 'No Communication with Internal BMS', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The controller cannot communicate with the internal battery management system — check the data connector first.', fix: ['Re-seat the battery communication connector.', 'Check the wiring and controller connections first.', 'Test with known-good battery/controller hardware.'], parts: ['BMS'] },
    { code: 'E22', title: 'Internal BMS Config Invalid', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal BMS configuration is invalid — a provisioning/serial mismatch, often after a battery swap.', fix: ['Confirm the battery is the correct genuine part.', 'Re-provision the battery serial.', 'Replace the pack if it cannot be provisioned.'], parts: ['Battery pack'] },
    { code: 'E23', title: 'Internal BMS Not Activated (Default S/N)', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal BMS has not been activated and still holds its default serial number.', fix: ['Re-seat the battery communication connector.', 'Re-provision/activate the BMS serial.', 'Replace the BMS if it cannot be activated.'], parts: ['BMS'] },
    { code: 'E24', title: 'Supply Voltage Out of Range', severity: 'High', system: 'controller', source: S.ninebotWiki, description: 'System supply-voltage detection is out of range — a battery, charging or controller-reading fault.', fix: ['Check the charger and pack voltage.', 'Verify the pack is the correct voltage for the model.', 'Use Segway tooling before replacing hardware.'], parts: ['Controller'] },
    { code: 'E25', title: 'Communication Failure During Firmware Update', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'Communication failed while updating the controller firmware — the controller may be left half-flashed.', fix: ['Hard-reset the scooter (power off, then on).', 'Re-run the firmware update.', 'Re-flash the controller with ST-Link if it will not boot.'], parts: ['Controller'] },
    { code: 'E26', title: 'Flash Save Error', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'The controller could not save to its flash memory. Reset and re-flash come before replacement.', fix: ['Factory-reset via the app.', 'Re-flash the controller firmware (ST-Link if needed).', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E27', title: 'ESC Config Invalid (CPUID Mismatch)', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'The controller configuration is invalid — the stored CPUID does not match the actual MCU (often after a board swap).', fix: ['Change/re-provision the serial number (BLE/UART).', 'Re-flash the controller firmware.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E28', title: 'Motor Driver MOS Up-Bridge Short Circuit', severity: 'High', system: 'controller', source: S.ninebotWiki, description: 'A motor-driver MOSFET on the high side is short-circuited — a defective output transistor.', fix: ['Check the motor and phase wiring for a short.', 'Inspect the controller for burnt FETs.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E29', title: 'Motor Driver MOS Down-Bridge Short Circuit', severity: 'High', system: 'controller', source: S.ninebotWiki, description: 'A motor-driver MOSFET on the low side is short-circuited — a defective output transistor.', fix: ['Check the phase wiring for shorts.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E31', title: 'Program Skip Error', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'The controller program/firmware execution skipped — a firmware fault.', fix: ['Restart and check for a firmware update.', 'Re-flash the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E32', title: 'No Communication with IoT Device', severity: 'Medium', system: 'display', source: S.ninebotWiki, description: 'The controller has lost communication with the IoT/telematics module (seen on rental/fleet scooters).', fix: ['Inspect the IoT module and its connector.', 'Check the harness to the IoT device.', 'Replace the IoT module if faulty.'], parts: [] },
    { code: 'E35', title: 'ESC Not Activated (Default Serial Number)', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'The controller has not been activated and still holds its default serial number — usually after a controller or dashboard replacement.', fix: ['Record which parts were replaced.', 'Re-program/activate the controller serial with the correct tool.', 'Confirm the serials match.'], parts: [] },
    { code: 'E36', title: '2+4 Connector / External Battery Charge-Wire Fault', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The 2+4 connector between the battery and controller failed, or the external battery charging wire is broken.', fix: ['Inspect the 2+4 battery/controller connector.', 'Check the external battery charging wire.', 'Replace the damaged harness or connector.'], parts: ['Harness'] },
    { code: 'E37', title: 'Charging Base / Charge-Wire Fault', severity: 'Medium', system: 'charging', source: S.ninebotWiki, description: 'The charging base failed, or the built-in battery charging wire is broken — inspect the wiring before replacing expensive parts.', fix: ['Check the charger and its cable.', 'Check the charge port and the battery charge wire.', 'Replace the charger or harness if faulty.'], parts: ['Charger'] },
    { code: 'E38', title: 'Charging Overcurrent', severity: 'Medium', system: 'charging', source: S.ninebotWiki, description: 'The charge current is above the safe limit — usually the wrong charger or power supply.', fix: ['Confirm the correct charger is used for the model.', 'Check the charger output voltage.', 'Replace a faulty or incorrect charger.'], parts: ['Charger'] },
    { code: 'E39', title: 'Internal Battery Overheat', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal battery is overheating, or its temperature sensor is abnormal.', fix: ['Let the pack cool naturally.', 'Inspect the battery sensor wiring.', 'Replace the pack if the sensor is faulty.'], parts: ['Battery pack'] },
    { code: 'E40', title: 'ESC Overheat', severity: 'Medium', system: 'controller', source: S.ninebotWiki, description: 'The controller is overheating — check the temperature sensors and let it cool.', fix: ['Cool the controller.', 'Check the thermal pad / heatsink.', 'Replace the controller if the sensor is faulty.'], parts: ['Controller'] },
    { code: 'E41', title: 'External Battery Overheat', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The external (second) battery is overheating.', fix: ['Let the external battery cool.', 'Check its connections.', 'Replace the external battery if it overheats without load.'], parts: ['Battery pack'] },
    { code: 'E42', title: 'No Communication with External BMS', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The controller cannot communicate with the external battery BMS.', fix: ['Inspect the external battery connectors.', 'Tighten the external battery mounting screws.', 'Replace the external BMS or battery if it persists.'], parts: ['BMS'] },
    { code: 'E43', title: 'External BMS Config Invalid', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The external BMS configuration is invalid — a provisioning/serial mismatch.', fix: ['Re-provision the external BMS serial.', 'Replace the external BMS or battery if it cannot be fixed.'], parts: ['BMS'] },
    { code: 'E44', title: 'External BMS Not Activated (Default S/N)', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The external BMS has not been activated and still holds its default serial number.', fix: ['Re-provision/activate the external BMS serial.', 'Replace the external BMS or battery if it cannot be activated.'], parts: ['BMS'] },
    { code: 'E45', title: 'Internal BMS Deep Cell Discharge', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'A cell group in the internal battery has discharged below the safe minimum — the pack is deeply discharged or aged.', fix: ['Attempt a full charge with the correct charger.', 'Test each cell group.', 'Replace the pack if a group will not recover.'], parts: ['Battery pack'] },
    { code: 'E46', title: 'External BMS Deep Cell Discharge', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'A cell group in the external battery has discharged below the safe minimum.', fix: ['Attempt a full charge of the external battery.', 'Test each cell group.', 'Replace the external battery if a group will not recover.'], parts: ['Battery pack'] },
    { code: 'E47', title: 'Internal Battery Protection Board Damaged', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The internal battery protection board (BMS) is damaged.', fix: ['Replace the internal battery or its BMS.'], parts: ['BMS'] },
    { code: 'E48', title: 'External Battery Protection Board Damaged', severity: 'High', system: 'bms', source: S.ninebotWiki, description: 'The external battery protection board (BMS) is damaged.', fix: ['Replace the external battery or its BMS.'], parts: ['BMS'] },
    { code: 'E49', title: 'Internal BMS Firmware Version Mismatch', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The internal BMS firmware version does not match the system.', fix: ['Update the internal BMS firmware version.', 'Use Segway tooling to re-flash.'], parts: ['BMS'] },
    { code: 'E50', title: 'External BMS Firmware Version Mismatch', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The external BMS firmware version does not match the system.', fix: ['Update the external BMS firmware version.', 'Use Segway tooling to re-flash.'], parts: ['BMS'] },
    { code: 'E51', title: 'BLE Firmware Incompatible with DRV', severity: 'Medium', system: 'display', source: S.ninebotWiki, description: 'The Bluetooth (BLE) firmware is incompatible with the controller (DRV) firmware.', fix: ['Re-flash the BLE or the DRV firmware to matching versions.'], parts: [] },
    { code: 'E52', title: 'BMS Firmware Incompatible with DRV', severity: 'Medium', system: 'bms', source: S.ninebotWiki, description: 'The BMS firmware is incompatible with the controller (DRV) firmware.', fix: ['Update the BMS firmware version to match the controller.'], parts: ['BMS'] },
    { code: 'E54', title: 'Motor Phase Error', severity: 'High', system: 'motor', source: S.ninebotWiki, description: 'A motor phase fault is detected (retail) — check the motor-related wiring.', fix: ['Check the motor phase wiring and connectors.', 'On dual motors, isolate the faulty motor.', 'Replace the phase harness or motor.'], parts: ['Motor harness'] },
  ],

  // -------------------------------------------------------------------------
  // PURE ELECTRIC (Air / Air Pro / Advance) — E codes on the OLED dash.
  // -------------------------------------------------------------------------
  pure: [
    { code: 'E01', title: 'Low Battery Voltage', severity: 'Medium', system: 'bms', source: S.pure, description: 'The pack is below the safe riding voltage.', fix: ['Charge the scooter.', 'Test the pack if it will not charge.'], parts: [] },
    { code: 'E02', title: 'Motor Failure', severity: 'High', system: 'motor', source: S.pure, description: 'The motor or its connection has failed.', fix: ['Check the motor cable and connectors.', 'Test the phase wiring.', 'Replace the motor if the windings are burnt.'], parts: ['Motor'] },
    { code: 'E03', title: 'Controller Issue', severity: 'High', system: 'controller', source: S.pure, description: 'Controller fault or internal error.', fix: ['Check the controller connectors.', 'Re-flash if supported.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E04', title: 'Throttle or Brake Error', severity: 'High', system: 'throttle', source: S.pure, description: 'A throttle or brake signal fault.', fix: ['Check the throttle and brake connections.', 'Confirm the lever returns and the throttle is free.', 'Replace the faulty part.'], parts: ['Throttle', 'Brake lever switch'] },
    { code: 'E07', title: 'Overheating', severity: 'Medium', system: 'controller', source: S.pure, description: 'The motor or controller is overheating.', fix: ['Allow to cool down.', 'Reduce sustained load or hills.', 'Check for bearing drag.'], parts: [] },
  ],

  // -------------------------------------------------------------------------
  // APOLLO (Phantom / Ghost / City) — E codes.
  // -------------------------------------------------------------------------
  apollo: [
    { code: 'E1', title: 'Controller Communication Error', severity: 'High', system: 'controller', source: S.apollo, description: 'Communication fault between the controller and the rest of the system.', fix: ['Re-seat all controller connectors.', 'Check the display cable.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E2', title: 'Brake Sensor Error', severity: 'High', system: 'brake', source: S.apollo, description: 'The brake lever sensor is reading a fault (often held at startup).', fix: ['Confirm the brake returns fully.', 'Check the brake sensor wiring.', 'Replace the lever sensor.'], parts: ['Brake lever switch'] },
    { code: 'E3', title: 'Motor Communication Error', severity: 'High', system: 'motor', source: S.apollo, description: 'The controller has lost communication with the motor.', fix: ['Check the motor cable and connectors.', 'Test the Hall sensors.', 'Replace the motor harness.'], parts: ['Motor harness'] },
    { code: 'E4', title: 'Throttle Signal Error', severity: 'High', system: 'throttle', source: S.apollo, description: 'The throttle signal is out of range.', fix: ['Check the throttle connector.', 'Confirm it returns to zero.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E5', title: 'Battery Communication Error', severity: 'High', system: 'bms', source: S.apollo, description: 'Communication lost between the controller and the battery BMS.', fix: ['Check the battery connector and data line.', 'Test the BMS.', 'Replace the BMS or pack.'], parts: ['BMS'] },
    { code: 'E6', title: 'Overcurrent Protection', severity: 'High', system: 'controller', source: S.apollo, description: 'The controller has tripped on overcurrent — a stall, a shorted phase or a binding motor.', fix: ['Check the wheel spins freely and the brake is not dragging.', 'Check the motor phase wires for a short.', 'Replace the controller if it trips without load.'], parts: ['Controller'] },
    { code: 'E7', title: 'Motor Hall Sensor Failure', severity: 'High', system: 'motor', source: S.apollo, description: 'A motor Hall sensor has failed — the motor will judder or refuse to start.', fix: ['Inspect the motor Hall connector and cable.', 'Test the Hall sensors.', 'Replace the Hall board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E8', title: 'Controller Overheating Protection', severity: 'Medium', system: 'controller', source: S.apollo, description: 'The controller has exceeded its temperature limit and is protecting itself.', fix: ['Let the controller cool.', 'Check the heatsink and thermal pad.', 'Reduce sustained load; replace the controller if it overheats without load.'], parts: [] },
  ],

  // -------------------------------------------------------------------------
  // DUALTRON / MINIMOTORS (EY3 / EY4 display) — small numeric fault codes.
  // -------------------------------------------------------------------------
  dualtron: [
    { code: 'E2', title: 'System Error', severity: 'High', system: 'controller', source: S.dualtron, description: 'A general system fault on the EY display.', fix: ['Power-cycle the scooter.', 'Check all main connectors.', 'Contact a service centre if it persists.'], parts: ['Controller'] },
    { code: 'E4', title: 'Motor / Hall Sensor Error', severity: 'High', system: 'motor', source: S.dualtron, description: 'A motor or Hall-sensor fault (also shown as code 2/4 on the EY3).', fix: ['Check the motor power connection.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E5', title: 'Throttle (Accelerator) Error', severity: 'High', system: 'throttle', source: S.dualtron, description: 'The accelerator/throttle is not communicating correctly.', fix: ['Check the EY throttle is properly connected to the controller.', 'Disconnect and reconnect the plug-and-play connector.', 'Wait for communication to establish on power-up.'], parts: ['Throttle'] },
    { code: 'E6', title: 'Controller Error', severity: 'High', system: 'controller', source: S.dualtron, description: 'A controller or controller-communication error.', fix: ['Check the throttle-to-controller connection.', 'Power-cycle and wait for the link.', 'Replace the controller if it persists.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // TALARIA (e-moto) — controller E codes.
  // -------------------------------------------------------------------------
  talaria: [
    { code: 'E01', title: 'Throttle Fault', severity: 'High', system: 'throttle', source: S.generic, description: 'Throttle out of range.', fix: ['Check the throttle connector.', 'Confirm it returns to zero.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E02', title: 'Brake Fault', severity: 'High', system: 'brake', source: S.generic, description: 'Brake switch fault.', fix: ['Check the brake switches.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'E03', title: 'Motor Hall Fault', severity: 'High', system: 'motor', source: S.generic, description: 'Hall sensor fault.', fix: ['Check the motor connector.', 'Test the hall board.', 'Replace the hall board / motor.'], parts: ['Hall sensor board'] },
    { code: 'E04', title: 'Controller Overheat', severity: 'Medium', system: 'controller', source: S.generic, description: 'Controller too hot.', fix: ['Cool the controller.', 'Check the fan/thermal pad.', 'Replace the controller if needed.'], parts: ['Controller'] },
    { code: 'E05', title: 'Controller Overcurrent', severity: 'High', system: 'controller', source: S.generic, description: 'Current spike.', fix: ['Check the motor phases.', 'Check for a stalled wheel.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E06', title: 'BMS Fault', severity: 'High', system: 'bms', source: S.generic, description: 'BMS communication fault.', fix: ['Check the battery harness.', 'Replace the BMS.'], parts: ['BMS'] },
    { code: 'E07', title: 'Low Voltage Lockout', severity: 'Medium', system: 'bms', source: S.generic, description: 'Pack undervoltage.', fix: ['Charge the pack.', 'Check the charge fuse.'], parts: [] },
  ],

  // -------------------------------------------------------------------------
  // BOSCH (Active/Performance/CX, Smart System) — numeric codes on Kiox/Intuvia.
  // -------------------------------------------------------------------------
  bosch: [
    { code: '410', title: 'Control / Display Button Stuck', severity: 'Low', system: 'display', source: S.bosch, description: 'One or more buttons on the display or control unit are being read as pressed continuously — dirt, moisture or wear.', fix: ['Clean the buttons with a dry cloth and let the unit dry.', 'Restart the system.', 'Replace the control unit if a button is mechanically stuck.'], parts: [] },
    { code: '414', title: 'Display / Operating Unit Connection Interrupted', severity: 'Medium', system: 'display', source: S.bosch, description: 'The connection between the operating unit and the rest of the system is interrupted.', fix: ['Check the operating-unit connectors and cable.', 'Reseat the cable and restart.', 'Have the connection checked by a dealer if it persists.'], parts: ['Display harness'] },
    { code: '418', title: 'Operating Unit Buttons Blocked', severity: 'Low', system: 'display', source: S.bosch, description: 'One or more buttons on the operating unit are blocked.', fix: ['Check for dirt or a jammed button.', 'Clean and dry the unit.', 'Replace the unit if the button is damaged.'], parts: [] },
    { code: '419', title: 'Configuration Error', severity: 'Medium', system: 'controller', source: S.bosch, description: 'A configuration error in the system.', fix: ['Restart the system.', 'Check for a firmware update.', 'Contact a Bosch dealer if it returns.'], parts: [] },
    { code: '422', title: 'Drive Unit Communication Error', severity: 'Medium', system: 'motor', source: S.bosch, description: 'The drive unit cannot communicate properly with the rest of the system.', fix: ['Check the drive-unit connectors and cables.', 'Restart the system.', 'Have it diagnosed by a dealer if it persists.'], parts: [] },
    { code: '423', title: 'Battery Communication Error', severity: 'Medium', system: 'bms', source: S.bosch, description: 'The battery is not communicating correctly — poor contact at the mount or an internal battery-electronics fault.', fix: ['Remove and re-seat the battery.', 'Clean the battery contacts and mount.', 'Have the battery checked by a dealer if it persists.'], parts: ['Battery pack'] },
    { code: '424', title: 'Component Communication Error', severity: 'Medium', system: 'controller', source: S.boschMagazine, description: 'A communication problem between system components (battery, motor, display or control unit).', fix: ['Check the connectors and cables.', 'Restart the system.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: '430', title: 'Display Internal Battery Empty', severity: 'Low', system: 'display', source: S.bosch, description: 'The onboard computer has an internal (coin-cell) battery that is empty.', fix: ['Charge the display / replace the internal cell.', 'Restart the system.'], parts: [] },
    { code: '431', title: 'Software Version Error', severity: 'Low', system: 'controller', source: S.boschMagazine, description: 'A software version mismatch in the system.', fix: ['Restart the system.', 'Check for and apply a firmware update.'], parts: [] },
    { code: '440', title: 'Internal Drive Unit Error', severity: 'High', system: 'motor', source: S.bosch, description: 'An internal electronic fault in the drive unit. Do not open the motor.', fix: ['Restart the system once.', 'Contact a Bosch-certified dealer.', 'Do not open the drive unit.'], parts: [] },
    { code: '450', title: 'Internal Software Error', severity: 'High', system: 'controller', source: S.bosch, description: 'Internal software fault in the drive system.', fix: ['Restart the system.', 'Contact a Bosch dealer for a firmware re-flash.'], parts: [] },
    { code: '460', title: 'USB Port Fault', severity: 'Low', system: 'display', source: S.boschMagazine, description: 'A fault with the USB port — a cable or device is causing it.', fix: ['Remove the USB cable and any connected device.', 'Restart the system.'], parts: [] },
    { code: '490', title: 'Internal HMI Error', severity: 'Medium', system: 'display', source: S.bosch, description: 'Internal error of the HMI (display/control).', fix: ['Check the HMI connections.', 'Restart the system.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: '500', title: 'Internal Motor Fault', severity: 'High', system: 'motor', source: S.bosch, description: 'An internal fault in the drive unit. Do not open the motor.', fix: ['Restart the system.', 'Contact a Bosch dealer if it persists.'], parts: [] },
    { code: '502', title: 'Light System Failure', severity: 'Low', system: 'charging', source: S.bosch, description: 'A fault with the lighting — a loose or damaged light cable.', fix: ['Check the front/rear light cables and connections.', 'Only fit Bosch-compatible lights.', 'Restart the system.'], parts: [] },
    { code: '503', title: 'Speed Sensor Error', severity: 'Medium', system: 'motor', source: S.bosch, description: 'The speed sensor is giving incorrect readings — a misaligned or displaced spoke magnet.', fix: ['Check the speed sensor and magnet position and gap.', 'Restart the system.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: '504', title: 'Speed Signal Distortion', severity: 'Medium', system: 'motor', source: S.boschMagazine, description: 'The detected speed signal is distorted or implausible — including a tampering/tuning flag.', fix: ['Check the spoke magnet alignment.', 'Check the sensor and cabling.', 'The system may flag tampering — do not fit a tuning device.'], parts: [] },
    { code: '510', title: 'Internal Sensor Error', severity: 'High', system: 'motor', source: S.bosch, description: 'An internal sensor error in the drive system.', fix: ['Restart the system.', 'Contact a Bosch dealer if it persists.'], parts: [] },
    { code: '511', title: 'Internal Drive Unit Error', severity: 'High', system: 'motor', source: S.bosch, description: 'An internal error of the drive unit.', fix: ['Restart the system.', 'Contact a Bosch dealer if it persists.'], parts: [] },
    { code: '520', title: 'Power Supply Error', severity: 'High', system: 'bms', source: S.bosch, description: 'A power-supply error — charging or battery supply path.', fix: ['Check the charger and charge port.', 'Re-seat the battery.', 'Have the battery checked by a dealer.'], parts: ['Charger', 'Battery pack'] },
    { code: '530', title: 'Battery Authentication Error', severity: 'High', system: 'bms', source: S.bosch, description: 'The battery pack does not authenticate with the system — a genuine part or contact issue.', fix: ['Switch off, remove and reinsert the battery pack.', 'Clean the contacts.', 'Have the battery checked by a Bosch dealer.'], parts: ['Battery pack'] },
    { code: '531', title: 'Configuration Mismatch', severity: 'Medium', system: 'controller', source: S.bosch, description: 'A configuration error — a component does not match the stored system configuration, often after a component swap.', fix: ['Restart the system.', 'Check all components are compatible and correctly configured.', 'A dealer must reconfigure the system if it persists.'], parts: [] },
    { code: '540', title: 'Over-Temperature Detected', severity: 'Medium', system: 'motor', source: S.bosch, description: 'The drive unit (or battery) temperature has exceeded the safe limit — sustained high load or high ambient temperature.', fix: ['Stop riding and allow the system to cool.', 'Reduce prolonged high-load riding.', 'Check for a binding drive if it recurs.'], parts: [] },
    { code: '550', title: 'Impermissible Electrical Load Detected', severity: 'Low', system: 'controller', source: S.bosch, description: 'An unauthorised consumer was detected on the system — an external device drawing power from the USB or light port.', fix: ['Remove external devices and USB connections.', 'Restart the system.', 'Only use approved accessories.'], parts: [] },
    { code: '580', title: 'Software Version Error', severity: 'Medium', system: 'controller', source: S.bosch, description: 'A software version error in the system — components are running mismatched firmware.', fix: ['Update the software via the dealer tool / eBike Flow app.', 'Visit a Bosch retailer if the update cannot be applied.'], parts: [] },
    { code: '591', title: 'Battery Authentication Error', severity: 'High', system: 'bms', source: S.bosch, description: 'The battery did not authenticate with the system — a genuine-part or contact issue.', fix: ['Switch off, remove and reinsert the battery.', 'Clean the contacts.', 'Have the battery checked by a Bosch dealer.'], parts: ['Battery pack'] },
  ],

  // -------------------------------------------------------------------------
  // SHIMANO STEPS (E6100 / E7000 / E8000 / EP8) — E (error) & W (warning) codes.
  // -------------------------------------------------------------------------
  shimano: [
    { code: 'E010', title: 'Drive Unit Abnormality', severity: 'High', system: 'motor', source: S.shimano, description: 'An abnormality was detected in the drive unit (sensor or internal error). Reset by disconnecting the battery; if it returns, the fault is in the unit electronics.', fix: ['Switch off and reset by disconnecting the battery for ~60 seconds.', 'Check the motor connections and wiring.', 'If the code returns, dealer E-TUBE diagnosis is required.'], parts: [] },
    { code: 'E011', title: 'System Error', severity: 'High', system: 'controller', source: S.shimano, description: 'A system error was detected in the drive system.', fix: ['Restart the system.', 'Check for and apply any firmware update.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: 'E012', title: 'Sensor Initialization Error', severity: 'High', system: 'motor', source: S.shimano, description: 'Sensor initialisation could not be completed normally at startup.', fix: ['Restart the system and confirm the pedals are still at startup.', 'Check the sensor wiring.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: 'E013', title: 'Drive Unit Firmware Abnormality', severity: 'High', system: 'controller', source: S.shimano, description: 'An abnormality was detected in the drive unit firmware.', fix: ['Update or reinstall the drive unit firmware via E-TUBE.', 'Restart the system.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: 'E014', title: 'Speed Sensor Signal Abnormality', severity: 'Medium', system: 'motor', source: S.shimano, description: 'An abnormal bicycle-speed signal was detected from the speed sensor — the magnet/sensor gap is wrong or the magnet twisted.', fix: ['Check the gap between the magnet and speed sensor.', 'Straighten the spoke magnet.', 'Check the sensor connection and cable.'], parts: ['Speed sensor'] },
    { code: 'E015', title: 'Drive Unit Abnormality', severity: 'High', system: 'motor', source: S.shimano, description: 'An abnormality was detected in the drive unit — check all internal connections.', fix: ['Check all connections in the drive unit.', 'Restart the system.', 'Dealer E-TUBE diagnosis if it persists.'], parts: [] },
    { code: 'E020', title: 'Battery / Drive Unit Communication Error', severity: 'Medium', system: 'bms', source: S.shimano, description: 'A communication error between the battery and the drive unit was detected.', fix: ['Inspect the battery connections and communication cable.', 'Reset the system.', 'Dealer diagnosis if it persists.'], parts: ['Battery pack'] },
    { code: 'E021', title: 'Unsupported Battery', severity: 'Medium', system: 'bms', source: S.shimano, description: 'The connected battery conforms to system standards but is not supported by this system.', fix: ['Fit a supported Shimano battery model.', 'Confirm the part number against the system spec.'], parts: ['Battery pack'] },
    { code: 'E022', title: 'Non-Conforming Battery', severity: 'High', system: 'bms', source: S.shimano, description: 'The connected battery does not conform to system standards.', fix: ['Fit a battery that conforms to system standards.', 'Do not ride with an incompatible pack.'], parts: ['Battery pack'] },
    { code: 'E023', title: 'Battery Electrical Abnormality', severity: 'High', system: 'bms', source: S.shimano, description: 'An electrical abnormality was detected in the battery.', fix: ['Inspect the battery and its electrical connections.', 'Reset the system.', 'Dealer diagnosis if it persists.'], parts: ['Battery pack'] },
    { code: 'E024', title: 'Battery Overcurrent Protection', severity: 'Medium', system: 'bms', source: S.shimano, description: 'The battery overcurrent protection has operated (often reported as a communication error with the bicycle system).', fix: ['Restart the system and check for communication issues.', 'Check the battery connections.', 'Dealer diagnosis if it persists.'], parts: ['Battery pack'] },
    { code: 'E025', title: 'Battery Does Not Recognize Drive Unit', severity: 'High', system: 'bms', source: S.shimano, description: 'The battery does not recognise the drive unit — a genuine drive unit is not connected, or its power cord is disconnected.', fix: ['Ensure the genuine drive unit is connected properly.', 'Check the power cord between the battery and drive unit.', 'Dealer diagnosis if it persists.'], parts: ['Battery pack'] },
    { code: 'E030', title: 'Shifting Unit Configuration Error', severity: 'Medium', system: 'controller', source: S.shimano, description: 'A shifting unit different from the system configuration is installed.', fix: ['Replace the shifting unit with the correct configuration.', 'Confirm the part against the system spec.'], parts: [] },
    { code: 'E031', title: 'Chain Tension / Crank Position Error', severity: 'Medium', system: 'motor', source: S.shimano, description: 'The chain tension may not yet be adjusted, or the crank may not be installed in the proper position.', fix: ['Adjust the chain tension.', 'Reinstall the crank in the correct position.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: 'W010', title: 'Drive Unit High Temperature (Warning)', severity: 'Low', system: 'motor', source: S.shimano, description: 'A high-temperature abnormality was detected in the drive unit.', fix: ['Allow the drive unit to cool down.', 'Reduce sustained load.'], parts: [] },
    { code: 'W011', title: 'Speed Sensor Signal (Warning)', severity: 'Medium', system: 'motor', source: S.shimano, description: 'No plausible bicycle speed signal — the sensor/magnet gap is wrong or the magnet has twisted. A warning; assistance is reduced.', fix: ['Check the gap between the magnet and speed sensor.', 'Straighten the spoke magnet.', 'Check the sensor connection.'], parts: ['Speed sensor'] },
    { code: 'W012', title: 'Crank Installed Wrong Direction (Warning)', severity: 'Low', system: 'motor', source: S.shimano, description: 'The crank may be installed in the wrong direction.', fix: ['Reinstall the crank in the correct direction.'], parts: [] },
    { code: 'W013', title: 'Sensor Initialization (Warning)', severity: 'Low', system: 'motor', source: S.shimano, description: 'Sensor initialisation could not complete normally at startup.', fix: ['Restart the system with the pedals still.', 'Ensure proper initialisation.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: 'W020', title: 'Battery Temperature (Warning)', severity: 'Low', system: 'bms', source: S.shimano, description: 'If the temperature exceeds the guaranteed operating range, the battery output stops.', fix: ['Allow the battery to cool down (or warm up) before use.', 'Store and charge within the specified temperature range.'], parts: ['Battery pack'] },
    { code: 'W030', title: 'Multiple Assist Switches Connected (Warning)', severity: 'Low', system: 'controller', source: S.shimano, description: 'Two or more assist switches are connected to the system.', fix: ['Disconnect the extra assist switches.'], parts: [] },
    { code: 'W031', title: 'Chain Tension / Crank Position (Warning)', severity: 'Low', system: 'motor', source: S.shimano, description: 'The chain tension may not yet be adjusted, or the crank may not be installed in the proper position.', fix: ['Adjust the chain tension.', 'Reinstall the crank properly.'], parts: [] },
    { code: 'W032', title: 'Shifting Unit Configuration (Warning)', severity: 'Low', system: 'controller', source: S.shimano, description: 'A shifting unit different from the system configuration is installed.', fix: ['Replace the shifting unit with the correct configuration.'], parts: [] },
  ],

  // -------------------------------------------------------------------------
  // BAFANG (BBS01 / BBS02 / BBSHD, M-series) — numeric codes on the display.
  // -------------------------------------------------------------------------
  bafang: [
    { code: 'E04', title: 'Throttle Did Not Return', severity: 'High', system: 'throttle', source: S.bafang, description: 'The throttle lever no longer returns to the zero position.', fix: ['Check the throttle is mechanically at zero.', 'Unplug the throttle and restart — if the error clears, the throttle or cable is damaged.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E07', title: 'High Voltage / Overvoltage Protection', severity: 'High', system: 'bms', source: S.bafang, description: 'The battery voltage is above the system limit — often a battery of the wrong voltage for the kit.', fix: ['Confirm the battery matches the system voltage (e.g. 48 V pack on a 48 V kit).', 'Check the charger output.', 'Do not use an over-voltage pack.'], parts: ['Battery pack', 'Charger'] },
    { code: 'E08', title: 'Hall / Motor Sensor Error', severity: 'High', system: 'motor', source: S.bafang, description: 'A hall-sensor or motor sensor error.', fix: ['Check the motor sensor connectors.', 'Test the hall sensors.', 'Replace the sensor board or motor harness.'], parts: ['Hall sensor board'] },
    { code: 'E10', title: 'Controller Overheat', severity: 'Medium', system: 'controller', source: S.bafang, description: 'The controller (or motor) is overheating.', fix: ['Allow the system to cool.', 'Check for a phantom error with a firmware update (BBSHD).', 'Reduce sustained load.'], parts: [] },
    { code: 'E12', title: 'Current Sensor Abnormality', severity: 'High', system: 'controller', source: S.bafang, description: 'A current-measurement (shunt) error in the controller. Not field-replaceable.', fix: ['Try a firmware update (BBSHD) to rule out a phantom error.', 'If that fails, replace the controller.'], parts: ['Controller'] },
    { code: 'E21', title: 'Speed Sensor Failure', severity: 'Medium', system: 'motor', source: S.bafang, description: 'The speed sensor has no signal — the magnet is misaligned or the sensor cable is cut.', fix: ['Switch the display off and on.', 'Check the spoke magnet aligns with the sensor (a few mm gap).', 'Check the speed-sensor cable for damage.'], parts: [] },
    { code: 'E30', title: 'Communication Error (Display ↔ Controller)', severity: 'Medium', system: 'display', source: S.bafang, description: 'The display cannot receive data from the controller. The most common Bafang fault.', fix: ['Check every connector between the display and controller for looseness or bent pins.', 'Look for kinks or cuts in the harness.', 'Replace the display (most common culprit), then the harness, then the controller.'], parts: ['Display harness', 'Controller'] },
  ],

  // -------------------------------------------------------------------------
  // VSETT / ZERO (QS-S4 LCD) — small numeric fault codes shown above the bars.
  // Also used by many QS-S4-equipped scooters (some Kaabo, ZERO 10X/11X).
  // -------------------------------------------------------------------------
  vsett: [
    { code: 'E1', title: 'Meter / Dashboard Fault', severity: 'Low', system: 'display', source: S.vsett, description: 'The meter (dashboard) reports a problem, or a stored fault from another code.', fix: ['Power-cycle and watch for a code that returns.', 'Check the display cable and connector.', 'Replace the dashboard if it persists.'], parts: ['Display unit'] },
    { code: 'E2', title: 'Brake Sensor (Electronic Brake) Fault', severity: 'High', system: 'brake', source: S.vsett, description: 'The electronic brake sensor is stuck or disconnected, so the motor cut-off is engaged. The brake (!) symbol also stays lit.', fix: ['Confirm the brake levers return fully.', 'Loosen the sensor with an 8mm spanner and adjust into range.', 'Replace the brake sensor if it will not adjust.'], parts: ['Brake lever switch'] },
    { code: 'E3', title: 'PAS / Pedal Sensor Fault', severity: 'Medium', system: 'motor', source: S.vsett, description: 'The pedal-assist (PAS) sensor is not reading — a misaligned sensor ring or a damaged sensor cable.', fix: ['Check the PAS sensor ring and magnet alignment.', 'Check the PAS cable and connector.', 'Replace the PAS sensor if faulty.'], parts: ['PAS sensor'] },
    { code: 'E6', title: 'Battery Undervoltage', severity: 'Medium', system: 'bms', source: S.vsett, description: 'Battery voltage is too low to drive the scooter.', fix: ['Charge the pack fully.', 'Test each cell group if it will not hold charge.', 'Replace the pack if a group is dead.'], parts: [] },
    { code: 'E7', title: 'Motor Fault', severity: 'High', system: 'motor', source: S.vsett, description: 'A motor fault — Hall sensor or phase wiring. On dual-motor models, swap the phase/Hall plugs to isolate which motor.', fix: ['Check the motor phase and Hall connectors.', 'On dual motors, swap the connectors to identify the faulty side.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E8', title: 'Motor / Hall Sensor Fault', severity: 'High', system: 'motor', source: S.vsett, description: 'A motor Hall-sensor or motor power-connection fault (not a throttle fault). On dual-motor models, isolate the faulty side.', fix: ['Check the motor Hall and phase connectors.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E9', title: 'Controller Fault', severity: 'High', system: 'controller', source: S.vsett, description: 'Controller fault — often a blown MOSFET after water ingress or hard use. Usually needs a full controller replacement.', fix: ['Check the controller for burnt components.', 'Check the phase wiring for a short.', 'Replace the controller (wire-for-wire).'], parts: ['Controller'] },
    { code: 'E10', title: 'Controller RX / Communication Receiving Fault', severity: 'Medium', system: 'display', source: S.vsett, description: 'The display is not receiving data from the controller — a fault in the LCD, controller or the comms wire. Often appears after quick handlebar movement.', fix: ['Unplug the LCD module and check the connector pins.', 'Plug it back in and wiggle the cable to test.', 'Replace the communication harness if it persists.'], parts: ['Harness'] },
    { code: 'E11', title: 'Controller TX / Communication Transmitting Fault', severity: 'Medium', system: 'display', source: S.vsett, description: 'The controller is not receiving data from the display (same harness as E10).', fix: ['Reseat the LCD connector.', 'Check the harness for damage.', 'Replace the communication harness.'], parts: ['Harness'] },
    { code: 'E12', title: 'BMS Communication Failure', severity: 'High', system: 'bms', source: S.vsett, description: 'The controller cannot communicate with the battery BMS.', fix: ['Check whether the battery still charges.', 'Check the battery-to-controller connector.', 'Replace the BMS or pack.'], parts: ['BMS'] },
    { code: 'E13', title: 'Headlight Error', severity: 'Low', system: 'charging', source: S.vsett, description: 'A fault with the LED headlight — a loose connection or a damaged LED.', fix: ['Check the headlight cable and connector.', 'Test the LED with a multimeter on diode mode.', 'Replace the headlight.'], parts: ['Headlight'] },
  ],

  // -------------------------------------------------------------------------
  // KAABO (Mantis / Wolf Warrior / Wolf King, LT01 & central displays).
  // -------------------------------------------------------------------------
  // Kaabo uses TWO display systems with DIFFERENT numbering: the LT01 LCD
  // (Mantis 8/10, Wolf Warrior) and the central/TFT display (Wolf King GTR).
  // Both are listed; the title names the display so a tech picks the right row.
  kaabo: [
    { code: 'E01', title: 'Motor Phase Fault (central display)', severity: 'High', system: 'motor', source: S.kaabo, description: 'The scooter detects a motor phase fault. The display may show F-01 (front) or r-01 (rear).', fix: ['Check the yellow, green and blue motor phase wires and their connectors.', 'On dual motors, isolate the faulty motor.', 'Replace the phase harness or motor.'], parts: ['Motor harness'] },
    { code: 'E02', title: 'Motor Hall Sensor Fault (central display)', severity: 'High', system: 'motor', source: S.kaabo, description: 'A motor Hall sensor fault. The display may show F-02 (front) or r-02 (rear). Not a brake fault.', fix: ['Inspect the motor Hall connector for loose wiring, dirt or bent pins.', 'Check the motor cable for damage.', 'Replace the Hall board or the motor if it persists.'], parts: ['Hall sensor board'] },
    { code: 'E04', title: 'Throttle Fault (central display)', severity: 'High', system: 'throttle', source: S.kaabo, description: 'The scooter detects a throttle fault — modified wiring, connector pins or the display main cable.', fix: ['Check for modified wiring or aftermarket accessories; restore the original wiring.', 'Inspect the throttle connector pins.', 'Replace the throttle if faulty.'], parts: ['Throttle'] },
    { code: 'E06', title: 'Undervoltage / Low Voltage (LT01 display)', severity: 'Medium', system: 'bms', source: S.kaabo, description: 'Low-voltage protection — the pack is below the cut-off. On LT01 displays the P1 voltage setting can trigger it early.', fix: ['Charge the pack fully.', 'Check the P1 voltage setting matches the battery (e.g. 60 V/72 V).', 'Test the pack if it will not charge.'], parts: [] },
    { code: 'E07', title: 'Motor Hall Sensor Fault (LT01 display)', severity: 'High', system: 'motor', source: S.kaabo, description: 'A Hall-sensor communication fault between the motor and the controller.', fix: ['Inspect the motor Hall connector for loose wiring, contamination or bent pins.', 'Check the motor cable insulation.', 'Replace the Hall board or motor if it persists.'], parts: ['Hall sensor board'] },
    { code: 'E08', title: 'Throttle Fault (LT01 display)', severity: 'High', system: 'throttle', source: S.kaabo, description: 'A throttle communication or throttle-signal fault.', fix: ['Check for modified wiring or aftermarket accessories.', 'Inspect the display connector and main harness.', 'Replace the throttle if faulty.'], parts: ['Throttle'] },
    { code: 'E09', title: 'Controller Communication Fault (LT01 display)', severity: 'High', system: 'controller', source: S.kaabo, description: 'A controller communication/connection fault — inspect the XHB9 connector between the controller and junction box.', fix: ['Open the controller compartment and locate the XHB9 connector.', 'Check for loose wiring, bent pins or incorrect wiring; reconnect securely.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E10', title: 'Display / Controller Communication Fault (LT01 display)', severity: 'Medium', system: 'display', source: S.kaabo, description: 'A communication fault between the display, controller or main wiring harness.', fix: ['Inspect the display waterproof connector pins.', 'Check the controller communication wiring.', 'Replace the harness or display if it persists.'], parts: ['Display harness'] },
  ],

  // -------------------------------------------------------------------------
  // RAD POWER BIKES (RadCity / RadRover / RadRunner) — numeric codes.
  // -------------------------------------------------------------------------
  radpower: [
    { code: '6', title: 'Battery Undervoltage', severity: 'Medium', system: 'bms', source: S.radpower, description: 'Battery undervoltage — the pack is flat or aged.', fix: ['Charge the pack fully.', 'Test the pack if it will not hold charge.', 'Replace the pack if a group is weak.'], parts: [] },
    { code: '10', title: 'Battery Overvoltage', severity: 'Medium', system: 'bms', source: S.radpower, description: 'Battery overvoltage — check the charger, or a failed BMS allowing over-charge.', fix: ['Confirm the correct charger is used.', 'Check the pack voltage.', 'Replace the charger or BMS if faulty.'], parts: ['Charger', 'BMS'] },
    { code: '12', title: 'Motor Stall / Torque Sensor Error', severity: 'Medium', system: 'motor', source: S.radpower, description: 'The motor is under excessive load (steep starts, too high a gear, heavy load) or the torque sensor is misreading.', fix: ['Power off, wait a few minutes and restart.', 'Use an easier gear and lower assistance.', 'If it returns, test the torque sensor.'], parts: ['Torque sensor'] },
    { code: '15', title: 'Controller Error', severity: 'High', system: 'controller', source: S.radpower, description: 'An internal controller fault.', fix: ['Power-cycle the bike.', 'Check the controller connectors and wiring.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: '16', title: 'Throttle Active at Startup', severity: 'Medium', system: 'throttle', source: S.radpower, description: 'The throttle was not at rest when the bike powered on, so the controller locked out for safety.', fix: ['Release the throttle and power-cycle.', 'Check the throttle returns to zero.', 'Replace the throttle if it sticks.'], parts: ['Throttle'] },
    { code: '17', title: 'Abnormal Motor Current / Wiring Fault', severity: 'High', system: 'motor', source: S.radpower, description: 'Abnormal motor current — a motor or wiring fault.', fix: ['Check the motor phase connectors and cable.', 'Check the controller.', 'Replace the harness or motor if faulty.'], parts: ['Motor harness'] },
    { code: '21', title: 'Abnormal Current (Controller / Wiring)', severity: 'High', system: 'controller', source: S.radpower, description: 'Abnormal current — a controller, motor or wiring fault. Often the battery tray contacts on RadCity models.', fix: ['Power-cycle first.', 'Inspect all cables and connections.', 'Check the battery tray contacts; replace the controller if it persists.'], parts: ['Controller'] },
    { code: '22', title: 'Throttle Fault', severity: 'High', system: 'throttle', source: S.radpower, description: 'Throttle fault — a damaged throttle or loose wiring.', fix: ['Check the throttle connector and wiring.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: '23', title: 'Motor Phase Fault', severity: 'High', system: 'motor', source: S.radpower, description: 'Motor phase fault — a controller or motor connection issue.', fix: ['Check the motor phase connectors.', 'Check the controller.', 'Replace the harness or motor if faulty.'], parts: ['Motor harness'] },
    { code: '24', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', source: S.radpower, description: 'Motor Hall sensor fault — internal motor sensor failure.', fix: ['Check the motor cable and connector.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: '25', title: 'Brake Sensor Fault', severity: 'High', system: 'brake', source: S.radpower, description: 'The brake sensor is stuck active, so the bike will not assist.', fix: ['Find the sensors under the brake levers and adjust them.', 'Check the sensor wiring.', 'Replace the brake sensor.'], parts: ['Brake sensor'] },
    { code: '30', title: 'Communication Fault', severity: 'Medium', system: 'display', source: S.radpower, description: 'Communication fault — often loose wiring or water in a connector.', fix: ['Check all connections and wiring.', 'Inspect the connector pins for corrosion.', 'Replace the display or harness if it persists.'], parts: ['Display harness'] },
    { code: '31', title: 'Power Button Hold Fault', severity: 'Low', system: 'display', source: S.radpower, description: 'The power button was held down too long at startup (a safety lock-out).', fix: ['Release and press the power button normally.', 'Check the button for sticking.', 'Replace the button/display if it persists.'], parts: [] },
    { code: '34', title: 'Walk Mode Disengage Fault', severity: 'Low', system: 'display', source: S.radpower, description: 'Walk mode did not disengage — the walk button/sensor is stuck.', fix: ['Press and release walk mode again.', 'Check the display buttons.', 'Replace the display if it persists.'], parts: ['Display unit'] },
  ],

  // -------------------------------------------------------------------------
  // BROSE (Specialized/BH/Serial-1 drive systems) — numeric & text codes.
  // -------------------------------------------------------------------------
  brose: [
    { code: '10', title: 'Battery Voltage Too Low', severity: 'Medium', system: 'bms', source: S.brose, description: 'The battery voltage is too low — the pack is discharged or aged.', fix: ['Charge the battery.', 'Test the pack if it will not hold charge.'], parts: ['Battery pack'] },
    { code: '11', title: 'Battery Voltage Too High', severity: 'Medium', system: 'bms', source: S.brose, description: 'The battery voltage is too high — check the charger or a BMS fault.', fix: ['Power-cycle the system.', 'Confirm the correct charger is used.', 'Dealer diagnosis if it persists.'], parts: ['Charger'] },
    { code: '12', title: 'Battery Almost / Completely Discharged', severity: 'Medium', system: 'bms', source: S.brose, description: 'The battery is almost or completely discharged.', fix: ['Charge the battery fully.', 'Test the pack if it will not hold charge.'], parts: ['Battery pack'] },
    { code: '20', title: 'Electrical Measurements Incorrect', severity: 'Medium', system: 'controller', source: S.brose, description: 'The system electrical measurements are incorrect.', fix: ['Power-cycle the system.', 'Dealer/shop diagnosis if it persists.'], parts: [] },
    { code: '21', title: 'Thermal Sensor Defective', severity: 'High', system: 'motor', source: S.brose, description: 'A temperature (thermal) sensor is defective.', fix: ['Stop riding and contact a dealer/shop.', 'Do not attempt repeated restarts.'], parts: [] },
    { code: '24', title: 'Internal Voltage Outside Working Range', severity: 'Medium', system: 'bms', source: S.brose, description: 'The internal voltage is outside its working range.', fix: ['Charge the battery.', 'Test the pack if it will not hold charge.'], parts: ['Battery pack'] },
    { code: '25', title: 'Motor Current Measurement Error', severity: 'Medium', system: 'controller', source: S.brose, description: 'An error in the motor current measurement.', fix: ['Power-cycle the system.', 'Shop diagnosis if it persists.'], parts: [] },
    { code: '26', title: 'Software Reset Completed', severity: 'Low', system: 'controller', source: S.brose, description: 'The system performed a software reset — usually clears the fault.', fix: ['Continue riding and monitor.', 'If it repeats or pairs with other faults, contact a shop.'], parts: [] },
    { code: '40', title: 'Overcurrent in Motor', severity: 'Medium', system: 'motor', source: S.brose, description: 'Overcurrent detected in the motor — the motor is working too hard.', fix: ['Reduce load: lower assistance and pedal easier.', 'Check for a binding drive or brake drag.'], parts: [] },
    { code: '41', title: 'Overcurrent in Motor', severity: 'Medium', system: 'motor', source: S.brose, description: 'Overcurrent detected in the motor — same as code 40.', fix: ['Reduce load: lower assistance and pedal easier.', 'Check for a binding drive or brake drag.'], parts: [] },
    { code: '42', title: 'Fault in Motor Rotation', severity: 'Medium', system: 'motor', source: S.brose, description: 'A fault in the motor rotation was detected.', fix: ['Power-cycle the system.', 'Contact a shop if it persists.'], parts: [] },
    { code: '43', title: 'Short Circuit in Motor', severity: 'High', system: 'motor', source: S.brose, description: 'A short circuit in the motor — stop riding.', fix: ['Stop riding immediately.', 'Contact a shop for diagnosis.', 'Do not open the drive unit.'], parts: [] },
    { code: '44', title: 'Motor Overheating', severity: 'Medium', system: 'motor', source: S.brose, description: 'The motor is overheating.', fix: ['Reduce load and let the motor cool.', 'Check for a binding drive.'], parts: [] },
    { code: '45', title: 'Motor Rotation Error (Auto-Corrected)', severity: 'Low', system: 'motor', source: S.brose, description: 'The software corrected an error in motor rotation.', fix: ['Power-cycle the system.', 'Contact a shop if it repeats.'], parts: [] },
    { code: '46', title: 'No Motor Movement Recognized', severity: 'High', system: 'motor', source: S.brose, description: 'No motor movement was recognised — often not a DIY fix.', fix: ['Stop riding and contact a shop.'], parts: [] },
    { code: '60', title: 'CAN-BUS Communication Interruption', severity: 'Medium', system: 'display', source: S.brose, description: 'A CAN-BUS communication interruption between system components.', fix: ['Check the cables and plug connections.', 'Power-cycle the system.', 'Shop diagnosis if it persists.'], parts: [] },
    { code: '70', title: 'Pedal Force / Cadence Sensor Error', severity: 'Medium', system: 'motor', source: S.brose, description: 'A pedal-force (torque) or cadence sensor error.', fix: ['Check the sensor connections.', 'Shop diagnosis if it persists.'], parts: ['Torque sensor'] },
    { code: '71', title: 'Pedal Force / Cadence Sensor Error', severity: 'Medium', system: 'motor', source: S.brose, description: 'A pedal-force (torque) or cadence sensor error.', fix: ['Check the sensor connections.', 'Shop diagnosis if it persists.'], parts: ['Torque sensor'] },
    { code: '74', title: 'Pedal Force / Cadence Sensor Error', severity: 'Medium', system: 'motor', source: S.brose, description: 'A pedal-force (torque) or cadence sensor error.', fix: ['Check the sensor connections.', 'Shop diagnosis if it persists.'], parts: ['Torque sensor'] },
  ],

  // -------------------------------------------------------------------------
  // KUGOO / KUKIRIN (S1, M4, G2 Pro, G3, G-Booster) — small numeric codes.
  // -------------------------------------------------------------------------
  kugoo: [
    { code: '1', title: 'Motor Fault', severity: 'High', system: 'motor', source: S.kugoo, description: 'A motor fault — Hall sensor, phase wiring or the motor itself.', fix: ['Check the motor Hall and phase connectors.', 'Test the Hall sensors.', 'Replace the Hall board or motor if faulty.'], parts: ['Hall sensor board'] },
    { code: '2', title: 'Throttle Fault', severity: 'High', system: 'throttle', source: S.kugoo, description: 'A throttle fault — the throttle signal is out of range or the throttle is disconnected.', fix: ['Check the throttle connector and cable.', 'Confirm the throttle returns to zero.', 'Replace the throttle if faulty.'], parts: ['Throttle'] },
    { code: '3', title: 'Controller Fault', severity: 'High', system: 'controller', source: S.kugoo, description: 'A controller fault — an internal failure or a wiring fault.', fix: ['Check the controller connectors and wiring.', 'Check the phase wires for a short.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: '4', title: 'Brake Lever Fault', severity: 'High', system: 'brake', source: S.kugoo, description: 'A brake lever fault — the brake cut-off switch is stuck or disconnected.', fix: ['Confirm the brake levers return fully.', 'Check the brake cut-off sensor wiring.', 'Replace the lever sensor if faulty.'], parts: ['Brake lever switch'] },
    { code: '5', title: 'Undervoltage Protection', severity: 'Medium', system: 'bms', source: S.kugoo, description: 'Low-voltage protection — the pack is below the cut-off voltage.', fix: ['Charge the pack fully.', 'Test the pack if it will not hold charge.'], parts: [] },
    { code: '6', title: 'Display / Controller Communication Fault', severity: 'Medium', system: 'display', source: S.kugoo, description: 'A display-to-controller communication fault.', fix: ['Reseat the display cable.', 'Check the harness for damage.', 'Replace the display or harness if it persists.'], parts: ['Display harness'] },
    { code: '7', title: 'Display / Controller Communication Fault', severity: 'Medium', system: 'display', source: S.kugoo, description: 'A second display-to-controller communication fault (same harness as code 6).', fix: ['Reseat the display cable.', 'Check the harness for damage.', 'Replace the display or harness if it persists.'], parts: ['Display harness'] },
  ],

  // -------------------------------------------------------------------------
  // iENYRID (M4 / M4 Pro S+ / M8, ES series) — "nE" display codes.
  // -------------------------------------------------------------------------
  ienyrid: [
    { code: '3E', title: 'Motor Malfunction', severity: 'High', system: 'motor', source: S.ienyrid, description: 'The display reports a motor malfunction — Hall sensor or phase wiring.', fix: ['Check the motor Hall and phase connectors.', 'Test the Hall sensors.', 'Replace the Hall board or motor if faulty.'], parts: ['Hall sensor board'] },
    { code: '4E', title: 'Low Voltage Issue', severity: 'Medium', system: 'bms', source: S.ienyrid, description: 'Low-voltage issue — the battery needs recharging.', fix: ['Recharge the battery fully.', 'Test the pack if the code returns on a full charge.'], parts: [] },
    { code: '5E', title: 'Brake Lever Malfunction', severity: 'High', system: 'brake', source: S.ienyrid, description: 'The brake lever is malfunctioning — a stuck cut-off switch or wiring.', fix: ['Confirm the brake lever returns fully.', 'Check the brake cut-off sensor wiring.', 'Replace the lever sensor if faulty.'], parts: ['Brake lever switch'] },
    { code: '6E', title: 'Motor Malfunction', severity: 'High', system: 'motor', source: S.ienyrid, description: 'A second motor malfunction code — motor or controller fault.', fix: ['Check the motor cable and connectors.', 'Check the controller.', 'Replace the faulty motor or controller.'], parts: ['Controller'] },
    { code: '7E', title: 'Throttle Not Neutral', severity: 'High', system: 'throttle', source: S.ienyrid, description: 'The throttle is not in the neutral position at startup. Reset the throttle by disconnecting and reconnecting its cable.', fix: ['Disconnect the throttle cable connector and reset the thumb throttle.', 'Confirm the throttle returns to zero.', 'Replace the throttle if it will not reset.'], parts: ['Throttle'] },
    { code: '10E', title: 'Display Sending Malfunction', severity: 'Medium', system: 'display', source: S.ienyrid, description: 'The display has a sending (transmit) malfunction — replace the display unit.', fix: ['Check the display connector and harness.', 'Replace the display unit.'], parts: ['Display unit'] },
    { code: '15E', title: 'Controller Receiving Malfunction', severity: 'High', system: 'controller', source: S.ienyrid, description: 'The controller has a receiving (receive) malfunction — replace the controller.', fix: ['Check the controller connectors and harness.', 'Replace the controller.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // GOTRAX (GXL, XR, Apex, G-series) — E codes.
  // -------------------------------------------------------------------------
  gotrax: [
    { code: 'E2', title: 'Brake Sensor Fault', severity: 'High', system: 'brake', source: S.gotrax, description: 'The controller believes the brake lever is engaged — a faulty brake sensor, damaged lever wiring or a misaligned brake cable.', fix: ['Confirm the brake lever returns fully.', 'Check the brake sensor wiring and cable.', 'Replace the brake lever sensor.'], parts: ['Brake lever switch'] },
    { code: 'E3', title: 'Console Communication Issue', severity: 'Medium', system: 'display', source: S.gotrax, description: 'A communication issue between the display console and the controller — loose display wiring, a controller connection failure or a damaged console.', fix: ['Reseat the display wiring.', 'Check the controller connection.', 'Replace the display console if it persists.'], parts: ['Display harness'] },
    { code: 'E7', title: 'Motor Hall Sensor Failure', severity: 'High', system: 'motor', source: S.gotrax, description: 'A communication issue between the motor and controller — a Hall-sensor failure.', fix: ['Check the motor Hall connector and cable.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
  ],

  // -------------------------------------------------------------------------
  // HIBOY (S2, S2 Pro, X2, MAX series) — E codes.
  // -------------------------------------------------------------------------
  hiboy: [
    { code: 'E1', title: 'Motor / Hall Communication Fault', severity: 'High', system: 'motor', source: S.hiboy, description: 'A motor communication fault — Hall sensor or phase wiring between the motor and controller.', fix: ['Check the motor Hall and phase connectors.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E3', title: 'Motor Sensor Error', severity: 'High', system: 'motor', source: S.hiboy, description: 'A motor sensor (Hall) error — the controller is not receiving a valid motor position signal.', fix: ['Check the motor connector and cable.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E4', title: 'Controller Fault', severity: 'High', system: 'controller', source: S.hiboy, description: 'A controller fault — an internal failure or a wiring fault.', fix: ['Check the controller connectors and wiring.', 'Replace the controller if it persists.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // NIU (KQi / KQi3 / KQi2 e-scooters) — numeric error codes.
  // -------------------------------------------------------------------------
  niu: [
    { code: '03', title: 'Throttle Signal Error', severity: 'High', system: 'throttle', source: S.niu, description: 'The controller is not receiving a proper signal from the throttle — a throttle sensor or wiring fault.', fix: ['Check the throttle connector and cable.', 'Confirm the throttle returns to zero.', 'Replace the throttle if faulty.'], parts: ['Throttle'] },
    { code: '05', title: 'Motor Communication Fault', severity: 'High', system: 'motor', source: S.niu, description: 'A motor communication fault — motor Hall sensor failure.', fix: ['Check the motor Hall connector and cable.', 'Test the Hall sensors.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: '07', title: 'Controller Communication Error', severity: 'High', system: 'controller', source: S.niu, description: 'A controller communication error — a controller malfunction or wiring issue.', fix: ['Check the controller connectors and wiring.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: '09', title: 'Battery Communication Error', severity: 'High', system: 'bms', source: S.niu, description: 'A battery communication error — a battery management system fault.', fix: ['Check the battery connector and data line.', 'Test the BMS.', 'Replace the BMS or pack.'], parts: ['BMS'] },
    { code: '10', title: 'Overcurrent Protection', severity: 'High', system: 'controller', source: S.niu, description: 'Overcurrent protection — the controller detected abnormal power draw (a stall, short or binding motor).', fix: ['Check the wheel spins freely.', 'Check the motor phase wires for a short.', 'Replace the controller if it trips without load.'], parts: ['Controller'] },
    { code: '12', title: 'Motor Temperature Warning', severity: 'Medium', system: 'motor', source: S.niu, description: 'Motor temperature warning — the motor is overheating.', fix: ['Let the motor cool.', 'Reduce sustained load or hills.', 'Check for a binding wheel.'], parts: [] },
    { code: '21', title: 'Battery Voltage Error', severity: 'Medium', system: 'bms', source: S.niu, description: 'Battery voltage outside the safe operating range.', fix: ['Charge the pack fully.', 'Test the pack if the code returns.', 'Replace the pack if a cell group is weak.'], parts: ['Battery pack'] },
  ],
};


/** The error set to show when a specific model has no dedicated family entry — the workshop generic list. */
export const GENERIC_ERROR_CODES: EVehicleErrorDefinition[] = CODE_FAMILIES.generic;

/**
 * Model → error family map. Anything not listed falls back to the generic
 * controller codes, which are a super-set of the codes a budget scooter reports.
 */
export const EVEHICLE_MODEL_ERRORS: EVehicleModelErrors[] = [
  // Xiaomi
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'M365', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'M365 Pro', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'Mi Electric Scooter 3', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'Pro 2', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: '1S', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'Essential', family: 'xiaomi' },
  { category: 'electric_scooter', brand: 'Xiaomi', model: 'Pro 4', family: 'xiaomi' },
  // Segway / Ninebot — the Max G30 family uses ER codes, the ES1–ES4 use generic E codes.
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'KickScooter ES1', family: 'generic' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'KickScooter ES2', family: 'generic' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'KickScooter ES4', family: 'generic' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'KickScooter E22', family: 'generic' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'Max G30', family: 'ninebot' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'Max G30LP', family: 'ninebot' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'Max G65', family: 'ninebot' },
  { category: 'electric_scooter', brand: 'Segway / Ninebot', model: 'Other Ninebot Model', family: 'ninebot' },
  // Pure
  { category: 'electric_scooter', brand: 'Pure Electric', model: 'Air', family: 'pure' },
  { category: 'electric_scooter', brand: 'Pure Electric', model: 'Air Pro', family: 'pure' },
  { category: 'electric_scooter', brand: 'Pure Electric', model: 'Advance', family: 'pure' },
  { category: 'electric_scooter', brand: 'Pure Electric', model: 'Advance+', family: 'pure' },
  { category: 'electric_scooter', brand: 'Pure Electric', model: 'Other Pure Model', family: 'pure' },
  // Apollo
  { category: 'electric_scooter', brand: 'Apollo', model: 'Phantom', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Apollo', model: 'Ghost', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Apollo', model: 'City', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Apollo', model: 'Explore', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Apollo', model: 'Air', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Apollo', model: 'Other Apollo Model', family: 'apollo' },
  // Dualtron
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Ultra', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Thunder', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Victor', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Eagle', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Popular', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Dualtron', model: 'Other Dualtron Model', family: 'dualtron' },
  // Vsett / Kaabo / NAMI / Razor / GoTrax / iScooter / Okai / Hiboy / InMotion / generic others → generic codes.
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Wolf Warrior', family: 'kaabo' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Wolf King', family: 'kaabo' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Skywalker', family: 'kaabo' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Mantis', family: 'kaabo' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Other Kaabo Model', family: 'kaabo' },
  { category: 'electric_scooter', brand: 'Vsett', model: '8', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Vsett', model: '9+', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Vsett', model: '10+', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Vsett', model: '11+', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Vsett', model: 'Other Vsett Model', family: 'vsett' },
  { category: 'electric_scooter', brand: 'NAMI', model: 'Burn-e', family: 'generic' },
  { category: 'electric_scooter', brand: 'NAMI', model: 'Blast', family: 'generic' },
  { category: 'electric_scooter', brand: 'NAMI', model: 'Seas', family: 'generic' },
  { category: 'electric_scooter', brand: 'NAMI', model: 'Other NAMI Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Razor', model: 'E100', family: 'generic' },
  { category: 'electric_scooter', brand: 'Razor', model: 'E300', family: 'generic' },
  { category: 'electric_scooter', brand: 'Razor', model: 'E Prime', family: 'generic' },
  { category: 'electric_scooter', brand: 'Razor', model: 'Other Razor Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'G2', family: 'gotrax' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'G3', family: 'gotrax' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'GXL', family: 'gotrax' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'Xr Elite', family: 'gotrax' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'Other GoTrax Model', family: 'gotrax' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i9', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i9 Pro', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i10', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'Other iScooter Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'EA10', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'ES10', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'ESA Pro', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'Other Okai Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'S2', family: 'hiboy' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'S2 Pro', family: 'hiboy' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'X2', family: 'hiboy' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'Other Hiboy Model', family: 'hiboy' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'S1', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'S2', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'L9', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'Other InMotion Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'M4', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'M4 Pro', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'G2 Pro', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'G3', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'G-Booster', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'S1', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'Kugoo / Kukirin', model: 'Other Kugoo Model', family: 'kugoo' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'M4', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'M4 Pro', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'M4 Pro S+', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'M8', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'ES Series', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'iENYRID', model: 'Other iENYRID Model', family: 'ienyrid' },
  { category: 'electric_scooter', brand: 'NIU', model: 'KQi1', family: 'niu' },
  { category: 'electric_scooter', brand: 'NIU', model: 'KQi2', family: 'niu' },
  { category: 'electric_scooter', brand: 'NIU', model: 'KQi3', family: 'niu' },
  { category: 'electric_scooter', brand: 'NIU', model: 'KQi Air', family: 'niu' },
  { category: 'electric_scooter', brand: 'NIU', model: 'Other NIU Model', family: 'niu' },
  { category: 'electric_scooter', brand: 'Zero', model: '10X', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Zero', model: '11X', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Zero', model: 'Other Zero Model', family: 'vsett' },
  { category: 'electric_scooter', brand: 'Budget / Other', model: 'Generic Controller', family: 'generic' },
  { category: 'electric_scooter', brand: 'Budget / Other', model: 'Other / Not Listed', family: 'generic' },
  // --- E-Bikes -------------------------------------------------------------
  // Bosch Classic + Smart: many "5XXX" and error strings; we use the generic
  // codes plus the common Bosch specific ones below where sensible.
  { category: 'ebike', brand: 'Bosch', model: 'Active Line', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Active Line Plus', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Performance Line', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Performance CX', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Cargo Line', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Speed (45 km/h)', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch', model: 'Other Bosch System', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Performance Line CX Smart', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Performance Line Smart', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Active Line Smart', family: 'bosch' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Other Smart System', family: 'bosch' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E6100', family: 'shimano' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E7000', family: 'shimano' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E8000', family: 'shimano' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS EP8', family: 'shimano' },
  { category: 'ebike', brand: 'Shimano', model: 'Other STEPS System', family: 'shimano' },
  { category: 'ebike', brand: 'Bafang', model: 'BBS01', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'BBS02', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'BBSHD', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'M400', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'M500', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'M600', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'H600', family: 'bafang' },
  { category: 'ebike', brand: 'Bafang', model: 'Other Bafang System', family: 'bafang' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-SE', family: 'generic_bike' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-X', family: 'generic_bike' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-i', family: 'generic_bike' },
  { category: 'ebike', brand: 'Yamaha', model: 'PWseries TE', family: 'generic_bike' },
  { category: 'ebike', brand: 'Yamaha', model: 'Other Yamaha System', family: 'generic_bike' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Core', family: 'generic_bike' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Sport', family: 'generic_bike' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Pro', family: 'generic_bike' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'Other Giant System', family: 'generic_bike' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Vado', family: 'generic_bike' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Como', family: 'generic_bike' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Levo', family: 'generic_bike' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo SL', family: 'generic_bike' },
  { category: 'ebike', brand: 'Specialized', model: 'Other Turbo System', family: 'generic_bike' },
  { category: 'ebike', brand: 'Cannondale', model: 'Tesoro Neo', family: 'generic_bike' },
  { category: 'ebike', brand: 'Cannondale', model: 'Synapse Neo', family: 'generic_bike' },
  { category: 'ebike', brand: 'Cannondale', model: 'Trail Neo', family: 'generic_bike' },
  { category: 'ebike', brand: 'Cannondale', model: 'Other Cannondale System', family: 'generic_bike' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: '250 W Hub', family: 'generic_bike' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: '500 W Hub', family: 'generic_bike' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: 'Other Hub Motor', family: 'generic_bike' },
  { category: 'ebike', brand: 'Swytch', model: 'Swytch Kit (Conversions)', family: 'generic_bike' },
  { category: 'ebike', brand: 'Swytch', model: 'Other Swytch Kit', family: 'generic_bike' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadCity', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadCity Plus', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadRover', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadRunner', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadMission', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'RadWagon', family: 'radpower' },
  { category: 'ebike', brand: 'Rad Power Bikes', model: 'Other Rad Model', family: 'radpower' },
  { category: 'ebike', brand: 'Brose', model: 'Drive T', family: 'brose' },
  { category: 'ebike', brand: 'Brose', model: 'Drive S', family: 'brose' },
  { category: 'ebike', brand: 'Brose', model: 'Drive C', family: 'brose' },
  { category: 'ebike', brand: 'Brose', model: 'Drive Mag', family: 'brose' },
  { category: 'ebike', brand: 'Brose', model: 'Other Brose System', family: 'brose' },
  { category: 'ebike', brand: 'Budget / Other', model: 'Generic Controller', family: 'generic_bike' },
  { category: 'ebike', brand: 'Budget / Other', model: 'Other / Not Listed', family: 'generic_bike' },
];

/** Exact case-insensitive family lookup for a specific brand + model. */
export function errorFamilyFor(category: EVehicleCategory, brand: string, model: string): EVehicleErrorFamily {
  const hit = EVEHICLE_MODEL_ERRORS.find(
    (e) =>
      e.category === category &&
      e.brand.toLowerCase() === brand.toLowerCase() &&
      e.model.toLowerCase() === model.toLowerCase()
  );
  return hit?.family ?? 'generic';
}

/**
 * The full code list for a chosen category / brand / model. Returns the model’s
 * dedicated family when known, otherwise the generic controller codes.
 */
export function errorCodesFor(category: EVehicleCategory, brand: string, model: string): EVehicleErrorDefinition[] {
  const family = errorFamilyFor(category, brand.trim(), model.trim());
  return errorCodesForFamily(family);
}

/** The full code list for a family, independent of any brand/model selection. */
export function errorCodesForFamily(family: EVehicleErrorFamily): EVehicleErrorDefinition[] {
  return CODE_FAMILIES[family] || CODE_FAMILIES.generic;
}

/** Find a single code by normalised code string within a list. */
export function findErrorCode(codes: EVehicleErrorDefinition[], raw: string): EVehicleErrorDefinition | undefined {
  const want = normalizeErrorCode(raw);
  return codes.find((c) => normalizeErrorCode(c.code) === want);
}

/** All brands that match a category, in the picker’s display order. */
export function brandsForEVehicleCategory(category: EVehicleCategory): EVehicleModelsSet[] {
  return EVEHICLE_BRANDS.filter((b) => b.category === category).map(({ brand, models }) => ({ brand, models }));
}

// ---------------------------------------------------------------------------
// DISPLAY / SYSTEM IDENTIFICATION
//
// The single most common reason a mechanic looks up the wrong code: two scooters
// from the same brand show completely different numbers because they run
// different displays/controllers. The code number is a property of the DISPLAY,
// not of the bike. These entries let the tool start from "what does the display
// look like / what does it say" and route straight to the right code table.
// ---------------------------------------------------------------------------

export interface EVehicleDisplay {
  /** Stable id, used by the UI. */
  id: string;
  category: EVehicleCategory;
  /** Family whose codes this display reports. */
  family: EVehicleErrorFamily;
  /** How the codes appear, e.g. "E10", "3E", "numeric 10–54". */
  codeStyle: string;
  /** What the mechanic sees on the unit, so they can pick the right one. */
  appearance: string;
  /** Brands/models this display is fitted to. */
  usedOn: string[];
  /** Optional identifying hint, e.g. colour or a marking. */
  hint?: string;
}

export const EVEHICLE_DISPLAYS: EVehicleDisplay[] = [
  // --- E-Scooters ---------------------------------------------------------
  {
    id: 'xiaomi-m365',
    category: 'electric_scooter',
    family: 'xiaomi',
    codeStyle: 'E10 – E40 (E + two digits)',
    appearance: 'Plain white-OLED round/oval bar display; no coloured housing. Codes flash as "E" + number.',
    usedOn: ['Xiaomi M365 / M365 Pro / 1S / Pro 2 / Essential / Mi 3'],
    hint: 'Also fitted to the Segway Max G30 — the G30 dashboard uses the same E-number lexicon.',
  },
  {
    id: 'ninebot-g30',
    category: 'electric_scooter',
    family: 'ninebot',
    codeStyle: 'numeric 10 – 54 (no letter)',
    appearance: 'Segway/Ninebot oval dashboard with the ring LED; codes show as bare numbers, not "E" codes.',
    usedOn: ['Segway Ninebot Max G30 / G30LP / G65'],
    hint: 'If the display shows "E10" it is the Xiaomi/ES firmware; if it shows "10" it is the Max firmware.',
  },
  {
    id: 'ninebot-es',
    category: 'electric_scooter',
    family: 'generic',
    codeStyle: 'E-codes (generic)',
    appearance: 'Segway ES1/ES2/ES4 dashboard (Bluetooth button) — early firmware uses generic E-codes.',
    usedOn: ['Segway Ninebot KickScooter ES1 / ES2 / ES4 / E22'],
  },
  {
    id: 'pure-air',
    category: 'electric_scooter',
    family: 'pure',
    codeStyle: 'E01 – E07',
    appearance: 'Pure Air / Air Pro centre display with a battery-percentage bar.',
    usedOn: ['Pure Electric Air / Air Pro / Advance / Advance+'],
  },
  {
    id: 'kugoo-numeric',
    category: 'electric_scooter',
    family: 'kugoo',
    codeStyle: 'numeric 1 – 7',
    appearance: 'Kugoo/Kukirin square or thumb-throttle display; codes are single digits, often with a wrench icon.',
    usedOn: ['Kugoo S1 / M4 / G2 / G-Booster', 'Kukirin G2 Pro / G3 / M4'],
    hint: 'Some Kukirin firmware shows the same faults as "E-001 … E-007" — the number is the key.',
  },
  {
    id: 'ienyrid-ne',
    category: 'electric_scooter',
    family: 'ienyrid',
    codeStyle: '3E, 4E, 5E, 6E, 7E, 10E, 15E (digit + E)',
    appearance: 'iENYRID colour LCD (M4 / M4 Pro S+). The code is the digit followed by "E", e.g. "7E".',
    usedOn: ['iENYRID M4 / M4 Pro / M4 Pro S+ / M8'],
    hint: 'Note the reversed order versus Xiaomi: it is "7E", not "E7".',
  },
  {
    id: 'gotrax-e',
    category: 'electric_scooter',
    family: 'gotrax',
    codeStyle: 'E2, E3, E7',
    appearance: 'Gotrax LED/LCD console with a single button; codes flash as "E" + number.',
    usedOn: ['Gotrax G2 / G3 / GXL / Xr Elite'],
  },
  {
    id: 'hiboy-e',
    category: 'electric_scooter',
    family: 'hiboy',
    codeStyle: 'E1, E3, E4',
    appearance: 'Hiboy central LCD with mode buttons.',
    usedOn: ['Hiboy S2 / S2 Pro / X2 / MAX'],
  },
  {
    id: 'niu-numeric',
    category: 'electric_scooter',
    family: 'niu',
    codeStyle: 'numeric 03, 05, 07, 09, 10, 12, 21',
    appearance: 'NIU KQi dashboard with a large speed readout; codes show as two-digit numbers.',
    usedOn: ['NIU KQi1 / KQi2 / KQi3 / KQi Air'],
  },
  {
    id: 'vsett-qs4',
    category: 'electric_scooter',
    family: 'vsett',
    codeStyle: 'E1 – E13',
    appearance: 'QS-S4 / round VSETT display with trigger throttle; codes "E" + number.',
    usedOn: ['Vsett 8 / 9+ / 10+ / 11+', 'Zero 10X / 11X'],
  },
  {
    id: 'kaabo-lt01',
    category: 'electric_scooter',
    family: 'kaabo',
    codeStyle: 'E01 – E10 (LT01)',
    appearance: 'Kaabo LT01 colour display (Mantis/Wolf). The older central display numbers the same faults differently.',
    usedOn: ['Kaabo Mantis / Wolf Warrior / Wolf King / Skywalker'],
    hint: 'Confirm which display is fitted: LT01 vs the central display swap E02 and E04 meanings.',
  },
  {
    id: 'apollo-e',
    category: 'electric_scooter',
    family: 'apollo',
    codeStyle: 'E1 – E8',
    appearance: 'Apollo colour display with app pairing.',
    usedOn: ['Apollo Phantom / Ghost / City / Explore / Air'],
  },
  {
    id: 'dualtron-ey3',
    category: 'electric_scooter',
    family: 'dualtron',
    codeStyle: 'E1 – E5 (+ EY3/EY4 detail codes)',
    appearance: 'Dualtron EY3 / EY4 thumb display; codes "E" + number.',
    usedOn: ['Dualtron Ultra / Thunder / Victor / Eagle / Popular'],
  },
  {
    id: 'generic-e',
    category: 'electric_scooter',
    family: 'generic',
    codeStyle: 'E1 – E10 (generic controller)',
    appearance: 'The cheap cloned controller display fitted to most unbranded/budget scooters.',
    usedOn: ['Unbranded / Budget / Other e-scooters'],
  },
  // --- E-Bikes ------------------------------------------------------------
  {
    id: 'bosch-intuvia',
    category: 'ebike',
    family: 'bosch',
    codeStyle: '5-digit 4xx / 5xx, or text',
    appearance: 'Bosch Intuvia / Purion / Kiox / Nyon display; codes are 3-digit numbers, often with a wrench.',
    usedOn: ['Bosch Active/Performance/Cargo Line (Classic + Smart System)'],
  },
  {
    id: 'shimano-steps',
    category: 'ebike',
    family: 'shimano',
    codeStyle: 'E010 – E031 and W010 – W032',
    appearance: 'Shimano STEPS display (SC-E6100/E7000/E8000/EP8). "E" = error, "W" = warning.',
    usedOn: ['Shimano STEPS E6100 / E7000 / E8000 / EP8'],
  },
  {
    id: 'bafang-dpc',
    category: 'ebike',
    family: 'bafang',
    codeStyle: 'numeric 01 – 30',
    appearance: 'Bafang DPC-14 / 750C colour display; codes are two-digit numbers.',
    usedOn: ['Bafang BBS01 / BBS02 / BBSHD / M-series'],
  },
  {
    id: 'rad-lcd',
    category: 'ebike',
    family: 'radpower',
    codeStyle: 'numeric 6 – 34',
    appearance: 'Rad Power LCD with a keypad; codes are bare numbers.',
    usedOn: ['Rad Power RadCity / RadRover / RadRunner / RadMission / RadWagon'],
  },
  {
    id: 'brose-serial1',
    category: 'ebike',
    family: 'brose',
    codeStyle: 'numeric 10 – 74',
    appearance: 'Brose / Serial-1 display (Specialized, BH, etc.); codes are two-digit numbers.',
    usedOn: ['Brose Drive T / S / C / Mag systems'],
  },
  {
    id: 'generic-bike-e',
    category: 'ebike',
    family: 'generic_bike',
    codeStyle: 'E1 – E6',
    appearance: 'Generic hub-motor conversion-kit display (LCD3, KT, etc.).',
    usedOn: ['Hub-motor conversions', 'Yamaha / Giant / Specialized / Cannondale (as fitted generic)'],
  },
];

/** Displays that report the codes for a family — used to route from display → table. */
export function displaysForFamily(family: EVehicleErrorFamily): EVehicleDisplay[] {
  return EVEHICLE_DISPLAYS.filter((d) => d.family === family);
}

/** Displays for a category, in catalogue order. */
export function displaysForCategory(category: EVehicleCategory): EVehicleDisplay[] {
  return EVEHICLE_DISPLAYS.filter((d) => d.category === category);
}

/** The display that a brand/model uses, if the catalogue knows it. */
export function displayForModel(category: EVehicleCategory, brand: string, model: string): EVehicleDisplay | null {
  const family = errorFamilyFor(category, brand, model);
  return EVEHICLE_DISPLAYS.find((d) => d.family === family) ?? null;
}