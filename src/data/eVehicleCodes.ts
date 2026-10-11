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
  | 'brose';

/**
 * Reference library. Every code's `source` field points at one of these, so the
 * UI can link straight to the public documentation the meaning came from.
 * Verified 2026-10-07.
 */
export const EVEHICLE_SOURCES: Record<string, string> = {
  xiaomi: 'https://electrazoomscooters.com/blogs/news/xiaomi-m365-and-m365-pro-electric-scooter-error-codes-explained',
  xiaomiAlt: 'https://www.electricscooterslondon.com/blogs/e-bike-e-scooter-care-maintenance-and-repair-tips/xiaomi-m365-and-m365-pro-electric-scooter-error-codes',
  ninebot: 'https://escooterhut.co.uk/blogs/ride-read/ninebot-max-g30-error-codes',
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
  kaabo: 'https://electrickicks.gorgias.help/en-US/kaabo-wolf-king-gtr-%E2%80%93-central-display-error-code-troubleshooting-6250191',
  radpower: 'https://upway.co/blogs/news/rad-power-bikes-error-codes-list',
  brose: 'https://upway.co/blogs/news/serial-1-electric-bike-error-codes',
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
    { code: 'E11', title: 'Motor Phase A Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'The controller read an abnormal current in motor phase A (blue). Most often moisture ingress into the controller or the phase connection.', fix: ['Power down and let the deck dry if water is suspected.', 'Check the blue phase wire and its connector.', 'A persistent controller current fault needs board-level testing.', 'Replace the controller if the fault repeats.'], parts: ['Controller'] },
    { code: 'E12', title: 'Motor Phase B Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'Abnormal current in motor phase B (usually the black/brown phase). Same moisture/corrosion root as E11.', fix: ['Check the phase B wire and connector for corrosion.', 'Dry the controller if water is present.', 'Replace the controller if the fault persists.'], parts: ['Controller'] },
    { code: 'E13', title: 'Motor Phase C Current Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'Abnormal current in motor phase C (yellow). Usually corrosion from moisture ingress.', fix: ['Check the yellow phase wire and connector.', 'Dry the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E14', title: 'Throttle / Accelerator Fault', severity: 'High', system: 'throttle', source: S.xiaomi, description: 'The throttle or its cable to the controller is faulty. The accelerator contains fragile magnets that break if the scooter is dropped.', fix: ['Check the throttle, display and the cable between them.', 'Confirm the throttle returns to zero.', 'Replace the throttle if the sensor is faulty.'], parts: ['Throttle'] },
    { code: 'E15', title: 'Brake Lever Sensor Fault', severity: 'High', system: 'brake', source: S.xiaomi, description: 'The brake lever (or its cable) is faulty. The lever contains brittle magnets that break in a fall.', fix: ['Check the brake lever, display and cable between them.', 'Confirm the lever returns fully and is not held at startup.', 'Replace the brake lever sensor if faulty.'], parts: ['Brake lever switch'] },
    { code: 'E18', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', source: S.xiaomi, description: 'The controller receives an abnormal signal from the position sensors inside the motor. Do not ride if the motor judders.', fix: ['Inspect the external motor cable near the wheel for damage.', 'Check the motor connector contacts.', 'Replace the hall sensor board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E21', title: 'BMS Communication Fault', severity: 'High', system: 'bms', source: S.xiaomi, description: 'The controller cannot read the battery management system over its data line.', fix: ['Restart once.', 'Re-seat the battery connector under the deck.', 'Check the BMS data line and pack voltage at the charge port.', 'Replace the BMS if the pack is otherwise healthy.'], parts: ['BMS'] },
    { code: 'E22', title: 'BMS Authentication / Password Error', severity: 'High', system: 'bms', source: S.xiaomi, description: 'Bad BMS serial number or password — the battery has not authenticated with the controller (common after a battery swap).', fix: ['Confirm the battery is the correct genuine part for the model.', 'The BMS serial/password may need reprogramming.', 'Replace with a correctly provisioned pack.'], parts: ['Battery pack'] },
    { code: 'E23', title: 'BMS Serial Number / Abnormal Battery', severity: 'High', system: 'bms', source: S.xiaomi, description: 'The BMS reports a default or abnormal serial number / internal fault.', fix: ['Restart once.', 'Check the battery connector.', 'Replace the pack if the fault persists.'], parts: ['Battery pack'] },
    { code: 'E24', title: 'Wrong Supply Voltage / Motor Short', severity: 'High', system: 'controller', source: S.xiaomi, description: 'System voltage detection is out of range, or the motor has a short circuit.', fix: ['Check the charger is the correct voltage for the pack.', 'Inspect the motor phase wires for a short.', 'Test the pack voltage.', 'Replace the controller or motor as indicated.'], parts: ['Controller', 'Motor'] },
    { code: 'E26', title: 'Controller Flash / Memory Fault', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The controller failed to save data to its flash memory.', fix: ['Power-cycle for 10 minutes.', 'Re-flash the controller firmware if supported.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E27', title: 'Controller Authentication / Password Error', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The controller has a bad password / activation or serial-number read error (seen after a controller swap).', fix: ['Confirm the controller is correct for the model.', 'Re-provision / activate the controller.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E28', title: 'MOSFET Fault (High Side)', severity: 'High', system: 'controller', source: S.xiaomi, description: 'A power MOSFET in the controller is in an invalid state — a blown output transistor.', fix: ['Inspect the controller for burnt FETs.', 'Check the phase wires for shorts that killed the FET.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E29', title: 'MOSFET Fault (Low Side) / Controller Serial', severity: 'High', system: 'controller', source: S.xiaomi, description: 'MOSFET invalid low state or controller serial-number/activation problem.', fix: ['Check the phase wiring for shorts.', 'Re-provision the controller if it is a serial issue.', 'Replace the controller if the FETs are bad.'], parts: ['Controller'] },
    { code: 'E31', title: 'Controller Program / Firmware Error', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'Program/firmware execution error in the controller.', fix: ['Restart once.', 'Re-flash the official firmware.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E35', title: 'Scooter Serial Number Fault', severity: 'Medium', system: 'display', source: S.xiaomi, description: 'The scooter serial number is missing or incorrect — usually after a dashboard or controller replacement. It needs reprogramming.', fix: ['Record which parts were replaced.', 'Re-program the serial number with the correct model-specific tool/app.', 'Confirm the dashboard and controller serials match.', 'Replace the unit only if it cannot be reprogrammed.'], parts: [] },
    { code: 'E39', title: 'Battery Temperature Fault', severity: 'Medium', system: 'bms', source: S.xiaomi, description: 'The battery temperature reading is abnormal, or its sensor is faulty.', fix: ['Power off and let the pack return to room temperature naturally.', 'Do not apply direct heat or charge a hot pack.', 'Replace the pack if the sensor is faulty.'], parts: ['Battery pack'] },
    { code: 'E40', title: 'Controller Temperature Sensor Fault', severity: 'Medium', system: 'controller', source: S.xiaomi, description: 'The main controller temperature sensor is faulty or the controller is overheating.', fix: ['Let the controller cool.', 'Check the heatsink / thermal pad.', 'Replace the controller if the sensor is faulty.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // NINEBOT / SEGWAY (ES1–ES4, E22, Max G30/G65) — dashboard numeric codes.
  // -------------------------------------------------------------------------
  ninebot: [
    { code: 'E10', title: 'Dashboard / Controller Communication Error', severity: 'Medium', system: 'display', source: S.ninebot, description: 'The dashboard cannot communicate with the controller. Most often a loose wiring connection inside the stem.', fix: ['Power-cycle and retry.', 'Check the wiring inside the stem for a loose or damaged connection.', 'Check the dashboard connector for corrosion.', 'Replace the dashboard, then the controller, if needed.'], parts: ['Display harness'] },
    { code: 'E11', title: 'Motor Phase A Current Sampling Abnormal', severity: 'High', system: 'motor', source: S.ninebot, description: 'Abnormal current sampling in motor phase A. Persisting 11/12/13 usually means internal controller damage.', fix: ['Inspect the phase A wiring for frays, pinches or loose connectors.', 'Check for a shorted MOSFET.', 'Replace the controller if the fault persists.'], parts: ['Controller'] },
    { code: 'E12', title: 'Motor Phase B Current Sampling Abnormal', severity: 'High', system: 'motor', source: S.ninebot, description: 'Abnormal current sampling in motor phase B. Same root as E11.', fix: ['Inspect the phase B wiring.', 'Check the controller for damage.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E13', title: 'Motor Phase C Current Sampling Abnormal', severity: 'High', system: 'motor', source: S.ninebot, description: 'Abnormal current sampling in motor phase C. Same root as E11.', fix: ['Inspect the phase C wiring.', 'Check the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E14', title: 'Throttle Hall Sensor Abnormal', severity: 'High', system: 'throttle', source: S.ninebot, description: 'The throttle is not sending a correct signal — a faulty throttle, a pinched wire or a connector issue.', fix: ['Confirm the throttle moves freely and returns to zero.', 'Inspect the throttle cable, especially in the stem.', 'Replace the throttle if the sensor is faulty.'], parts: ['Throttle'] },
    { code: 'E15', title: 'Brake Lever Sensor Fault', severity: 'High', system: 'brake', source: S.ninebot, description: 'The brake lever Hall sensor reads abnormal or the lever was held during power-on.', fix: ['Release the brake fully and check it returns.', 'Inspect the brake handle magnets, wiring and connector.', 'Replace the lever sensor if it persists.'], parts: ['Brake lever switch'] },
    { code: 'E16', title: 'Internal Battery MOS Replacement Error', severity: 'High', system: 'bms', source: S.segwayFleet, description: 'The internal battery reports an incorrect MOS replacement error — an internal battery electronics fault.', fix: ['Restart once.', 'Check the internal battery connector.', 'Replace the internal battery if it persists.'], parts: ['Battery pack'] },
    { code: 'E17', title: 'External Battery MOS Replacement Error', severity: 'High', system: 'bms', source: S.segwayFleet, description: 'The external (second) battery reports an incorrect MOS replacement error.', fix: ['Check the external battery connector and harness.', 'Replace the external battery if it persists.'], parts: ['Battery pack'] },
    { code: 'E18', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', source: S.segwayFleet, description: 'A motor Hall sensor problem — inspect the 5-pin Hall connector before replacing parts.', fix: ['Inspect the 5-pin Hall connector under the deck.', 'Test the Hall sensors.', 'Replace the Hall board or the motor.'], parts: ['Hall sensor board'] },
    { code: 'E19', title: 'Battery Voltage Abnormal (Internal)', severity: 'Medium', system: 'bms', source: S.segwayFleet, description: 'The battery voltage is below the expected range.', fix: ['Charge the pack and watch the charger LED.', 'Check the battery connections.', 'Test with a known-good battery if it will not charge.'], parts: [] },
    { code: 'E20', title: 'External Battery Voltage Abnormal', severity: 'Medium', system: 'bms', source: S.segwayFleet, description: 'The voltage of the external (second) battery is out of range.', fix: ['Charge the external battery.', 'Check its connector and harness.', 'Replace the external battery if faulty.'], parts: [] },
    { code: 'E21', title: 'Battery Communication Error', severity: 'High', system: 'bms', source: S.ninebot, description: 'The controller cannot communicate with the battery management system.', fix: ['Re-seat the battery communication connector.', 'Check the wiring and controller connections first.', 'Test with known-good battery/controller hardware.'], parts: ['BMS'] },
    { code: 'E22', title: 'Battery Authentication / Serial Error', severity: 'Medium', system: 'bms', source: S.segwayFleet, description: 'Battery provisioning / serial-number mismatch. Use Segway tooling before replacing hardware.', fix: ['Confirm the battery is the correct genuine part.', 'Re-provision the battery serial.', 'Replace the pack if it cannot be provisioned.'], parts: ['Battery pack'] },
    { code: 'E23', title: 'BMS Serial Number / Communication Error', severity: 'Medium', system: 'bms', source: S.ninebot, description: 'Very similar to E21 — a default/incorrect BMS serial or a lost BMS data link.', fix: ['Re-seat the battery communication connector.', 'Check the data wiring.', 'Re-provision or replace the BMS.'], parts: ['BMS'] },
    { code: 'E24', title: 'System Voltage Detection Error', severity: 'High', system: 'controller', source: S.segwayFleet, description: 'System voltage detection is incorrect — a provisioning, battery or firmware mismatch.', fix: ['Check the charger and pack voltage.', 'Verify the firmware version matches.', 'Use Segway tooling before replacing hardware.'], parts: ['Controller'] },
    { code: 'E26', title: 'Flash Memory / Data Storage Error', severity: 'Medium', system: 'controller', source: S.segwayFleet, description: 'Controller flash-memory or data-storage error. Reset and firmware update come before replacement.', fix: ['Factory-reset via the app.', 'Re-flash the controller firmware.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E27', title: 'Control Board Password / Program Error', severity: 'Medium', system: 'controller', source: S.segwayFleet, description: 'Control-board password or program/order-code error.', fix: ['Re-flash the controller firmware.', 'Re-provision the board.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E28', title: 'MOSFET Transistor Invalid State', severity: 'High', system: 'controller', source: S.ninebot, description: 'A MOSFET in the controller is in an invalid state (defective transistor).', fix: ['Inspect the controller for burnt FETs.', 'Check the phase wiring for a short.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E29', title: 'MOSFET Transistor Invalid Low State', severity: 'High', system: 'controller', source: S.ninebot, description: 'A MOSFET is stuck in an invalid low state (defective transistor).', fix: ['Check the phase wiring for shorts.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E31', title: 'Program / Firmware Error', severity: 'Medium', system: 'controller', source: S.segwayFleet, description: 'Controller program or firmware error.', fix: ['Restart and check for a firmware update.', 'Re-flash the controller.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E35', title: 'Default Vehicle Serial Number Detected', severity: 'Medium', system: 'controller', source: S.segwayFleet, description: 'The vehicle serial number is missing or still the default — usually after a controller or dashboard replacement. It must be re-provisioned.', fix: ['Record which parts were replaced.', 'Update the controller/dashboard serial number with Segway tooling.', 'Confirm the serials match.'], parts: [] },
    { code: 'E37', title: 'Charging Base / Cable Failure', severity: 'Medium', system: 'charging', source: S.segwayFleet, description: 'The charging base or cable failed — inspect the wiring before replacing expensive parts.', fix: ['Check the charger and its cable.', 'Check the charge port and connections.', 'Replace the charger if faulty.'], parts: ['Charger'] },
    { code: 'E39', title: 'Battery Temperature Sensor Abnormal', severity: 'Medium', system: 'bms', source: S.segwayFleet, description: 'The internal battery temperature sensor is abnormal or the pack is overheating.', fix: ['Let the pack cool naturally.', 'Inspect the battery sensor wiring.', 'Replace the pack if the sensor is faulty.'], parts: ['Battery pack'] },
    { code: 'E40', title: 'Control Board Temperature Sensor Abnormal', severity: 'Medium', system: 'controller', source: S.segwayFleet, description: 'The control board temperature sensor is abnormal or the board is overheating.', fix: ['Cool the board.', 'Check the thermal pad / heatsink.', 'Replace the controller if the sensor is faulty.'], parts: ['Controller'] },
    { code: 'E41', title: 'Motor Temperature Abnormal', severity: 'Medium', system: 'motor', source: S.segwayFleet, description: 'The motor is overheating — from heavy usage, hills or an obstruction.', fix: ['Let the motor cool.', 'Check for an obstruction or bearing drag.', 'Reduce sustained load.'], parts: [] },
    { code: 'E45', title: 'Retail Firmware Flashed', severity: 'Low', system: 'controller', source: S.segwayFleet, description: 'The scooter has retail firmware flashed (often on ex-rental units).', fix: ['Confirm the intended firmware region.', 'Update to the correct firmware version.'], parts: [] },
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
    { code: '531', title: 'Configuration Mismatch', severity: 'Medium', system: 'controller', source: S.bosch, description: 'A configuration error — a component does not match the system configuration.', fix: ['Restart the system.', 'Check all components are compatible and correctly configured.', 'Dealer diagnosis if it persists.'], parts: [] },
  ],

  // -------------------------------------------------------------------------
  // SHIMANO STEPS (E6100 / E7000 / E8000 / EP8) — E (error) & W (warning) codes.
  // -------------------------------------------------------------------------
  shimano: [
    { code: 'E010', title: 'Drive Unit System Error', severity: 'High', system: 'motor', source: S.shimano, description: 'An abnormality was detected in the drive unit (sensor or internal error). Reset by disconnecting the battery; if it returns, the fault is in the unit electronics.', fix: ['Switch off and reset by disconnecting the battery for ~60 seconds.', 'Check the motor connections and wiring.', 'If the code returns, dealer E-TUBE diagnosis is required.'], parts: [] },
    { code: 'E012', title: 'Torque Sensor Initialization Error', severity: 'High', system: 'motor', source: S.shimano, description: 'The torque sensor could not initialise normally — a sensor calibration issue.', fix: ['Restart the system and confirm pedals are still at startup.', 'Check the sensor wiring.', 'Recalibrate or replace the sensor if it persists.'], parts: [] },
    { code: 'E013', title: 'Torque Sensor Error', severity: 'High', system: 'motor', source: S.shimano, description: 'The torque sensor is malfunctioning.', fix: ['Check the sensor position and wiring.', 'Recalibrate if possible.', 'Replace the sensor if faulty.'], parts: [] },
    { code: 'E020', title: 'Battery / Drive Unit Communication Error', severity: 'Medium', system: 'bms', source: S.shimano, description: 'A communication error between the battery and the drive unit was detected.', fix: ['Inspect the battery connections and communication cable.', 'Reset the system.', 'Dealer diagnosis if it persists.'], parts: ['Battery pack'] },
    { code: 'E021', title: 'Unsupported Battery', severity: 'Medium', system: 'bms', source: S.shimano, description: 'The connected battery conforms to system standards but is not supported by this system.', fix: ['Fit a supported Shimano battery model.', 'Confirm the part number against the system spec.'], parts: ['Battery pack'] },
    { code: 'E022', title: 'Non-Conforming Battery', severity: 'High', system: 'bms', source: S.shimano, description: 'The connected battery does not conform to system standards.', fix: ['Fit a battery that conforms to system standards.', 'Do not ride with an incompatible pack.'], parts: ['Battery pack'] },
    { code: 'W011', title: 'Speed Sensor Signal (Warning)', severity: 'Medium', system: 'motor', source: S.shimano, description: 'No plausible bicycle speed signal — the sensor/magnet gap is wrong or the magnet has twisted. A warning; assistance is reduced.', fix: ['Check the gap between the magnet and speed sensor.', 'Straighten the spoke magnet.', 'Check the sensor connection.'], parts: [] },
    { code: 'W013', title: 'Sensor Initialization (Warning)', severity: 'Low', system: 'motor', source: S.shimano, description: 'Sensor initialisation could not complete normally at startup.', fix: ['Restart the system with the pedals still.', 'Ensure proper initialisation.', 'Dealer diagnosis if it persists.'], parts: [] },
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
    { code: 'E6', title: 'Battery Undervoltage', severity: 'Medium', system: 'bms', source: S.vsett, description: 'Battery voltage is too low to drive the scooter.', fix: ['Charge the pack fully.', 'Test each cell group if it will not hold charge.', 'Replace the pack if a group is dead.'], parts: [] },
    { code: 'E7', title: 'Motor Fault', severity: 'High', system: 'motor', source: S.vsett, description: 'A motor fault — Hall sensor or phase wiring. On dual-motor models, swap the phase/Hall plugs to isolate which motor.', fix: ['Check the motor phase and Hall connectors.', 'On dual motors, swap the connectors to identify the faulty side.', 'Replace the Hall board or motor.'], parts: ['Hall sensor board'] },
    { code: 'E8', title: 'Throttle Fault', severity: 'High', system: 'throttle', source: S.vsett, description: 'The throttle is not reacting correctly.', fix: ['Check the throttle wiring and connection.', 'Confirm it returns to zero.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E9', title: 'Controller Fault', severity: 'High', system: 'controller', source: S.vsett, description: 'Controller fault — often a blown MOSFET after water ingress or hard use. Usually needs a full controller replacement.', fix: ['Check the controller for burnt components.', 'Check the phase wiring for a short.', 'Replace the controller (wire-for-wire).'], parts: ['Controller'] },
    { code: 'E10', title: 'Communication Receiving Fault', severity: 'Medium', system: 'display', source: S.vsett, description: 'The display is not receiving data from the controller — a fault in the LCD, controller or the comms wire. Often appears after quick handlebar movement.', fix: ['Unplug the LCD module and check the connector pins.', 'Plug it back in and wiggle the cable to test.', 'Replace the communication harness if it persists.'], parts: ['Harness'] },
    { code: 'E11', title: 'Communication Transmitting Fault', severity: 'Medium', system: 'display', source: S.vsett, description: 'The controller is not receiving data from the display (same harness as E10).', fix: ['Reseat the LCD connector.', 'Check the harness for damage.', 'Replace the communication harness.'], parts: ['Harness'] },
    { code: 'E12', title: 'BMS Communication Failure', severity: 'High', system: 'bms', source: S.vsett, description: 'The controller cannot communicate with the battery BMS.', fix: ['Check whether the battery still charges.', 'Check the battery-to-controller connector.', 'Replace the BMS or pack.'], parts: ['BMS'] },
    { code: 'E13', title: 'Headlight Error', severity: 'Low', system: 'charging', source: S.vsett, description: 'A fault with the LED headlight — a loose connection or a damaged LED.', fix: ['Check the headlight cable and connector.', 'Test the LED with a multimeter on diode mode.', 'Replace the headlight.'], parts: ['Headlight'] },
  ],

  // -------------------------------------------------------------------------
  // KAABO (Mantis / Wolf Warrior / Wolf King, LT01 & central displays).
  // -------------------------------------------------------------------------
  kaabo: [
    { code: 'E01', title: 'Motor Phase Error', severity: 'High', system: 'motor', source: S.kaabo, description: 'The scooter detects a motor phase fault.', fix: ['Check the motor phase wiring and connectors.', 'On dual motors, isolate the faulty motor.', 'Replace the phase harness or motor.'], parts: ['Motor harness'] },
    { code: 'E02', title: 'Brake Sensor Error', severity: 'High', system: 'brake', source: S.kaabo, description: 'A brake sensor fault prevents acceleration (the motor cut-off is engaged).', fix: ['Confirm the brake levers return fully.', 'Check the brake sensor wiring.', 'Replace the lever sensor.'], parts: ['Brake lever switch'] },
    { code: 'E04', title: 'Throttle Error', severity: 'High', system: 'throttle', source: S.kaabo, description: 'The scooter detects a throttle fault — wiring changes, connector pins or the display main cable.', fix: ['Check for modified wiring.', 'Inspect the throttle connector pins.', 'Replace the throttle if faulty.'], parts: ['Throttle'] },
    { code: 'E05', title: 'Undervoltage Protection', severity: 'Medium', system: 'bms', source: S.kaabo, description: 'Low-voltage protection — the pack is below the cut-off (check the P1 low-voltage setting on LT01 displays).', fix: ['Charge the pack.', 'Check the P1 low-voltage setting if it triggers early.', 'Test the pack if it will not charge.'], parts: [] },
    { code: 'E06', title: 'Controller Error', severity: 'High', system: 'controller', source: S.kaabo, description: 'The scooter detects a controller fault — loose wiring or a failing controller.', fix: ['Restart the scooter.', 'Check the controller wiring.', 'Replace the controller if the error remains.'], parts: ['Controller'] },
    { code: 'E08', title: 'High Temperature Protection', severity: 'Medium', system: 'controller', source: S.kaabo, description: 'High-temperature protection — the controller or motor is too hot.', fix: ['Let the scooter cool.', 'Check for a binding wheel or heavy load.', 'Check the controller thermal pad.'], parts: [] },
    { code: 'E10', title: 'Communication Failure', severity: 'Medium', system: 'motor', source: S.kaabo, description: 'Communication failure — often the controller is no longer supplying the 5 V Hall reference to the motors.', fix: ['Measure the 4–5 V reference at the motor Hall connector.', 'If it is missing, the controller has failed.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E30', title: 'Central Display Communication Error', severity: 'Medium', system: 'display', source: S.kaabo, description: 'The central display has lost communication with the controller.', fix: ['Check the display cable and junction box.', 'Reseat the main cable.', 'Replace the harness or display if it persists.'], parts: ['Display harness'] },
  ],

  // -------------------------------------------------------------------------
  // RAD POWER BIKES (RadCity / RadRover / RadRunner) — numeric codes.
  // -------------------------------------------------------------------------
  radpower: [
    { code: '6', title: 'Battery Undervoltage', severity: 'Medium', system: 'bms', source: S.radpower, description: 'Battery undervoltage — the pack is flat or aged.', fix: ['Charge the pack fully.', 'Test the pack if it will not hold charge.', 'Replace the pack if a group is weak.'], parts: [] },
    { code: '10', title: 'Battery Overvoltage', severity: 'Medium', system: 'bms', source: S.radpower, description: 'Battery overvoltage — check the charger, or a failed BMS allowing over-charge.', fix: ['Confirm the correct charger is used.', 'Check the pack voltage.', 'Replace the charger or BMS if faulty.'], parts: ['Charger', 'BMS'] },
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
    { code: '1', title: 'General System Error', severity: 'Medium', system: 'controller', source: S.brose, description: 'A general system error. Usually clears after a power cycle.', fix: ['Power-cycle the system (off 10 s, on).', 'Check all connectors are seated.', 'Dealer diagnosis if it returns.'], parts: [] },
    { code: '3', title: 'Speed Sensor Error', severity: 'Medium', system: 'motor', source: S.brose, description: 'The speed sensor is not reading correctly — magnet alignment or wiring.', fix: ['Check the spoke magnet alignment and gap.', 'Check the sensor cable.', 'Replace the sensor if faulty.'], parts: ['Speed sensor'] },
    { code: '5', title: 'Motor Overtemperature', severity: 'Medium', system: 'motor', source: S.brose, description: 'The motor has exceeded its temperature limit.', fix: ['Let the motor cool (15–20 minutes).', 'Reduce sustained load or hills.', 'Check for a binding drive.'], parts: [] },
    { code: '9', title: 'Internal Motor Error', severity: 'High', system: 'motor', source: S.brose, description: 'An internal motor fault — do not attempt repeated restarts.', fix: ['Stop riding.', 'Contact a Brose dealer for diagnosis.', 'Do not open the drive unit.'], parts: [] },
    { code: '60', title: 'Communication Error', severity: 'Medium', system: 'display', source: S.brose, description: 'A communication error between the system components — check wiring and plugs.', fix: ['Check the wiring and plug connections.', 'Restart the system.', 'Dealer diagnosis if it persists.'], parts: [] },
    { code: '81', title: 'Speed Sensor Error (Display)', severity: 'Medium', system: 'motor', source: S.brose, description: 'Display-side speed sensor error — check the sensor and spoke magnet.', fix: ['Check the speed sensor and spoke magnet.', 'Adjust and clean.', 'Replace the sensor if faulty.'], parts: ['Speed sensor'] },
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
  { category: 'electric_scooter', brand: 'GoTrax', model: 'G2', family: 'generic' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'G3', family: 'generic' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'GXL', family: 'generic' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'Xr Elite', family: 'generic' },
  { category: 'electric_scooter', brand: 'GoTrax', model: 'Other GoTrax Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i9', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i9 Pro', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'i10', family: 'generic' },
  { category: 'electric_scooter', brand: 'iScooter', model: 'Other iScooter Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'EA10', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'ES10', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'ESA Pro', family: 'generic' },
  { category: 'electric_scooter', brand: 'Okai', model: 'Other Okai Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'S2', family: 'generic' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'S2 Pro', family: 'generic' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'X2', family: 'generic' },
  { category: 'electric_scooter', brand: 'Hiboy', model: 'Other Hiboy Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'S1', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'S2', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'L9', family: 'generic' },
  { category: 'electric_scooter', brand: 'InMotion', model: 'Other InMotion Model', family: 'generic' },
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