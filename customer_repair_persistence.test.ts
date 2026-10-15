import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('./src/lib/supabase', () => ({ getSupabaseClient: () => ({ from: () => ({ insert: db.insert }) }) }));
import { insertServiceBookingToDb } from './src/api/backendDataService';
import { descriptionOnlyReport, formatRepairReport } from './src/utils/customerRepairReport';
const report = descriptionOnlyReport({ bike: 'Bike', symptoms: ['Flat tyre'], notes: 'Loses air overnight', answers: {}, safetyConcern: false, photos: [{ id: 'p1', label: 'Tyre', dataUrl: 'data:image/jpeg;base64,AAAA' }] });
const booking = { id: 'test-no-live-booking', notes: formatRepairReport(report), bikeDetails: { repairAssessment: report } } as any;
beforeEach(() => db.insert.mockReset());
describe('photo report persistence', () => {
  it('persists the photos in bike_details and the readable summary in notes', async () => {
    db.insert.mockResolvedValue({ error: null });
    expect(await insertServiceBookingToDb(booking)).toBe(true);
    expect(db.insert.mock.calls[0][0].bike_details.repairAssessment.photos).toHaveLength(1);
    expect(db.insert.mock.calls[0][0].notes).toContain('Loses air overnight');
  });
  it('refuses to silently strip a report when the JSON column is missing', async () => {
    db.insert.mockResolvedValue({ error: { message: 'Could not find the \'bike_details\' column', code: 'PGRST204' } });
    expect(await insertServiceBookingToDb(booking)).toBe(false);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
