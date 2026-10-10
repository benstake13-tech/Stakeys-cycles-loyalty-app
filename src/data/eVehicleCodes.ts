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
export type EVehicleErrorFamily = 'generic' | 'xiaomi' | 'ninebot' | 'pure' | 'apollo' | 'dualtron' | 'talaria';

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

const CODE_FAMILIES: Record<EVehicleErrorFamily, EVehicleErrorDefinition[]> = {
  // -------------------------------------------------------------------------
  // GENERIC — codes shared by the majority of cheap controllers/displays.
  // Label them "E0X" because that is how the rider reports them.
  // -------------------------------------------------------------------------
  generic: [
    { code: 'E01', title: 'Communications / Display Link Error', severity: 'Medium', system: 'display', description: 'The display cannot talk to the controller. Caused by a loose display/controller plug, a broken cable or a faulty display or controller.', fix: ['Power down and disconnect the battery.', 'Reseat the 6-pin display cable at both ends and check for bent pins.', 'Check for water ingress / corrosion in the connector.', 'Replace the display cable, then the display, then the controller, in that order.'], parts: ['Display harness'] },
    { code: 'E02', title: 'Brake Lever / Brake Signal Fault', severity: 'High', system: 'brake', description: 'The controller sees a permanently applied brake (or a stuck brake switch). The motor will refuse to run even with the throttle.', fix: ['Check both brake levers are fully released.', 'Unplug each brake cut-off sensor in turn to isolate a stuck switch.', 'Check the brake lever return spring and cable.', 'Replace the faulty lever switch.'], parts: ['Brake lever switch'] },
    { code: 'E03', title: 'Throttle Fault (Stuck / Open Circuit)', severity: 'High', system: 'throttle', description: 'The throttle signal is out of range — either the throttle is stuck on, the hall sensor failed, or the 3-pin connector is loose.', fix: ['Disconnect the throttle and check the connector pins.', 'Check the throttle returns freely and the grip spring works.', 'Measure the throttle signal (0.8–3.6 V expected).', 'Replace the throttle if out of range.'], parts: ['Throttle'] },
    { code: 'E04', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', description: 'One or more of the three hall sensors inside the motor are not reporting — a disconnected phase/hall wire, a broken sensor, or a failed controller.', fix: ['Check the motor phase and hall connectors for corrosion/bent pins.', 'With the motor cover open, test the hall sensors (5 V / ground / 3 signal wires).', 'Check for a burnt controller in the hall supply line.', 'Replace the hall sensor board or the complete motor harness.'], parts: ['Hall sensor board', 'Motor harness'] },
    { code: 'E05', title: 'Motor Overheating / Thermal Cut-Out', severity: 'Medium', system: 'motor', description: 'The motor or controller exceeded its temperature limit — long hill climbs, a stalled wheel, over-inflation or a seized bearing.', fix: ['Let the scooter cool for 30–60 minutes.', 'Check the wheel spins freely (no bearing drag).', 'Check brake drag.', 'Reduce load / the rider’s weight for the model.'], parts: [] },
    { code: 'E06', title: 'Low Battery / Low-Voltage Cut-Off', severity: 'Medium', system: 'bms', description: 'The battery reached the controller cut-off voltage. The display shows a battery/lightning symbol rather than a code on many models.', fix: ['Plug in the charger and confirm the charger LED turns red.', 'If it will not charge, test each cell group with a multimeter.', 'Check the charge port fuse and the BMS charge path.'], parts: [] },
    { code: 'E07', title: 'Motor Blocked / Stall Error', severity: 'High', system: 'motor', description: 'The controller detects the wheel is not turning while power is applied — a jammed wheel, seized bearings, or a damaged motor.', fix: ['Check the wheel spins freely by hand.', 'Check for objects wrapped around the axle.', 'Check the brake is not dragging.', 'Inspect the motor axle and bearings.'], parts: ['Bearings'] },
    { code: 'E08', title: 'Display / Controller EEPROM Fault', severity: 'Low', system: 'display', description: 'The controller’s configuration memory failed to read, usually after a lightning strike or a failed firmware update.', fix: ['Power-cycle the scooter for 10 minutes.', 'Check the controller battery backup.', 'Re-flash the controller firmware if supported.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E09', title: 'Regenerative Brake / EABS Fault', severity: 'Medium', system: 'brake', description: 'The electronic (regen) brake is requesting too much current or is malfunctioning, so the controller disabled it.', fix: ['Check the motor connections are tight (regen relies on the motor).', 'Check the brake lever switch wiring.', 'Update the controller firmware if available.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E10', title: 'Communication Timeout (Controller → Display)', severity: 'Medium', system: 'display', description: 'The display lost the serial link to the controller mid-ride. A stiff cable at the handlebar joint is the usual cause.', fix: ['Check the folding-joint cable for crushed wires.', 'Reseat the display connector.', 'Replace the harness if there is intermittent power.'], parts: ['Harness'] },
    { code: 'E11', title: 'Hall/Phase Wire Short', severity: 'High', system: 'motor', description: 'A short between the motor phase and hall wires, usually where the harness rubs the frame or at a connector.', fix: ['Test continuity of each phase/hall wire to ground.', 'Find the chafed spot and repair or replace the harness.', 'Check the controller MOSFETs after a short.'], parts: ['Motor harness'] },
    { code: 'E12', title: 'Controller Over-Voltage', severity: 'High', system: 'controller', description: 'The controller measured a battery voltage above its maximum — a wrong charger, or a failed BMS allowing over-charge.', fix: ['Verify the charger voltage matches the pack (36/48/52 V).', 'Test each cell group for over-voltage.', 'Check the BMS balancing.', 'Replace the BMS if it fails to cut off.'], parts: ['BMS', 'Charger'] },
    { code: 'E13', title: 'Undervoltage (Pack Below Safe Minimum)', severity: 'High', system: 'bms', description: 'The battery pack has dropped below the safe per-cell minimum — the BMS has locked the pack out.', fix: ['Measure pack voltage at the charge port.', 'Using a BMS tester, check each cell group.', 'If one group is dead, replace the pack (never balance-charge a damaged pack in the workshop).', 'Recycle the old pack correctly.'], parts: ['Battery pack'] },
    { code: 'E14', title: 'Overcurrent (Controller Cut-Out)', severity: 'High', system: 'controller', description: 'The controller drew more than its current limit — a stalled motor, a wrong-wattage motor, or a shorted MOSFET.', fix: ['Check for a binding wheel or brake.', 'Check the motor phase wires for shorts.', 'Inspect the controller MOSFETs for a dead short.', 'Replace the controller if the FETs are bad.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // XIAOMI (M365 / Pro / Essential families) — codes shown on the dashboard.
  // -------------------------------------------------------------------------
  xiaomi: [
    { code: 'E21', title: 'BMS Communication Error', severity: 'High', system: 'bms', description: 'The dashboard cannot read the battery management system over its UART line — a loose battery connector, a blown BMS fuse, or a dead BMS.', fix: ['Re-seat the battery connector (under the deck).', 'Check continuity of the BMS data line.', 'Test the pack voltage at the charge port.', 'Replace the BMS if the pack is otherwise healthy.'], parts: ['BMS'] },
    { code: 'E22', title: 'Overcurrent', severity: 'High', system: 'controller', description: 'Controllers on the M365 family report E22 when current spikes above the limit — usually a stuck motor or a controller fault.', fix: ['Check the motor spins freely and no brake drags.', 'Drain the battery fully, then test.', 'Replace the controller if it persists.'], parts: ['Controller'] },
    { code: 'E23', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'The throttle hall sensor reads out of range, or the throttle wire is damaged at the stem joint.', fix: ['Check the throttle connector socket.', 'Check the stem folding joint cable.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E24', title: 'Motor Hall Sensor Fault', severity: 'High', system: 'motor', description: 'Motor hall sensor failure, virtually always on the M365 — the phase/hall wiring is chafed or a sensor died.', fix: ['Open the motor and inspect the hall board.', 'Test each hall sensor with 5 V applied.', 'Replace the hall board or the motor.'], parts: ['Hall sensor board', 'Motor'] },
    { code: 'E25', title: 'Brake / Brake Lever Fault', severity: 'High', system: 'brake', description: 'The regenerative-brake lever switch reads permanently engaged.', fix: ['Check the left brake lever switch.', 'Check the electronic-brake wire in the handlebar.', 'Replace the lever cluster.'], parts: ['Brake lever switch'] },
    { code: 'E26', title: 'Motor Fixing Bolt Loose / Motorphase Fault', severity: 'High', system: 'motor', description: 'Indicates the motor phase wire has a poor connection or the axle bolt worked loose.', fix: ['Torque the axle bolts to spec.', 'Check the phase connectors and motor nut.', 'Reseat the phase wires.'], parts: [] },
    { code: 'E27', title: 'Controller Temperature Fault', severity: 'Medium', system: 'controller', description: 'The controller is overheating — riding in very hot weather or a failing MOSFET.', fix: ['Cool the scooter down.', 'Check the controller heatsink and thermal pad.', 'Replace the controller if it repeats.'], parts: ['Controller'] },
    { code: 'E28', title: 'LED / Dashboard Communications Fault', severity: 'Low', system: 'display', description: 'The dashboard LED ring lost communications with the controller.', fix: ['Reseat the dashboard cable.', 'Check the folding joint harness.', 'Replace the dashboard or controller.'], parts: ['Dashboard'] },
    { code: 'E29', title: 'Low Battery BMS Lockout', severity: 'Medium', system: 'bms', description: 'The BMS reports a low-voltage lockout.', fix: ['Charge for 30 minutes to exit lockout.', 'Test the pack if it will not charge.', 'Check the charge port fuse.'], parts: [] },
    { code: 'E30', title: 'Docking / Communication General Fault', severity: 'Medium', system: 'controller', description: 'A generic controller fault on the M365 family.', fix: ['Check all controller connectors.', 'Test the controller 5 V rail.', 'Replace the controller if needed.'], parts: ['Controller'] },
    { code: 'E31', title: 'Battery Disposal / Low Cell Warning', severity: 'High', system: 'bms', description: 'The BMS flags a severely depleted cell that must not be re-used at full capacity.', fix: ['Measure each cell group.', 'Replace the pack if one group is below minimum.', 'Never ship or store a swollen pack — recycle it.'], parts: ['Battery pack'] },
  ],

  // -------------------------------------------------------------------------
  // NINEBOT / SEGWAY (ES1–ES4, E22, Max G30) — "ER" codes on the dashboard.
  // -------------------------------------------------------------------------
  ninebot: [
    { code: 'E01', title: 'Scooter Communication Error', severity: 'Medium', system: 'controller', description: 'Internal CAN/UART failure between the dashboard and the controller.' , fix: ['Power-cycle the scooter.', 'Check the dashboard ribbon cable.', 'Update the firmware via the Ninebot app.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER01', title: 'Scooter Communication Error', severity: 'Medium', system: 'display', description: 'Display/controller CAN link error.', fix: ['Reseat the dashboard cable.', 'Check the handlebar harness.', 'Replace the dashboard or controller.'], parts: ['Dashboard'] },
    { code: 'ER02', title: 'Battery Communication Error', severity: 'Medium', system: 'bms', description: 'The controller cannot talk to the battery BMS.', fix: ['Check the battery power connector and the BMS data plug.', 'Test the BMS 12 V rail.', 'Replace the BMS or the pack.'], parts: ['BMS'] },
    { code: 'ER03', title: 'Overvoltage / Charger Fault', severity: 'High', system: 'bms', description: 'The charger voltage is too high for the pack, or the BMS failed to cut off.', fix: ['Verify the correct charger is being used.', 'Test the pack voltage at the port.', 'Replace the charger or BMS.'], parts: ['Charger', 'BMS'] },
    { code: 'ER04', title: 'Undervoltage Lockout', severity: 'High', system: 'bms', description: 'Battery is at its low-voltage cut-off — the board disabled the motor.', fix: ['Charge the scooter.', 'If it will not charge, test the cells and the charge port fuse.'], parts: [] },
    { code: 'ER05', title: 'Malfunction Code: Main Board / Controller', severity: 'High', system: 'controller', description: 'Main board fault — almost always a burnt MOSFET or a dead controller on the Max series.', fix: ['Check the controller for burnt FETs.', 'Check the motor phase connectors.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER06', title: 'Ride Data / Internal Memory Fault', severity: 'Low', system: 'controller', description: 'The controller’s ride-history memory failed — generally cosmetic.', fix: ['Factory reset via the app.', 'Replace the controller if it recurs.'], parts: [] },
    { code: 'ER07', title: 'Motor Fault', severity: 'High', system: 'motor', description: 'Motor hall or phase fault detected by the controller.', fix: ['Check the motor connector under the deck.', 'Test the hall sensor board.', 'Replace the motor or hall board.'], parts: ['Hall sensor board', 'Motor'] },
    { code: 'ER08', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'Throttle signal out of range.', fix: ['Check the throttle connector.', 'Test the throttle signal.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'ER09', title: 'Brake Fault', severity: 'High', system: 'brake', description: 'Brake lever signal permanently active.', fix: ['Check both brake switches.', 'Check the lever return.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'ER10', title: 'Brake Lever Fault (Second Side)', severity: 'Medium', system: 'brake', description: 'The other brake lever also reports a fault.', fix: ['Check both levers and their cables.', 'Replace both lever switches if needed.'], parts: ['Brake lever switch'] },
    { code: 'ER11', title: 'Permanent Brake Regen Fault', severity: 'Medium', system: 'brake', description: 'The regen brake is requesting current while the motor should be free-running.', fix: ['Check the brake switch wiring.', 'Test the motor connections.', 'Replace the controller if needed.'], parts: ['Controller'] },
    { code: 'ER12', title: 'System Overvoltage', severity: 'High', system: 'controller', description: 'Input voltage above the controller’s limit.', fix: ['Check the charger.', 'Test the pack voltage.', 'Replace the charger or BMS.'], parts: ['Charger', 'BMS'] },
    { code: 'ER13', title: 'Motor Undervoltage', severity: 'High', system: 'bms', description: 'Motor-side undervoltage — same root as a drained or imbalanced pack.', fix: ['Charge and balance the pack.', 'Test cell groups.', 'Replace the pack if imbalanced.'], parts: [] },
    { code: 'ER14', title: 'Controller Current Sensor Fault', severity: 'High', system: 'controller', description: 'The current shunt on the controller reads out of range.', fix: ['Check the phase wiring for shorts.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER15', title: 'Controller MOSFET / Current Fault', severity: 'High', system: 'controller', description: 'MOSFET bridge fault.', fix: ['Inspect the controller for burnt FETs.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER16', title: 'Controller Fault (Generic)', severity: 'High', system: 'controller', description: 'Unspecified main board error.', fix: ['Re-flash the firmware.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER17', title: 'Drive Mode / Buttons Fault', severity: 'Low', system: 'display', description: 'Dashboard button cluster error.', fix: ['Check the dashboard button PCB.', 'Replace the dashboard.'], parts: ['Dashboard'] },
    { code: 'ER18', title: 'Controller I2C / IC Fault', severity: 'High', system: 'controller', description: 'On-board I2C device error.', fix: ['Re-flash the controller.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER19', title: 'Controller Clock / Oscillator Fault', severity: 'Medium', system: 'controller', description: 'The controller’s oscillator is out of spec.', fix: ['Power-cycle for 10 minutes.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'ER20', title: 'Firmware Version Mismatch', severity: 'Medium', system: 'display', description: 'The dashboard and motor controller firmware do not match.', fix: ['Update both via the Ninebot/Segway app.', 'Flash the correct firmware region.'], parts: [] },
    { code: 'ER21', title: 'IPX / Moisture Sensing Fault', severity: 'Low', system: 'controller', description: 'The moisture sensor flag is stuck after water exposure.', fix: ['Dry the controller and connectors.', 'Check the seals.', 'Replace the controller if the flag resets wrong.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // PURE (Air / Advance) — E codes on the OLED dash.
  // -------------------------------------------------------------------------
  pure: [
    { code: 'E01', title: 'Motor Hall Fault', severity: 'High', system: 'motor', description: 'Motor hall sensor fault.', fix: ['Check the motor connector.', 'Test the hall sensors.', 'Replace the hall board / motor.'], parts: ['Hall sensor board'] },
    { code: 'E02', title: 'Motor Phase Fault', severity: 'High', system: 'motor', description: 'A phase wire is open or shorted.', fix: ['Check the phase connectors and axle exit.', 'Repair or replace the harness.', 'Replace the motor if the windings are burnt.'], parts: ['Motor harness'] },
    { code: 'E03', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'Throttle signal out of range.', fix: ['Check the throttle connector.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E04', title: 'Brake Fault', severity: 'High', system: 'brake', description: 'Brake switch permanently on.', fix: ['Check both brake levers.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'E05', title: 'BMS Fault', severity: 'High', system: 'bms', description: 'Battery management communication fault.', fix: ['Check the BMS data cable.', 'Test the pack.', 'Replace the BMS.'], parts: ['BMS'] },
    { code: 'E06', title: 'Controller Fault', severity: 'High', system: 'controller', description: 'Main board fault.', fix: ['Re-flash the controller.', 'Check the connectors.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E07', title: 'Low Battery', severity: 'Medium', system: 'bms', description: 'Battery too low to ride.', fix: ['Charge the scooter.', 'Test if it will not charge.'], parts: [] },
    { code: 'E08', title: 'Overheat', severity: 'Medium', system: 'motor', description: 'Motor or controller over-temperature.', fix: ['Let it cool.', 'Check for bearing drag.', 'Check hills/load.'], parts: [] },
    { code: 'E09', title: 'Communication Error', severity: 'Medium', system: 'display', description: 'Display/controller link lost.', fix: ['Reseat the display cable.', 'Check the fold joint harness.'], parts: ['Harness'] },
    { code: 'E10', title: 'Regen Brake Fault', severity: 'Medium', system: 'brake', description: 'Electronic brake fault.', fix: ['Check the motor wiring.', 'Check the lever switch.', 'Replace the controller if needed.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // APOLLO (Phantom / Ghost / City) — "E0X" on the display.
  // -------------------------------------------------------------------------
  apollo: [
    { code: 'E01', title: 'Controller Communication Fault', severity: 'High', system: 'controller', description: 'Main board / dashboard comms error.', fix: ['Re-seat all board connectors.', 'Update via the Apollo app.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E02', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'Throttle out of range.', fix: ['Check the throttle connector.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E03', title: 'Brake Fault', severity: 'High', system: 'brake', description: 'Brake lever active fault.', fix: ['Check the brake switches.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'E04', title: 'Motor Hall Fault', severity: 'High', system: 'motor', description: 'Motor hall sensor fault.', fix: ['Check the motor connector.', 'Test the hall board.', 'Replace the hall board / motor.'], parts: ['Hall sensor board'] },
    { code: 'E05', title: 'Controller Overheat', severity: 'Medium', system: 'controller', description: 'Controller over-temperature.', fix: ['Cool the deck.', 'Check the thermal pad.', 'Check for current spikes.'], parts: ['Controller'] },
    { code: 'E06', title: 'BMS Communication Fault', severity: 'High', system: 'bms', description: 'The BMS lost comms.', fix: ['Check the battery harness.', 'Test the BMS.', 'Replace the BMS or pack.'], parts: ['BMS'] },
    { code: 'E07', title: 'Low Voltage', severity: 'Medium', system: 'bms', description: 'Pack under-voltage.', fix: ['Charge the pack.', 'Check the charge port fuse.'], parts: [] },
    { code: 'E08', title: 'High Voltage', severity: 'High', system: 'bms', description: 'Pack over-voltage.', fix: ['Check the charger.', 'Replace the charger or BMS.'], parts: ['Charger', 'BMS'] },
    { code: 'E09', title: 'Controller Overcurrent', severity: 'High', system: 'controller', description: 'Current spike.', fix: ['Check the motor phases.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E10', title: 'Motor Phase Fault', severity: 'High', system: 'motor', description: 'Phase open/short.', fix: ['Check the phase wiring.', 'Replace the harness.'], parts: ['Motor harness'] },
  ],

  // -------------------------------------------------------------------------
  // DUALTRON (Ultra / Thunder / Victor) — E-codes on the EY dash.
  // -------------------------------------------------------------------------
  dualtron: [
    { code: 'E01', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'Throttle signal out of range.', fix: ['Check the throttle connector.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E02', title: 'Brake Fault', severity: 'High', system: 'brake', description: 'Brake lever switch fault.', fix: ['Check the brake switches.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'E03', title: 'Motor Hall Fault', severity: 'High', system: 'motor', description: 'Motor hall sensor fault.', fix: ['Check the motor connectors.', 'Test the hall board.', 'Replace the hall board / motor.'], parts: ['Hall sensor board'] },
    { code: 'E04', title: 'Motor Phase Fault', severity: 'High', system: 'motor', description: 'Phase wire open/short.', fix: ['Check the phase wiring.', 'Replace the harness.'], parts: ['Motor harness'] },
    { code: 'E05', title: 'Controller Overheat', severity: 'Medium', system: 'controller', description: 'Controller too hot.', fix: ['Cool the deck.', 'Check the thermal interface.', 'Replace the controller if it recurs.'], parts: ['Controller'] },
    { code: 'E06', title: 'BMS COMMS Fault', severity: 'High', system: 'bms', description: 'BMS lost comms.', fix: ['Check the battery harness.', 'Replace the BMS.'], parts: ['BMS'] },
    { code: 'E07', title: 'Low Voltage', severity: 'Medium', system: 'bms', description: 'Pack undervoltage.', fix: ['Charge the pack.', 'Check the charge fuse.'], parts: [] },
    { code: 'E08', title: 'Motor Blocked', severity: 'High', system: 'motor', description: 'The wheel is jammed.', fix: ['Check for brake drag / debris.', 'Check the bearings.', 'Check the motor axle.'], parts: ['Bearings'] },
    { code: 'E09', title: 'Regen Fault', severity: 'Medium', system: 'brake', description: 'Regen braking fault.', fix: ['Check the motor wiring.', 'Check the lever switch.', 'Replace the controller.'], parts: ['Controller'] },
  ],

  // -------------------------------------------------------------------------
  // TALARIA (off-road e-moto style / big controllers) — E-codes.
  // -------------------------------------------------------------------------
  talaria: [
    { code: 'E01', title: 'Throttle Fault', severity: 'High', system: 'throttle', description: 'Throttle out of range.', fix: ['Check the throttle connector.', 'Replace the throttle.'], parts: ['Throttle'] },
    { code: 'E02', title: 'Brake Fault', severity: 'High', system: 'brake', description: 'Brake switch fault.', fix: ['Check the brake switches.', 'Replace the switch.'], parts: ['Brake lever switch'] },
    { code: 'E03', title: 'Motor Hall Fault', severity: 'High', system: 'motor', description: 'Hall sensor fault.', fix: ['Check the motor connector.', 'Test the hall board.', 'Replace the hall board / motor.'], parts: ['Hall sensor board'] },
    { code: 'E04', title: 'Controller Overheat', severity: 'Medium', system: 'controller', description: 'Controller too hot.', fix: ['Cool the controller.', 'Check the fan/thermal pad.', 'Replace the controller if needed.'], parts: ['Controller'] },
    { code: 'E05', title: 'Controller Overcurrent', severity: 'High', system: 'controller', description: 'Current spike.', fix: ['Check the motor phases.', 'Check for a stalled wheel.', 'Replace the controller.'], parts: ['Controller'] },
    { code: 'E06', title: 'BMS Fault', severity: 'High', system: 'bms', description: 'BMS communication fault.', fix: ['Check the battery harness.', 'Replace the BMS.'], parts: ['BMS'] },
    { code: 'E07', title: 'Low Voltage Lockout', severity: 'Medium', system: 'bms', description: 'Pack undervoltage.', fix: ['Charge the pack.', 'Check the charge fuse.'], parts: [] },
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
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Wolf Warrior', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Wolf King', family: 'dualtron' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Skywalker', family: 'generic' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Mantis', family: 'apollo' },
  { category: 'electric_scooter', brand: 'Kaabo', model: 'Other Kaabo Model', family: 'generic' },
  { category: 'electric_scooter', brand: 'Vsett', model: '8', family: 'generic' },
  { category: 'electric_scooter', brand: 'Vsett', model: '9+', family: 'generic' },
  { category: 'electric_scooter', brand: 'Vsett', model: '10+', family: 'generic' },
  { category: 'electric_scooter', brand: 'Vsett', model: '11+', family: 'generic' },
  { category: 'electric_scooter', brand: 'Vsett', model: 'Other Vsett Model', family: 'generic' },
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
  { category: 'electric_scooter', brand: 'Budget / Other', model: 'Generic Controller', family: 'generic' },
  { category: 'electric_scooter', brand: 'Budget / Other', model: 'Other / Not Listed', family: 'generic' },
  // --- E-Bikes -------------------------------------------------------------
  // Bosch Classic + Smart: many "5XXX" and error strings; we use the generic
  // codes plus the common Bosch specific ones below where sensible.
  { category: 'ebike', brand: 'Bosch', model: 'Active Line', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Active Line Plus', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Performance Line', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Performance CX', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Cargo Line', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Speed (45 km/h)', family: 'generic' },
  { category: 'ebike', brand: 'Bosch', model: 'Other Bosch System', family: 'generic' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Performance Line CX Smart', family: 'generic' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Performance Line Smart', family: 'generic' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Active Line Smart', family: 'generic' },
  { category: 'ebike', brand: 'Bosch Smart System', model: 'Other Smart System', family: 'generic' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E6100', family: 'generic' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E7000', family: 'generic' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS E8000', family: 'generic' },
  { category: 'ebike', brand: 'Shimano', model: 'STEPS EP8', family: 'generic' },
  { category: 'ebike', brand: 'Shimano', model: 'Other STEPS System', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'BBS01', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'BBS02', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'BBSHD', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'M400', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'M500', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'M600', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'H600', family: 'generic' },
  { category: 'ebike', brand: 'Bafang', model: 'Other Bafang System', family: 'generic' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-SE', family: 'generic' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-X', family: 'generic' },
  { category: 'ebike', brand: 'Yamaha', model: 'PW-i', family: 'generic' },
  { category: 'ebike', brand: 'Yamaha', model: 'PWseries TE', family: 'generic' },
  { category: 'ebike', brand: 'Yamaha', model: 'Other Yamaha System', family: 'generic' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Core', family: 'generic' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Sport', family: 'generic' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'SyncDrive Pro', family: 'generic' },
  { category: 'ebike', brand: 'Giant EnergyPak', model: 'Other Giant System', family: 'generic' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Vado', family: 'generic' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Como', family: 'generic' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo Levo', family: 'generic' },
  { category: 'ebike', brand: 'Specialized', model: 'Turbo SL', family: 'generic' },
  { category: 'ebike', brand: 'Specialized', model: 'Other Turbo System', family: 'generic' },
  { category: 'ebike', brand: 'Cannondale', model: 'Tesoro Neo', family: 'generic' },
  { category: 'ebike', brand: 'Cannondale', model: 'Synapse Neo', family: 'generic' },
  { category: 'ebike', brand: 'Cannondale', model: 'Trail Neo', family: 'generic' },
  { category: 'ebike', brand: 'Cannondale', model: 'Other Cannondale System', family: 'generic' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: '250 W Hub', family: 'generic' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: '500 W Hub', family: 'generic' },
  { category: 'ebike', brand: 'Bosch / Generic Motors', model: 'Other Hub Motor', family: 'generic' },
  { category: 'ebike', brand: 'Swytch', model: 'Swytch Kit (Conversions)', family: 'generic' },
  { category: 'ebike', brand: 'Swytch', model: 'Other Swytch Kit', family: 'generic' },
  { category: 'ebike', brand: 'Budget / Other', model: 'Generic Controller', family: 'generic' },
  { category: 'ebike', brand: 'Budget / Other', model: 'Other / Not Listed', family: 'generic' },
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