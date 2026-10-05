/**
 * Legal disclaimers for Stakey's Cycles & Scooter.
 *
 * Covers mobile call-outs, home-workshop repairs and e-scooter / bicycle
 * servicing. Rendered by LegalDisclaimers.tsx (inline accordion + footer modal).
 */

export interface LegalBullet {
  /** Optional bold lead-in, e.g. "Call-Out Fee". */
  label?: string;
  text: string;
}

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets: LegalBullet[];
}

export const LEGAL_DISCLAIMER_UPDATED = 'October 2026';

export const LEGAL_DISCLAIMER_SECTIONS: LegalSection[] = [
  {
    id: 'general',
    title: '1. General Business Disclaimer',
    paragraphs: [
      'The information provided on this website and through our communication channels is for general informational purposes only. Stakey’s Cycles makes every effort to ensure that the descriptions, turnaround times, and pricing estimates provided are accurate; however, actual repair costs and timelines may vary depending on component availability, bike condition, or unexpected damage identified during servicing.',
    ],
    bullets: [],
  },
  {
    id: 'mobile-callout',
    title: '2. Mobile Call-Out & Service Fee Disclaimer',
    paragraphs: [],
    bullets: [
      {
        label: 'Call-Out Fee',
        text: 'Our mobile call-out service starts at £10 and varies depending on the travel distance to your location.',
      },
      {
        label: 'Non-Refundable Fee',
        text: 'The call-out fee covers travel time and initial physical inspection. If a repair cannot be completed due to missing specialized parts, unfixable structural damage, or customer cancellation after our technician has arrived on site, the base call-out fee remains payable and non-refundable.',
      },
      {
        label: 'Safe Working Area',
        text: 'For mobile servicing, customers must provide a reasonably safe, dry, and flat area for our technician to carry out the work. Stakey’s Cycles reserves the right to decline or halt on-site service if environmental conditions or safety hazards pose a risk to our team.',
      },
    ],
  },
  {
    id: 'repair',
    title: '3. Electric Scooter & Bicycle Repair Disclaimer',
    paragraphs: [],
    bullets: [
      {
        label: 'Post-Repair Inspection',
        text: 'Customers are strongly advised to inspect and test-ride their bicycle or e-scooter immediately upon completion of the repair.',
      },
      {
        label: 'Third-Party Modifications & Wear and Tear',
        text: 'Stakey’s Cycles is not responsible for pre-existing mechanical issues, structural fatigue, frame fractures, or defects caused by third-party modifications, unauthorized software/hardware alterations (including speed-unlocking on e-scooters), or general wear and tear.',
      },
      {
        label: 'Legal Road Use (E-Scooters)',
        text: 'Customers are solely responsible for ensuring that their electric scooter usage complies with all local UK laws, road traffic regulations, and public land restrictions. Stakey’s Cycles does not accept liability for fines, penalties, or legal action arising from the illegal operation of private e-scooters on public roads or pavements.',
      },
    ],
  },
  {
    id: 'home-workshop',
    title: '4. Home Workshop & Equipment Storage Disclaimer',
    paragraphs: [],
    bullets: [
      {
        label: 'Pick-Up and Drop-Off Service',
        text: 'Equipment collected for off-site servicing at our dedicated home workshop is handled with care. However, Stakey’s Cycles is not liable for minor cosmetic blemishes or pre-existing scratches.',
      },
      {
        label: 'Unclaimed Property',
        text: 'Repairs must be settled and picked up (or scheduled for redelivery) within 14 days of service completion notification. Unclaimed equipment beyond 30 days may be subject to storage fees or disposed of/sold to recover unpaid repair costs and storage fees.',
      },
    ],
  },
  {
    id: 'liability',
    title: '5. Limitation of Liability',
    paragraphs: [
      'To the fullest extent permitted by applicable UK law, Stakey’s Cycles shall not be liable for any indirect, incidental, or consequential damages, personal injury, or property damage resulting from the operation of any bicycle or electric scooter following service, except where directly caused by proven mechanical negligence by Stakey’s Cycles.',
    ],
    bullets: [],
  },
];
