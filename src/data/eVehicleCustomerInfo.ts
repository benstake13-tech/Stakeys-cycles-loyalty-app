/**
 * Customer-facing layer over the workshop error-code catalogue.
 *
 * The base catalogue in `eVehicleCodes.ts` says what a code MEANS and how a
 * technician fixes it. This file adds what a RIDER cares about: why it happened,
 * whether they can do it themselves, what a workshop will charge, and where to
 * buy the compatible part at the lowest price.
 *
 * Everything here is keyed by `family:CODE` and merged onto the base definitions
 * by `enrichErrorDefinition()`, so the workshop data stays the single source of
 * truth and no code list is duplicated.
 *
 * Costs are typical UK values (2026) for diagnosis + labour at an independent
 * workshop; `diyCost` is the parts-only price. Treat them as a guide, not a quote.
 */

import type { EVehicleErrorDefinition, EVehicleCategory, EVehicleErrorFamily } from './eVehicleCodes';
import { errorCodesFor, errorCodesForFamily, errorFamilyFor } from './eVehicleCodes';

export interface PartOption {
  label: string;
  /** Compatibility note shown to the customer. */
  note: string;
  /** Typical UK price range, GBP. */
  priceRange: [number, number];
  /** Search phrase pre-filled into each retailer so results match the part. */
  query: string;
}

/** Replacement parts referenced by `partKeys` on the enriched codes. */
export const PART_CATALOG: Record<string, PartOption> = {
  throttle_xiaomi: { label: 'Xiaomi M365 / 1S throttle', note: 'Fits M365, 1S, Pro 2, Essential. Hall-based trigger; check the 3-pin plug.', priceRange: [12, 30], query: 'Xiaomi M365 throttle' },
  throttle_ninebot: { label: 'Ninebot / Segway throttle', note: 'Fits Max G30/G30LP/G65. Match the connector shape before ordering.', priceRange: [18, 40], query: 'Ninebot Max G30 throttle' },
  throttle_generic: { label: 'Generic 3-wire scooter throttle', note: 'Most budget scooters. Count the wires and match the plug.', priceRange: [10, 25], query: 'electric scooter throttle 3 wire' },
  brake_sensor: { label: 'Brake lever / cut-off switch', note: 'Match lever type (Hall vs mechanical). Fits most scooters.', priceRange: [8, 22], query: 'electric scooter brake lever cut off sensor' },
  hall_board: { label: 'Motor Hall sensor board', note: 'Solder-in board for hub motors. Match the motor size (8/10 inch).', priceRange: [12, 35], query: 'ebike hub motor hall sensor board' },
  motor_hub: { label: 'Hub motor (like-for-like)', note: 'Match wattage, wheel size and axle width exactly.', priceRange: [90, 220], query: 'electric scooter hub motor' },
  controller_generic: { label: 'Generic brushless controller', note: 'Match voltage, wattage and plug layout — lookalikes are not always compatible.', priceRange: [35, 110], query: 'electric scooter controller 36v 48v' },
  controller_ninebot: { label: 'Ninebot / Segway controller', note: 'Model-specific. Match the G30/G30LP/G65 board revision.', priceRange: [70, 140], query: 'Ninebot Max G30 controller' },
  controller_xiaomi: { label: 'Xiaomi controller board', note: 'Fits M365/1S/Pro 2. Genuine or good clone; needs serial programming.', priceRange: [45, 100], query: 'Xiaomi M365 controller board' },
  display_harness: { label: 'Display / communication cable', note: 'The stem cable is the usual culprit. Match the connector pin count.', priceRange: [10, 28], query: 'electric scooter display cable harness' },
  display_unit: { label: 'Dashboard / display unit', note: 'Match the model and plug; some need pairing.', priceRange: [25, 75], query: 'electric scooter dashboard display' },
  bms: { label: 'Battery BMS board', note: 'Match cell count (10S/13S etc.) and current rating, not just voltage.', priceRange: [30, 75], query: 'ebike battery BMS board' },
  battery_pack: { label: 'Replacement battery pack', note: 'Match voltage AND capacity/connector. Buy from a UK/EU seller for safe shipping.', priceRange: [180, 600], query: 'electric scooter battery pack' },
  charger: { label: 'Charger', note: 'Match the output voltage exactly (42V for 36V, 54.6V for 48V).', priceRange: [20, 60], query: 'electric scooter charger' },
  speed_sensor: { label: 'Speed sensor + spoke magnet', note: 'Bosch/Shimano/Bafang specific. Match the mount and cable length.', priceRange: [12, 40], query: 'ebike speed sensor magnet' },
  torque_sensor: { label: 'Torque / pedal sensor', note: 'Bottom-bracket fit is brand-specific — check the crank standard.', priceRange: [40, 120], query: 'ebike torque sensor bottom bracket' },
  pas_sensor: { label: 'PAS / pedal-assist sensor', note: 'Square-taper or splined; match the ring magnet and gaps.', priceRange: [10, 28], query: 'ebike PAS pedal assist sensor' },
  throttle_bike: { label: 'E-bike throttle', note: 'Match the connector (many kits use a 3-pin SM plug).', priceRange: [12, 30], query: 'ebike throttle 3 pin' },
  brake_sensor_bike: { label: 'E-bike brake cut-off sensor', note: 'Inline cable or lever-integrated; match the brake type.', priceRange: [8, 25], query: 'ebike brake cut off sensor' },
  wheel_sensor: { label: 'Wheel / motor speed sensor', note: 'Match the fork mount and magnet.', priceRange: [10, 30], query: 'ebike wheel speed sensor' },
  headlight: { label: 'Scooter headlight / LED', note: 'Match the voltage and connector.', priceRange: [10, 30], query: 'electric scooter headlight' },
  key_lock: { label: 'Ignition / key switch', note: 'Match the barrel and connector.', priceRange: [12, 35], query: 'electric scooter ignition key switch' },
};

/**
 * Enrichment keyed by `family:CODE`. Any code without an entry still renders —
 * it simply falls back to the workshop description and a generic workshop cost.
 */
type Info = {
  why?: string;
  symptoms?: string[];
  difficulty?: EVehicleErrorDefinition['difficulty'];
  costRange?: [number, number];
  diyCost?: [number, number];
  partKeys?: string[];
};

const E: Record<string, Info> = {
  // ---------------- Xiaomi M365 / 1S / Pro ----------------
  'xiaomi:E10': { why: 'The dashboard and controller lost their data link — almost always the cable that runs through the folding stem.', symptoms: ['Screen works but nothing responds', 'Scooter shuts down mid-ride', 'Flashing error on the display'], difficulty: 'Easy', costRange: [20, 45], diyCost: [0, 0], partKeys: ['display_harness'] },
  'xiaomi:E11': { why: 'Moisture got into the controller and upset phase A current sensing — very common after wet rides.', symptoms: ['Jerky motor', 'Loses power under load', 'Error appears when damp'], difficulty: 'Workshop only', costRange: [90, 160], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E12': { why: 'Same as E11 but on phase B — water ingress or a corroded phase connector.', symptoms: ['Motor judders or stutters', 'Assist cuts out'], difficulty: 'Workshop only', costRange: [90, 160], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E13': { why: 'Same as E11 but on phase C — typically corrosion.', symptoms: ['Motor judders or stutters'], difficulty: 'Workshop only', costRange: [90, 160], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E14': { why: 'The throttle (or its cable) failed — the little magnets inside break if the scooter is dropped.', symptoms: ['Won\'t accelerate', 'Throttle feels dead or sticking', 'Runs at full speed by itself'], difficulty: 'DIY', costRange: [40, 75], diyCost: [12, 30], partKeys: ['throttle_xiaomi'] },
  'xiaomi:E15': { why: 'The brake lever sensor is stuck on, so the controller thinks the brake is held.', symptoms: ['Won\'t move even with throttle', 'Brake light stays on'], difficulty: 'Easy', costRange: [35, 65], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'xiaomi:E18': { why: 'A position (Hall) sensor inside the motor stopped reporting — usually a chafed motor cable.', symptoms: ['Motor judders or won\'t start', 'Grinding on take-off'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'xiaomi:E21': { why: 'The controller cannot read the battery — a loose pack connector or a failed BMS.', symptoms: ['No power', 'Won\'t charge', 'Dead on the stand'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [30, 75], partKeys: ['bms'] },
  'xiaomi:E22': { why: 'The battery did not authenticate — common after fitting a replacement battery without programming.', symptoms: ['No power', 'Error on any battery'], difficulty: 'Workshop only', costRange: [60, 120], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'xiaomi:E23': { why: 'The BMS reports a default/incorrect serial number or an internal battery fault.', symptoms: ['No power', 'Refuses to charge'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [180, 400], partKeys: ['battery_pack'] },
  'xiaomi:E24': { why: 'The system supply voltage is out of range — a battery, charging or controller-reading fault.', symptoms: ['Won\'t power on', 'Error on start', 'Odd voltage reading'], difficulty: 'Workshop only', costRange: [60, 150], diyCost: [45, 110], partKeys: ['controller_xiaomi', 'battery_pack'] },
  'xiaomi:E26': { why: 'The controller could not read/write its configuration memory.', symptoms: ['Settings lost on power-off', 'Random errors'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E27': { why: 'Controller password/activation error — usually after a board swap.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E28': { why: 'A power transistor (MOSFET) in the controller failed — often from a shorted phase wire.', symptoms: ['Dead or violent jolt', 'Burning smell'], difficulty: 'Workshop only', costRange: [90, 170], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E29': { why: 'MOSFET stuck in an invalid state, or a controller serial-number issue.', symptoms: ['Dead controller'], difficulty: 'Workshop only', costRange: [90, 170], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },
  'xiaomi:E31': { why: 'Controller firmware/program error.', symptoms: ['Random behaviour'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: ['controller_xiaomi'] },
  'xiaomi:E35': { why: 'The scooter\'s serial number is missing — usually after a dashboard or controller replacement.', symptoms: ['Error persists but scooter rides', 'Shows after a repair'], difficulty: 'Workshop only', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'xiaomi:E39': { why: 'Battery temperature reading is abnormal — a hot pack or a failed sensor.', symptoms: ['No power when warm', 'Hot battery'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [180, 400], partKeys: ['battery_pack'] },
  'xiaomi:E40': { why: 'Controller temperature sensor fault or genuine overheating.', symptoms: ['Cuts out when worked hard'], difficulty: 'Workshop only', costRange: [45, 100], diyCost: [45, 100], partKeys: ['controller_xiaomi'] },

  // ---------------- Ninebot / Segway (Max G30 etc.) ----------------
  'ninebot:E10': { why: 'Dashboard-to-controller communication lost — most often a loose connector inside the stem.', symptoms: ['Won\'t move', 'Sudden shutdown', 'Flashing 10'], difficulty: 'Easy', costRange: [20, 45], diyCost: [0, 0], partKeys: ['display_harness'] },
  'ninebot:E14': { why: 'The throttle Hall sensor is not sending a correct signal.', symptoms: ['No acceleration', 'Throttle dead'], difficulty: 'DIY', costRange: [45, 80], diyCost: [18, 40], partKeys: ['throttle_ninebot'] },
  'ninebot:E15': { why: 'Brake lever sensor stuck/dirty, or the brake was held during power-on.', symptoms: ['Won\'t move', 'Brake warning'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'ninebot:E18': { why: 'Motor Hall sensor fault — inspect the 5-pin connector before replacing anything.', symptoms: ['Judders on take-off', 'Motor won\'t start'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'ninebot:E21': { why: 'The controller cannot talk to the battery BMS.', symptoms: ['No power', 'Won\'t charge'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [30, 75], partKeys: ['bms'] },
  'ninebot:E22': { why: 'Battery serial/provisioning mismatch.', symptoms: ['No power after battery swap'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [180, 380], partKeys: ['battery_pack'] },
  'ninebot:E23': { why: 'BMS serial or data-link fault, similar to E21.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [30, 75], partKeys: ['bms'] },
  'ninebot:E35': { why: 'Vehicle serial number is default/missing — after a controller or dash swap.', symptoms: ['Rides but shows an error'], difficulty: 'Workshop only', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'ninebot:E39': { why: 'Battery temperature sensor abnormal or the pack is too hot.', symptoms: ['Cuts out when warm'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [180, 380], partKeys: ['battery_pack'] },
  'ninebot:E45': { why: 'A cell group in the battery has discharged below the safe minimum — the pack is deeply discharged or aged.', symptoms: ['Won\'t hold charge', 'Cuts out under load', 'Won\'t power on'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [180, 380], partKeys: ['battery_pack'] },
  'ninebot:E41': { why: 'The external (second) battery is overheating.', symptoms: ['Cuts out when hot', 'Hot second battery'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'ninebot:E16': { why: 'The internal battery reports an abnormal protection-MOS state — an internal battery-electronics fault.', symptoms: ['No power', 'Won\'t charge'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [180, 380], partKeys: ['battery_pack'] },
  'ninebot:E42': { why: 'The controller cannot communicate with the external battery BMS.', symptoms: ['No power', 'Second battery ignored'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [30, 75], partKeys: ['bms'] },

  // ---------------- Generic scooter controller ----------------
  'generic:E1': { why: 'Throttle signal missing/out of range — a common connector or grip fault.', symptoms: ['Won\'t accelerate', 'Throttle dead'], difficulty: 'DIY', costRange: [40, 75], diyCost: [10, 25], partKeys: ['throttle_generic'] },
  'generic:E2': { why: 'The brake cut-off is permanently on (stuck lever or switch).', symptoms: ['Won\'t move', 'Brake light stuck on'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'generic:E3': { why: 'Motor phase or Hall wiring fault.', symptoms: ['Judders', 'No motor'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'generic:E4': { why: 'Battery below the cut-off voltage or the BMS tripped.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['charger'] },
  'generic:E5': { why: 'Controller overheated or an internal fault.', symptoms: ['Cuts out when pushed'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [35, 110], partKeys: ['controller_generic'] },
  'generic:E6': { why: 'Display and controller lost their link.', symptoms: ['No dash', 'Won\'t move'], difficulty: 'Easy', costRange: [25, 55], diyCost: [10, 28], partKeys: ['display_harness'] },
  'generic:E7': { why: 'Motor Hall sensor fault.', symptoms: ['Judders on take-off'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'generic:E10': { why: 'Communication lost between display and controller (stem cable).', symptoms: ['Won\'t move', 'Flashing error'], difficulty: 'Easy', costRange: [25, 55], diyCost: [10, 28], partKeys: ['display_harness'] },

  // ---------------- Generic e-bike conversion kit ----------------
  'generic_bike:E1': { why: 'Kit throttle signal missing or out of range.', symptoms: ['No throttle power'], difficulty: 'DIY', costRange: [30, 60], diyCost: [12, 30], partKeys: ['throttle_bike'] },
  'generic_bike:E2': { why: 'A brake cut-off sensor is stuck on.', symptoms: ['Assist cuts out', 'No throttle'], difficulty: 'Easy', costRange: [30, 60], diyCost: [8, 25], partKeys: ['brake_sensor_bike'] },
  'generic_bike:E3': { why: 'Motor Hall or phase wiring fault in the kit.', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [12, 35], partKeys: ['hall_board'] },
  'generic_bike:E4': { why: 'Battery below the controller cut-off.', symptoms: ['Won\'t assist', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 45], diyCost: [0, 0], partKeys: ['charger'] },
  'generic_bike:E5': { why: 'Controller overcurrent or internal fault.', symptoms: ['Cuts out under load'], difficulty: 'Workshop only', costRange: [60, 120], diyCost: [35, 90], partKeys: ['controller_generic'] },
  'generic_bike:E6': { why: 'Display lost its link to the kit controller.', symptoms: ['No dash', 'No assist'], difficulty: 'Easy', costRange: [25, 55], diyCost: [10, 28], partKeys: ['display_harness'] },

  // ---------------- Bosch ----------------
  'bosch:410': { why: 'A button on the display or control unit is being read as pressed.', symptoms: ['Screen behaves oddly', 'Random inputs'], difficulty: 'DIY', costRange: [0, 30], diyCost: [0, 0], partKeys: [] },
  'bosch:414': { why: 'Connection between the control unit and the rest of the system is interrupted.', symptoms: ['Assist cuts in and out', 'Display warnings'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },
  'bosch:418': { why: 'A button on the operating unit is jammed or dirty.', symptoms: ['Stuck button'], difficulty: 'DIY', costRange: [0, 30], diyCost: [0, 0], partKeys: [] },
  'bosch:422': { why: 'The drive unit cannot communicate with the system.', symptoms: ['No assist', 'Motor warning'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },
  'bosch:423': { why: 'The battery is not communicating — often dirty contacts or a seating issue.', symptoms: ['No power', 'Battery warning'], difficulty: 'DIY', costRange: [20, 60], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'bosch:424': { why: 'Communication problem between system components.', symptoms: ['Intermittent assist'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'bosch:440': { why: 'Internal electronic fault in the drive unit.', symptoms: ['No assist', 'Error every ride'], difficulty: 'Workshop only', costRange: [60, 120], diyCost: [0, 0], partKeys: [] },
  'bosch:450': { why: 'Internal software fault.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },
  'bosch:500': { why: 'Internal drive-unit fault.', symptoms: ['No assist', 'Error on start'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [0, 0], partKeys: [] },
  'bosch:502': { why: 'A fault in the lighting circuit — loose or damaged light cable.', symptoms: ['Lights out', 'Light warning'], difficulty: 'Easy', costRange: [25, 60], diyCost: [10, 30], partKeys: ['headlight'] },
  'bosch:503': { why: 'Speed sensor is not reading correctly — usually a misaligned spoke magnet.', symptoms: ['Speed reads 0 or jumps', 'Assist erratic'], difficulty: 'DIY', costRange: [20, 50], diyCost: [12, 40], partKeys: ['speed_sensor'] },
  'bosch:504': { why: 'Speed signal is distorted or the system flagged tampering/tuning.', symptoms: ['Speed reading wrong', 'Assist limited'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: ['speed_sensor'] },
  'bosch:510': { why: 'Internal sensor fault in the drive system.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [0, 0], partKeys: [] },
  'bosch:511': { why: 'Internal drive-unit fault.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [0, 0], partKeys: [] },
  'bosch:520': { why: 'Power-supply error — charging or battery supply path.', symptoms: ['Won\'t charge', 'Cuts out'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [20, 60], partKeys: ['charger', 'battery_pack'] },
  'bosch:530': { why: 'The battery did not authenticate with the system.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [40, 100], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'bosch:531': { why: 'A component does not match the system configuration.', symptoms: ['Error on start'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },

  // ---------------- Shimano STEPS ----------------
  'shimano:E010': { why: 'The drive unit detected an internal abnormality — often a temporary glitch, sometimes a sensor fault.', symptoms: ['Assist disabled', 'Error on start'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'shimano:E012': { why: 'Sensor initialisation did not complete — often because the pedals moved at startup.', symptoms: ['No assist', 'Error on start'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'shimano:E013': { why: 'The drive unit firmware is abnormal — an update/reinstall is usually needed.', symptoms: ['No assist', 'Error on start'], difficulty: 'Workshop only', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'shimano:E014': { why: 'The speed sensor is giving an abnormal signal — magnet/sensor gap or wiring.', symptoms: ['Speed reads wrong', 'Assist reduced'], difficulty: 'DIY', costRange: [20, 50], diyCost: [12, 40], partKeys: ['speed_sensor'] },
  'shimano:E023': { why: 'An electrical abnormality was detected in the battery.', symptoms: ['No assist', 'Battery warning'], difficulty: 'Workshop only', costRange: [30, 80], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:E024': { why: 'The battery overcurrent protection operated — often reported as a communication error.', symptoms: ['Cuts out under load', 'Battery warning'], difficulty: 'Workshop only', costRange: [30, 80], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:E025': { why: 'The battery does not recognise the drive unit — a genuine unit is not connected or its cord is disconnected.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [30, 80], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:E020': { why: 'Communication error between the battery and the drive unit.', symptoms: ['No assist', 'Battery warning'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:E021': { why: 'The connected battery is not supported by this system.', symptoms: ['No power with that battery'], difficulty: 'Workshop only', costRange: [0, 40], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:E022': { why: 'The connected battery does not conform to system standards.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [0, 40], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'shimano:W011': { why: 'No plausible speed signal — the magnet/sensor gap is wrong or the magnet twisted.', symptoms: ['Speed reads wrong', 'Assist reduced'], difficulty: 'DIY', costRange: [20, 50], diyCost: [12, 40], partKeys: ['speed_sensor'] },
  'shimano:W013': { why: 'Sensor initialisation did not complete at startup.', symptoms: ['Warning on start'], difficulty: 'DIY', costRange: [20, 50], diyCost: [0, 0], partKeys: [] },

  // ---------------- Bafang ----------------
  'bafang:E04': { why: 'The throttle lever is not returning to zero.', symptoms: ['Assist stuck on', 'Error at power-up'], difficulty: 'DIY', costRange: [30, 60], diyCost: [12, 30], partKeys: ['throttle_bike'] },
  'bafang:E07': { why: 'Battery voltage is above the system limit — often the wrong battery for the kit.', symptoms: ['Error immediately', 'No assist'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['battery_pack', 'charger'] },
  'bafang:E08': { why: 'Hall or motor sensor error.', symptoms: ['Motor judders', 'No assist'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [12, 35], partKeys: ['hall_board'] },
  'bafang:E10': { why: 'Controller or motor overheating.', symptoms: ['Cuts out when hot'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },
  'bafang:E12': { why: 'The controller shunt/current sensor failed — not field-replaceable.', symptoms: ['No assist', 'Error on start'], difficulty: 'Workshop only', costRange: [70, 140], diyCost: [60, 130], partKeys: ['controller_generic'] },
  'bafang:E21': { why: 'The speed sensor has no signal — magnet misaligned or cable damaged.', symptoms: ['Speed reads 0', 'Assist cuts out'], difficulty: 'DIY', costRange: [25, 55], diyCost: [12, 30], partKeys: ['speed_sensor'] },
  'bafang:E30': { why: 'The display cannot receive data from the controller — the classic Bafang comms fault.', symptoms: ['Flashing 30', 'Display dead'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },

  // ---------------- Dualtron / Minimotors EY ----------------
  'dualtron:E2': { why: 'A general system fault on the EY display.', symptoms: ['Triangle warning', 'Assist odd'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },
  'dualtron:E4': { why: 'Motor or Hall sensor error.', symptoms: ['Motor judders', 'No power'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'dualtron:E5': { why: 'The throttle (accelerator) is not communicating with the controller.', symptoms: ['No acceleration'], difficulty: 'Easy', costRange: [40, 90], diyCost: [25, 60], partKeys: ['throttle_generic'] },
  'dualtron:E6': { why: 'Controller or controller-communication error.', symptoms: ['No power', 'Warning'], difficulty: 'Workshop only', costRange: [90, 180], diyCost: [70, 150], partKeys: ['controller_generic'] },

  // ---------------- Apollo ----------------
  'apollo:E1': { why: 'Controller communication error.', symptoms: ['Won\'t move', 'Warning'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [60, 130], partKeys: ['controller_generic'] },
  'apollo:E2': { why: 'Brake sensor fault (often held during power-on).', symptoms: ['Won\'t move'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'apollo:E3': { why: 'Controller lost communication with the motor.', symptoms: ['Motor dead or juddering'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'apollo:E4': { why: 'Throttle signal out of range.', symptoms: ['No acceleration'], difficulty: 'DIY', costRange: [40, 80], diyCost: [10, 25], partKeys: ['throttle_generic'] },
  'apollo:E5': { why: 'Controller lost communication with the battery BMS.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [30, 75], partKeys: ['bms'] },

  // ---------------- Pure ----------------
  'pure:E01': { why: 'Battery below the safe riding voltage.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['charger'] },
  'pure:E02': { why: 'The motor or its connection failed.', symptoms: ['No motor'], difficulty: 'Workshop only', costRange: [80, 170], diyCost: [90, 220], partKeys: ['motor_hub'] },
  'pure:E03': { why: 'Controller fault.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [35, 110], partKeys: ['controller_generic'] },
  'pure:E04': { why: 'Throttle or brake signal fault.', symptoms: ['Won\'t move', 'Odd assist'], difficulty: 'Easy', costRange: [35, 75], diyCost: [10, 25], partKeys: ['throttle_generic', 'brake_sensor'] },
  'pure:E07': { why: 'Motor or controller overheating.', symptoms: ['Cuts out when hot'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: [] },

  // ---------------- VSETT / Zero (QS-S4 LCD) ----------------
  'vsett:E1': { why: 'The meter/display reports an issue.', symptoms: ['Display glitch'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [25, 75], partKeys: ['display_unit'] },
  'vsett:E2': { why: 'The electronic brake sensor is stuck or disconnected — the motor cut-off is engaged.', symptoms: ['Won\'t accelerate', 'Brake symbol stays on'], difficulty: 'Easy', costRange: [35, 75], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'vsett:E6': { why: 'Battery voltage too low.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['charger'] },
  'vsett:E7': { why: 'Motor fault (Hall/phase).', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'vsett:E8': { why: 'A motor Hall-sensor or motor power-connection fault.', symptoms: ['Motor judders or dead', 'No power to the wheel'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'vsett:E9': { why: 'Controller fault — often a blown MOSFET after water or hard use.', symptoms: ['No power', 'Burning smell'], difficulty: 'Workshop only', costRange: [90, 180], diyCost: [70, 150], partKeys: ['controller_generic'] },
  'vsett:E10': { why: 'Communication fault between the display and controller — usually a loose stem-harness connection.', symptoms: ['Won\'t move', 'Flashing 10'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },
  'vsett:E11': { why: 'Communication transmitting fault (same harness as E10).', symptoms: ['Won\'t move'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },
  'vsett:E12': { why: 'BMS communication failure.', symptoms: ['No power', 'Won\'t charge'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [30, 75], partKeys: ['bms'] },
  'vsett:E13': { why: 'Headlight error — a loose or damaged LED.', symptoms: ['Lights out'], difficulty: 'DIY', costRange: [20, 50], diyCost: [10, 30], partKeys: ['headlight'] },

  // ---------------- Kaabo (LT01 / Wolf) ----------------
  'kaabo:E01': { why: 'Motor phase fault (central display).', symptoms: ['Motor dead or juddering'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'kaabo:E02': { why: 'Motor Hall sensor fault (central display) — not a brake fault.', symptoms: ['Motor judders or won\'t start'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'kaabo:E04': { why: 'Throttle fault (central display).', symptoms: ['No acceleration'], difficulty: 'DIY', costRange: [45, 90], diyCost: [25, 60], partKeys: ['throttle_generic'] },
  'kaabo:E06': { why: 'Undervoltage / low-voltage protection — battery low or the P1 voltage setting is wrong.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['charger'] },
  'kaabo:E07': { why: 'Motor Hall sensor fault (LT01 display).', symptoms: ['Motor judders or won\'t start'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'kaabo:E08': { why: 'Throttle fault (LT01 display).', symptoms: ['No acceleration'], difficulty: 'DIY', costRange: [45, 90], diyCost: [25, 60], partKeys: ['throttle_generic'] },
  'kaabo:E09': { why: 'Controller communication fault (LT01 display).', symptoms: ['No power', 'Warning'], difficulty: 'Workshop only', costRange: [90, 180], diyCost: [70, 150], partKeys: ['controller_generic'] },
  'kaabo:E10': { why: 'Display/controller communication fault (LT01 display) — usually the harness.', symptoms: ['Won\'t move', 'Flashing 10'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },

  // ---------------- Rad Power Bikes ----------------
  'radpower:6': { why: 'Battery undervoltage — the pack is flat or aged.', symptoms: ['Won\'t assist', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['charger'] },
  'radpower:10': { why: 'Battery overvoltage.', symptoms: ['Error after charging'], difficulty: 'Workshop only', costRange: [30, 80], diyCost: [0, 0], partKeys: ['charger'] },
  'radpower:21': { why: 'Abnormal current — a controller, motor or wiring connection issue. Often the battery tray/contacts.', symptoms: ['No assist', 'Error 21 on start'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [35, 110], partKeys: ['controller_generic'] },
  'radpower:22': { why: 'Throttle fault.', symptoms: ['No throttle'], difficulty: 'DIY', costRange: [40, 80], diyCost: [12, 30], partKeys: ['throttle_bike'] },
  'radpower:23': { why: 'Motor phase fault.', symptoms: ['Motor judders'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'radpower:24': { why: 'Motor Hall sensor fault.', symptoms: ['Judders on take-off'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [12, 35], partKeys: ['hall_board'] },
  'radpower:25': { why: 'Brake sensor stuck active.', symptoms: ['Won\'t assist'], difficulty: 'Easy', costRange: [30, 65], diyCost: [8, 25], partKeys: ['brake_sensor_bike'] },
  'radpower:30': { why: 'Communication fault — often loose wiring or water in a connector.', symptoms: ['Intermittent assist', 'Error appears randomly'], difficulty: 'Easy', costRange: [30, 75], diyCost: [10, 28], partKeys: ['display_harness'] },
  'radpower:31': { why: 'The power button was held too long at startup (a safety lock-out).', symptoms: ['Won\'t power on'], difficulty: 'DIY', costRange: [20, 45], diyCost: [12, 35], partKeys: ['key_lock'] },
  'radpower:34': { why: 'Walk-mode disengage fault — the walk button/sensor is stuck.', symptoms: ['Walk mode won\'t exit'], difficulty: 'Easy', costRange: [25, 60], diyCost: [12, 35], partKeys: ['display_unit'] },

  // ---------------- Brose / Serial-1 ----------------
  'brose:10': { why: 'Battery voltage too low — the pack is discharged or aged.', symptoms: ['Assist drops out', 'Won\'t assist'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'brose:11': { why: 'Battery voltage too high — check the charger.', symptoms: ['Error after charging'], difficulty: 'Easy', costRange: [30, 70], diyCost: [0, 0], partKeys: ['charger'] },
  'brose:12': { why: 'Battery almost or completely discharged.', symptoms: ['Won\'t assist'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'brose:20': { why: 'The system electrical measurements are incorrect.', symptoms: ['Assist drops out'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },
  'brose:21': { why: 'A temperature sensor is defective.', symptoms: ['Cuts out', 'Error on start'], difficulty: 'Workshop only', costRange: [50, 120], diyCost: [0, 0], partKeys: [] },
  'brose:24': { why: 'The internal voltage is outside its working range.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [30, 80], diyCost: [0, 0], partKeys: ['battery_pack'] },
  'brose:25': { why: 'An error in the motor current measurement.', symptoms: ['Assist drops out'], difficulty: 'Workshop only', costRange: [40, 90], diyCost: [0, 0], partKeys: [] },
  'brose:26': { why: 'The system performed a software reset.', symptoms: ['Brief warning then normal'], difficulty: 'DIY', costRange: [0, 30], diyCost: [0, 0], partKeys: [] },
  'brose:40': { why: 'Overcurrent in the motor — the motor is working too hard.', symptoms: ['Assist cuts out on hills'], difficulty: 'DIY', costRange: [0, 40], diyCost: [0, 0], partKeys: [] },
  'brose:41': { why: 'Overcurrent in the motor — same as code 40.', symptoms: ['Assist cuts out on hills'], difficulty: 'DIY', costRange: [0, 40], diyCost: [0, 0], partKeys: [] },
  'brose:42': { why: 'A fault in the motor rotation.', symptoms: ['No assist'], difficulty: 'Workshop only', costRange: [50, 110], diyCost: [0, 0], partKeys: [] },
  'brose:43': { why: 'A short circuit in the motor — stop riding.', symptoms: ['No assist', 'Motor fault'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [0, 0], partKeys: [] },
  'brose:44': { why: 'The motor is overheating.', symptoms: ['Cuts out when hot'], difficulty: 'Easy', costRange: [25, 60], diyCost: [0, 0], partKeys: [] },
  'brose:45': { why: 'The software corrected an error in motor rotation.', symptoms: ['Brief warning then normal'], difficulty: 'DIY', costRange: [0, 30], diyCost: [0, 0], partKeys: [] },
  'brose:46': { why: 'No motor movement was recognised — often not a DIY fix.', symptoms: ['No assist', 'Motor dead'], difficulty: 'Workshop only', costRange: [60, 130], diyCost: [0, 0], partKeys: [] },
  'brose:60': { why: 'A CAN-BUS communication interruption between components.', symptoms: ['Intermittent assist'], difficulty: 'Easy', costRange: [30, 75], diyCost: [0, 0], partKeys: [] },
  'brose:70': { why: 'A pedal-force (torque) or cadence sensor error.', symptoms: ['Assist weak or absent'], difficulty: 'Workshop only', costRange: [50, 120], diyCost: [40, 120], partKeys: ['torque_sensor'] },
  'brose:71': { why: 'A pedal-force (torque) or cadence sensor error.', symptoms: ['Assist weak or absent'], difficulty: 'Workshop only', costRange: [50, 120], diyCost: [40, 120], partKeys: ['torque_sensor'] },
  'brose:74': { why: 'A pedal-force (torque) or cadence sensor error.', symptoms: ['Assist weak or absent'], difficulty: 'Workshop only', costRange: [50, 120], diyCost: [40, 120], partKeys: ['torque_sensor'] },

  // ---------------- Kugoo / Kukirin ----------------
  'kugoo:1': { why: 'A motor fault — Hall sensor, phase wiring or the motor itself.', symptoms: ['Motor dead or juddering'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'kugoo:2': { why: 'A throttle fault — the signal is out of range or the throttle is disconnected.', symptoms: ['No acceleration'], difficulty: 'DIY', costRange: [40, 80], diyCost: [12, 30], partKeys: ['throttle_generic'] },
  'kugoo:3': { why: 'A controller fault — an internal failure or a wiring fault.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },
  'kugoo:4': { why: 'A brake lever fault — the cut-off switch is stuck or disconnected.', symptoms: ['Won\'t accelerate'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'kugoo:5': { why: 'Low-voltage protection — the pack is below the cut-off voltage.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: [] },
  'kugoo:6': { why: 'A display-to-controller communication fault.', symptoms: ['Won\'t move', 'Error on start'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },
  'kugoo:7': { why: 'A second display-to-controller communication fault (same harness as code 6).', symptoms: ['Won\'t move'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },

  // ---------------- iENYRID ----------------
  'ienyrid:3E': { why: 'The display reports a motor malfunction — Hall sensor or phase wiring.', symptoms: ['Motor dead or juddering'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'ienyrid:4E': { why: 'Low-voltage issue — the battery needs recharging.', symptoms: ['Won\'t move', 'Won\'t charge'], difficulty: 'Easy', costRange: [20, 50], diyCost: [0, 0], partKeys: [] },
  'ienyrid:5E': { why: 'The brake lever is malfunctioning — a stuck cut-off switch or wiring.', symptoms: ['Won\'t accelerate'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'ienyrid:6E': { why: 'A second motor malfunction code — motor or controller fault.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },
  'ienyrid:7E': { why: 'The throttle is not in the neutral position at startup — it needs resetting.', symptoms: ['Won\'t accelerate'], difficulty: 'DIY', costRange: [40, 80], diyCost: [12, 30], partKeys: ['throttle_generic'] },
  'ienyrid:10E': { why: 'The display has a sending (transmit) malfunction — replace the display unit.', symptoms: ['Error on start'], difficulty: 'Easy', costRange: [40, 90], diyCost: [30, 70], partKeys: ['display_unit'] },
  'ienyrid:15E': { why: 'The controller has a receiving (receive) malfunction — replace the controller.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },

  // ---------------- Gotrax ----------------
  'gotrax:E2': { why: 'The controller believes the brake lever is engaged — a faulty brake sensor or wiring.', symptoms: ['Won\'t accelerate'], difficulty: 'Easy', costRange: [35, 70], diyCost: [8, 22], partKeys: ['brake_sensor'] },
  'gotrax:E3': { why: 'A communication issue between the console and the controller.', symptoms: ['Error on start'], difficulty: 'Easy', costRange: [30, 70], diyCost: [10, 28], partKeys: ['display_harness'] },
  'gotrax:E7': { why: 'A motor-to-controller communication issue — a Hall-sensor failure.', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },

  // ---------------- Hiboy ----------------
  'hiboy:E1': { why: 'A motor communication fault — Hall sensor or phase wiring.', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'hiboy:E3': { why: 'A motor sensor (Hall) error — no valid motor position signal.', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'hiboy:E4': { why: 'A controller fault — an internal failure or a wiring fault.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },

  // ---------------- NIU ----------------
  'niu:03': { why: 'The controller is not receiving a proper signal from the throttle.', symptoms: ['No acceleration'], difficulty: 'DIY', costRange: [40, 80], diyCost: [12, 30], partKeys: ['throttle_generic'] },
  'niu:05': { why: 'A motor communication fault — motor Hall sensor failure.', symptoms: ['Motor judders or dead'], difficulty: 'Workshop only', costRange: [70, 150], diyCost: [12, 35], partKeys: ['hall_board'] },
  'niu:07': { why: 'A controller communication error — a controller malfunction or wiring issue.', symptoms: ['No power'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },
  'niu:09': { why: 'A battery communication error — a battery management system fault.', symptoms: ['No power', 'Won\'t charge'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [30, 75], partKeys: ['bms'] },
  'niu:10': { why: 'Overcurrent protection — the controller detected abnormal power draw.', symptoms: ['Cuts out under load'], difficulty: 'Workshop only', costRange: [80, 160], diyCost: [45, 100], partKeys: ['controller_generic'] },
  'niu:12': { why: 'Motor temperature warning — the motor is overheating.', symptoms: ['Cuts out when hot'], difficulty: 'Easy', costRange: [25, 60], diyCost: [0, 0], partKeys: [] },
  'niu:21': { why: 'Battery voltage outside the safe operating range.', symptoms: ['Won\'t assist', 'Won\'t charge'], difficulty: 'Workshop only', costRange: [60, 140], diyCost: [180, 380], partKeys: ['battery_pack'] },
};

/**
 * Merge the customer info onto a workshop definition. Any definition without an
 * enrichment entry gets sensible defaults so the UI never breaks.
 */
export function enrichErrorDefinition(def: EVehicleErrorDefinition, family: string): EVehicleErrorDefinition {
  const info = E[`${family}:${def.code}`];
  if (!info) return def;
  return { ...def, ...info };
}

/** Look up a single part by key (for the customer UI). */
export function partForKey(key: string): PartOption | undefined {
  return PART_CATALOG[key];
}

/**
 * The customer-facing code list for a model: the workshop catalogue with the
 * rider-facing fields (why / symptoms / cost / parts) merged in.
 */
export function customerCodesFor(category: EVehicleCategory, brand: string, model: string): EVehicleErrorDefinition[] {
  const family = errorFamilyFor(category, brand, model);
  return errorCodesFor(category, brand, model).map((def) => enrichErrorDefinition(def, family));
}

/**
 * Customer-facing code list for a whole display/system family. Used when the
 * rider has identified their display but does not know the exact model — the
 * codes still route to the correct table.
 */
export function customerCodesForFamily(family: EVehicleErrorFamily): EVehicleErrorDefinition[] {
  return errorCodesForFamily(family).map((def) => enrichErrorDefinition(def, family));
}

/** Free-text symptom search across an enriched code list. */
export function matchBySymptom(codes: EVehicleErrorDefinition[], text: string): EVehicleErrorDefinition[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  return codes
    .map((c) => {
      const hay = [c.title, c.description, c.why, ...(c.symptoms || []), ...(c.fix || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const codeHit = normalizeHay(c.code) === normalizeHay(q);
      const score = (codeHit ? 5 : 0) + words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

function normalizeHay(s: string): string {
  return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+/, '');
}

export interface RetailerLink {
  retailer: string;
  url: string;
  note?: string;
}

/**
 * Deep links to buy a part, cheapest-first. eBay's "used/new" listings and
 * AliExpress are usually the lowest price; Halfords/Amazon are the fastest.
 * `model` is appended so results match the exact machine.
 */
export function buildRetailerLinks(partKey: string, model?: string): RetailerLink[] {
  const part = PART_CATALOG[partKey];
  if (!part) return [];
  const modelSuffix = model && !part.query.toLowerCase().includes(model.toLowerCase()) ? ` ${model}` : '';
  const q = encodeURIComponent(`${part.query}${modelSuffix}`.trim());
  return [
    { retailer: 'eBay UK', url: `https://www.ebay.co.uk/sch/i.html?_nkw=${q}`, note: 'Usually the cheapest — check seller feedback.' },
    { retailer: 'AliExpress', url: `https://www.aliexpress.com/wholesale?SearchText=${q}`, note: 'Cheapest but slower shipping.' },
    { retailer: 'Amazon UK', url: `https://www.amazon.co.uk/s?k=${q}`, note: 'Fast delivery, easy returns.' },
    { retailer: 'Halfords', url: `https://www.halfords.com/search?q=${q}`, note: 'Walk-in collection.' },
  ];
}
