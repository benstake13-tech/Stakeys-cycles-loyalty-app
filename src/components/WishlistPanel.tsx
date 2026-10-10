import React from 'react';
import { Heart, Trash2, BellRing, PackageSearch } from 'lucide-react';
import { useWishlist, removeFromWishlist } from '../context/WishlistStore';
import { useWebsiteContent } from '../context/WebsiteContentStore';

/**
 * The customer's watchlist: shop items they asked to be notified about. Shows a
 * live "back in stock" signal when a watched product's stock has returned.
 */
export const WishlistPanel: React.FC = () => {
  const items = useWishlist();
  const content = useWebsiteContent();
  const products = content.products || [];

  const stockById: Record<string, number> = {};
  for (const p of products) stockById[p.id] = p.stock;

  const backInStock = items.filter((i) => i.stockAtWatch <= 0 && (stockById[i.productId] ?? 0) > 0);

  return (
    <div className="space-y-6" data-testid="wishlist-panel">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-400" /> My Watchlist
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Items you're watching. We'll flag them here (and send a nudge) as soon as they're back in stock.
        </p>
      </div>

      {backInStock.length > 0 && (
        <div className="rounded-xl border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950 via-[#0d1e13] to-neutral-900 p-4 flex items-center gap-3 text-white">
          <BellRing className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-sm">Back in stock!</div>
            <div className="text-xs text-emerald-200">
              {backInStock.map((i) => i.title).join(', ')} {backInStock.length === 1 ? 'is' : 'are'} available again.
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
          <PackageSearch className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">Nothing on your watchlist</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Browse the shop and tap the heart on any item to be told when it's back in stock.
          </p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-neutral-800 bg-[#0d1015] divide-y divide-neutral-800/80 overflow-hidden">
          {items.map((i) => {
            const stock = stockById[i.productId];
            const back = i.stockAtWatch <= 0 && (stock ?? 0) > 0;
            return (
              <li key={i.productId} className="p-4 flex items-center gap-4">
                {i.imageUrl ? (
                  <img src={i.imageUrl} alt={i.title} className="w-14 h-14 rounded-lg object-cover border border-neutral-800 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5 text-neutral-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{i.title}</div>
                  <div className="text-xs text-neutral-500">
                    {i.category ? `${i.category} · ` : ''}
                    {back ? (
                      <span className="text-emerald-400 font-semibold">Back in stock</span>
                    ) : typeof stock === 'number' && stock > 0 ? (
                      <span className="text-emerald-400">In stock</span>
                    ) : (
                      <span className="text-amber-400">Out of stock — watching</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromWishlist(i.productId)}
                  aria-label={`Remove ${i.title} from watchlist`}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WishlistPanel;
