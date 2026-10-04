import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/supabase', () => ({
  getStoredSupabaseUrl: () => 'https://lhojocpygcnkxvkrcuxh.supabase.co',
}));

import { AlertPipelineActions } from './src/components/AlertPipelineActions';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

describe('AlertPipelineActions', () => {
  it('shows the copy actions and the dashboard deep links', () => {
    render(<AlertPipelineActions />);
    expect(screen.getByText(/Copy webhook SQL \(rebuild trigger\)/i)).toBeTruthy();
    expect(screen.getByText(/Copy edge-function deploy command/i)).toBeTruthy();
    expect(screen.getByText(/Copy server secrets/i)).toBeTruthy();
    expect(screen.getByText(/Open Resend API keys/i)).toBeTruthy();
    expect(screen.getByText(/Open PushEngage dashboard/i)).toBeTruthy();
    expect(screen.getByText(/Open Supabase Webhooks/i)).toBeTruthy();
    expect(screen.getByText(/Open Edge Functions/i)).toBeTruthy();
  });

  it('copies the webhook SQL and reports it back', async () => {
    const onFlash = vi.fn();
    render(<AlertPipelineActions onFlash={onFlash} />);
    fireEvent.click(screen.getByText(/Copy webhook SQL \(rebuild trigger\)/i));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(copied).toContain('/functions/v1/notify-booking');
    await waitFor(() => expect(onFlash).toHaveBeenCalledWith(expect.stringMatching(/copied/i), true));
  });
});
