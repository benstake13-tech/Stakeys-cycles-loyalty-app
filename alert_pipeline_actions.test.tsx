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

  it('copies the deploy command and reveals what to do next', async () => {
    const onFlash = vi.fn();
    render(<AlertPipelineActions onFlash={onFlash} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Copy$/ })[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(copied).toContain('supabase functions deploy send-email');
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
});
