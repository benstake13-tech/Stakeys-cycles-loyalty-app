import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The identifier talks to Gemini through visionService; mock that boundary so the
// UI can be exercised offline (no key, no network, no quota).
const hoisted = vi.hoisted(() => ({
  diagnoseFault: vi.fn(),
  shop: {} as any,
}));

vi.mock('./src/api/visionService', () => ({
  isBikeVisionConfigured: () => true,
  diagnoseFault: hoisted.diagnoseFault,
}));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { AiBikeIdentifier } from './src/components/AiBikeIdentifier';

const ANALYSIS = {
  make: 'Trek',
  model: 'FX 1',
  type: 'cycle',
  confidence: 0.8,
  summary: 'Hybrid commuter',
  colour: 'Matte black',
  frameMaterial: 'Aluminium',
  serialNumber: 'WTU1234567',
  positioning: {
    wheelSize: '700c',
    tyreSize: '700x32c',
    valveType: 'Presta',
    frameSizeEstimate: 'Medium (~17in)',
  },
  electricKit: { isElectric: false },
  mainSpecs: [{ category: 'Wheels & Tires', componentName: 'Wheelset', currentPart: '700c alloy' }],
  obviousProblems: [],
};

const selectFile = (input: HTMLElement) => {
  const file = new File(['fake-bytes'], 'bike.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  cleanup();
  hoisted.diagnoseFault.mockReset();
  hoisted.diagnoseFault.mockResolvedValue({ ...ANALYSIS, usedFallback: false, fallbackReason: null });
  hoisted.shop = { addCustomerBike: vi.fn(async () => ({ id: 'bike-1' })) };
});

describe('AiBikeIdentifier — fuller spec capture', () => {
  it('offers a full shot plus brand-name and model close-up slots', () => {
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    expect(screen.getByText(/full side-on photo/i)).toBeTruthy();
    expect(screen.getByText('Brand name')).toBeTruthy();
    expect(screen.getByText('Model')).toBeTruthy();
    expect(container.querySelectorAll('input[type="file"]').length).toBe(1);
  });

  it('reads wheel size, tyre size, valve type and serial number from the analysis', async () => {
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);

    await waitFor(() => expect(hoisted.diagnoseFault).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Wheel 700c/)).toBeTruthy());
    expect(screen.getByText(/Tyre 700x32c/)).toBeTruthy();
    expect(screen.getByText(/Valve Presta/)).toBeTruthy();
    expect(screen.getByText(/Serial WTU1234567/)).toBeTruthy();
  });

  it('sends the full image to the vision service as a single request', async () => {
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);
    await waitFor(() => expect(hoisted.diagnoseFault).toHaveBeenCalledTimes(1));
    const [payload] = hoisted.diagnoseFault.mock.calls[0];
    expect(Array.isArray(payload.images)).toBe(true);
    expect(payload.images).toHaveLength(1);
    expect(payload.images[0].mimeType).toBe('image/jpeg');
  });
});

const RICH_ANALYSIS = {
  ...ANALYSIS,
  mainSpecs: [
    { systemId: 'wheels', componentId: 'rear-tyre', category: 'Wheels & Tires', componentName: 'Rear tyre', currentPart: 'Continental Gatorskin', specValue: '700x32c', condition: 'good', visibility: 'visible', confidence: 0.9 },
    { systemId: 'wheels', componentId: 'front-tyre', category: 'Wheels & Tires', componentName: 'Front tyre', currentPart: 'Continental Gatorskin', specValue: '700x32c', condition: 'worn', visibility: 'visible', confidence: 0.85 },
    { systemId: 'drivetrain', componentId: 'chain', category: 'Drivetrain', componentName: 'Chain', currentPart: 'Shimano CN-HG53', condition: 'worn', visibility: 'visible' },
    { systemId: 'brakes', componentId: 'rotors', category: 'Brakes', componentName: 'Brake rotors / discs', currentPart: 'Unknown', visibility: 'assumed' },
  ],
  notVisible: ['Brake rotors / discs', 'Bottom bracket'],
  coverage: 0.55,
};

describe('AiBikeIdentifier — exhaustive grouped spec sheet', () => {
  it('renders the sheet grouped by system with a coverage meter', async () => {
    hoisted.diagnoseFault.mockResolvedValue({ ...RICH_ANALYSIS, usedFallback: false, fallbackReason: null });
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);

    await waitFor(() => expect(screen.getByText(/Full spec sheet \(4 parts\)/)).toBeTruthy());
    // Grouped headers, not a single flat list.
    expect(screen.getByText('Wheels & Tyres')).toBeTruthy();
    expect(screen.getByText('Drivetrain')).toBeTruthy();
    expect(screen.getByText('Brakes')).toBeTruthy();
    // Per-part spec values (also reflected in the positioning panel) and the visibility badge.
    expect(screen.getAllByText('700x32c').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('assumed')).toBeTruthy();
    // Coverage meter + not-visible callout.
    expect(screen.getByText(/parts · \d+% coverage/)).toBeTruthy();
    expect(screen.getByText(/Confirm at intake \(2\)/)).toBeTruthy();
  });

  it('persists every detected component and the notVisible/coverage fields', async () => {
    hoisted.diagnoseFault.mockResolvedValue({ ...RICH_ANALYSIS, usedFallback: false, fallbackReason: null });
    const addCustomerBike = vi.fn(async (bike: any) => ({ id: 'bike-9', ...bike }));
    hoisted.shop = { addCustomerBike };
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);

    await waitFor(() => expect(screen.getByText(/Full spec sheet/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /add to my garage/i }));

    await waitFor(() => expect(addCustomerBike).toHaveBeenCalledTimes(1));
    const saved = addCustomerBike.mock.calls[0][0];
    expect(saved.scrapedData.components).toHaveLength(4);
    expect(saved.scrapedData.components[0]).toMatchObject({
      systemId: 'wheels',
      componentId: 'rear-tyre',
      specValue: '700x32c',
      visibility: 'visible',
    });
    expect(saved.scrapedData.notVisible).toEqual(['Brake rotors / discs', 'Bottom bracket']);
    expect(saved.scrapedData.coverage).toBe(0.55);
    expect(saved.scrapedData.aiIdentification).toMatchObject(RICH_ANALYSIS);
  });
});

const FALLBACK = {
  inputLanguageDetected: 'es',
  userNotesTranslated: 'Rear brake squeals when wet',
  hasVisualData: false,
  brand: 'Unknown / To Be Inspected',
  make: 'Unknown / To Be Inspected',
  model: 'Unknown / To Be Inspected',
  wheelSizeAndSpecs: 'Standard / Requires Workshop Measurement',
  overallCondition: 'Fair',
  faults: [
    {
      component: 'General Intake',
      faultTitle: 'Customer Reported Issue',
      description: 'Reported: "freno chirría". Visual diagnostic offline.',
      severity: 'Medium',
      source: 'User Note',
    },
  ],
  type: 'cycle',
  confidence: 0,
  summary: 'Reported issue',
  positioning: {},
  electricKit: { isElectric: false },
  mainSpecs: [],
  obviousProblems: [],
  usedFallback: true,
  fallbackReason: 'error',
};

describe('AiBikeIdentifier — text-only intake & graceful fallback', () => {
  it('diagnoses from description alone (no photo) and shows the fallback banner', async () => {
    hoisted.diagnoseFault.mockResolvedValue(FALLBACK);
    render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);

    fireEvent.change(screen.getByTestId('ai-bike-notes'), { target: { value: 'freno chirría' } });
    fireEvent.click(screen.getByTestId('ai-bike-notes-submit'));

    await waitFor(() => expect(hoisted.diagnoseFault).toHaveBeenCalledTimes(1));
    const [payload] = hoisted.diagnoseFault.mock.calls[0];
    expect(payload.images).toEqual([]);
    expect(payload.userNotes).toBe('freno chirría');

    await waitFor(() => expect(screen.getByTestId('ai-bike-fallback')).toBeTruthy());
    expect(screen.getByTestId('ai-bike-fallback').textContent).toMatch(/Visual diagnostic offline/i);
    expect(screen.getByTestId('ai-bike-faults')).toBeTruthy();
    expect(screen.getByText('Customer Reported Issue')).toBeTruthy();
    expect(screen.getByText(/Notes: es/)).toBeTruthy();
  });

  it('keeps the notes button disabled until there is something to diagnose', () => {
    render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    const btn = screen.getByTestId('ai-bike-notes-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('ai-bike-notes'), { target: { value: 'chain skips' } });
    expect(btn.disabled).toBe(false);
  });

  it('passes the typed notes along with the photos on a photo analysis', async () => {
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    fireEvent.change(screen.getByTestId('ai-bike-notes'), { target: { value: 'rear wheel wobbles' } });
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);

    await waitFor(() => expect(hoisted.diagnoseFault).toHaveBeenCalled());
    const payload = hoisted.diagnoseFault.mock.calls.at(-1)![0];
    expect(payload.userNotes).toBe('rear wheel wobbles');
    expect(payload.images).toHaveLength(1);
  });
});
