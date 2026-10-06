import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgePoundSterling,
  Bike,
  CalendarCheck,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useWebsiteContent } from '../context/WebsiteContentStore';
import { supabase } from '../lib/supabase';
import { SegmentedTab, SegmentedTabs } from './SegmentedTabs';
import { WebsitePageId, WebProductCategory, WebCartItem, WebProduct } from '../types/websiteContent';

interface WebsiteReplicaProps {
/** Opens the app's own booking flow (guest when signed out, Booking tab when signed in). */
  onBookService: () => void;
}

const CART_TITLE = 'Your Basket';
const CART_BLURB =
  'Add second-hand parts and bikes to your basket, then checkout with click & collect from the workshop.';
const CART_CTA_LABEL = 'Checkout';
const CHECKOUT_SUCCESS_TITLE = 'Order received!';

/** Checkout requires a basket, a name and some contact detail before the order can be placed. */
function isCheckoutReady(name: string, contact: string, itemCount: number): boolean {
  return itemCount > 0 && name.trim().length > 1 && contact.trim().length > 4;
}

const SOCIAL_ICON: Record<string, string> = {
  Instagram: '📸',
  Facebook: '📘',
  LinkedIn: '💼',
  Pinterest: '📌',
  Snapchat: '👻',
  TikTok: '🎵',
  Yelp: '⭐',
  YouTube: '▶️',
};

export const WebsiteReplica: React.FC<WebsiteReplicaProps> = ({ onBookService }) => {
  const { currentUser, theme, promotions } = useShop();
  const content = useWebsiteContent();
  const isDark = theme === 'dark';

  const livePromotions = promotions.filter((p) => p.status === 'active');

  const [page, setPage] = useState<WebsitePageId>('home');
  const [faqFilter, setFaqFilter] = useState<'repairs' | 'parts' | 'general' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WebProductCategory>('all');

  const [cart, setCart] = useState<WebCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutContact, setCheckoutContact] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placing, setPlacing] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartQtyFor = (productId: string) => cart.find((i) => i.productId === productId)?.qty ?? 0;

  const addToCart = (product: WebProduct) => {
    setOrderPlaced(false);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: product.price, image: product.image, qty: 1 },
      ];
    });
    setCartOpen(true);
  };

  const decrementCart = (productId: string) => {
    setOrderPlaced(false);
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setOrderPlaced(false);
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const placeOrder = async () => {
    if (!isCheckoutReady(checkoutName, checkoutContact, cartCount) || placing) return;
    setPlacing(true);
    try {
      const order = {
        customer_name: checkoutName.trim(),
        contact: checkoutContact.trim(),
        items: cart,
        total: cartTotal,
        note: checkoutNote.trim() || null,
      };
      const { error } = await supabase.from('ecommerce_orders').insert(order);
      if (error) console.warn('[WEBSITE SHOP] Order persist skipped:', error.message);
      await supabase.functions
        .invoke('send-email', {
          body: {
            from: 'noreply@stakeyscycles.co.uk',
            to: 'Benstake13@gmail.com',
            subject: `🛒 [STAKEY'S SHOP] New order — £${cartTotal.toFixed(2)} (${checkoutName.trim()})`,
            html: `<h2>New shop order</h2><p><strong>${checkoutName.trim()}</strong> · ${checkoutContact.trim()}</p><p>Total: <strong>£${cartTotal.toFixed(2)}</strong></p><ul>${cart
              .map((i) => `<li>${i.qty}× ${i.name} — £${(i.price * i.qty).toFixed(2)}</li>`)
              .join('')}</ul>${checkoutNote.trim() ? `<p>Note: ${checkoutNote.trim()}</p>` : ''}`,
          },
        })
        .catch((err: unknown) => console.warn('[WEBSITE SHOP] Order email skipped:', err));
      setOrderPlaced(true);
      setCart([]);
      setCheckoutNote('');
    } finally {
      setPlacing(false);
    }
  };

  const pageTabs: SegmentedTab<WebsitePageId>[] = [
    { id: 'home', label: 'Home', icon: Globe, tone: 'emerald' },
    { id: 'location', label: 'Location', icon: MapPin, tone: 'sky' },
    { id: 'shop', label: 'Shop', icon: Store, tone: 'amber' },
    { id: 'faqs', label: 'FAQs', icon: MessageCircle, tone: 'neutral' },
    { id: 'gallery', label: 'Gallery', icon: Bike, tone: 'sky' },
    { id: 'priceList', label: 'price list', icon: BadgePoundSterling, tone: 'amber' },
    { id: 'join', label: 'Join the Team', icon: Star, tone: 'emerald' },
  ];

  const call = `tel:${content.phone}`;
  const mail = `mailto:${content.email}`;

  const groupedPriceRows = (scope: 'bike' | 'scooter') =>
    content.priceList.filter((r) => r.scope === scope).reduce<Record<string, typeof content.priceList>>((acc, row) => {
      (acc[row.group] ||= []).push(row);
      return acc;
    }, {});

  const visibleProducts = content.products.filter((p) =>
    categoryFilter === 'all' || p.category === categoryFilter
  );

  const faqGroups: { key: 'repairs' | 'parts' | 'general'; label: string }[] = [
    { key: 'repairs', label: 'Repairs & Service' },
    { key: 'parts', label: 'Parts & Accessories' },
    { key: 'general', label: 'General Information' },
  ];

  // Rotate the site's own announcement ribbon so the marketing site feels alive
  // without pulling in the in-store staff notice board.
  const [ribbonIndex, setRibbonIndex] = useState(0);
  useEffect(() => {
    if (content.siteAnnouncements.length < 2) return;
    const id = window.setInterval(
      () => setRibbonIndex((i) => (i + 1) % content.siteAnnouncements.length),
      5200
    );
    return () => window.clearInterval(id);
  }, [content.siteAnnouncements.length]);

  const heroCard = (
    <div className="relative overflow-hidden rounded-3xl border p-6 sm:p-10 shadow-xl">
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-16 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#05C147] animate-pulse" />
            {content.heroBadge}
          </span>
          <h2 className={`font-display text-3xl sm:text-4xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Stakey's <span className="text-emerald-500">{content.heroTitle}</span>
          </h2>
          <p className={`text-sm font-semibold ${isDark ? 'text-emerald-200/80' : 'text-emerald-700/80'}`}>
            {content.heroSubtitle}
          </p>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {content.heroBlurb}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onBookService}
              className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer hover:scale-[1.02]"
            >
              <CalendarCheck className="w-4 h-4" />
              {content.calloutCta}
            </button>
            <a
              href={call}
              className="pressable inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-bold cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              Call Us Out
            </a>
          </div>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-200' : 'text-neutral-700'}`}>
                Live Promotions
              </span>
            </div>
            <span className={`text-[10px] font-bold ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {livePromotions.length} running
            </span>
          </div>
          {livePromotions.length === 0 ? (
            <p className={`text-[11px] leading-snug ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              No promotions running right now — check back soon.
            </p>
          ) : (
            <div className="space-y-2">
              {livePromotions.map((promo) => (
                <div
                  key={promo.id}
                  className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      {promo.title}
                    </span>
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-950">
                      {promo.badgeText}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{promo.subtitle}</p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className={`rounded-lg border border-dashed px-2 py-0.5 text-[10px] font-mono font-bold ${isDark ? 'border-neutral-600 text-neutral-200' : 'border-neutral-300 text-neutral-700'}`}>
                      {promo.code}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>Ends {promo.endDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const reviewCard = (
    <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-gradient-to-br from-neutral-900 to-neutral-950 border-neutral-800' : 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        <h3 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Your Feedback Keeps the Wheels Turning Smoothly</h3>
      </div>
      <p className={`text-sm leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
        {content.reviewBlurb}
      </p>
      <div className="flex flex-wrap gap-2.5 mt-4">
        <a
          href="https://www.google.com/search?q=stakeys+cycles+reviews"
          target="_blank"
          rel="noreferrer"
          className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-neutral-950 text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          <Star className="w-4 h-4" />
          Leave a Review
        </a>
        <a
          href={mail}
          className="pressable inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          {content.feedbackTitle}
        </a>
      </div>
      <p className={`text-xs leading-relaxed mt-4 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        {content.feedbackBody}
      </p>
    </div>
  );

  const socialLinks = (
    <div className="flex flex-wrap gap-2">
      {content.socials.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.platform}
          className={`pressable inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer ${isDark ? 'border-neutral-700 bg-neutral-900/70 text-neutral-300 hover:border-emerald-500/50' : 'border-neutral-200 bg-white text-neutral-600 hover:border-emerald-500/50'}`}
        >
          <span>{SOCIAL_ICON[s.platform] ?? '🔗'}</span>
          <span className="hidden sm:inline">{s.platform}</span>
        </a>
      ))}
    </div>
  );

  const footerBar = (
    <footer className={`mt-10 rounded-3xl border p-6 ${isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <div className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            STAKEYS <span className="text-[#05C147] text-xs font-bold uppercase">Cycles &amp; Scooter</span>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Independent maintenance &amp; repair workshop · Call-out-only service across Salford.

          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a href={call} className="pressable inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-[11px] font-bold text-emerald-400 cursor-pointer">
            <Phone className="w-3.5 h-3.5" /> {content.phone}
          </a>
          <a href={mail} className="pressable inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold cursor-pointer">
            <MessageCircle className="w-3.5 h-3.5" /> {content.email}
          </a>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap justify-between items-center gap-3">
        {socialLinks}
        <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
          © 2026 Stakey's Cycles · Content managed from the Staff Station
        </span>
      </div>
    </footer>
  );

  const cartDrawer = cartOpen && (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <aside className={`relative z-10 h-full w-full max-w-md overflow-y-auto border-l p-5 space-y-4 ${isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{CART_TITLE}</h3>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{CART_BLURB}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className={`pressable h-8 w-8 rounded-lg border cursor-pointer ${isDark ? 'border-neutral-700 text-neutral-300' : 'border-neutral-200 text-neutral-600'}`}
            aria-label="Close basket"
          >
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        {orderPlaced && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-[11px] font-bold text-emerald-400">
            ✓ {CHECKOUT_SUCCESS_TITLE} We've emailed the workshop — we'll confirm collection shortly.
          </div>
        )}

        {cart.length === 0 ? (
          <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Your basket is empty. Browse the Shop to add parts and bikes.</p>
        ) : (
          <>
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.productId} className={`flex items-center gap-3 rounded-xl border p-2.5 ${isDark ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
                  <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className={`truncate text-xs font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>{item.name}</div>
                    <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>£{item.price.toFixed(2)} each</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => decrementCart(item.productId)} className="pressable h-6 w-6 rounded-md border text-xs font-black cursor-pointer">−</button>
                    <span className={`w-5 text-center text-xs font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-700'}`}>{item.qty}</span>
                    <button type="button" onClick={() => removeFromCart(item.productId)} className="pressable h-6 w-6 rounded-md border text-rose-400 cursor-pointer">
                      <Trash2 className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`flex items-center justify-between rounded-xl border p-3 ${isDark ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Total</span>
              <span className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>£{cartTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-2">
              <input
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                placeholder="Your name"
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
              />
              <input
                value={checkoutContact}
                onChange={(e) => setCheckoutContact(e.target.value)}
                placeholder="Phone or email"
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
              />
              <textarea
                value={checkoutNote}
                onChange={(e) => setCheckoutNote(e.target.value)}
                placeholder="Anything we should know? (optional)"
                rows={2}
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
              />
              {content.shopDisclaimers.length > 0 && (
                <div className={`rounded-xl border p-2.5 text-[10px] leading-relaxed space-y-1 ${isDark ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/80' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                  {content.shopDisclaimers.map((d, i) => (
                    <p key={i} className="flex gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </p>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={!isCheckoutReady(checkoutName, checkoutContact, cartCount) || placing}
                onClick={placeOrder}
                className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {placing ? 'Placing order…' : `${CART_CTA_LABEL} · £${cartTotal.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case 'location':
        return (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border shadow-lg">
              <img
                src={content.locationImage}
                alt="Stakey's Cycles — Salford"
                className="w-full h-56 sm:h-72 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 sm:p-8">
                <p className="text-white/90 italic text-sm sm:text-lg font-semibold max-w-2xl leading-relaxed drop-shadow">
                  “{content.locationQuote}”
                </p>
              </div>
            </div>
            <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
              <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{content.mobileTitle}</h3>
              <p className={`text-sm leading-relaxed mt-2 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {content.mobileBody}
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={onBookService}
                  className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
                  Book Your Appointment
                </button>
                <a href={call} className="pressable inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-bold cursor-pointer">
                  <Phone className="w-4 h-4" /> Call Us Out
                </a>
              </div>
            </div>
            {footerBar}
          </div>
        );
      case 'faqs':
        return (
          <div className="space-y-6">
            <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
              <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>FAQs</h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Answers to common workshop questions — published by your mechanics from the Staff Station.

              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {([{ key: 'all', label: 'All' }, ...faqGroups] as { key: 'all' | 'repairs' | 'parts' | 'general'; label: string }[]).map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setFaqFilter(g.key)}
                    className={`pressable rounded-xl px-3 py-1.5 text-[11px] font-bold cursor-pointer border ${
                      faqFilter === g.key
                        ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                        : isDark
                        ? 'bg-neutral-900 border-neutral-700 text-neutral-300'
                        : 'bg-white border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {faqGroups.map((group) => {
              const rows = content.faqs.filter((f) => f.section === group.key);
              if (faqFilter !== 'all' && faqFilter !== group.key) return null;
              if (rows.length === 0) return null;
              return (
                <section key={group.key} className="space-y-2.5">
                  <h4 className={`text-xs font-black uppercase tracking-widest px-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {group.label}
                  </h4>
                  {rows.map((f) => (
                    <details
                      key={f.id}
                      className={`group rounded-2xl border p-4 cursor-pointer ${isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}
                    >
                      <summary className={`flex items-center justify-between gap-3 text-sm font-bold list-none cursor-pointer ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>
                        <span>{f.q}</span>
                        <span className="text-emerald-500 transition-transform group-open:rotate-90">▸</span>
                      </summary>
                      <p className={`text-sm leading-relaxed mt-3 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{f.a}</p>
                    </details>
                  ))}
                </section>
              );
            })}
            {footerBar}
          </div>
        );
      case 'gallery':
        return (
          <div className="space-y-6">
            <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Gallery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.galleryImages.map((img) => (
                <figure
                  key={img.id}
                  className={`overflow-hidden rounded-2xl border shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-neutral-200'}`}
                >
                  <img src={img.url} alt="Stakey's Cycles workshop work" className="w-full h-56 object-cover" loading="lazy" />
                  <figcaption className={`px-4 py-3 text-[11px] font-semibold ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    Stakey's Cycles — Salford
                  </figcaption>
                </figure>
              ))}
            </div>
            {footerBar}
          </div>
        );
      case 'priceList':
        return (
          <div className="space-y-6">
            <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
              <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{content.priceIntroTitle}</h3>
              <p className={`text-sm leading-relaxed mt-2 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {content.priceIntroBody}
              </p>
              <div className="mt-4 space-y-1.5">
                {content.priceNotes.map((note, i) => (
                  <p key={i} className="flex gap-2 text-[11px] leading-snug">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>{note}</span>
                  </p>
                ))}
              </div>
            </div>
            {(['bike', 'scooter'] as const).map((scope) => {
              const groups = groupedPriceRows(scope);
              return (
                <section key={scope} className="space-y-4">
                  <h4 className={`text-xs font-black uppercase tracking-widest px-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {scope === 'bike' ? 'Bicycle Repair Price List (Labour Only)' : 'E-Scooter Repair Price List (Labour Only)'}
                  </h4>
                  {Object.entries(groups).map(([group, rows]) => (
                    <div key={group} className={`rounded-2xl border divide-y divide-neutral-800/60 overflow-hidden ${isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
                      <div className="px-4 py-2.5 bg-emerald-500/10 text-[11px] font-black uppercase tracking-wider">
                        {group}
                      </div>
                      {rows.map((row) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-start">
                          <div className="col-span-12 sm:col-span-7">
                            <div className={`text-sm font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>{row.item}</div>
                            {row.desc && <p className={`text-[11px] leading-snug ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{row.desc}</p>}
                            {row.note && <p className="text-[10px] text-amber-400/90 italic">{row.note}</p>}
                          </div>
                          <div className="col-span-12 sm:col-span-5 sm:text-right">
                            <span className={`text-sm font-black ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{row.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              );
            })}
            <div className="flex justify-center">
              <a href={call} className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer">
                <Phone className="w-4 h-4" /> Call Now for an Exact Quote
              </a>
            </div>
            {footerBar}
          </div>
        );
      case 'shop':
        return (
          <div className="space-y-6">
            <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
              <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{content.shopNoticeTitle}</h3>
              <p className={`text-sm leading-relaxed mt-2 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {content.shopNoticeBody}
              </p>
              {content.shopDisclaimers.length > 0 && (
                <ul className={`mt-4 space-y-1.5 rounded-xl border p-3 text-[11px] leading-relaxed ${isDark ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/90' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                  {content.shopDisclaimers.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2.5 mt-4">
                <a href={call} className="pressable inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer">
                  <Phone className="w-4 h-4" /> Call / Text / WhatsApp
                </a>
                <a href={mail} className="pressable inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer">
                  <MessageCircle className="w-4 h-4" /> Email Us
                </a>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Browse by category</span>
              {(['all', ...content.shopCategories] as Array<'all' | WebProductCategory>).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`pressable rounded-xl px-3 py-1.5 text-[11px] font-bold cursor-pointer border ${
                    categoryFilter === cat
                      ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                      : isDark
                      ? 'bg-neutral-900 border-neutral-700 text-neutral-300'
                      : 'bg-white border-neutral-200 text-neutral-600'
                  }`}
                >
                  {cat === 'all' ? 'All Items' : cat}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-[11px] font-mono ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                {visibleProducts.length} results · buy online and collect in person from the workshop.
              </p>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="pressable inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Basket ({cartCount})
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProducts.map((p) => {
                const inBasket = cartQtyFor(p.id);
                const soldOut = p.stock <= 0;
                return (
                  <div key={p.id} className={`group overflow-hidden rounded-2xl border shadow-lg flex flex-col ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                    <div className="relative overflow-hidden">
                      <img src={p.image} alt={p.name} className="w-full h-48 object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      {p.wasPrice && (
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-950 shadow">
                          Sale
                        </span>
                      )}
                      {soldOut && (
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-neutral-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
                          Out of stock
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2 flex-1 flex flex-col">
                      <div className={`text-sm font-bold leading-snug ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>{p.name}</div>
                      {p.description && (
                        <p className={`text-[11px] leading-snug ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{p.description}</p>
                      )}
                      <div className="flex items-baseline gap-2">
                        <span className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>£{p.price.toFixed(2)}</span>
                        {p.wasPrice && (
                          <span className={`text-xs line-through ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>£{p.wasPrice.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
                          {p.category}
                        </span>
                        <span className={`text-[10px] font-bold ${soldOut ? 'text-rose-400' : isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          {soldOut ? 'Unavailable' : `${p.stock} in stock`}
                        </span>
                      </div>
                      <div className="mt-auto pt-1">
                        {inBasket > 0 ? (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => decrementCart(p.id)}
                              className="pressable h-8 w-8 rounded-lg border text-sm font-black cursor-pointer"
                            >
                              −
                            </button>
                            <span className={`text-xs font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-700'}`}>{inBasket} in basket</span>
                            <button
                              type="button"
                              disabled={inBasket >= p.stock}
                              onClick={() => addToCart(p)}
                              className="pressable h-8 w-8 rounded-lg border text-sm font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={soldOut}
                            onClick={() => addToCart(p)}
                            className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-neutral-950 text-[11px] font-black uppercase tracking-wider shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> {soldOut ? 'Out of stock' : 'Add to basket'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {footerBar}
          </div>
        );
      case 'join':
        return (
          <div className="space-y-6">
            <div className={`rounded-3xl border p-6 sm:p-8 shadow-lg ${isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}>
              <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{content.joinTitle}</h3>
              <p className={`text-sm leading-relaxed mt-2 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{content.joinBody}</p>
              <ul className="mt-4 space-y-2">
                {content.joinBullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="text-emerald-500 font-bold shrink-0">✓</span>
                    <span className={isDark ? 'text-neutral-300' : 'text-neutral-600'}>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <a
                  href={call}
                  className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  {content.joinCtaLabel}
                </a>
              </div>
            </div>
            {footerBar}
          </div>
        );
      case 'home':
      default:
        return (
          <div className="space-y-6">
            {heroCard}
            {reviewCard}
            {footerBar}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {content.siteAnnouncements.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span key={ribbonIndex} className={`animate-fade-in text-xs font-bold tracking-wide ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
              {content.siteAnnouncements[ribbonIndex]}
            </span>
          </div>
        </div>
      )}

      <div className={`rounded-3xl border p-4 sm:p-5 ${isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Stakey's Cycles &amp; Scooter · Repairs &amp; Second-Hand Shop
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Book a repair, browse the shop and see live promotions. Everything is kept up to date by the workshop team.

            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={`pressable inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold cursor-pointer ${isDark ? 'border-neutral-700 text-neutral-200' : 'border-neutral-200 text-neutral-700'}`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Basket
              {cartCount > 0 && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-neutral-950">{cartCount}</span>
              )}
            </button>
            {currentUser && (
              <span className={`hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#05C147] animate-pulse" />
                Book = {content.calloutCta}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <SegmentedTabs tabs={pageTabs} active={page} onChange={setPage} ariaLabel="Website pages" size="sm" />
        </div>
      </div>

      {renderPage()}
      {cartDrawer}
    </div>
  );
};