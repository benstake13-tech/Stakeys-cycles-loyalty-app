import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/shared/supabase', () => ({
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
  it('renders the three pipeline steps, each with a copy button and a "paste here" link', () => {
    render(<AlertPipelineActions />);
    expect(screen.getByText('Deploy the edge functions')).toBeTruthy();
    expect(screen.getByText('Set the server secrets')).toBeTruthy();
    expect(screen.getByText('Wire the webhook that alerts staff')).toBeTruthy();
    // One copy button per step.
    expect(screen.getAllByRole('button', { name: /^Copy$/ })).toHaveLength(3);
    // And a link beside each copy button pointing at the page to paste into.
    expect(screen.getByText(/Open Edge Functions — Paste here/i)).toBeTruthy();
    expect(screen.getByText(/Open Secrets page — Paste here/i)).toBeTruthy();
    expect(screen.getByText(/Open SQL Editor — Paste here/i)).toBeTruthy();
  });

  it('links the copy buttons to the right Supabase pages', () => {
    render(<AlertPipelineActions />);
    const href = (text: RegExp) => screen.getByText(text).closest('a')?.getAttribute('href') ?? '';
    expect(href(/Open Edge Functions — Paste here/i)).toContain('/functions');
    expect(href(/Open Secrets page — Paste here/i)).toContain('/settings/functions');
    expect(href(/Open SQL Editor — Paste here/i)).toContain('/sql/new');
  });

  it('copies the deploy prompt and reveals what to do next', async () => {
    const onFlash = vi.fn();
    render(<AlertPipelineActions onFlash={onFlash} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Copy$/ })[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // A prompt, not a CLI script.
    expect(copied).toContain('send-email');
    expect(copied).toContain('SUPABASE_ACCESS_TOKEN');
    expect(copied).not.toMatch(/^supabase login/m);
    await waitFor(() => expect(screen.getByText(/Copied!/)).toBeTruthy());
    await waitFor(() => expect(onFlash).toHaveBeenCalledWith(expect.stringMatching(/copied/i), true));
  });

  it('copies the webhook SQL (notify-booking) from the third step', async () => {
    render(<AlertPipelineActions />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Copy$/ })[2]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(copied).toContain('/functions/v1/notify-booking');
  });

  it('renders the "Fix everything at once" one-shot repair', () => {
    render(<AlertPipelineActions ownerEmail="owner@stakeys.co.uk" />);
    expect(screen.getByText(/Fix everything at once/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy the fix-all SQL/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy the fix-all secrets/i })).toBeTruthy();
    expect(screen.getByText(/SQL Editor — paste & Run/i)).toBeTruthy();
    expect(screen.getByText(/Secrets — paste here/i)).toBeTruthy();
    // Owner email pre-fills the workshop recipient field.
    expect((screen.getByDisplayValue('owner@stakeys.co.uk') as HTMLInputElement).value).toBe(
      'owner@stakeys.co.uk'
    );
  });

  it('fix-all SQL uses one shared secret and targets both booking functions', async () => {
    render(<AlertPipelineActions ownerEmail="owner@stakeys.co.uk" />);
    fireEvent.click(screen.getByRole('button', { name: /Copy the fix-all SQL/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const sql = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain('/functions/v1/booking-email-notification');
    expect(sql).toContain('/functions/v1/booking-push-notification');
    expect(sql).toContain("booking_webhook_secret");
    expect(sql).toContain("owner_email = 'owner@stakeys.co.uk'");
    // The same secret must appear in the SQL and the secrets blob.
    const m = sql.match(/vault\.create_secret\('([0-9a-f]+)'/);
    expect(m).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Copy the fix-all secrets/i }));
    const secrets = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(secrets).toContain(`BOOKING_WEBHOOK_SECRET=${m![1]}`);
    expect(secrets).toContain('BOOKING_NOTIFY_EMAILS=owner@stakeys.co.uk');
  });
});
