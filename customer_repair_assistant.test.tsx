import React, { useCallback, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ assess: vi.fn(), change: vi.fn(), busy: vi.fn(), pending: vi.fn() }));
vi.mock('./src/api/customerRepairAssessment', () => ({ assessCustomerRepair: calls.assess }));
vi.mock('./src/utils/imageCompress', () => ({ compressImageFile: async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA' }) }));
import { CustomerRepairAssistant } from './src/components/CustomerRepairAssistant';
import { normaliseRepairReport, type CustomerRepairReport } from './src/utils/customerRepairReport';
function Host({ notes = 'Rear wheel issue' }: { notes?: string }) {
  const [value, setValue] = useState<CustomerRepairReport | null>(null);
  const change = useCallback((report: CustomerRepairReport | null) => { calls.change(report); setValue(report); }, []);
  return <CustomerRepairAssistant bike="Trek FX" symptoms={[]} notes={notes} value={value} onChange={change} onBusyChange={calls.busy} onPendingChange={calls.pending}/>;
}
beforeEach(() => {
  vi.clearAllMocks();
  calls.assess.mockImplementation(async input => normaliseRepairReport({ summary: 'Possible tyre issue.', findings: [], systems: [], questions: ['How fast does it lose air?'], photoRequests: [{ area: 'Sidewall size', instruction: 'Show the printed size', reason: 'Needed for tube sizing' }] }, input));
});
afterEach(cleanup);
async function upload() {
  fireEvent.change(screen.getByLabelText('Choose repair photos'), { target: { files: [new File(['image'], 'bike.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(screen.getByText('1/6 photos')).toBeTruthy());
}
describe('customer photo repair flow', () => {
  it('requires an explicit review, retains photos on AI failure and allows a manual staff handoff', async () => {
    calls.assess.mockRejectedValueOnce(Error('offline'));
    render(<Host/>); await upload();
    expect(calls.assess).not.toHaveBeenCalled();
    expect(calls.pending).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Review my bike' }));
    await screen.findByText(/Photo analysis is unavailable/);
    fireEvent.click(screen.getByRole('button', { name: 'Attach for staff without AI' }));
    await screen.findByText(/Report ready/);
    const report = calls.change.mock.calls.at(-1)?.[0];
    expect(report.mode).toBe('customer-description');
    expect(report.photos).toHaveLength(1);
    expect(calls.pending).toHaveBeenLastCalledWith(false);
  });
  it('asks focused follow-ups and requires a fresh report after answers change', async () => {
    render(<Host/>); await upload();
    fireEvent.click(screen.getByRole('button', { name: 'Review my bike' }));
    await screen.findByText(/Report ready/);
    expect(screen.getByText('Show the printed size')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('How fast does it lose air?'), { target: { value: 'Overnight' } });
    expect(screen.queryByText(/Report ready/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update photo review' }));
    await screen.findByText(/Report ready/);
    expect(calls.assess.mock.calls.at(-1)?.[0].answers['How fast does it lose air?']).toBe('Overnight');
  });
  it('ignores a stale response when the customer changes the reported symptoms', async () => {
    let resolve!: (v: unknown) => void;
    calls.assess.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const view = render(<Host/>);
    fireEvent.click(screen.getByRole('button', { name: 'Review my bike' }));
    view.rerender(<Host notes="Brake has stopped working"/>);
    await act(async () => resolve({ summary: 'Old report' }));
    expect(screen.queryByText(/Report ready/)).toBeNull();
  });
  it('does not read unsupported files or call Gemini automatically', async () => {
    render(<Host/>);
    fireEvent.change(screen.getByLabelText('Choose repair photos'), { target: { files: [new File(['x'], 'bike.heic', { type: 'image/heic' })] } });
    await screen.findByText(/Export HEIC photos as JPEG/);
    expect(screen.getByText('0/6 photos')).toBeTruthy();
    expect(calls.assess).not.toHaveBeenCalled();
  });
});
