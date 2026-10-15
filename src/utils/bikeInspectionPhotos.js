/** Ten labelled views used by customer bike identification and resale assessment. */
export const BIKE_INSPECTION_PHOTO_SLOTS = [
  { id: 'drive-side', label: 'Drive side', hint: 'Whole bike from the right; show the chain and gears.' },
  { id: 'non-drive-side', label: 'Non-drive side', hint: 'Whole bike from the left.' },
  { id: 'front', label: 'Front wheel & fork', hint: 'Fork, front tyre, brake and wheel markings.' },
  { id: 'rear', label: 'Rear wheel & brake', hint: 'Rear tyre, brake, hub and wheel markings.' },
  { id: 'drivetrain', label: 'Drivetrain details', hint: 'Cranks, chain, cassette and derailleur labels.' },
  { id: 'brakes', label: 'Brake details', hint: 'Both brake levers, calipers and rotor markings.' },
  { id: 'cockpit', label: 'Cockpit & controls', hint: 'Handlebar, shifters, display and control labels.' },
  { id: 'tyres', label: 'Tyre sidewalls', hint: 'Readable size, brand and valve on both tyres.' },
  { id: 'serial', label: 'Frame & serial', hint: 'Frame labels and serial number; commonly below the bottom bracket or on a dropout.' },
  { id: 'electric', label: 'Motor & battery labels', hint: 'E-bike motor, battery rating label and visible wiring; never open the battery.' },
];

export const BIKE_INSPECTION_PHOTO_COUNT = BIKE_INSPECTION_PHOTO_SLOTS.length;

/** Point a follow-up request at the closest existing guided photo slot. */
export const PHOTO_SLOT_FOR_SYSTEM = {
  frame: 'serial', geometry: 'drive-side', wheels: 'tyres', brakes: 'brakes',
  drivetrain: 'drivetrain', cockpit: 'cockpit', seating: 'non-drive-side',
  suspension: 'front', electric: 'electric', accessories: 'non-drive-side', safety: 'front',
};
