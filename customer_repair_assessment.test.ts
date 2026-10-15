import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normaliseRepairReport, descriptionOnlyReport, formatRepairReport, readStoredRepairReport, REPAIR_SYSTEMS, MAX_REPAIR_PHOTO_CHARS, validRepairPhotos, type RepairReportInput } from './src/utils/customerRepairReport';
const gateway = vi.hoisted(() => vi.fn());
vi.mock('./src/api/geminiGateway', () => ({ generateGemini: gateway }));
import { assessCustomerRepair } from './src/api/customerRepairAssessment';

const input: RepairReportInput = { bike: 'Trek FX', symptoms: ['Rear tyre loses air'], notes: 'Started yesterday', photos: [{ id: 'photo-1', label: 'Tyre sidewall', dataUrl: 'data:image/jpeg;base64,AAAA' }], answers: { 'When?': 'After a wet ride' }, safetyConcern: false };
const raw = { summary: 'Tyre appears deflated; leak test needed.', stopRiding: false, findings: [{ component: 'Rear tyre', observation: 'Appears deflated', source: 'photo', severity: 'attention', photoIds: ['photo-1'], possibleCauses: ['Tube or valve leak'], workshopChecks: ['Leak test and inspect casing'], replacement: { part: 'Tube', markings: '', searchQuery: 'bicycle tube ETRTO valve', compatibilityChecks: ['Read ETRTO size and valve length'], status: 'confirmed' } }], systems: [{ id: 'tyres', status: 'concern', note: 'Test for leak.' }], photoRequests: [{ area: 'Tyre sidewall', instruction: 'Photograph the printed ETRTO size', reason: 'Size is not legible' }], questions: ['How fast does it deflate?'] };
beforeEach(() => gateway.mockReset());
describe('customer repair assessment contract', () => {
  it('reviews every system and keeps unobserved systems unassessed', () => {
    const report = normaliseRepairReport(raw, input);
    expect(report.systems).toHaveLength(REPAIR_SYSTEMS.length);
    expect(report.systems.find(s => s.id === 'brakes')?.status).toBe('not-assessed');
    expect(report.findings[0].source).toBe('photo');
  });
  it('downgrades photo claims with fabricated evidence and never confirms part compatibility', () => {
    const report = normaliseRepairReport({ ...raw, findings: [{ ...raw.findings[0], photoIds: ['invented'] }] }, input);
    expect(report.findings[0].source).toBe('possible');
    expect(report.findings[0].photoIds).toEqual([]);
    expect(report.findings[0].replacement?.status).toBe('unverified');
    expect(report.findings[0].replacement?.compatibilityChecks.join(' ')).toMatch(/before ordering/);
  });
  it('cannot override a customer safety concern', () => {
    expect(normaliseRepairReport(raw, { ...input, safetyConcern: true }).stopRiding).toBe(true);
    expect(normaliseRepairReport({ ...raw, findings: [{ ...raw.findings[0], severity: 'urgent' }] }, input).stopRiding).toBe(true);
  });
  it('keeps reports honest without images and supports an explicit non-AI handoff', () => {
    const report = normaliseRepairReport(raw, { ...input, photos: [] });
    expect(report.findings[0].source).toBe('possible');
    expect(report.systems.every(s => s.status === 'not-assessed')).toBe(true);
    const manual = descriptionOnlyReport(input);
    expect(manual.mode).toBe('customer-description');
    expect(manual.findings).toEqual([]);
    expect(manual.photos).toEqual(input.photos);
    expect(manual.answers).toEqual(input.answers);
  });
  it('produces staff-readable notes without embedding base64 photos in emails', () => {
    const notes = formatRepairReport(normaliseRepairReport(raw, input));
    expect(notes).toContain('Started yesterday');
    expect(notes).toContain('After a wet ride');
    expect(notes).toContain('Read ETRTO size and valve length');
    expect(notes).toContain('How fast does it deflate?');
    expect(notes).toContain('Leak test');
    expect(notes).not.toContain('data:image');
  });
  it('rejects malformed model output and unsafe or oversized photo URLs', () => {
    expect(() => normaliseRepairReport({}, input)).toThrow(/incomplete/);
    expect(validRepairPhotos([{ id: 'a', label: 'a', dataUrl: 'javascript:alert(1)' }])).toEqual([]);
    expect(validRepairPhotos([{ id: 'a', label: 'a', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_REPAIR_PHOTO_CHARS) }])).toEqual([]);
    expect(readStoredRepairReport({ version: 1, findings: false })).toBeNull();
  });
  it('sends labelled photos and answers through the existing gateway with cancellation', async () => {
    gateway.mockResolvedValue({ text: JSON.stringify(raw), model: 'server-selected-flash' });
    const controller = new AbortController();
    const result = await assessCustomerRepair(input, controller.signal);
    const request = gateway.mock.calls[0][0];
    expect(request.contents[0].parts[0].text).toBe('Photo photo-1: Tyre sidewall');
    expect(request.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'AAAA' });
    expect(JSON.parse(request.contents[0].parts[2].text).answers).toEqual(input.answers);
    expect(request.config.abortSignal).toBe(controller.signal);
    expect(request.config.systemInstruction).toContain('Never provide a safe-to-ride clearance');
    expect(request.model).toBeUndefined();
    expect(result.model).toBe('server-selected-flash');
  });
  it('does not silently fabricate a successful analysis on service or JSON errors', async () => {
    gateway.mockRejectedValueOnce(Error('quota'));
    await expect(assessCustomerRepair(input)).rejects.toThrow('quota');
    gateway.mockResolvedValueOnce({ text: '{ incomplete' });
    await expect(assessCustomerRepair(input)).rejects.toThrow(/incomplete/);
  });
});
