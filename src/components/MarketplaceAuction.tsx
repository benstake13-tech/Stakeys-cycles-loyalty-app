import React, { useState } from 'react';
import { Clock3, Gavel } from 'lucide-react';

export type MarketplaceAuctionRow = {
  listing_id: string;
  start_price: number;
  duration_hours: number;
  status: 'pending' | 'live' | 'ended' | 'no_sale' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  highest_bid: number | null;
  bid_count: number;
  extension_count: number;
  winning_bid_id: string | null;
};

const gbp = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export function minimumAuctionBid(auction: MarketplaceAuctionRow): number {
  return auction.bid_count === 0
    ? Number(auction.start_price)
    : Number(auction.highest_bid) + Math.max(1, Math.ceil(Number(auction.highest_bid) * 0.02));
}

export function auctionTimeLeft(endsAt: string | null, now: number): string {
  if (!endsAt) return 'Starts after staff approval';
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  if (!seconds) return 'Closing now';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h left` : hours ? `${hours}h ${minutes}m left` : `${minutes}m ${seconds % 60}s left`;
}

type Props = {
  auction: MarketplaceAuctionRow;
  compact?: boolean;
  now: number;
  isSeller: boolean;
  isStaff: boolean;
  canBid: boolean;
  hasBid: boolean;
  isLeading: boolean;
  isWinner: boolean;
  busy: boolean;
  onBid: (amount: number) => Promise<boolean>;
  onOpen?: () => void;
  onOpenDeal?: () => void;
  onUseApp?: () => void;
};

export function MarketplaceAuction({
  auction, compact = false, now, isSeller, isStaff, canBid, hasBid, isLeading, isWinner, busy,
  onBid, onOpen, onOpenDeal, onUseApp,
}: Props) {
  const [amount, setAmount] = useState('');
  const min = minimumAuctionBid(auction);
  const active = auction.status === 'live' && Boolean(auction.ends_at) && new Date(auction.ends_at!).getTime() > now;
  const price = auction.bid_count ? Number(auction.highest_bid) : Number(auction.start_price);
  const label = auction.status === 'pending' ? 'Awaiting staff approval'
    : active ? auctionTimeLeft(auction.ends_at, now)
    : auction.status === 'live' ? 'Closing now'
    : auction.status === 'ended' ? 'Auction ended'
    : auction.status === 'no_sale' ? 'No bids received' : 'Auction cancelled';

  return <section className="marketplace-glass rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-3" aria-label="Bike auction">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300"><Gavel className="h-4 w-4"/> Bike auction</p>
        <p className="mt-1 font-mono text-xl font-bold text-white">{gbp(price)}</p>
        <p className="text-xs text-neutral-300">{auction.bid_count ? `${auction.bid_count} bid${auction.bid_count === 1 ? '' : 's'}` : 'Opening bid'}</p>
      </div>
      <div className="flex items-center gap-1 text-right text-xs text-emerald-200"><Clock3 className="h-3.5 w-3.5 shrink-0"/>{label}</div>
    </div>
    {active && hasBid && !isSeller && <p className="mt-2 text-xs text-emerald-200">Your bid is {isLeading ? 'leading' : 'outbid'}.</p>}
    {auction.extension_count > 0 && active && <p className="mt-2 text-[11px] text-neutral-400">Late bids extended the closing time.</p>}
    {compact ? (
      <button type="button" onClick={onOpen} className="mt-3 min-h-10 w-full rounded-lg border border-emerald-400/40 px-3 text-xs font-bold text-emerald-100">
        {active && !isSeller && !isStaff ? 'View auction & bid' : 'View auction'}
      </button>
    ) : active && !isSeller && !isStaff ? canBid ? (
      <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void onBid(Number(amount)).then(placed => { if (placed) setAmount(''); }); }}>
        <label className="block text-xs font-semibold text-neutral-200">Your bid · minimum {gbp(min)}
          <input aria-label="Your auction bid" type="number" min={min} max="50000" step="0.01" value={amount}
            onChange={event => setAmount(event.target.value)} placeholder={min.toFixed(2)}
            className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-neutral-950 px-3 text-base text-white"/>
        </label>
        <button type="submit" disabled={busy || !amount || Number(amount) < min || Number(amount) > 50000}
          className="min-h-11 w-full rounded-lg bg-emerald-400 px-4 text-sm font-bold text-neutral-950 disabled:opacity-50">
          {busy ? 'Placing bid…' : 'Place bid'}
        </button>
        <p className="text-[11px] leading-4 text-neutral-400">The highest bid wins when time ends. No payment is taken when you bid. A bid in the final two minutes can extend the auction.</p>
      </form>
    ) : <button type="button" onClick={onUseApp} className="mt-3 min-h-10 w-full rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Sign in to bid</button>
    : null}
    {!compact && auction.status === 'ended' && isWinner && (
      <button type="button" onClick={onOpenDeal} className="mt-3 min-h-11 w-full rounded-lg bg-emerald-400 px-3 text-sm font-bold text-neutral-950">
        You won · arrange handover
      </button>
    )}
    {!compact && auction.status === 'ended' && isSeller && <p className="mt-2 text-xs text-emerald-200">A winning bid is ready. Open Messages and sale agreements to arrange the handover.</p>}
    {!compact && auction.status === 'ended' && !isWinner && !isSeller && !isStaff && <p className="mt-2 text-xs text-neutral-400">Bidding has closed. The winner and seller can arrange the sale in Messages.</p>}
  </section>;
}
