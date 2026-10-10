import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The identifier talks to Gemini through visionService; mock that boundary so the
// UI can be exercised offline (no key, no network, no quota).
const hoisted = vi.hoisted(() => ({
  identifyBikeFromImage: vi.fn(),
  shop: {} as any,
}));

vi.mock('./src/api/visionService', () => ({
  isBikeVisionConfigured: () => true,
  identifyBikeFromImage: hoisted.identifyBikeFromImage,
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
  hoisted.identifyBikeFromImage.mockReset();
  hoisted.identifyBikeFromImage.mockResolvedValue(ANALYSIS);
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

    await waitFor(() => expect(hoisted.identifyBikeFromImage).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Wheel 700c/)).toBeTruthy());
    expect(screen.getByText(/Tyre 700x32c/)).toBeTruthy();
    expect(screen.getByText(/Valve Presta/)).toBeTruthy();
    expect(screen.getByText(/Serial WTU1234567/)).toBeTruthy();
  });

  it('sends the full image to the vision service as a single request', async () => {
    const { container } = render(<AiBikeIdentifier user={{ uid: 'u1' }} isOpen onClose={() => {}} onAdded={() => {}} addBike={undefined} />);
    selectFile(container.querySelector('input[type="file"]') as HTMLElement);
    await waitFor(() => expect(hoisted.identifyBikeFromImage).toHaveBeenCalledTimes(1));
    const [images] = hoisted.identifyBikeFromImage.mock.calls[0];
    expect(Array.isArray(images)).toBe(true);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe('image/jpeg');
  });
});
