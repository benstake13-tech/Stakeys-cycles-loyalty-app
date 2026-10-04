import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Crown,
  Wrench,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import type { StaffAccountRole } from '../api/backendDataService';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface StaffFormValues {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  role: StaffAccountRole;
}

/** Pure validation so it can be unit tested without rendering the form. */
export function validateStaffForm(values: StaffFormValues): string | null {
  if (!EMAIL_RE.test(values.email.trim())) return 'Enter a valid email address.';
  if (values.password.length < 6) return 'Password must be at least 6 characters.';
  if (values.password !== values.confirmPassword) return 'Passwords do not match.';
  if (values.displayName.trim().length > 80) return 'Name is too long.';
  return null;
}

/** The RPCs ship in a migration; surface a clear fix when they are missing. */
function looksLikeMissingFunction(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('could not find the function') ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  );
}

const SETUP_SQL_PATH = 'supabase/migrations/20261004_staff_accounts.sql';

export const StaffAccountsTab: React.FC = () => {
  const {
    staffAccounts,
    refreshStaffAccounts,
    createStaffAccount,
    updateStaffAccountRole,
    currentUser,
    theme,
  } = useShop();
  const isDark = theme === 'dark';

  const [values, setValues] = useState<StaffFormValues>({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) void refreshStaffAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const admins = useMemo(() => staffAccounts.filter((a) => a.role === 'admin'), [staffAccounts]);

  const set = (patch: Partial<StaffFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateStaffForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    const res = await createStaffAccount(
      values.email.trim().toLowerCase(),
      values.password,
      values.displayName.trim(),
      values.role
    );
    setBusy(false);

    if (res.success) {
      setSuccess(`Login created for ${values.email.trim().toLowerCase()}.`);
      setValues({ email: '', displayName: '', password: '', confirmPassword: '', role: 'staff' });
    } else {
      if (looksLikeMissingFunction(res.message)) setNeedsSetup(true);
      setError(res.message || 'Could not create the staff account.');
    }
  };

  const handleRoleChange = async (userId: string, role: 'customer' | StaffAccountRole) => {
    setError(null);
    setSuccess(null);
    const res = await updateStaffAccountRole(userId, role);
    if (!res.success) {
      if (looksLikeMissingFunction(res.message)) setNeedsSetup(true);
      setError(res.message || 'Could not update the role.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStaffAccounts();
    setRefreshing(false);
  };

  const card = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200';
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-neutral-950 border-neutral-800 text-white placeholder-neutral-600 focus:border-emerald-500/60'
      : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-emerald-500'
  }`;
  const labelCls = `block text-xs font-semibold mb-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`;

  if (!isAdmin) {
    return (
      <div className={`rounded-2xl border p-6 ${card}`}>
        <div className="flex items-center gap-3 text-amber-500">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm font-semibold">Only admins can manage staff logins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Staff Logins
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Create the email/password logins staff use on the Staff Station.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
            isDark
              ? 'border-neutral-800 text-neutral-300 hover:border-emerald-500/40'
              : 'border-neutral-200 text-neutral-700 hover:border-emerald-500'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {needsSetup && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Staff account functions are not installed yet
          </div>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
            Run <code className="font-mono">{SETUP_SQL_PATH}</code> in the Supabase SQL Editor, then hit Refresh.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Create form */}
        <form onSubmit={handleSubmit} className={`rounded-2xl border p-5 space-y-4 ${card}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <UserPlus className="w-4 h-4 text-emerald-500" />
            New staff login
          </h3>

          <div>
            <label className={labelCls} htmlFor="staff-name">Name</label>
            <input
              id="staff-name"
              className={inputCls}
              value={values.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
              placeholder="e.g. Sam Carter"
              autoComplete="off"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="staff-email">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="staff-email"
                type="email"
                className={`${inputCls} pl-9`}
                value={values.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="sam@stakeyscycles.co.uk"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="staff-password">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="staff-password"
                type={showPassword ? 'text' : 'password'}
                className={`${inputCls} pl-9 pr-10`}
                value={values.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-emerald-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="staff-confirm">Confirm password</label>
            <input
              id="staff-confirm"
              type={showPassword ? 'text' : 'password'}
              className={inputCls}
              value={values.confirmPassword}
              onChange={(e) => set({ confirmPassword: e.target.value })}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="staff-role">Role</label>
            <select
              id="staff-role"
              className={inputCls}
              value={values.role}
              onChange={(e) => set({ role: e.target.value as StaffAccountRole })}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 text-sm text-emerald-500">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold py-2.5 transition-colors"
          >
            {busy ? 'Creating…' : 'Create staff login'}
          </button>
        </form>

        {/* Existing accounts */}
        <div className={`rounded-2xl border p-5 ${card}`}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Existing logins ({staffAccounts.length})
          </h3>

          {staffAccounts.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
              No staff logins yet. Create the first one on the left.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {staffAccounts.map((account) => {
                const isLastAdmin = account.role === 'admin' && admins.length <= 1;
                return (
                  <li
                    key={account.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 ${
                      isDark ? 'border-neutral-800 bg-neutral-950/60' : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ${
                        account.role === 'admin'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-sky-500/15 text-sky-500'
                      }`}
                    >
                      {account.role === 'admin' ? <Crown className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                      {account.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                        {account.displayName || account.email.split('@')[0]}
                        {account.id === currentUser?.uid && (
                          <span className="ml-2 text-[11px] font-bold text-neutral-500">(you)</span>
                        )}
                      </p>
                      <p className={`text-xs truncate ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                        {account.email}
                      </p>
                    </div>

                    <select
                      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                        isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'
                      }`}
                      value={account.role}
                      onChange={(e) => handleRoleChange(account.id, e.target.value as StaffAccountRole)}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin" disabled={isLastAdmin}>
                        Admin
                      </option>
                    </select>

                    <button
                      type="button"
                      disabled={isLastAdmin}
                      onClick={() => handleRoleChange(account.id, 'customer')}
                      title={isLastAdmin ? 'Cannot revoke the last admin' : 'Revoke staff access'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className={`text-[11px] mt-4 ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
            Revoking sets the account back to a customer profile; the login is kept but can no longer
            reach the Staff Station.
          </p>
        </div>
      </div>
    </div>
  );
};
