import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Menu,
  ChevronLeft,
  Trophy,
  Ticket,
  Plus,
  Minus,
  RotateCcw,
  Save,
  User,
  Mail,
  Phone,
  Search,
  Check,
  Zap,
  RefreshCw,
  BadgeCheck,
  LayoutList,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile } from '../types/bikeShop';
import { FaceAvatar } from './FaceAvatar';

const STAMP_GOAL = 10;
const VIP_POINTS = 100;
const VIP_TICKETS = 5;

const AUDIT_REASONS = ['Goodwill', 'Counter Purchase', 'Card Stamp Repair'];

interface MemberControlPanelProps {
  customer: UserProfile;
  onBack: () => void;
  onOpenFullDossier?: () => void;
}

/**
 * Mobile-first loyalty control surface for a single member. Everything the
 * front desk needs on one screen: the stamp card, the ticket/point quick-adds,
 * the till overrides, the contact details and an audited reason for the change.
 * Saving applies the draft directly to the profile and stamps an audit note.
 */
export const MemberControlPanel: React.FC<MemberControlPanelProps> = ({
  customer,
  onBack,
  onOpenFullDossier,
}) => {
  const { currentUser, users, updateCustomerPoints } = useShop();
  const currentCustomer = users.find((u) => u.uid === customer.uid) || customer;
  const staffId = currentUser?.uid || 'staff-stakey';

  const [stamps, setStamps] = useState(currentCustomer.stamps || 0);
  const [tickets, setTickets] = useState(currentCustomer.tickets || 0);
  const [points, setPoints] = useState(currentCustomer.points || 0);
  const [fullName, setFullName] = useState(currentCustomer.displayName || '');
  const [email, setEmail] = useState(currentCustomer.email || '');
  const [phone, setPhone] = useState(currentCustomer.phoneNumber || '');
  const [reasonQuery, setReasonQuery] = useState('');
  const [reason, setReason] = useState('');
  const [bypassRateLimit, setBypassRateLimit] = useState(true);
  const [resetSpinCooldown, setResetSpinCooldown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const stampPct = Math.min(100, Math.round((stamps / STAMP_GOAL) * 100));
  const eligible = stamps >= STAMP_GOAL;
  const isVip = points >= VIP_POINTS || tickets >= VIP_TICKETS;
  const initial = (currentCustomer.displayName || 'M').charAt(0).toUpperCase();

  const bumpStamps = (n: number) => setStamps((s) => Math.min(STAMP_GOAL, Math.max(0, s + n)));
  const bumpTickets = (n: number) => setTickets((t) => Math.max(0, t + n));
  const bumpPoints = (n: number) => setPoints((p) => Math.max(0, p + n));

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const note = (reason || reasonQuery).trim() || 'Loyalty adjustment at front desk';
      const res = await updateCustomerPoints(currentCustomer.uid, staffId, {
        stamps,
        tickets,
        points,
        displayName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phone.trim(),
        resetDailyRateLimit: bypassRateLimit,
        resetSpinCooldown,
        staffNote: note,
      });
      setFeedback({ success: res.success, message: res.message });
      if (res.success) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 },
            colors: ['#10B981', '#34D399', '#F59E0B', '#ffffff'],
          });
        } catch {}
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e?.message || 'Could not save loyalty changes.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#090D16] text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Header navigation bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 bg-[#090D16]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-300 font-display text-sm font-black text-[#090D16] shadow-lg shadow-emerald-500/25">
            SC
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-black tracking-tight text-white">STAKEY'S CYCLES</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Loyalty Control
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.6)]" />
            Online
          </span>
          <button
            type="button"
            onClick={onOpenFullDossier}
            aria-label="Open full dossier"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0F172A] text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-white cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-40 pt-4">
        {/* ── Hero: customer profile ──────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#090D16] p-5 shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#090D16] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:text-white cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Till
            </button>
            {onOpenFullDossier && (
              <button
                type="button"
                onClick={onOpenFullDossier}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#090D16] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:text-white cursor-pointer"
              >
                <LayoutList className="h-3.5 w-3.5" />
                Full dossier
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-300 p-[3px] shadow-[0_0_24px_rgba(16,185,129,0.45)]">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[#090D16] bg-[#0F172A]">
                  <FaceAvatar
                    seed={currentCustomer.displayName}
                    configString={currentCustomer.avatarColor}
                    size={64}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#090D16] bg-amber-500 text-[#090D16]">
                <BadgeCheck className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-400">
                #Customer Profile
              </div>
              <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-white">
                {currentCustomer.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-slate-400">
                  Customer ID: #{currentCustomer.membershipNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isVip
                      ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <Trophy className="h-3 w-3" />
                  {isVip ? 'VIP Member' : 'Member'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#090D16]/70 px-4 py-2.5 font-mono text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-bold text-white">{stamps}</span> Stamps
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-bold text-white">{tickets}</span> Tickets
            </span>
          </div>
        </section>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${
              feedback.success
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            }`}
          >
            {feedback.success ? <Check className="h-4 w-4 shrink-0" /> : <RefreshCw className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ── Card 1: Stamp & balance control ─────────────────────────────── */}
        <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0F172A] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy className="h-4 w-4 text-emerald-400" />
              Stamp &amp; Balance Control
            </h2>
            <span className="font-mono text-sm font-black text-emerald-400">
              {stamps} <span className="text-slate-500">/ {STAMP_GOAL}</span>
            </span>
          </div>

          {/* 10-step stamp grid */}
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: STAMP_GOAL }).map((_, i) => {
              const filled = i < stamps;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStamps(i + 1 === stamps ? i : i + 1)}
                  aria-label={`Set stamps to ${i + 1}`}
                  className={`flex h-11 items-center justify-center rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                    filled
                      ? 'bg-emerald-500 text-[#090D16] shadow-md shadow-emerald-500/30'
                      : 'border border-white/10 bg-[#090D16] text-slate-600 hover:border-emerald-500/30'
                  }`}
                >
                  {filled ? <Check className="h-4 w-4 stroke-[3]" /> : i + 1}
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#090D16]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
              style={{ width: `${stampPct}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#090D16] p-1">
              <button
                type="button"
                onClick={() => bumpStamps(-1)}
                aria-label="Remove a stamp"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-mono text-sm font-bold text-white tabular-nums">{stamps}</span>
              <button
                type="button"
                onClick={() => bumpStamps(1)}
                aria-label="Add a stamp"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-[#090D16] transition-colors hover:bg-emerald-400 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStamps(0)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#090D16] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/40 hover:text-rose-200 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Pass
            </button>

            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
                eligible
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border border-white/10 bg-white/5 text-slate-500'
              }`}
            >
              <Zap className="h-3 w-3" />
              {eligible ? 'Eligible for £40 Service' : '£40 Service at 10'}
            </span>
          </div>

          {/* Quick-add split grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-500/25 bg-[#090D16] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <Ticket className="h-3.5 w-3.5" />
                Prize Tickets
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-amber-300 tabular-nums">{tickets}</div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bumpTickets(1)}
                  className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => bumpTickets(5)}
                  className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => bumpTickets(-1)}
                  aria-label="Remove a prize ticket"
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/10 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-[#090D16] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <Zap className="h-3.5 w-3.5" />
                Bonus Points
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-emerald-300 tabular-nums">{points}</div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bumpPoints(50)}
                  className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 cursor-pointer"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => bumpPoints(100)}
                  className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 cursor-pointer"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => bumpPoints(-50)}
                  aria-label="Remove bonus points"
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/10 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Card 2: Till overrides ──────────────────────────────────────── */}
        <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0F172A] p-5 shadow-xl">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <RefreshCw className="h-4 w-4 text-emerald-400" />
            Till Overrides
          </h2>

          <OverrideToggle
            label="Bypass Stamp Rate Limit"
            hint="Allow a second stamp today without the daily lock."
            active={bypassRateLimit}
            onChange={setBypassRateLimit}
          />
          <OverrideToggle
            label="Reset Weekly Prize Wheel Cooldown"
            hint="Clear the spin lock so this member can spin again now."
            active={resetSpinCooldown}
            onChange={setResetSpinCooldown}
          />
        </section>

        {/* ── Card 3: Customer contact data ───────────────────────────────── */}
        <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0F172A] p-5 shadow-xl">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <User className="h-4 w-4 text-emerald-400" />
            Customer Contact Data
          </h2>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#090D16] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/60 focus:outline-none"
              placeholder="Full name"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Mail className="h-3 w-3" /> Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090D16] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/60 focus:outline-none"
                placeholder="name@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Phone className="h-3 w-3" /> Phone
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090D16] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/60 focus:outline-none"
                placeholder="07000 000000"
              />
            </label>
          </div>
        </section>

        {/* ── Card 4: Staff audit reason ──────────────────────────────────── */}
        <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0F172A] p-5 shadow-xl">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Search className="h-4 w-4 text-emerald-400" />
            Staff Audit Reason
          </h2>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={reasonQuery}
              onChange={(e) => setReasonQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#090D16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500/60 focus:outline-none"
              placeholder="Search…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {AUDIT_REASONS.map((r) => {
              const selected = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(selected ? '' : r)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    selected
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 bg-[#090D16] text-slate-300 hover:border-emerald-500/30'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Sticky footer action bar ──────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#090D16]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-white/20 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-wider text-[#090D16] shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Loyalty Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface OverrideToggleProps {
  label: string;
  hint: string;
  active: boolean;
  onChange: (value: boolean) => void;
}

const OverrideToggle: React.FC<OverrideToggleProps> = ({ label, hint, active, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-label={label}
    onClick={() => onChange(!active)}
    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
      active
        ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.15)]'
        : 'border-white/10 bg-[#090D16]'
    }`}
  >
    <div className="min-w-0">
      <div className={`flex items-center gap-2 text-xs font-bold ${active ? 'text-amber-200' : 'text-slate-300'}`}>
        {label}
        {active && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
            <Check className="h-2.5 w-2.5" /> Active
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>

    <span
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        active ? 'bg-amber-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-[22px]' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
);
