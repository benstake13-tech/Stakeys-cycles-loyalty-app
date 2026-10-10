import React, { useState } from 'react';
import { Wallet, Copy, Check, Award, Gift, Ticket, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { UserProfile } from '../types/bikeShop';
import { PolicyDisclaimers } from './PolicyDisclaimers';
import { voucherExpiry } from '../utils/rewardNudges';

interface RewardsWalletProps {
  user: UserProfile;
  /** Route to the loyalty pass (stamps) tab. */
  onGoToStamps?: () => void;
  /** Route to the booking tab (apply a voucher to a booking). */
  onGoToBooking?: () => void;
  /** Route to the Refer a Friend tab. */
  onGoToRefer?: () => void;
}

interface WalletEntry {
  id: string;
  kind: 'voucher' | 'referral' | 'points';
  title: string;
  subtitle: string;
  value: number;
  valueLabel: string;
  status: string;
  statusTone: 'emerald' | 'amber' | 'neutral';
  code?: string;
  expiry?: Date | null;
  action?: { label: string; onClick: () => void };
}

const STATUS_TONE: Record<'emerald' | 'amber' | 'neutral', string> = {
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  amber: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  neutral: 'bg-neutral-700/40 border-neutral-600 text-neutral-300',
};

/**
 * The customer's single rewards screen: every service voucher, referral credit
 * and points balance in one place, each with its value, status and a primary
 * action (apply to a booking, copy the code, or jump to where it is used).
 */
export const RewardsWallet: React.FC<RewardsWalletProps> = ({
  user,
  onGoToStamps,
  onGoToBooking,
  onGoToRefer,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      window.prompt('Copy your reward code:', code);
    }
  };

  const entries: WalletEntry[] = [];

  for (const v of user.serviceVouchers || []) {
    const expiry = voucherExpiry(v);
    entries.push({
      id: v.id,
      kind: 'voucher',
      title: v.title,
      subtitle: v.description,
      value: v.value,
      valueLabel: `£${v.value}`,
      status: v.status === 'available' ? 'Available' : 'Redeemed',
      statusTone: v.status === 'available' ? 'emerald' : 'neutral',
      code: v.code,
      expiry,
      action:
        v.status === 'available'
          ? { label: 'Apply to booking', onClick: () => onGoToBooking?.() }
          : undefined,
    });
  }

  for (const r of user.referralRewards || []) {
    entries.push({
      id: r.id,
      kind: 'referral',
      title: `£${r.amount} referral credit`,
      subtitle: `Earned from ${r.friendName || 'a referred friend'}`,
      value: r.amount,
      valueLabel: `£${r.amount}`,
      status: r.status === 'earned' ? 'Ready to use' : r.status === 'pending' ? 'Pending' : 'Redeemed',
      statusTone: r.status === 'earned' ? 'emerald' : r.status === 'pending' ? 'amber' : 'neutral',
      action: r.status === 'earned' ? { label: 'Use on booking', onClick: () => onGoToBooking?.() } : undefined,
    });
  }

  const points = user.points || 0;

  const totalValue = entries
    .filter((e) => e.statusTone === 'emerald')
    .reduce((sum, e) => sum + e.value, 0);

  const statusLabel: Record<WalletEntry['kind'], { label: string; icon: React.ReactNode }> = {
    voucher: { label: 'Service voucher', icon: <Award className="w-4 h-4" /> },
    referral: { label: 'Referral credit', icon: <Gift className="w-4 h-4" /> },
    points: { label: 'Loyalty points', icon: <Sparkles className="w-4 h-4" /> },
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
              <span className="text-emerald-400 font-semibold tracking-wider uppercase">Rewards Wallet</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>{user.membershipNumber}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Everything you've earned
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Vouchers, referral credits and points — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-[#090b0e]/80 px-5 py-3.5 rounded-xl border border-neutral-800 shrink-0">
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-[#05C147] tabular-nums">£{totalValue}</div>
              <div className="text-[11px] text-neutral-400 font-medium">Ready to use</div>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">{points}</div>
              <div className="text-[11px] text-neutral-400 font-medium">Points</div>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">
                {user.stamps || 0}<span className="text-xs text-neutral-500 font-normal">/10</span>
              </div>
              <div className="text-[11px] text-neutral-400 font-medium">Stamps</div>
            </div>
          </div>
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0 && points === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
          <Wallet className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">Your wallet is empty — for now</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Collect visit stamps to unlock a £40 service credit, or refer a friend to earn £5 credits.
          </p>
          <div className="flex justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onGoToStamps}
              className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              View loyalty pass
            </button>
            <button
              type="button"
              onClick={onGoToRefer}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Refer a friend
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map((e) => (
            <div
              key={e.id}
              data-testid={`wallet-entry-${e.id}`}
              className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    {statusLabel[e.kind].icon}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      {statusLabel[e.kind].label}
                    </div>
                    <div className="font-semibold text-white text-sm">{e.title}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">{e.subtitle}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xl font-bold text-[#05C147]">{e.valueLabel}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${STATUS_TONE[e.statusTone]}`}>
                  {e.status}
                </span>
                {e.expiry && (
                  <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Expires {e.expiry.toLocaleDateString()}
                  </span>
                )}
                {e.code && (
                  <button
                    type="button"
                    onClick={() => copy(e.id, e.code!)}
                    className="ml-auto text-[10px] font-mono font-bold px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-emerald-500/40 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === e.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {e.code}
                  </button>
                )}
              </div>

              {e.action && (
                <button
                  type="button"
                  onClick={e.action.onClick}
                  className="pressable w-full py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {e.action.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Points card (always shown; points are not "spendable" but worth surfacing) */}
          <div
            data-testid="wallet-entry-points"
            className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Loyalty points</div>
                  <div className="font-semibold text-white text-sm">{points} points</div>
                  <div className="text-xs text-neutral-400 mt-0.5">Bonus balance from wheel spins and promotions</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xl font-bold text-sky-400">{points}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToStamps}
              className="pressable w-full py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5" />
              Spin the prize wheel
            </button>
          </div>
        </div>
      )}

      <PolicyDisclaimers
        tone="neutral"
        compact
        title="Reward terms"
        items={[
          'Service credits apply to labour only — parts are not included.',
          'Rewards are tied to your membership and cannot be transferred or exchanged for cash.',
          'One reward per qualifying visit or referral; expired rewards cannot be reinstated.',
        ]}
      />
    </div>
  );
};

export default RewardsWallet;
