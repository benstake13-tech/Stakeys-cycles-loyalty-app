import { describe, it, expect } from 'vitest';
import { describeAuthFailure } from './authErrors';

/**
 * These pin the mapping that replaced the old blanket "Invalid email or
 * password." message — the one that disguised a dead SMTP server (500) and a
 * rate limit (429) as a wrong password, which is how the native sign-in outage
 * kept being misdiagnosed.
 */
describe('describeAuthFailure', () => {
  it('names a genuine wrong password', () => {
    const msg = describeAuthFailure({ code: 'invalid_credentials', status: 400 });
    expect(msg).toMatch(/invalid email or password/i);
  });

  it('flags an unconfirmed email with actionable guidance', () => {
    expect(describeAuthFailure({ code: 'email_not_confirmed' })).toMatch(/not confirmed/i);
    expect(describeAuthFailure({ message: 'Email not confirmed' })).toMatch(/not confirmed/i);
  });

  it('reports a rate limit instead of a bad password', () => {
    expect(describeAuthFailure({ code: 'over_request_rate_limit', status: 429 })).toMatch(/too many attempts/i);
  });

  it('reports a 500 as a service problem, never the customer’s password', () => {
    const msg = describeAuthFailure({ message: 'internal error', status: 500 });
    expect(msg).toMatch(/temporarily unavailable/i);
    expect(msg).not.toMatch(/invalid email or password/i);
  });

  it('calls out a dead mailer plainly', () => {
    const msg = describeAuthFailure({ message: 'Error sending confirmation email', status: 500 });
    expect(msg).toMatch(/confirmation email/i);
  });

  it('reports an unreachable network when there is no status', () => {
    expect(describeAuthFailure({})).toMatch(/could not reach/i);
  });

  it('never hides an unknown error code and never blames the password', () => {
    const msg = describeAuthFailure({ code: 'mfa_required', status: 401 });
    expect(msg).toContain('mfa_required');
    expect(msg).not.toMatch(/invalid email or password/i);
  });
});
