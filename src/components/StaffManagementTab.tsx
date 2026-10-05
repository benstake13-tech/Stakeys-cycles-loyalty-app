import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Phone,
  Mail,
  Award,
  X,
  Save,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Crown,
  Wrench,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { StaffMember, StaffRole, StaffWorkStatus } from '../shared/types/bikeShop';
import type { StaffAccountRole } from '../shared/api/backendDataService';

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

const EMPTY_LOGIN_FORM: StaffFormValues = {
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'staff',
};

const ROLES_LIST: StaffRole[] = [
  'Shift Supervisor',
  'Store Manager',
  'Admin',
  'Mechanic',
];
const STATUSES_LIST: StaffWorkStatus[] = ['Active', 'On Leave', 'Inactive'];

/**
 * Team tab: the staff roster (profiles, roles, contact details) and the Staff
 * Station access logins (email/password + app role) in one place, so adding a
 * person and giving them a login is a single workflow.
 */
export const StaffManagementTab: React.FC = () => {
  const {
    staffMembers,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
    staffAccounts,
    refreshStaffAccounts,
    createStaffAccount,
    updateStaffAccountRole,
    currentUser,
  } = useShop();

  // ---- Roster (profiles) state ----
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: StaffRole;
    status: StaffWorkStatus;
    joinedDate: string;
    certificationLevel: string;
    notes: string;
  }>({
    name: '',
    email: '',
    phone: '+44 7700 900',
    role: 'Mechanic',
    status: 'Active',
    joinedDate: new Date().toISOString().split('T')[0],
    certificationLevel: 'Workshop Level 2',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ---- Staff Station access (logins) state ----
  const [values, setValues] = useState<StaffFormValues>(EMPTY_LOGIN_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) void refreshStaffAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const admins = useMemo(() => staffAccounts.filter((a) => a.role === 'admin'), [staffAccounts]);

  const setLogin = (patch: Partial<StaffFormValues>) => setValues((v) => ({ ...v, ...patch }));

  /** Match a roster profile to its Staff Station login by email. */
  const loginAccountFor = (staff: StaffMember) => {
    const email = staff.email.trim().toLowerCase();
    return staffAccounts.find((a) => a.email.trim().toLowerCase() === email);
  };

  /** Prefill the login form from a roster profile so granting access is one click. */
  const handleGrantLogin = (staff: StaffMember) => {
    const existing = loginAccountFor(staff);
    setLoginSuccess(null);
    setLoginError(null);
    if (existing) {
      setLoginError(
        existing.role === 'admin'
          ? `${staff.name} already has admin access (${existing.email}).`
          : `${staff.name} already has a login (${existing.email}).`
      );
      return;
    }
    setValues({
      email: staff.email,
      displayName: staff.name,
      password: '',
      confirmPassword: '',
      role: staff.role === 'Admin' ? 'admin' : 'staff',
    });
    document.getElementById('staff-email')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  // Filter staff roster
  const filteredStaff = staffMembers.filter((staff) => {
    if (roleFilter !== 'All' && staff.role !== roleFilter) return false;
    if (statusFilter !== 'All' && staff.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inName = staff.name.toLowerCase().includes(q);
      const inEmail = staff.email.toLowerCase().includes(q);
      const inPhone = staff.phone.includes(q);
      const inRole = staff.role.toLowerCase().includes(q);
      return inName || inEmail || inPhone || inRole;
    }
    return true;
  });

  const handleOpenAdd = () => {
    setEditingStaffId(null);
    setFormData({
      name: '',
      email: '',
      phone: '+44 7700 900',
      role: 'Mechanic',
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      certificationLevel: 'Workshop Level 2',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaffId(staff.id);
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      status: staff.status,
      joinedDate: staff.joinedDate,
      certificationLevel: staff.certificationLevel || '',
      notes: staff.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Please enter the staff member’s full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    try {
      if (editingStaffId) {
        await updateStaffMember(editingStaffId, formData);
        setActionSuccess(`Staff profile for ${formData.name} updated successfully.`);
      } else {
        await addStaffMember(formData);
        setActionSuccess(`New staff member ${formData.name} added to roster.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save staff record.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the staff roster?`)) {
      await deleteStaffMember(id);
      setActionSuccess(`Staff member ${name} removed.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    const validationError = validateStaffForm(values);
    if (validationError) {
      setLoginError(validationError);
      return;
    }

    setLoginBusy(true);
    const res = await createStaffAccount(
      values.email.trim().toLowerCase(),
      values.password,
      values.displayName.trim(),
      values.role
    );
    setLoginBusy(false);

    if (res.success) {
      setLoginSuccess(`Login created for ${values.email.trim().toLowerCase()}.`);
      setValues(EMPTY_LOGIN_FORM);
    } else {
      if (looksLikeMissingFunction(res.message)) setNeedsSetup(true);
      setLoginError(res.message || 'Could not create the staff account.');
    }
  };

  const handleRoleChange = async (userId: string, role: 'customer' | StaffAccountRole) => {
    setLoginError(null);
    setLoginSuccess(null);
    const res = await updateStaffAccountRole(userId, role);
    if (!res.success) {
      if (looksLikeMissingFunction(res.message)) setNeedsSetup(true);
      setLoginError(res.message || 'Could not update the role.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStaffAccounts();
    setRefreshing(false);
  };

  const inputCls =
    'w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 placeholder-neutral-600';
  const labelCls = 'block text-neutral-300 font-medium mb-1';

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Banner & Action */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Team
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              ROSTER + LOGINS
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Add staff profiles, assign roles and manage their contact details — and create the
            email/password logins they use on the Staff Station, all in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ---- Staff Station access (logins) ---- */}
      <section className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Staff Station access
            </h4>
            <p className="text-xs text-neutral-400 mt-1">
              Create the email/password logins staff use to sign in to the Staff Station.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {!isAdmin ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">Only admins can manage staff logins.</p>
          </div>
        ) : (
          <>
            {needsSetup && (
              <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 p-4">
                <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Staff account functions are not installed yet
                </div>
                <p className="text-xs mt-1.5 text-amber-200/80">
                  Use the <strong>Set Up Staff Accounts</strong> button at the top of the staff area
                  to copy
                  <code className="font-mono"> {SETUP_SQL_PATH}</code>, run it in the Supabase SQL
                  Editor, then Refresh.
                </p>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
              {/* Create form */}
              <form
                onSubmit={handleLoginSubmit}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4"
              >
                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  New staff login
                </h5>

                <div>
                  <label className={labelCls} htmlFor="staff-name">
                    Name
                  </label>
                  <input
                    id="staff-name"
                    className={inputCls}
                    value={values.displayName}
                    onChange={(e) => setLogin({ displayName: e.target.value })}
                    placeholder="e.g. Sam Carter"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="staff-email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      id="staff-email"
                      type="email"
                      className={`${inputCls} pl-9`}
                      value={values.email}
                      onChange={(e) => setLogin({ email: e.target.value })}
                      placeholder="sam@stakeyscycles.co.uk"
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls} htmlFor="staff-password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputCls} pl-9 pr-10`}
                      value={values.password}
                      onChange={(e) => setLogin({ password: e.target.value })}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-emerald-500 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls} htmlFor="staff-confirm">
                    Confirm password
                  </label>
                  <input
                    id="staff-confirm"
                    type={showPassword ? 'text' : 'password'}
                    className={inputCls}
                    value={values.confirmPassword}
                    onChange={(e) => setLogin({ confirmPassword: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="staff-role">
                    Role
                  </label>
                  <select
                    id="staff-role"
                    className={`${inputCls} cursor-pointer`}
                    value={values.role}
                    onChange={(e) => setLogin({ role: e.target.value as StaffAccountRole })}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {loginError && (
                  <div className="flex items-start gap-2 text-sm text-red-500">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}
                {loginSuccess && (
                  <div className="flex items-start gap-2 text-sm text-emerald-500">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{loginSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold py-2.5 transition-colors cursor-pointer"
                >
                  {loginBusy ? 'Creating…' : 'Create staff login'}
                </button>
              </form>

              {/* Existing accounts */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <h5 className="text-sm font-bold text-white mb-4">
                  Existing logins ({staffAccounts.length})
                </h5>

                {staffAccounts.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No staff logins yet. Create the first one on the left.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {staffAccounts.map((account) => {
                      const isLastAdmin = account.role === 'admin' && admins.length <= 1;
                      return (
                        <li
                          key={account.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-3"
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ${
                              account.role === 'admin'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-sky-500/15 text-sky-500'
                            }`}
                          >
                            {account.role === 'admin' ? (
                              <Crown className="w-3 h-3" />
                            ) : (
                              <Wrench className="w-3 h-3" />
                            )}
                            {account.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate text-white">
                              {account.displayName || account.email.split('@')[0]}
                              {account.id === currentUser?.uid && (
                                <span className="ml-2 text-[11px] font-bold text-neutral-500">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-xs truncate text-neutral-500">{account.email}</p>
                          </div>

                          <select
                            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs font-semibold text-neutral-200 cursor-pointer"
                            value={account.role}
                            onChange={(e) =>
                              handleRoleChange(account.id, e.target.value as StaffAccountRole)
                            }
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
                            title={
                              isLastAdmin ? 'Cannot revoke the last admin' : 'Revoke staff access'
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="text-[11px] mt-4 text-neutral-600">
                  Revoking sets the account back to a customer profile; the login is kept but can no
                  longer reach the Staff Station.
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ---- Staff roster ---- */}
      <div className="flex items-center gap-2 pt-1">
        <Users className="w-4 h-4 text-emerald-400" />
        <h4 className="text-sm font-black text-white">Roster ({staffMembers.length})</h4>
        <div className="h-px flex-1 bg-neutral-800/70" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-neutral-900/80 rounded-2xl border border-neutral-800 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, or role..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1">
            <span className="text-neutral-400 text-[11px] font-mono">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Roles</option>
              {ROLES_LIST.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-neutral-400 text-[11px] font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {STATUSES_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Staff Roster Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStaff.map((staff) => {
          const isActive = staff.status === 'Active';
          const isOnLeave = staff.status === 'On Leave';
          const login = loginAccountFor(staff);
          const loginIsAdmin = login?.role === 'admin';

          return (
            <div
              key={staff.id}
              className="bg-[#0d1015] hover:bg-neutral-900/80 transition-all border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, Avatar, Role, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-neutral-950 shadow-md shrink-0"
                      style={{ backgroundColor: staff.avatarColor || '#05C147' }}
                    >
                      {staff.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base leading-snug">{staff.name}</h4>
                      <div className="text-xs font-semibold text-emerald-400 mt-0.5">{staff.role}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isOnLeave
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {staff.status}
                  </span>
                </div>

                {/* Contact Information */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <a href={`mailto:${staff.email}`} className="hover:text-emerald-400 truncate">
                      {staff.email}
                    </a>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-300">
                    <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <a href={`tel:${staff.phone}`} className="hover:text-emerald-400 font-mono">
                      {staff.phone}
                    </a>
                  </div>

                  {staff.certificationLevel && (
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] font-mono">{staff.certificationLevel}</span>
                    </div>
                  )}

                  {staff.notes && (
                    <p className="text-[11px] text-neutral-400 italic bg-neutral-950 p-2 rounded-lg border border-neutral-800/80 mt-1">
                      "{staff.notes}"
                    </p>
                  )}
                </div>

                {/* Staff Station access status */}
                <div className="mt-3 flex items-center gap-2">
                  {login ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {loginIsAdmin ? <Crown className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        {loginIsAdmin ? 'Admin access' : 'Has login'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRoleChange(login.id, loginIsAdmin ? 'staff' : 'admin')}
                        disabled={loginIsAdmin && admins.length <= 1}
                        title={loginIsAdmin && admins.length <= 1 ? 'Cannot remove the last admin' : undefined}
                        className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loginIsAdmin ? 'Make staff' : 'Make admin'}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        <Lock className="w-3 h-3" />
                        No login
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleGrantLogin(staff)}
                          className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          Grant access
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Action Buttons: Edit & Delete */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-neutral-500 font-mono">
                  Joined: {staff.joinedDate}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Edit staff details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(staff.id, staff.name)}
                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors cursor-pointer"
                    title="Remove staff member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStaff.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
          No staff match the current search or filters.
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{editingStaffId ? 'Edit Staff Profile' : 'Add Staff Member'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@stakeyscycles.com"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 7700 900..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Role Assignment</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffRole })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Work Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as StaffWorkStatus })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {STATUSES_LIST.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Workshop Certification (Optional)
                </label>
                <input
                  type="text"
                  value={formData.certificationLevel}
                  onChange={(e) => setFormData({ ...formData, certificationLevel: e.target.value })}
                  placeholder="e.g. Wheel Building Master"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Mechanic / Roster Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Hydraulic bleed lead, manages Saturday morning intake..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingStaffId ? 'Update Profile' : 'Save Staff Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
