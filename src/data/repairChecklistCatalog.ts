import { RepairChecklistItem, InvoiceLineItem } from '../types/bikeShop';

export const DEFAULT_REPAIR_CHECKLIST_ITEMS: Omit<RepairChecklistItem, 'completed'>[] = [
  {
    id: 'chk-m-check',
    label: 'Comprehensive Cytech M-Check (Frame, Fork, Bearings, Fasteners)',
    category: 'Safety',
    notes: 'Structural frame and fork integrity verified',
  },
  {
    id: 'chk-brakes-align',
    label: 'Braking System Alignment & Caliper Centring',
    category: 'Brakes',
    notes: 'Pad wear measured and rotor/rim surfaces cleaned',
  },
  {
    id: 'chk-brakes-fluid',
    label: 'Brake Cable Tension & Hydraulic System Pressure Test',
    category: 'Brakes',
    notes: 'Lever feel firm with zero sponge or leak',
  },
  {
    id: 'chk-gears-index',
    label: 'Gears Indexing & Derailleur Hanger Alignment',
    category: 'Drivetrain',
    notes: 'Smooth, rapid shifts across full cassette spectrum',
  },
  {
    id: 'chk-drivetrain-wear',
    label: 'Chain Wear Measurement (0.5/0.75 gauge) & Lubrication',
    category: 'Drivetrain',
    notes: 'Drivetrain degreased and lubed with workshop formula',
  },
  {
    id: 'chk-torque-cockpit',
    label: 'Cockpit & Critical Bolts Torqued to Spec (Nm)',
    category: 'Safety',
    notes: 'Stem, handlebar, seat clamp, and cranks verified with torque wrench',
  },
  {
    id: 'chk-wheel-truing',
    label: 'Wheel Truing & Spoke Tension Check',
    category: 'Wheels',
    notes: 'Lateral and radial runout within 1mm workshop tolerance',
  },
  {
    id: 'chk-tire-pressure',
    label: 'Tyre Tread Inspection & Precision Pressure Inflation',
    category: 'Wheels',
    notes: 'Tread checked for cuts/glass and inflated to optimal rider PSI',
  },
  {
    id: 'chk-ebike-diagnostic',
    label: 'Electric System Diagnostic, Console & Battery Check',
    category: 'Safety',
    notes: 'Display codes cleared, motor cutoffs and sensor gaps tested',
  },
  {
    id: 'chk-road-test',
    label: 'Dynamic Workshop Road Test (Braking & Climbing Shifts)',
    category: 'Final Inspection',
    notes: 'Tested under live rider torque and emergency stop conditions',
  },
  {
    id: 'chk-clean-polish',
    label: 'Post-Repair Valet Clean & Frame Wipe Down',
    category: 'Final Inspection',
    notes: 'Safe showroom delivery condition',
  },
];

export interface PresetRepairItem {
  name: string;
  description: string;
  category: 'Labour' | 'Part' | 'Consumable' | 'Diagnostic';
  unitPrice: number;
  partNumber?: string;
}

export const COMMON_REPAIR_PRESETS: PresetRepairItem[] = [
  {
    name: 'Labour - Minor Diagnostic & Adjustment (15m)',
    description: 'Quick safety adjustment, cable tensioning, or minor tuning',
    category: 'Labour',
    unitPrice: 15.0,
  },
  {
    name: 'Labour - Standard Workshop Service (30m)',
    description: 'Component fitting, puncture replacement, or brake servicing',
    category: 'Labour',
    unitPrice: 25.0,
  },
  {
    name: 'Labour - Full Workshop Overhaul (60m)',
    description: 'Comprehensive mechanical servicing, drivetrain rebuild & wheel truing',
    category: 'Labour',
    unitPrice: 45.0,
  },
  {
    name: 'Standard Inner Tube (Presta/Schrader)',
    description: 'High-grade butyl inner tube with valve core',
    category: 'Part',
    unitPrice: 7.5,
    partNumber: 'TUB-700-PRE',
  },
  {
    name: 'Shimano B05S Disc Brake Pads (Pair)',
    description: 'Genuine Shimano resin brake pads with retention spring',
    category: 'Part',
    unitPrice: 14.0,
    partNumber: 'SHI-PAD-B05S',
  },
  {
    name: 'Hydraulic Brake Mineral Oil Flush & Bleed',
    description: 'Complete fluid exchange, bubble purging, and lever pressure reset',
    category: 'Labour',
    unitPrice: 20.0,
  },
  {
    name: 'KMC 9-Speed Rust-Buster Chain',
    description: 'Pre-lubricated high-tensile 9-speed chain with MissingLink',
    category: 'Part',
    unitPrice: 19.5,
    partNumber: 'KMC-X9-RB',
  },
  {
    name: 'KMC 10/11-Speed Performance Chain',
    description: 'X-Bridge chamfered high-durability multi-speed chain',
    category: 'Part',
    unitPrice: 27.0,
    partNumber: 'KMC-X11-SIL',
  },
  {
    name: 'Stainless Steel Inner Cable & Slick Outer Housing',
    description: 'Die-extruded low friction stainless steel cable with sealed ferrules',
    category: 'Part',
    unitPrice: 6.5,
    partNumber: 'CAB-SS-SLK',
  },
  {
    name: 'Schwalbe Marathon Plus Puncture-Proof Tyre',
    description: 'SmartGuard 5mm puncture protection layer tyre',
    category: 'Part',
    unitPrice: 38.0,
    partNumber: 'SCH-MARA-PLUS',
  },
  {
    name: 'Replacement Stainless Spoke & Wheel True',
    description: 'Sapim double-butted stainless spoke, brass nipple, and tension true',
    category: 'Labour',
    unitPrice: 16.0,
  },
  {
    name: 'Workshop Biodegradable Degreaser & High-Tech Ceramic Lube',
    description: 'Muc-Off / Fenwicks ultrasonic solvent clean & dry lube treatment',
    category: 'Consumable',
    unitPrice: 5.0,
    partNumber: 'CON-LUBE-CER',
  },
];
