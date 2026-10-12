/**
 * Turns a Supabase Auth error into a customer-facing message.
 *
 * The old code collapsed every failure that wasn't "email not confirmed" into
 * the single string "Invalid email or password." That made a dead SMTP server
 * (500), a rate limit (429) and a genuine wrong-password all look identical —
 * which is exactly how a server-side outage kept being misread as "customers
 * can't sign in". Distinguish the cases the customer can act on, and for
 * server-side faults say so plainly instead of blaming their password.
 */

interface RawAuthError {
  message?: string;
  code?: string;
  status?: number;
}

const WRONG_PASSWORD = 'Invalid email or password. Check your details and try again.';

export function describeAuthFailure(error: unknown): string {
  const err = (error || {}) as RawAuthError;
  const code = String(err.code || '').toLowerCase();
  const message = String(err.message || '').toLowerCase();
  const status = Number(err.status || 0);

  if (code === 'email_not_confirmed' || message.includes('not confirmed')) {
    return 'Your email is not confirmed yet. Click the link in your confirmation email, then sign in. (You can resend it from the Sign Up tab.)';
  }

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return WRONG_PASSWORD;
  }

  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
    return 'Too many attempts in a short time. Wait a minute, then try again.';
  }

  if (code === 'user_not_found') {
    return 'We could not find an account for that email, member ID, or name. Check the spelling, or register a new account.';
  }

  if (code === 'weak_password' || message.includes('password should be at least')) {
    return 'That password is too weak. Choose a longer password and try again.';
  }

  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return 'Sign-ups are temporarily disabled. Please contact the workshop and we will help you straight away.';
  }

  if (message.includes('error sending confirmation email') || message.includes('error sending email')) {
    return 'We could not send your confirmation email — email delivery is temporarily unavailable. Please try again shortly, or call the workshop and we will set you up.';
  }

  if (status >= 500 || code === 'unexpected_failure') {
    return `The sign-in service is temporarily unavailable (error ${status || '5xx'}). Please try again in a few minutes.`;
  }

  if (!status) {
    return 'Could not reach the sign-in service. Check your internet connection and try again.';
  }

  // Anything else: never hide the code, so this can be diagnosed from a report.
  return `Sign-in failed (${code || 'error'}). Please try again, or contact the workshop if it keeps happening.`;
}
