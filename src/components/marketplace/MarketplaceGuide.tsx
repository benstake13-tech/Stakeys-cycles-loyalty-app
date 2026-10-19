import { Bike, Gavel, MessageCircle, ShieldCheck } from 'lucide-react';
export type MarketplaceView = 'browse' | 'auctions' | 'selling' | 'messages' | 'guide';
export function MarketplaceGuide({ onSelect }: { onSelect: (view: MarketplaceView) => void }) {
  return <section aria-label="How the marketplace works" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    {[
      { icon: Bike, title: 'Find your next ride', body: 'Browse local bikes, e-bikes, scooters, parts and accessories. Open a listing to see photos, condition and price.', action: 'Browse listings', view: 'browse' },
      { icon: MessageCircle, title: 'Talk. Offer. Agree.', body: 'Message the seller privately, ask questions and suggest a price. Both people confirm the agreement and handover plan.', action: 'Your messages', view: 'messages' },
      { icon: Gavel, title: 'Bid in an auction', body: 'See the starting price, current bid and countdown. The winning bid sets the price; no payment is taken just for bidding.', action: 'Explore auctions', view: 'auctions' },
      { icon: ShieldCheck, title: 'Sell with Stakey’s', body: 'Create a listing for review. For vehicles, add the guided photo assessment and frame details. The marketplace is free to use, with no per-sale commission.', action: 'Your selling space', view: 'selling' },
    ].map(item => <article key={item.title} className="marketplace-glass marketplace-guide-card flex flex-col rounded-2xl border border-white/10 bg-neutral-950/80 p-5">
      <item.icon className="mb-5 h-6 w-6 text-emerald-400" aria-hidden="true" />
      <h2 className="text-base font-bold text-white">{item.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-neutral-400">{item.body}</p>
      <button type="button" onClick={() => onSelect(item.view as MarketplaceView)} className="mt-5 min-h-11 rounded-xl border border-emerald-400/25 px-3 text-sm font-bold text-emerald-200">{item.action}</button>
    </article>)}
  </section>;
}
