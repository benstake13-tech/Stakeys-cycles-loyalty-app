import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  resetPassword: vi.fn(async () => ({ success: true, message: 'Password reset link sent to your email.' })),
  updatePassword: vi.fn(async () => ({ success: true, message: 'Password updated. You can now sign in.' })),
  loginWithCredentials: vi.fn(async () => ({ success: true })),
  loginStaff: vi.fn(async () => ({ success: true })),
  registerCustomerAccount: vi.fn(async () => ({ success: true })),
  resendConfirmationEmail: vi.fn(async () => ({ success: true })),
  addCustomerBike: vi.fn(async () => ({ success: true })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    loginWithCredentials: hoisted.loginWithCredentials,
    loginStaff: hoisted.loginStaff,
    registerCustomerAccount: hoisted.registerCustomerAccount,
    resendConfirmationEmail: hoisted.resendConfirmationEmail,
    resetPassword: hoisted.resetPassword,
    updatePassword: hoisted.updatePassword,
    addCustomerBike: hoisted.addCustomerBike,
  }),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// The reset page asks Supabase whether a recovery session already exists.
vi.mock('./src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  },
}));

import { LoginScreen } from './src/components/LoginScreen';
import { ResetPasswordPage } from './src/components/ResetPasswordPage';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.resetPassword.mockResolvedValue({ success: true, message: 'sent' });
  hoisted.updatePassword.mockResolvedValue({ success: true, message: 'updated' });
});

describe('LoginScreen — customer password reset', () => {
  it('opens the reset modal from the sign-in form and emails the entered address', async () => {
    render(<LoginScreen />);

    fireEvent.click(screen.getByText(/Forgot password\?/i));
    expect(screen.getByText(/Reset Your Password/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: 'rider@example.com' },
    });
    fireEvent.click(screen.getByText(/Send Reset Link/i));

    await waitFor(() => expect(hoisted.resetPassword).toHaveBeenCalledWith('rider@example.com'));
    await waitFor(() => expect(screen.getByText(/reset link is on its way/i)).toBeTruthy());
  });

  it('pre-fills the reset email when the identifier is already an email', () => {
    render(<LoginScreen />);
    fireEvent.change(screen.getByPlaceholderText(/alex.henderson@example.com/i), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByText(/Forgot password\?/i));
    const input = screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement;
    expect(input.value).toBe('alex@example.com');
  });
});

describe('ResetPasswordPage — set a new password', () => {
  it('rejects a too-short password without calling the backend', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText(/At least 6 characters/i), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter your new password/i), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByText(/Save New Password/i));

    await waitFor(() => expect(screen.getByText(/at least 6 characters/i)).toBeTruthy());
    expect(hoisted.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText(/At least 6 characters/i), {
      target: { value: 'secret1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter your new password/i), {
      target: { value: 'secret2' },
    });
    fireEvent.click(screen.getByText(/Save New Password/i));

    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeTruthy());
    expect(hoisted.updatePassword).not.toHaveBeenCalled();
  });

  it('saves a valid new password and confirms success', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText(/At least 6 characters/i), {
      target: { value: 'newpass1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter your new password/i), {
      target: { value: 'newpass1' },
    });
    fireEvent.click(screen.getByText(/Save New Password/i));

    await waitFor(() => expect(hoisted.updatePassword).toHaveBeenCalledWith('newpass1'));
    await waitFor(() => expect(screen.getByText(/Password updated/i)).toBeTruthy());
  });
});
