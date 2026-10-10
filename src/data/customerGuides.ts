/**
 * Short, customer-facing care guides.
 *
 * A curated subset of the workshop knowledge base (itself adapted from Sheldon
 * Brown's bicycle technical information — https://sheldonbrown.com/) rewritten
 * for riders rather than mechanics. Each guide is plain data so the viewer and
 * the tests stay simple; the workshop's full repair & training guide remains the
 * deeper, staff-facing reference.
 */

export interface CareGuideStep {
  title: string;
  body: string;
}

export interface CareGuide {
  id: string;
  title: string;
  summary: string;
  /** Rough minutes to read/do. */
  minutes: number;
  tags: string[];
  steps: CareGuideStep[];
  /** Optional safety warning shown prominently. */
  warning?: string;
}

export const CARE_GUIDES: CareGuide[] = [
  {
    id: 'fix-a-puncture',
    title: 'Fix a flat tyre on the road',
    summary: 'Get rolling again with a spare tube, levers and a pump.',
    minutes: 8,
    tags: ['Tyres', 'Roadside'],
    steps: [
      { title: 'Get the wheel off', body: 'Release the brake if it blocks the tyre, undo the quick-release or axle nuts, and lift the wheel out. Note which way it came out.' },
      { title: 'Find the cause', body: 'Inflate slightly and listen or feel for escaping air. Run a gloved finger around the inside of the tyre — the thorn or glass is often still there.' },
      { title: 'Remove the tyre', body: 'Hook one lever under the bead, then a second lever a few spokes along, and walk the lever around the rim to free one side.' },
      { title: 'Swap the tube', body: 'Fit the new tube, seating the valve first, then work the bead back on with your thumbs — use the lever only for the last few centimetres.' },
      { title: 'Inflate and refit', body: 'Inflate to the pressure on the tyre sidewall, check the bead sits evenly, then refit the wheel and re-engage the brake.' },
    ],
    warning: 'If the tyre has a large cut or the rim is damaged, do not ride it — book it in for a proper check.',
  },
  {
    id: 'check-tyre-pressure',
    title: 'Set the right tyre pressure',
    summary: 'The single easiest way to ride faster, grip better and avoid pinch flats.',
    minutes: 3,
    tags: ['Tyres', 'Maintenance'],
    steps: [
      { title: 'Read the sidewall', body: 'Every tyre prints a recommended pressure range. Start at the middle of that range.' },
      { title: 'Weigh it up', body: 'Heavier riders and loaded bikes want the upper end; lighter riders can run lower for more grip and comfort.' },
      { title: 'Check weekly', body: 'Tyres lose pressure slowly. A quick squeeze before each ride and a gauge check weekly keeps them honest.' },
    ],
  },
  {
    id: 'clean-and-lube',
    title: 'Clean and lubricate your drivetrain',
    summary: 'A clean chain shifts better and lasts far longer.',
    minutes: 10,
    tags: ['Drivetrain', 'Maintenance'],
    steps: [
      { title: 'Degrease', body: 'Apply a chain cleaner or degreaser and scrub with a brush while turning the pedals backwards. Wipe with a rag.' },
      { title: 'Rinse and dry', body: 'Rinse gently — avoid a high-pressure jet near the bearings — then dry the chain with a rag.' },
      { title: 'Lube', body: 'Apply one drop of chain lube to each link while turning the pedals, then wipe off the excess so it does not attract grit.' },
      { title: 'Check wear', body: 'Use a chain-wear gauge. A worn chain wears out your cassette and chainrings — replace it early.' },
    ],
  },
  {
    id: 'brake-safety-check',
    title: 'Do the ABC quick check before every ride',
    summary: 'A 60-second safety sweep that catches most avoidable problems.',
    minutes: 2,
    tags: ['Safety', 'Brakes'],
    steps: [
      { title: 'A — Air', body: 'Squeeze both tyres. They should feel firm and hold their shape.' },
      { title: 'B — Brakes', body: 'Roll the bike and pull each brake. The bike should stop smoothly and the lever should not reach the bar.' },
      { title: 'C — Chain & cranks', body: 'Spin the cranks — the chain should run smoothly and stay on. Check the wheels are clamped tight.' },
      { title: 'Quick release', body: 'Make sure both wheel quick-releases are closed and pointing backwards.' },
    ],
    warning: 'If a brake feels spongy or the lever reaches the bar, do not ride — book a brake service.',
  },
  {
    id: 'e-bike-battery-care',
    title: 'Look after an e-bike battery',
    summary: 'Keep range and battery life healthy with a few simple habits.',
    minutes: 5,
    tags: ['E-Bike', 'Maintenance'],
    steps: [
      { title: 'Store it sensibly', body: 'Keep the battery between roughly 20% and 80% for storage, in a cool, dry place away from direct sun.' },
      { title: 'Charge at room temperature', body: 'Charging a freezing-cold battery damages it. Let it warm up first.' },
      { title: 'Use the supplied charger', body: 'A mismatched charger can overheat the pack. Match the voltage and connector exactly.' },
      { title: 'Watch for warning signs', body: 'Swelling, a hot pack, or a burning smell means stop using it and bring it to the workshop.' },
    ],
    warning: 'Never leave a charging e-bike battery unattended overnight, and never charge a damaged pack.',
  },
  {
    id: 'when-to-book-a-service',
    title: 'When to book a workshop service',
    summary: 'Know the signs that a bike needs a professional check.',
    minutes: 3,
    tags: ['Servicing', 'Safety'],
    steps: [
      { title: 'Strange noises', body: 'Creaks, clicks and grinding often point to worn bearings or a dry drivetrain.' },
      { title: 'Gears misbehaving', body: 'Slipping, skipping or sluggish shifts usually mean worn cables or a stretched chain.' },
      { title: 'Braking changes', body: 'Longer stopping distances, squealing or a spongy lever are all safety-critical.' },
      { title: 'It has been a while', body: 'Most bikes benefit from a professional service every 6–12 months, or sooner for heavy use.' },
    ],
  },
];
