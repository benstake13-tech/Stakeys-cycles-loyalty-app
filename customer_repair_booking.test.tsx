import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./src/config/surface', async (importOriginal) => ({ ...await importOriginal<typeof import('./src/config/surface')>(), APP_SURFACE: 'customer', isCustomerSurface: true, isStaffSurface: false, isFullSurface: false }));
const calls = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ currentUser: { uid: 'customer', displayName: 'Sam Rider', email: 'sam@example.com', phoneNumber: '+44 7911 123456', bikes: [] }, createBooking: calls.create, redeemServiceVoucher: vi.fn(), ownerConfig: { businessName: 'Stakeys', ownerEmail: 'shop@example.com' } }) }));
vi.mock('./src/api/translationService', () => ({ isTranslationConfigured: () => false, translateBookingNotesWithOriginal: async (fields: any) => ({ translated: fields, original: fields }) }));
vi.mock('./src/components/weather/BookingRidingWeather', () => ({ BookingRidingWeather: () => null }));
vi.mock('./src/components/BookingConfirmationAnimation', () => ({ BookingConfirmationAnimation: () => null }));
vi.mock('./src/utils/imageCompress', () => ({ compressImageFile: async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA' }) }));
import { BookingPortal } from './src/components/BookingPortal';
beforeEach(() => { calls.create.mockReset(); calls.create.mockResolvedValue({ id: 'mock-report-booking' }); });
afterEach(cleanup);
async function addPhoto() {
  fireEvent.change(screen.getByLabelText('Choose repair photos'), { target: { files: [new File(['image'], 'bike.jpg', { type: 'image/jpeg' })] } });
  await screen.findByText('1/6 photos');
}
describe('customer photo report on the real booking form', () => {
  it('prevents accidental photo loss and submits the attached report without inventing a default symptom', async () => {
    const view = render(<BookingPortal/>); await addPhoto();
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    expect(calls.create).not.toHaveBeenCalled();
    await screen.findByText(/Please review your photos/);
    fireEvent.change(screen.getByLabelText('When did the problem start?'), { target: { value: 'Yesterday after a ride' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attach for staff without AI' }));
    const picker = screen.getByLabelText('Choose repair photos');
    const toggle = view.container.querySelector('#booking-step-issues button')!;
    fireEvent.click(toggle); fireEvent.click(toggle);
    expect(screen.getByLabelText('Choose repair photos')).toBe(picker);
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await waitFor(() => expect(calls.create).toHaveBeenCalledTimes(1));
    const payload = calls.create.mock.calls[0][0];
    expect(payload.bikeDetails.repairAssessment.photos).toHaveLength(1);
    expect(payload.bikeDetails.repairAssessment.answers['When did the problem start?']).toContain('Yesterday');
    expect(payload.selectedIssues).toEqual([]);
    expect(payload.notes).toContain('Customer description only');
    expect(payload.notes).not.toContain('data:image');
  });
  it('keeps report evidence in the form when the workshop rejects submission', async () => {
    calls.create.mockRejectedValueOnce(Error('Workshop unreachable'));
    render(<BookingPortal/>); await addPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Attach for staff without AI' }));
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await screen.findByText('Workshop unreachable');
    expect(screen.getByText('1/6 photos')).toBeTruthy();
    expect(screen.getByText(/Report ready/)).toBeTruthy();
  });
});
