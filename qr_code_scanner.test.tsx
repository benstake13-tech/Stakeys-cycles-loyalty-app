import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile } from './src/types/bikeShop';

const hoisted = vi.hoisted(() => {
  const scanner = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    clear: vi.fn(),
    getState: vi.fn(() => 2), // Html5QrcodeScannerState.SCANNING
    scanFileV2: vi.fn(async (_file: unknown) => ({ decodedText: 'STK-123456' })),
    decodeCb: null as null | ((text: string) => void),
  };
  return {
    scanner,
    playScannerBeep: vi.fn(),
    playScannerError: vi.fn(),
    resolveScannedMemberDetailed: vi.fn(),
    resolveScannedMember: vi.fn(),
    findDiscountCode: vi.fn(() => null),
  };
});

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    static getCameras = vi.fn(async () => []);
    start = (_cam: unknown, _cfg: unknown, onDecode: (t: string) => void) => {
      hoisted.scanner.decodeCb = onDecode;
      return hoisted.scanner.start();
    };
    stop = () => hoisted.scanner.stop();
    clear = () => hoisted.scanner.clear();
    getState = () => hoisted.scanner.getState();
    scanFileV2 = (file: unknown) => hoisted.scanner.scanFileV2(file);
  },
  Html5QrcodeSupportedFormats: {
    QR_CODE: 0, CODE_128: 1, CODE_39: 2, CODE_93: 3, EAN_13: 4, EAN_8: 5,
    UPC_A: 6, UPC_E: 7, ITF: 8, CODABAR: 9, DATA_MATRIX: 10,
  },
  Html5QrcodeScannerState: { NOT_STARTED: 1, SCANNING: 2, PAUSED: 3 },
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    users: [],
    discountCodes: [],
    resolveScannedMemberDetailed: hoisted.resolveScannedMemberDetailed,
    resolveScannedMember: hoisted.resolveScannedMember,
  }),
}));

vi.mock('./src/utils/wheelAudio', () => ({
  wheelAudio: {
    playScannerBeep: hoisted.playScannerBeep,
    playScannerError: hoisted.playScannerError,
  },
}));

vi.mock('./src/utils/discountService', () => ({
  findDiscountCode: hoisted.findDiscountCode,
}));

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => ({
    products: [
      {
        id: 'prod-abc123',
        name: 'Carrera Vengeance',
        price: 249.99,
        category: 'Mens Bikes',
        image: '',
        stock: 2,
      },
    ],
  }),
}));

import { QRCodeScannerModal } from './src/components/QRCodeScannerModal';

const customer: UserProfile = {
  uid: 'u1',
  email: 'ada@example.com',
  role: 'customer',
  displayName: 'Ada Rider',
  membershipNumber: 'STK-123456',
  stamps: 3,
  tickets: 1,
  points: 50,
  createdAt: new Date(),
};

let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  hoisted.scanner.start.mockClear();
  hoisted.scanner.stop.mockClear();
  hoisted.scanner.clear.mockClear();
  hoisted.scanner.getState.mockReturnValue(2);
  hoisted.scanner.scanFileV2.mockReset();
  hoisted.scanner.decodeCb = null;
  hoisted.playScannerBeep.mockClear();
  hoisted.playScannerError.mockClear();
  hoisted.resolveScannedMemberDetailed.mockReset();
  hoisted.findDiscountCode.mockReset();
  hoisted.findDiscountCode.mockReturnValue(null);
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openScanner() {
  const onCustomerScanned = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <QRCodeScannerModal isOpen onClose={onClose} onCustomerScanned={onCustomerScanned} />
  );
  await waitFor(() => expect(hoisted.scanner.start).toHaveBeenCalled());
  const decode = hoisted.scanner.decodeCb!;
  return { onCustomerScanned, onClose, decode, ...view };
}

describe('QRCodeScannerModal scan lifecycle', () => {
  it('pauses the camera the instant a code is detected and shows the resolved member', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer });
    const { decode } = await openScanner();

    await act(async () => {
      decode('STK-123456');
    });

    await waitFor(() => expect(screen.getByText('Ada Rider')).toBeTruthy());
    expect(hoisted.playScannerBeep).toHaveBeenCalledTimes(1);
    // Camera was stopped so no further frame can loop.
    expect(hoisted.scanner.stop).toHaveBeenCalled();
  });

  it('does NOT restart scanning after a successful scan when the component re-renders', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer });
    const { decode, rerender, onClose, onCustomerScanned } = await openScanner();

    await act(async () => {
      decode('STK-123456');
    });
    await waitFor(() => expect(screen.getByText('Ada Rider')).toBeTruthy());
    expect(hoisted.scanner.start).toHaveBeenCalledTimes(1);

    // A context-driven re-render (e.g. setUsers during the lookup) must not tear
    // the resolved result down and silently re-arm the camera.
    rerender(
      <QRCodeScannerModal isOpen onClose={onClose} onCustomerScanned={onCustomerScanned} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Ada Rider')).toBeTruthy();
    expect(hoisted.scanner.start).toHaveBeenCalledTimes(1);
  });

  it('alerts "User not found or access denied" and stays paused on a failed lookup', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({
      customer: null,
      error: 'permission denied for table profiles',
    });
    const { decode } = await openScanner();

    await act(async () => {
      decode('STK-000000');
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toMatch(/User not found or access denied/i);
    expect(screen.getByText(/User not found or access denied/i)).toBeTruthy();
    expect(hoisted.playScannerError).toHaveBeenCalledTimes(1);
    // Not looping: the camera was not re-armed.
    expect(hoisted.scanner.start).toHaveBeenCalledTimes(1);
  });

  it('resumes only when staff press "Scan Next QR Code"', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer });
    const { decode } = await openScanner();

    await act(async () => {
      decode('STK-123456');
    });
    await waitFor(() => expect(screen.getByText('Ada Rider')).toBeTruthy());
    expect(hoisted.scanner.start).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Scan Next QR Code/i }));

    await waitFor(() => expect(hoisted.scanner.start).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Ada Rider')).toBeNull();
  });

  it('handles a resolved member only once even if several frames fire together', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer });
    const { decode } = await openScanner();

    await act(async () => {
      decode('STK-123456');
      decode('STK-123456');
    });

    await waitFor(() => expect(screen.getByText('Ada Rider')).toBeTruthy());
    expect(hoisted.resolveScannedMemberDetailed).toHaveBeenCalledTimes(1);
  });

  it('triggers the portal navigation action when the member is loaded', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer });
    const { decode, onCustomerScanned, onClose } = await openScanner();

    await act(async () => {
      decode('STK-123456');
    });
    await waitFor(() => expect(screen.getByText('Ada Rider')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Load into till/i }));

    expect(onCustomerScanned).toHaveBeenCalledTimes(1);
    expect(onCustomerScanned.mock.calls[0][0]).toMatchObject({ uid: 'u1' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('routes an item-for-sale QR to onItemScanned', async () => {
    hoisted.resolveScannedMemberDetailed.mockResolvedValue({ customer: null });
    const onItemScanned = vi.fn();
    const onClose = vi.fn();
    render(
      <QRCodeScannerModal
        isOpen
        onClose={onClose}
        onCustomerScanned={vi.fn()}
        onItemScanned={onItemScanned}
      />
    );
    await waitFor(() => expect(hoisted.scanner.start).toHaveBeenCalled());
    const decode = hoisted.scanner.decodeCb!;

    await act(async () => {
      decode('ITEM-PRODABC123|urn:stakeys:item:ITEM-PRODABC123');
    });

    await waitFor(() => expect(onItemScanned).toHaveBeenCalledTimes(1));
    expect(onItemScanned.mock.calls[0][0]).toMatchObject({ id: 'prod-abc123' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hoisted.playScannerBeep).toHaveBeenCalledTimes(1);
    expect(hoisted.playScannerError).not.toHaveBeenCalled();
  });

  it('drops a lookup that resolves after the modal was closed (no stale UI)', async () => {
    let resolveLookup: ((v: { customer: UserProfile | null }) => void) | undefined;
    hoisted.resolveScannedMemberDetailed.mockImplementation(
      () => new Promise((res) => { resolveLookup = res; })
    );
    const onCustomerScanned = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <QRCodeScannerModal isOpen onClose={onClose} onCustomerScanned={onCustomerScanned} />
    );
    await waitFor(() => expect(hoisted.scanner.start).toHaveBeenCalled());
    const decode = hoisted.scanner.decodeCb!;

    await act(async () => {
      decode('STK-123456');
    });
    // Close the modal while the (still-pending) lookup is in flight.
    rerender(
      <QRCodeScannerModal isOpen={false} onClose={onClose} onCustomerScanned={onCustomerScanned} />
    );

    await act(async () => {
      resolveLookup?.({ customer });
      await Promise.resolve();
    });

    // The late result must not reopen the result panel or fire an alert.
    expect(screen.queryByText('Ada Rider')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onCustomerScanned).not.toHaveBeenCalled();
  });
});
