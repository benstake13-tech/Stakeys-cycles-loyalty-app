/**
 * Staff-facing helper for the booking-notification email pipeline.
 *
 * Backs the "Email Setup" modal in the Staff Station. Each step in the pipeline
 * (deploy `send-email`, deploy `notify-booking`, create the database webhook,
 * set the recipient) is checked against the live project, and every step can be
 * exercised with a real test call. The two functions here that touch the network
 * take their dependencies as arguments so they stay easy to test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnerNotificationConfig } from '../types/bikeShop';

export interface EmailTestResult {
  ok: boolean;
  message: string;
}

/** `https://lhojocpygcnkxvkrcuxh.supabase.co` -> `lhojocpygcnkxvkrcuxh`. */
export function deriveProjectRef(supabaseUrl: string): string {
  return supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] || 'your-project';
}

/**
 * Sends a POST to an edge function with the anon key and reads the raw status,
 * so "not deployed" (404) is distinguishable from "deployed but gated" (401/403).
 */
export async function probeEdgeFunction(
  supabaseUrl: string,
  anonKey: string,
  name: string
): Promise<{ deployed: boolean; detail: string }> {
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: '{}',
    });
    if (res.status === 404) return { deployed: false, detail: 'HTTP 404 — not deployed' };
    return { deployed: true, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { deployed: false, detail: err instanceof Error ? err.message : 'unreachable' };
  }
}

/**
 * Exercises the workshop-alert path end to end: inserts a throwaway booking row
 * (which the database webhook should pick up) and removes it again. The insert
 * is the same shape the real booking flow writes, so a failure here is a real
 * signal rather than a mock.
 */
export async function testWorkshopEmail(
  supabase: SupabaseClient,
  config: OwnerNotificationConfig
): Promise<EmailTestResult> {
  const id = `bk-emailtest-${Date.now()}`;
  const payload = {
    id,
    customer_name: 'Email Setup Test',
    customer_email: config.ownerEmail || 'test@example.com',
    customer_phone: 'n/a',
    service_id: 'email-setup-test',
    service_title: 'Email Setup Test (safe to ignore)',
    service_price: 0,
    vehicle_type: 'cycle',
    vehicle_model: 'Test probe',
    preferred_date: new Date().toISOString().slice(0, 10),
    preferred_time_slot: 'Test',
    status: 'pending',
    approval_status: 'pending_approval',
  };

  const { error } = await supabase.from('service_bookings').insert(payload);
  // Always clean up, whether or not the insert succeeded.
  await supabase.from('service_bookings').delete().eq('id', id);

  if (error) {
    return { ok: false, message: `Could not write a test booking: ${error.message}` };
  }
  const to = config.ownerEmail || 'the workshop recipient';
  return {
    ok: true,
    message: `Test booking inserted and removed. If the webhook is live, the workshop alert is on its way to ${to} — check that inbox.`,
  };
}
