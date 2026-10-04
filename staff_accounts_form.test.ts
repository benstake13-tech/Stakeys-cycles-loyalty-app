import { describe, it, expect } from 'vitest';
import { validateStaffForm } from './src/components/StaffManagementTab';

const base = {
  email: 'sam@shop.co.uk',
  displayName: 'Sam',
  password: 'secret1',
  confirmPassword: 'secret1',
  role: 'staff' as const,
};

describe('validateStaffForm', () => {
  it('accepts a well-formed form', () => {
    expect(validateStaffForm(base)).toBeNull();
  });
  it('rejects a malformed email', () => {
    expect(validateStaffForm({ ...base, email: 'nope' })).toMatch(/valid email/i);
  });
  it('rejects a short password', () => {
    expect(validateStaffForm({ ...base, password: '123' })).toMatch(/6 characters/i);
  });
  it('rejects mismatched passwords', () => {
    expect(validateStaffForm({ ...base, confirmPassword: 'other1' })).toMatch(/do not match/i);
  });
});
