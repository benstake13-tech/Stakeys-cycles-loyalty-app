import React from 'react';
import { Heart } from 'lucide-react';
import { WebProduct } from '../types/websiteContent';
import { useWishlist, toggleWishlist } from '../context/WishlistStore';

interface NotifyMeButtonProps {
  product: WebProduct;
  isDark?: boolean;
}

/**
 * "Notify me when back in stock" heart for a shop product card. Adds/removes the
 * product from the customer's watchlist; a watched out-of-stock item is flagged
 * in the app when its stock returns.
 */
export const NotifyMeButton: React.FC<NotifyMeButtonProps> = ({ product, isDark = true }) => {
  const items = useWishlist();
  const watched = items.some((i) => i.productId === product.id);

  return (
    <button
      type="button"
      data-testid={`notify-me-${product.id}`}
      aria-pressed={watched}
      aria-label={watched ? `Stop watching ${product.name}` : `Notify me when ${product.name} is back`}
      onClick={() =>
        toggleWishlist({
          productId: product.id,
          title: product.name,
          category: product.category,
          imageUrl: product.image,
          stockAtWatch: product.stock,
        })
      }
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
        watched
          ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
          : isDark
            ? 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900'
      }`}
    >
      <Heart className={`w-3.5 h-3.5 ${watched ? 'fill-rose-400 text-rose-400' : ''}`} />
      {watched ? 'Watching' : 'Notify me'}
    </button>
  );
};

export default NotifyMeButton;
