import { ArrowUpRight, Bike, Gavel, MessageCircle, Sparkles } from 'lucide-react';

type RecentListing = { id: string; title: string; created_at: string };
export function MarketplaceActivity({ listings, auctionCount, conversationCount, signedIn, loading, onOpenListing, onMessages }: {
  listings: RecentListing[]; auctionCount: number; conversationCount: number; signedIn: boolean; loading: boolean;
  onOpenListing: (id: string) => void; onMessages: () => void;
}) {
  const recent = [...listings].filter(item => Number.isFinite(Date.parse(item.created_at))).sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,3);
  return <section className="marketplace-activity" aria-label="Marketplace activity">
    <div className="marketplace-activity-summary">
      <div className="marketplace-activity-heading"><span className="marketplace-status-dot" aria-hidden="true"/><span>THE LOCAL EXCHANGE</span><Sparkles size={14} aria-hidden="true"/></div>
      <div className="marketplace-metrics">
        <div><Bike size={18} aria-hidden="true"/><strong>{loading?'…':listings.length}</strong><span>Approved listings</span></div>
        <div><Gavel size={18} aria-hidden="true"/><strong>{loading?'…':auctionCount}</strong><span>Auctions open</span></div>
        <button type="button" onClick={onMessages}><MessageCircle size={18} aria-hidden="true"/><strong>{signedIn?conversationCount:'Join in'}</strong><span>{signedIn?'Your conversations':'Private negotiations'}</span></button>
      </div>
    </div>
    <div className="marketplace-recent"><p className="marketplace-recent-label">{recent.length?'Latest arrivals':'Room for your next ride'}</p>
      {recent.length?recent.map(item=><button key={item.id} type="button" onClick={()=>onOpenListing(item.id)} className="marketplace-recent-item"><span><b>{item.title}</b><small>Approved listing · {new Date(item.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></span><ArrowUpRight size={16} aria-hidden="true"/></button>)
      :<><p className="marketplace-empty-intro">Good bikes. Local people. A better way to buy and sell.</p><div className="marketplace-journey" aria-label="Marketplace journey"><span>Discover</span><i aria-hidden="true"/><span>Discuss</span><i aria-hidden="true"/><span>Ride away</span></div><small>New listings appear here after workshop review.</small></>}
    </div>
  </section>;
}
