import React from 'react';
import { render, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const startCalls: number[] = [];
  const stopCalls: number[] = [];
  let lastSuccess: ((text: string) => void) | null = null;
  class FakeHtml5Qrcode {
    static getCameras = vi.fn(async () => [{ id: 'cam1', label: 'Back camera' }]);
    constructor(_id: string, _opts: unknown) {}
    getState() {
      return 2; // Html5QrcodeScannerState.SCANNING
    }
    start = vi.fn(
      async (
        _camera: unknown,
        _config: unknown,
        onSuccess: (text: string) => void
      ) => {
        startCalls.push(Date.now());
        lastSuccess = onSuccess;
      }
    );
    stop = vi.fn(async () => {
      stopCalls.push(Date.now());
    });
    clear = vi.fn();
    scanFileV2 = vi.fn(async () => ({ decodedText: '' }));
  }
  return { startCalls, stopCalls, FakeHtml5Qrcode, get lastSuccess() { return lastSuccess; } };
});

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: hoisted.FakeHtml5Qrcode,
  Html5QrcodeSupportedFormats: {
    QR_CODE: 0,
    CODE_128: 1,
    CODE_39: 2,
    CODE_93: 3,
    EAN_13: 4,
    EAN_8: 5,
    UPC_A: 6,
    UPC_E: 7,
    ITF: 8,
    CODABAR: 9,
    DATA_MATRIX: 10,
  },
  Html5QrcodeScannerState: { UNKNOWN: 0, NOT_STARTED: 1, SCANNING: 2, PAUSED: 3 },
}));

const shop = vi.hoisted(() => ({ current: {} as any }));
vi.mock('./src/shared/context/ShopContext', () => ({ useShop: () => shop.current }));

import { QRCodeScannerModal } from './src/components/QRCodeScannerModal';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  hoisted.startCalls.length = 0;
  hoisted.stopCalls.length = 0;
});

describe('QRCodeScannerModal', () => {
  it('starts the camera once and does NOT restart it when context values change', async () => {
    // ShopContext polls the DB every 4s and swaps in brand-new array/function
    // identities; the camera must survive that instead of tearing down each poll.
    shop.current = { users: [], discountCodes: [], resolveScannedMember: vi.fn(async () => null) };
    const { rerender } = render(
      <QRCodeScannerModal isOpen onClose={() => {}} onCustomerScanned={() => {}} />
    );

    await wait(400); // past the 250ms start delay
    expect(hoisted.startCalls.length).toBe(1);

    // Simulate a poll tick: new users array + new resolver identity.
    shop.current = {
      users: [{ uid: 'x' }],
      discountCodes: [],
      resolveScannedMember: vi.fn(async () => null),
    };
    rerender(<QRCodeScannerModal isOpen onClose={() => {}} onCustomerScanned={() => {}} />);
    await wait(300);

    expect(hoisted.startCalls.length).toBe(1);
    expect(hoisted.stopCalls.length).toBe(0);
  });

  it('resolves a decoded member and shows the pass before loading it', async () => {
    const customer = { uid: 'u1', displayName: 'Ada Lovelace', membershipNumber: 'STK-1' };
    const resolve = vi.fn(async () => customer);
    shop.current = { users: [], discountCodes: [], resolveScannedMember: resolve };
    const onCustomerScanned = vi.fn();

    render(<QRCodeScannerModal isOpen onClose={() => {}} onCustomerScanned={onCustomerScanned} />);
    await wait(400);

    expect(hoisted.lastSuccess).toBeTruthy();
    await act(async () => {
      hoisted.lastSuccess!('STK-1');
      await wait(20);
    });

    await screen.findByText('Ada Lovelace');
    expect(resolve).toHaveBeenCalledWith('STK-1');
    expect(hoisted.stopCalls.length).toBeGreaterThan(0);
  });
});
