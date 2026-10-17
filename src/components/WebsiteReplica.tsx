import { MarketplacePanel } from './MarketplacePanel';
import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  Bike,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Globe,
  Link2,
  Lock,
  MapPin,
  MessageCircle,
  Menu,
  Phone,
  Quote,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  CloudRain,
  Wrench,
  X,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useWebsiteContent } from '../context/WebsiteContentStore';
import { supabase } from '../lib/supabase';
import { SocialBrandIcon } from './SocialBrandIcon';
import { ShareMenu } from './ShareMenu';
import {
  WebsitePageId,
  WebProductCategory,
  WebCartItem,
  WebProduct,
  SiteNavGroup,
} from '../types/websiteContent';
import { NotifyMeButton } from './NotifyMeButton';
import {
  applyDiscountToTotal,
  findDiscountCode,
  validateDiscountCode,
} from '../utils/discountService';
import { websiteDiscountCatalogue, discountCodeFromSearch, discountShareUrl } from '../utils/websiteDiscounts';
import { claimEmailSend } from '../utils/sendOnce';
import type { DiscountCode } from '../types/bikeShop';
import { PolicyDisclaimers } from './PolicyDisclaimers';
import { DISCOUNT_DISCLAIMERS } from '../utils/workshopPolicy';
import { WeatherForecast } from './weather/WeatherForecast';
import { CustomerErrorCodeHelper } from './CustomerErrorCodeHelper';
import { SellYourBikeForm } from './TradeInRequestForm';
import { ThemeToggle } from './ThemeToggle';
import { worldFor } from './theme/worldCatalog';

interface WebsiteReplicaProps {
/** Opens the app's own booking flow (guest when signed out, Booking tab when signed in). */
  onBookService: () => void;
/** Which surface is showing the site: the public website or the embedded customer-app tab. */
  context?: 'public' | 'embedded';
/** Show a "Customer Sign In" action in the site header (used by the public website). */
  onSignIn?: () => void;
}

const CART_TITLE = 'Your Basket';
const CART_BLURB =
  'Add second-hand parts and bikes to your basket, then checkout with click & collect from the workshop.';
const CART_CTA_LABEL = 'Checkout';
const CHECKOUT_SUCCESS_TITLE = 'Order received!';

/** All page ids, used to validate a `?page=` deep link before trusting it. */
const ALL_PAGES: WebsitePageId[] = [
  'home',
  'shop',
  'marketplace',
  'repairs',
  'sell',
  'offers',
  'faqs',
  'visit',
  'join',
  'location',
  'weather',
  'gallery',
  'priceList',
];

/** Read the requested page from the URL (`?page=shop`) so links are shareable. */
function pageFromSearch(): WebsitePageId | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('page');
  return raw && (ALL_PAGES as string[]).includes(raw) ? (raw as WebsitePageId) : null;
}

/**
 * Reflect the active page in the URL, but only for a session that arrived on a
 * `?page=` deep link — a plain visit never gains a query param, so the address
 * bar stays clean and shared links keep working.
 */
function syncPageParam(next: WebsitePageId) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('page')) return;
  if (next === 'home') url.searchParams.delete('page');
  else url.searchParams.set('page', next);
  window.history.replaceState(null, '', url.toString());
}

/** Checkout requires a basket, a name and some contact detail before the order can be placed. */
function isCheckoutReady(name: string, contact: string, itemCount: number): boolean {
  return itemCount > 0 && name.trim().length > 1 && contact.trim().length > 4;
}

/**
 * Reveals its children as they scroll into view (IntersectionObserver, fires
 * once). Falls back to visible immediately when the API is unavailable so
 * nothing is ever hidden in a headless render or an old browser.
 */
const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`site-reveal ${shown ? 'is-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

/** Infinite horizontal ticker; the track is duplicated for a seamless loop. */
const Marquee: React.FC<{ items: string[]; className?: string }> = ({ items, className = '' }) => (
  <div className={`site-marquee ${className}`} aria-hidden="true">
    {[0, 1].map((dup) => (
      <div key={dup} className="site-marquee__track">
        {items.map((t, i) => (
          <span key={`${dup}-${i}`} className="flex items-center gap-3.5 whitespace-nowrap">
            <span className="font-editorial text-lg italic text-[var(--site-ink-soft)]">{t}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--site-brass)]" />
          </span>
        ))}
      </div>
    ))}
  </div>
);

export const WebsiteReplica: React.FC<WebsiteReplicaProps> = ({
  onBookService,
  context = 'public',
  onSignIn,
}) => {
  const { currentUser, theme, seasonalTheme, promotions, discountCodes, recordDiscountUsage } = useShop();
  const content = useWebsiteContent();
  const isDark = theme === 'dark';
  const isEmbedded = context === 'embedded';
  const seasonalWorld = worldFor(seasonalTheme ?? 'none');

  const livePromotions = promotions.filter((p) => p.status === 'active');
  // Live codes plus the curated public set, so the coupon panel works before
  // the audience migration has been applied to the live database.
  const catalogue = websiteDiscountCatalogue(discountCodes);
  const liveDiscountCodes = catalogue.filter(
    (c) => c.status === 'active' && (c.audience === 'public' || (c.audience === 'member' && currentUser))
  );

  const [page, setPage] = useState<WebsitePageId>(() => pageFromSearch() ?? 'home');
  const [faqFilter, setFaqFilter] = useState<'repairs' | 'parts' | 'general' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WebProductCategory>('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close the mega-menu / mobile drawer when clicking away or pressing Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenGroup(null);
        setMobileNavOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const goTo = useCallback((next: WebsitePageId) => {
    setPage(next);
    setOpenGroup(null);
    setMobileNavOpen(false);
    syncPageParam(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [cart, setCart] = useState<WebCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutContact, setCheckoutContact] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<{ id: string; code: string; amountOff: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const pendingDeepLink = useRef<string>('');

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartDiscount = appliedCode?.amountOff ?? 0;
  const cartTotal = applyDiscountToTotal(cartSubtotal, cartDiscount);
  const cartQtyFor = (productId: string) => cart.find((i) => i.productId === productId)?.qty ?? 0;

  /** Re-validate the applied code against the live basket so it never over-discounts. */
  const promoEvaluation = appliedCode
    ? validateDiscountCode(findDiscountCode(appliedCode.code, catalogue), {
        subtotal: cartSubtotal,
        isMember: Boolean(currentUser),
      })
    : null;
  const promoActive = Boolean(appliedCode && promoEvaluation?.ok);

  /** Shared apply path used by the manual code box and the coupon cards. */
  const applyCode = (found: DiscountCode | null, clearInput: boolean) => {
    setPromoError(null);
    if (!found) {
      setPromoError('That code was not recognised.');
      return;
    }
    const res = validateDiscountCode(found, {
      subtotal: cartSubtotal,
      isMember: Boolean(currentUser),
    });
    if (!res.ok) {
      setPromoError(res.reason || 'That code cannot be used on this basket.');
      return;
    }
    setAppliedCode({ id: found.id, code: found.code, amountOff: res.amountOff || 0 });
    if (clearInput) setPromoInput('');
  };

  const applyPromoCode = () => applyCode(findDiscountCode(promoInput, catalogue), true);

  /**
   * One-tap apply from a coupon card. Opens the basket so the shopper sees the
   * discount, and nudges them to add items when the basket is still empty.
   */
  const useCoupon = (coupon: DiscountCode) => {
    setCartOpen(true);
    if (cart.length === 0) {
      setPromoError('Add something to your basket first, then apply this code.');
      return;
    }
    applyCode(coupon, false);
  };

  const clearPromoCode = () => {
    setAppliedCode(null);
    setPromoError(null);
  };

  /** Copy a code to the clipboard so it can be used in-store or at checkout. */
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt('Copy this discount code:', code);
    }
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800);
  };

  /** Copy a shareable offer link (`?code=…`) so the code can be promoted in the wild. */
  const copyOfferLink = async (code: string) => {
    const link = discountShareUrl(code);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Copy this offer link:', link);
    }
    setCopiedLink(code);
    window.setTimeout(() => setCopiedLink((c) => (c === code ? null : c)), 1800);
  };

  // A visitor arriving from a shared offer link (?code=WEB-5OFF) has the code
  // remembered here and applied automatically once their basket has items.
  useEffect(() => {
    const code = discountCodeFromSearch();
    if (!code) return;
    setPromoInput(code);
    pendingDeepLink.current = code;
  }, []);

  // Retry the pending deep-link code whenever the basket changes. A public code
  // applies straight away; a member code stays in the box until they sign in.
  useEffect(() => {
    const code = pendingDeepLink.current;
    if (!code || cart.length === 0) return;
    const found = findDiscountCode(code, catalogue);
    if (!found || !validateDiscountCode(found, { subtotal: cartSubtotal, isMember: Boolean(currentUser) }).ok) {
      return;
    }
    applyCode(found, true);
    pendingDeepLink.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, currentUser, cartSubtotal]);

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
        discount_code: promoActive ? appliedCode?.code || null : null,
      };
      let { error } = await supabase.from('ecommerce_orders').insert(order);
      if (error) {
        // Older project without the discount_code column — still save the order.
        const retry = await supabase
          .from('ecommerce_orders')
          .insert({ ...order, discount_code: undefined });
        error = retry.error;
      }
      if (error) console.warn('[WEBSITE SHOP] Order persist skipped:', error.message);
      if (promoActive && appliedCode) {
        void recordDiscountUsage(appliedCode.id);
      }
      // One shop-order alert per distinct order. Re-clicking "Place order" (or a
      // retried submit during testing) must not fire duplicate copies.
      const orderEmailKey = `shop-order:${checkoutName.trim().toLowerCase()}:${cartTotal.toFixed(2)}:${cart.map((i) => `${i.productId}x${i.qty}`).join(',')}`;
      if (claimEmailSend(orderEmailKey)) {
        await supabase.functions
          .invoke('send-email', {
            body: {
              from: 'noreply@stakeyscycles.co.uk',
              to: 'Benstake13@gmail.com',
              subject: `🛒 [STAKEY'S SHOP] New order — £${cartTotal.toFixed(2)} (${checkoutName.trim()})`,
              html: `<h2>New shop order</h2><p><strong>${checkoutName.trim()}</strong> · ${checkoutContact.trim()}</p><p>Total: <strong>£${cartTotal.toFixed(2)}</strong>${promoActive ? ` (code <strong>${appliedCode?.code}</strong>, −£${cartDiscount.toFixed(2)})` : ''}</p><ul>${cart
                .map((i) => `<li>${i.qty}× ${i.name} — £${(i.price * i.qty).toFixed(2)}</li>`)
                .join('')}</ul>${checkoutNote.trim() ? `<p>Note: ${checkoutNote.trim()}</p>` : ''}`,
            },
          })
          .catch((err: unknown) => console.warn('[WEBSITE SHOP] Order email skipped:', err));
      }
      setOrderPlaced(true);
      setCart([]);
      setCheckoutNote('');
      setAppliedCode(null);
      setPromoInput('');
    } finally {
      setPlacing(false);
    }
  };

  /**
   * Primary navigation, grouped so a customer always knows where to go:
   * Shop and Repairs hold the submenus; everything else is one tap away.
   * Kept in sync with the Staff Station's "Pages" list.
   */
  const navGroups: SiteNavGroup[] = [
    {
      id: 'shop',
      label: 'Shop',
      icon: 'store',
      page: 'shop',
      children: [
        { id: 'shop', label: 'Second-hand bikes & parts', hint: 'Serviced, photographed, ready to ride' },
        { id: 'sell', label: 'Sell your bike', hint: 'Get an instant AI offer in minutes' },
      ],
    },
    {
      id: 'repairs',
      label: 'Repairs & Prices',
      icon: 'wrench',
      page: 'repairs',
      children: [
        { id: 'repairs', label: 'Repairs & services', hint: 'What we fix and how it works' },
        { id: 'priceList', label: 'Price list', hint: 'Clear, upfront labour prices' },
        { id: 'weather', label: 'Riding weather', hint: 'A 7-day "can I ride?" forecast' },
      ],
    },
    { id: 'marketplace', label: 'Marketplace', icon: 'store', page: 'marketplace' },
    { id: 'offers', label: 'Offers', icon: 'tag', page: 'offers' },
    { id: 'faqs', label: 'FAQs', icon: 'message', page: 'faqs' },
    {
      id: 'visit',
      label: 'Visit',
      icon: 'map',
      page: 'visit',
      children: [
        { id: 'visit', label: 'Find us & opening', hint: 'Salford workshop + mobile call-out' },
        { id: 'gallery', label: 'Gallery', hint: 'Recent builds from the workshop' },
      ],
    },
    { id: 'join', label: 'Join us', icon: 'star', page: 'join' },
  ];

  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    store: Store,
    wrench: Wrench,
    tag: Tag,
    message: MessageCircle,
    map: MapPin,
    star: Star,
  };

  const call = `tel:${content.phone}`;
  const mail = `mailto:${content.email}`;
  const whatsapp = `https://wa.me/447388209102?text=${encodeURIComponent(
    "Hi Stakey's Cycles, I'd like to ask about a repair."
  )}`;

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
  /* ------------------------------------------------------------------ *
   * Reusable page furniture
   * ------------------------------------------------------------------ */

  const pageHeading = (eyebrow: string, title: string, body?: string) => (
    <header className="max-w-3xl">
      <span className="site-eyebrow">{eyebrow}</span>
      <h1 className="site-display mt-3 text-4xl sm:text-5xl">{title}</h1>
      {body && <p className="site-lede mt-4 text-base">{body}</p>}
    </header>
  );

  const sectionHeading = (eyebrow: string, title: string, body?: string, right?: React.ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <span className="site-eyebrow">{eyebrow}</span>
        <h2 className="site-display mt-3 text-3xl sm:text-4xl">{title}</h2>
        {body && <p className="site-lede mt-3 text-sm sm:text-base">{body}</p>}
      </div>
      {right}
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Header — brand lock-up, grouped nav, one clear action
   * ------------------------------------------------------------------ */

  const utilityBadge = (
    <span
      data-testid="website-context-badge"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--site-line)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--site-ink-faint)]"
    >
      <Globe className="w-3 h-3" />
      {isEmbedded ? 'Customer app preview' : 'Public website'}
    </span>
  );

  const siteHeader = (
    <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 backdrop-blur-xl border-b border-[var(--site-line)] bg-[color-mix(in_srgb,var(--site-canvas)_82%,transparent)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo('home')}
          className="flex items-center gap-3 text-left cursor-pointer"
          aria-label="Stakey's Cycles home"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(5,193,71,0.45)] bg-black shadow-[0_12px_30px_-12px_rgba(18,184,102,0.9)]">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="Stakey's Cycles &amp; Scooter"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="leading-tight">
            <span className="font-editorial block text-lg font-semibold tracking-tight text-[var(--site-ink)]">
              Stakey's <span className="text-[var(--site-green)]">Cycles</span>
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-ink-faint)] sm:block">
              Repairs · Salford
            </span>
          </span>
        </button>

        {/* Desktop grouped navigation */}
        <nav ref={navRef} className="hidden xl:flex items-center gap-1" aria-label="Website pages">
          <button
            type="button"
            onClick={() => goTo('home')}
            className={`site-btn site-btn-sm ${page === 'home' ? 'site-btn-ghost !text-[var(--site-green)] !border-[var(--site-green)]' : 'site-btn-ghost !border-transparent'}`}
          >
            Home
          </button>
          {navGroups.map((group) => {
            const Icon = NAV_ICONS[group.icon] ?? Store;
            const isActive =
              group.page === page || group.children?.some((c) => c.id === page) || false;
            const open = openGroup === group.id;
            if (!group.children) {
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => group.page && goTo(group.page)}
                  className={`site-btn site-btn-sm ${isActive ? 'site-btn-ghost !text-[var(--site-green)] !border-[var(--site-green)]' : 'site-btn-ghost !border-transparent'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {group.label}
                </button>
              );
            }
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  aria-expanded={open}
                  className={`site-btn site-btn-sm ${isActive ? 'site-btn-ghost !text-[var(--site-green)] !border-[var(--site-green)]' : 'site-btn-ghost !border-transparent'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {group.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="site-glass absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 p-2 animate-slide-down">
                    {group.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => goTo(child.id)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(18,184,102,0.08)] cursor-pointer"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[rgba(18,184,102,0.12)] text-[var(--site-green)]">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                        <span>
                          <span className="block text-[13px] font-bold text-[var(--site-ink)]">{child.label}</span>
                          {child.hint && (
                            <span className="block text-[11px] text-[var(--site-ink-faint)]">{child.hint}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden xl:inline-flex">{utilityBadge}</span>
          <ThemeToggle className="site-toggle !px-2.5 !py-1.5" />
          {onSignIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="site-btn site-btn-ghost site-btn-sm hidden sm:inline-flex"
            >
              <Lock className="w-3.5 h-3.5" /> Sign in
            </button>
          )}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Open basket"
            className="site-btn site-btn-ghost site-btn-sm relative !px-3"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--site-green)] px-1 text-[9px] font-black text-[#04120b]">
                {cartCount}
              </span>
            )}
          </button>
          <button type="button" onClick={onBookService} className="site-btn site-btn-primary site-btn-sm">
            <CalendarCheck className="w-3.5 h-3.5" /> Book a repair
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
            className="site-btn site-btn-ghost site-btn-sm !px-3 xl:hidden"
          >
            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="xl:hidden pb-4 animate-slide-down">
          <div className="site-glass p-2">
            <button
              type="button"
              onClick={() => goTo('home')}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--site-ink)] hover:bg-[rgba(18,184,102,0.08)] cursor-pointer"
            >
              Home
            </button>
            {navGroups.map((group) => {
              const Icon = NAV_ICONS[group.icon] ?? Store;
              return (
                <div key={group.id} className="mt-1">
                  <button
                    type="button"
                    onClick={() => group.page && goTo(group.page)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--site-ink)] hover:bg-[rgba(18,184,102,0.08)] cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-[var(--site-green)]" /> {group.label}
                  </button>
                  {group.children && (
                    <div className="ml-4 border-l border-[var(--site-line)] pl-2">
                      {group.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => goTo(child.id)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[var(--site-ink-soft)] hover:text-[var(--site-green)] cursor-pointer"
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );

  /* ------------------------------------------------------------------ *
   * Home — hero
   * ------------------------------------------------------------------ */

  const heroSection = (
    <section className="relative overflow-hidden rounded-[2rem] border border-[var(--site-line)] bg-[color-mix(in_srgb,var(--site-card-solid)_70%,transparent)] shadow-[var(--site-shadow)]">
      <span className="site-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div className="relative z-10 grid grid-cols-1 gap-10 p-7 sm:p-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="site-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--site-green)] animate-pulse" />
              {content.heroBadge}
            </span>
          </div>
          <h1 className="site-display text-5xl sm:text-6xl lg:text-7xl">
            {content.heroTitle.split(' ').map((word, i, arr) =>
              i === arr.length - 1 ? (
                <span key={i} className="italic text-[var(--site-green)]">
                  {word}
                </span>
              ) : (
                <span key={i}>{word} </span>
              )
            )}
          </h1>
          <p className="font-editorial text-xl sm:text-2xl italic text-[var(--site-ink-soft)]">
            {content.homeHeadlineOverride?.[context] || content.heroSubtitle}
          </p>
          <p className="site-lede max-w-xl text-sm sm:text-base">{content.heroBlurb}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={onBookService} className="site-btn site-btn-primary">
              <CalendarCheck className="w-4 h-4" />
              {isEmbedded ? 'Book a repair' : content.calloutCta}
            </button>
            <a href={call} className="site-btn site-btn-ghost">
              <Phone className="w-4 h-4" /> Call the workshop
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            {[
              { icon: ShieldCheck, label: '10 stamps → £40 credit' },
              { icon: CalendarCheck, label: 'Live repair tracking' },
              { icon: MapPin, label: 'Salford · mobile call-out' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--site-ink-soft)]">
                <Icon className="w-4 h-4 text-[var(--site-green)]" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Quality promise card */}
        <div className="lg:col-span-5">
          <div
            data-testid="hero-quality-claim"
            className="site-frame relative rounded-[1.75rem] p-7 sm:p-8 shadow-[var(--site-shadow)]"
          >
            <Quote className="w-7 h-7 text-[var(--site-brass)]" />
            <p className="font-editorial mt-4 text-xl font-semibold leading-snug text-[var(--site-ink)] sm:text-2xl">
              {content.brandStory.qualityClaim}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="w-4 h-4 fill-[var(--site-brass)] text-[var(--site-brass)]" />
                ))}
              </div>
              <span className="text-[11px] font-semibold text-[var(--site-ink-faint)]">
                Loved by local riders
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const trustMarquee = (
    <div className="site-glass py-4">
      <Marquee
        items={[
          'Independent since day one',
          'Serviced before it sells',
          'Fixed-price labour',
          'Collection & delivery',
          'Salford based',
          'E-bike & e-scooter trained',
          'Loyalty that pays you back',
        ]}
      />
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Home — sections
   * ------------------------------------------------------------------ */

  const editorialGallery = (
    <section className="site-editorial-gallery" aria-label="Explore our cycle and e-scooter workshop">
      <div className="site-editorial-heading">
        <div><span className="site-eyebrow">THE ART OF THE RIDE / SALFORD</span><h2 className="site-display">Precision in every detail.</h2></div>
        <p>From finely tuned bicycles to everyday electric mobility. Discover a workshop where the details matter.</p>
      </div>
      <div className="site-editorial-grid">
        <button type="button" className="site-editorial-photo site-editorial-photo--lead" onClick={() => goTo('repairs')} aria-label="Explore cycle servicing and workshop repairs">
          <img src="/images/hero_workshop_craftsmanship_1790159761910.jpg" alt="Close-up of precision bicycle workshop craftsmanship" loading="eager" decoding="async" />
          <span className="site-editorial-photo__index">01 / THE WORKSHOP</span>
          <span className="site-editorial-photo__caption"><strong>Crafted with care.</strong><span>Cycle servicing & repairs <ArrowRight size={18} /></span></span>
        </button>
        <button type="button" className="site-editorial-photo" onClick={() => goTo('repairs')} aria-label="Explore bicycle repair services">
          <img src="/images/bike_precision_gravel_studio_1790159773368.jpg" alt="Premium gravel bicycle photographed in a dramatic studio setting" loading="lazy" decoding="async" />
          <span className="site-editorial-photo__index">02 / THE MACHINE</span>
          <span className="site-editorial-photo__caption"><strong>Every ride matters.</strong><span>Explore bicycle care <ArrowRight size={18} /></span></span>
        </button>
        <button type="button" className="site-editorial-photo" onClick={() => goTo('repairs')} aria-label="Explore electric scooter servicing enquiries">
          <img src="/images/scooter_performance_studio_1790159785831.jpg" alt="Modern electric scooter photographed with premium studio lighting" loading="lazy" decoding="async" />
          <span className="site-editorial-photo__index">03 / ELECTRIC MOBILITY</span>
          <span className="site-editorial-photo__caption"><strong>Electric. Elevated.</strong><span>Enquire about e-scooters <ArrowRight size={18} /></span></span>
        </button>
      </div>
    </section>
  );

  const offersTeaser = (
    <Reveal>
      <section
        data-testid="home-offers-teaser"
        className="site-frame relative overflow-hidden rounded-[1.75rem] p-7 sm:p-9"
      >
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(216,180,90,0.16)] text-[var(--site-brass)]">
              <BadgePoundSterling className="w-6 h-6" />
            </span>
            <div>
              <h3 className="font-editorial text-xl font-semibold text-[var(--site-ink)]">
                {liveDiscountCodes.length > 0
                  ? `${liveDiscountCodes.length} live offer${liveDiscountCodes.length === 1 ? '' : 's'} running`
                  : 'Offers & member rewards'}
              </h3>
              <p className="site-lede text-[13px]">
                Loyalty stamps, member codes and seasonal deals — all in one place.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => goTo('offers')} className="site-btn site-btn-brass">
            <Tag className="w-4 h-4" /> See all offers
          </button>
        </div>
      </section>
    </Reveal>
  );

  const reviewSection = (
    <Reveal>
      <section className="site-glass p-7 sm:p-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-[var(--site-brass)] text-[var(--site-brass)]" />
              <span className="site-eyebrow !text-[var(--site-brass)]">Reviews</span>
            </div>
            <h2 className="site-display mt-3 text-3xl sm:text-4xl">
              Your feedback keeps the wheels turning
            </h2>
            <p className="site-lede mt-3 text-sm sm:text-base">{content.reviewBlurb}</p>
            <p className="site-lede mt-3 text-[13px]">{content.feedbackBody}</p>
          </div>
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-3">
              <a
                href="https://www.google.com/search?q=stakeys+cycles+reviews"
                target="_blank"
                rel="noreferrer"
                className="site-btn site-btn-brass w-full"
              >
                <Star className="w-4 h-4" /> Leave a review
              </a>
              <a href={mail} className="site-btn site-btn-ghost w-full">
                <MessageCircle className="w-4 h-4" /> {content.feedbackTitle}
              </a>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );

  const ctaBand = (
    <Reveal>
      <section className="site-frame relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-14">
        <span className="site-aurora" aria-hidden="true">
          <span />
          <span />
        </span>
        <div className="relative z-10 mx-auto max-w-2xl">
          <span className="site-eyebrow">Ready when you are</span>
          <h2 className="site-display mt-3 text-4xl sm:text-5xl">
            Bring it to the workshop that treats it like their own
          </h2>
          <p className="site-lede mt-4">
            Book a repair in a minute, browse the shop, or get an instant offer on your old bike.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onBookService} className="site-btn site-btn-primary">
              <CalendarCheck className="w-4 h-4" /> Book a repair
            </button>
            <button type="button" onClick={() => goTo('sell')} className="site-btn site-btn-ghost">
              <Tag className="w-4 h-4" /> Sell your bike
            </button>
            <a href={call} className="site-btn site-btn-ghost">
              <Phone className="w-4 h-4" /> {content.phone}
            </a>
          </div>
        </div>
      </section>
    </Reveal>
  );

  /* ------------------------------------------------------------------ *
   * Footer
   * ------------------------------------------------------------------ */

  const socialLinks = (
    <div className="flex flex-wrap gap-2">
      {content.socials.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.platform}
          aria-label={s.platform}
          className="site-btn site-btn-ghost site-btn-sm !px-3"
        >
          <SocialBrandIcon platform={s.platform} className="w-4 h-4 shrink-0" />
        </a>
      ))}
    </div>
  );

  const siteFooter = (
    <footer className="mt-14 border-t border-[var(--site-line)] pt-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(5,193,71,0.45)] bg-black">
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt="Stakey's Cycles &amp; Scooter"
                className="h-full w-full object-contain"
              />
            </span>
            <span className="font-editorial text-lg font-semibold text-[var(--site-ink)]">
              Stakey's <span className="text-[var(--site-green)]">Cycles</span>
            </span>
          </div>
          <p className="site-lede mt-4 max-w-sm text-[13px]">
            Independent cycle &amp; scooter maintenance and repair workshop. Repairs, second-hand bikes
            and call-out service across Salford.
          </p>
          <div className="mt-5">{socialLinks}</div>
        </div>
        <div className="md:col-span-3">
          <h4 className="site-eyebrow">Explore</h4>
          <ul className="mt-4 space-y-2">
            {navGroups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => g.page && goTo(g.page)}
                  className="text-[13px] text-[var(--site-ink-soft)] transition-colors hover:text-[var(--site-green)] cursor-pointer"
                >
                  {g.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-4">
          <h4 className="site-eyebrow">Get in touch</h4>
          <div className="mt-4 space-y-2.5">
            <a href={call} className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--site-ink)]">
              <Phone className="h-4 w-4 text-[var(--site-green)]" /> {content.phone}
            </a>
            <a href={mail} className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
              <MessageCircle className="h-4 w-4 text-[var(--site-green)]" /> {content.email}
            </a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
              <MessageCircle className="h-4 w-4 text-[var(--site-green)]" /> WhatsApp us
            </a>
            <p className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
              <Clock className="h-4 w-4 text-[var(--site-green)]" /> Call-out across Salford
            </p>
          </div>
        </div>
      </div>
      <div className="site-rule mt-9" />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pb-2">
        <span className="text-[11px] text-[var(--site-ink-faint)]">
          © 2026 Stakey's Cycles &amp; Scooter · Salford
        </span>
        <span className="text-[11px] text-[var(--site-ink-faint)]">
          Content managed from the Staff Station
        </span>
      </div>
    </footer>
  );

  /* ------------------------------------------------------------------ *
   * Basket drawer
   * ------------------------------------------------------------------ */

  const cartDrawer = cartOpen && (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--site-line)] bg-[var(--site-card-solid)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--site-line)] p-5">
          <div>
            <h3 className="font-editorial text-xl font-semibold text-[var(--site-ink)]">{CART_TITLE}</h3>
            <p className="site-lede text-[11px]">{CART_BLURB}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close basket"
            className="site-btn site-btn-ghost site-btn-sm !px-2.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {orderPlaced && (
            <div className="rounded-xl border border-[rgba(18,184,102,0.4)] bg-[rgba(18,184,102,0.1)] p-3 text-[12px] font-bold text-[var(--site-green)]">
              ✓ {CHECKOUT_SUCCESS_TITLE} We've emailed the workshop — we'll confirm collection shortly.
            </div>
          )}

          {cart.length === 0 ? (
            <p className="site-lede text-[13px]">
              Your basket is empty. Browse the shop to add parts and bikes.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 rounded-xl border border-[var(--site-line)] p-2.5">
                    <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[var(--site-ink)]">{item.name}</div>
                      <div className="text-[11px] text-[var(--site-ink-faint)]">£{item.price.toFixed(2)} each</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => decrementCart(item.productId)} className="site-btn site-btn-ghost site-btn-sm !px-2 !py-0.5">−</button>
                      <span className="w-5 text-center text-xs font-bold text-[var(--site-ink)]">{item.qty}</span>
                      <button type="button" onClick={() => removeFromCart(item.productId)} className="site-btn site-btn-ghost site-btn-sm !px-2 !py-0.5 !text-rose-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 rounded-xl border border-[var(--site-line)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--site-ink-faint)]">Subtotal</span>
                  <span className="text-xs font-bold text-[var(--site-ink)]">£{cartSubtotal.toFixed(2)}</span>
                </div>
                {promoActive && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--site-green)]">Code {appliedCode?.code}</span>
                    <span className="text-xs font-bold text-[var(--site-green)]">−£{cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[var(--site-line)] pt-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--site-ink-faint)]">Total</span>
                  <span className="font-editorial text-xl font-semibold text-[var(--site-green)]">£{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {promoActive ? (
                  <div className="flex items-center justify-between rounded-xl border border-[rgba(18,184,102,0.4)] bg-[rgba(18,184,102,0.08)] px-3 py-2">
                    <span className="text-[11px] font-bold text-[var(--site-green)]">
                      {appliedCode?.code} applied{currentUser ? ' (member)' : ''}
                    </span>
                    <button type="button" onClick={clearPromoCode} className="text-[11px] font-semibold text-[var(--site-ink-faint)] hover:text-rose-400 cursor-pointer">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Discount code"
                      className="site-field font-mono"
                    />
                    <button type="button" onClick={applyPromoCode} className="site-btn site-btn-ghost site-btn-sm shrink-0">
                      Apply
                    </button>
                  </div>
                )}
                {promoError && <p className="text-[10px] text-rose-400">{promoError}</p>}
                {!currentUser && (
                  <p className="text-[10px] text-[var(--site-ink-faint)]">
                    Loyalty members get bigger discounts — sign in to unlock member codes.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <input value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} placeholder="Your name" className="site-field" />
                <input value={checkoutContact} onChange={(e) => setCheckoutContact(e.target.value)} placeholder="Phone or email" className="site-field" />
                <textarea
                  value={checkoutNote}
                  onChange={(e) => setCheckoutNote(e.target.value)}
                  placeholder="Anything we should know? (optional)"
                  rows={2}
                  className="site-field"
                />
                {content.shopDisclaimers.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.06)] p-2.5 text-[10px] leading-relaxed text-[var(--site-ink-soft)]">
                    {content.shopDisclaimers.map((d, i) => (
                      <p key={i} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--site-brass)]" />
                        <span>{d}</span>
                      </p>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!isCheckoutReady(checkoutName, checkoutContact, cartCount) || placing}
                  onClick={placeOrder}
                  className="site-btn site-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {placing ? 'Placing order…' : `${CART_CTA_LABEL} · £${cartTotal.toFixed(2)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Offers page panels
   * ------------------------------------------------------------------ */

  const couponPanel = (
    <div className="site-glass p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--site-brass)]" />
          <span className="site-eyebrow !text-[var(--site-brass)]">Active coupons &amp; codes</span>
        </div>
        <span className="text-[10px] font-bold text-[var(--site-ink-faint)]">{liveDiscountCodes.length} available</span>
      </div>

      {liveDiscountCodes.length === 0 ? (
        <p className="site-lede mt-3 text-[12px]">No active coupon codes right now.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {liveDiscountCodes.map((coupon) => {
            const isApplied = appliedCode?.code?.toUpperCase() === coupon.code.toUpperCase();
            return (
              <div key={coupon.id} className="rounded-xl border border-[var(--site-line)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[var(--site-ink)]">{coupon.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[8px] font-mono font-bold uppercase ${
                      coupon.audience === 'member'
                        ? 'bg-[rgba(18,184,102,0.16)] text-[var(--site-green)]'
                        : 'bg-[rgba(255,255,255,0.06)] text-[var(--site-ink-faint)]'
                    }`}
                  >
                    {coupon.audience === 'member' ? 'Member Only' : 'Public'}
                  </span>
                </div>
                {coupon.description && (
                  <p className="site-lede mt-1 text-[11px]">{coupon.description}</p>
                )}
                {coupon.minimumSpend ? (
                  <p className="mt-1 text-[10px] text-[var(--site-ink-faint)]">Min. spend £{coupon.minimumSpend.toFixed(2)}</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => copyCode(coupon.code)}
                    title="Copy code"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--site-line-strong)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--site-ink)] cursor-pointer"
                  >
                    {copiedCode === coupon.code ? (
                      <>
                        <Check className="h-3 w-3 text-[var(--site-green)]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> {coupon.code}
                      </>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyOfferLink(coupon.code)}
                      title="Copy shareable offer link"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--site-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--site-ink-soft)] cursor-pointer"
                    >
                      {copiedLink === coupon.code ? (
                        <>
                          <Check className="h-3 w-3 text-[var(--site-green)]" /> Link
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3" /> Link
                        </>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-[var(--site-green)]">
                      {coupon.type === 'percent' ? coupon.value + '% Off' : '£' + coupon.value + ' Off'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => useCoupon(coupon)}
                  className={`mt-2 w-full rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                    isApplied
                      ? 'border-[var(--site-green)] bg-[rgba(18,184,102,0.14)] text-[var(--site-green)]'
                      : 'border-[var(--site-line-strong)] text-[var(--site-ink)] hover:border-[var(--site-green)]'
                  }`}
                >
                  {isApplied ? '✓ Applied' : 'Use this code'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!currentUser && (
        <p className="mt-3 border-t border-dashed border-[var(--site-line)] pt-2 text-center text-[10px] text-[var(--site-ink-faint)]">
          💡 <strong className="text-[var(--site-ink-soft)]">Sign in</strong> to unlock premium member codes!
        </p>
      )}
    </div>
  );

  const promotionsPanel = (
    <div className="site-glass p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[var(--site-brass)]" />
          <span className="site-eyebrow !text-[var(--site-brass)]">Live promotions</span>
        </div>
        <span className="text-[10px] font-bold text-[var(--site-ink-faint)]">{livePromotions.length} running</span>
      </div>
      {livePromotions.length === 0 ? (
        <p className="site-lede mt-3 text-[12px]">No promotions running right now — check back soon.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {livePromotions.map((promo) => (
            <div key={promo.id} className="space-y-1 rounded-xl border border-[rgba(18,184,102,0.3)] bg-[rgba(18,184,102,0.06)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-black uppercase tracking-wider text-[var(--site-green)]">{promo.title}</span>
                <span className="rounded-full bg-[var(--site-brass)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#201703]">
                  {promo.badgeText}
                </span>
              </div>
              <p className="site-lede text-[11px]">{promo.subtitle}</p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="rounded-lg border border-dashed border-[var(--site-line-strong)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--site-ink)]">
                  {promo.code}
                </span>
                <span className="text-[10px] text-[var(--site-ink-faint)]">Ends {promo.endDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Page router
   * ------------------------------------------------------------------ */

  const renderPage = () => {
    switch (page) {
      case 'marketplace':
        return <MarketplacePanel />;
      case 'shop':
        return (
          <div className="space-y-8">
            <Reveal>{pageHeading('Shop', content.shopNoticeTitle, content.shopNoticeBody)}</Reveal>

            <div className="flex flex-wrap items-center gap-2.5">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="site-btn site-btn-ghost site-btn-sm">
                <MessageCircle className="w-4 h-4" /> WhatsApp us
              </a>
              <a href={call} className="site-btn site-btn-ghost site-btn-sm">
                <Phone className="w-4 h-4" /> Call / text
              </a>
              <a href={mail} className="site-btn site-btn-ghost site-btn-sm">
                <MessageCircle className="w-4 h-4" /> Email us
              </a>
            </div>

            {content.shopDisclaimers.length > 0 && (
              <ul className="space-y-1.5 rounded-2xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.06)] p-4 text-[11px] leading-relaxed text-[var(--site-ink-soft)]">
                {content.shopDisclaimers.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--site-brass)]" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['all', ...content.shopCategories] as Array<'all' | WebProductCategory>).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`site-btn site-btn-sm ${categoryFilter === cat ? 'site-btn-primary' : 'site-btn-ghost'}`}
                  >
                    {cat === 'all' ? 'All items' : cat}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-mono text-[var(--site-ink-faint)]">
                {visibleProducts.length} results · buy online, collect in person
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.length === 0 && (
                <div className="site-glass sm:col-span-2 lg:col-span-3 p-10 text-center">
                  <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(18,184,102,0.14)] text-[var(--site-green)]">
                    <Store className="h-6 w-6" />
                  </span>
                  <h4 className="font-editorial mt-3 text-lg font-semibold text-[var(--site-ink)]">The shelf is empty right now</h4>
                  <p className="site-lede mx-auto mt-1 max-w-md text-[13px]">
                    Fresh second-hand bikes and parts are listed here as they're serviced. Tell us what you're
                    after and we'll keep an eye out for it.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <a href={call} className="site-btn site-btn-primary site-btn-sm">
                      <Phone className="w-3.5 h-3.5" /> Call the workshop
                    </a>
                    <a href={mail} className="site-btn site-btn-ghost site-btn-sm">
                      <MessageCircle className="w-3.5 h-3.5" /> Ask about a part
                    </a>
                  </div>
                </div>
              )}
              {visibleProducts.map((p) => {
                const inBasket = cartQtyFor(p.id);
                const soldOut = p.stock <= 0;
                return (
                  <article key={p.id} className="site-glass site-glass-hover group flex flex-col overflow-hidden">
                    <div className="relative overflow-hidden">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      {p.wasPrice && (
                        <span className="absolute left-3 top-3 rounded-full bg-[var(--site-brass)] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#201703]">
                          Sale
                        </span>
                      )}
                      {soldOut && (
                        <span className="absolute right-3 top-3 rounded-full bg-black/75 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                          Out of stock
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="text-sm font-bold leading-snug text-[var(--site-ink)]">{p.name}</h3>
                      {p.description && <p className="site-lede text-[11px]">{p.description}</p>}
                      <div className="flex items-baseline gap-2">
                        <span className="font-editorial text-xl font-semibold text-[var(--site-green)]">£{p.price.toFixed(2)}</span>
                        {p.wasPrice && <span className="text-xs text-[var(--site-ink-faint)] line-through">£{p.wasPrice.toFixed(2)}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="site-chip !py-0.5">{p.category}</span>
                        <span className={`text-[10px] font-bold ${soldOut ? 'text-rose-400' : 'text-[var(--site-ink-faint)]'}`}>
                          {soldOut ? 'Unavailable' : `${p.stock} in stock`}
                        </span>
                      </div>
                      <ShareMenu
                        title={`${p.name} — Stakeys Cycles`}
                        text={`Check out this ${p.name} for £${p.price.toFixed(2)} at Stakeys Cycles:`}
                        isDark={isDark}
                      />
                      <div className="mt-auto pt-1">
                        {inBasket > 0 ? (
                          <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => decrementCart(p.id)} className="site-btn site-btn-ghost site-btn-sm !px-3">−</button>
                            <span className="text-xs font-bold text-[var(--site-ink)]">{inBasket} in basket</span>
                            <button
                              type="button"
                              disabled={inBasket >= p.stock}
                              onClick={() => addToCart(p)}
                              className="site-btn site-btn-ghost site-btn-sm !px-3 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={soldOut}
                            onClick={() => addToCart(p)}
                            className="site-btn site-btn-primary site-btn-sm w-full disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> {soldOut ? 'Out of stock' : 'Add to basket'}
                          </button>
                        )}
                        <div className="pt-2">
                          <NotifyMeButton product={p} isDark={isDark} />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {siteFooter}
          </div>
        );

      case 'repairs':
        return (
          <div className="space-y-10">
            <Reveal>{pageHeading('Repairs & services', 'Fixed-price repairs, done properly', content.priceIntroBody)}</Reveal>

            <section className="space-y-6">
              {sectionHeading('Price list', content.priceIntroTitle, undefined, (
                <a href={call} className="site-btn site-btn-ghost site-btn-sm">
                  <Phone className="w-4 h-4" /> Get an exact quote
                </a>
              ))}
              {content.priceNotes.length > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  {content.priceNotes.map((note, i) => (
                    <p key={i} className="flex items-center gap-2 text-[11px] text-[var(--site-ink-faint)]">
                      <span className="h-1 w-1 rounded-full bg-[var(--site-green)]" /> {note}
                    </p>
                  ))}
                </div>
              )}
              {(['bike', 'scooter'] as const).map((scope) => {
                const groups = groupedPriceRows(scope);
                return (
                  <div key={scope} className="space-y-4">
                    <h3 className="site-eyebrow">
                      {scope === 'bike' ? 'Bicycle repair — labour only' : 'E-scooter repair — labour only'}
                    </h3>
                    {Object.entries(groups).map(([group, rows]) => (
                      <div key={group} className="site-glass overflow-hidden">
                        <div className="border-b border-[var(--site-line)] bg-[rgba(18,184,102,0.08)] px-5 py-3 text-[11px] font-black uppercase tracking-wider text-[var(--site-green)]">
                          {group}
                        </div>
                        <div className="divide-y divide-[var(--site-line)]">
                          {rows.map((row) => (
                            <div key={row.id} className="grid grid-cols-12 gap-2 px-5 py-3.5 items-start">
                              <div className="col-span-12 sm:col-span-8">
                                <div className="text-sm font-bold text-[var(--site-ink)]">{row.item}</div>
                                {row.desc && <p className="site-lede text-[11px]">{row.desc}</p>}
                                {row.note && <p className="mt-0.5 text-[10px] italic text-[var(--site-brass)]">{row.note}</p>}
                              </div>
                              <div className="col-span-12 sm:col-span-4 sm:text-right">
                                <span className="font-editorial text-lg font-semibold text-[var(--site-green)]">{row.price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>

            {ctaBand}
            {siteFooter}
          </div>
        );

      case 'offers':
        return (
          <div className="space-y-8">
            <Reveal>
              {pageHeading(
                'Save on repairs & parts',
                'Discount codes & offers',
                'Use a code at the basket, or mention it when you drop your bike in. Every code is checked against your basket automatically — no small print to remember.'
              )}
            </Reveal>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
              {promotionsPanel}
              {couponPanel}
            </div>
            <div className="site-glass p-6">
              <h4 className="font-editorial text-lg font-semibold text-[var(--site-ink)]">How to use a code</h4>
              <ol className="mt-4 space-y-3">
                {[
                  'Add the parts or bikes you want to the basket, or start a repair booking.',
                  'Tap “Use this code” on an offer, or type it into the basket code box.',
                  'Watch the discount come off your total before you check out.',
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--site-ink-soft)]">
                    <span className="font-editorial shrink-0 text-lg font-semibold text-[var(--site-green)]">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="site-btn site-btn-ghost site-btn-sm">
                  <MessageCircle className="w-4 h-4" /> Ask about an offer
                </a>
                <button type="button" onClick={() => goTo('shop')} className="site-btn site-btn-ghost site-btn-sm">
                  <Store className="w-4 h-4" /> Browse the shop
                </button>
              </div>
              <div className="mt-5">
                <PolicyDisclaimers items={DISCOUNT_DISCLAIMERS} title="Discount code terms" tone="neutral" compact />
              </div>
            </div>
            {siteFooter}
          </div>
        );

      case 'sell':
        return (
          <div className="space-y-8">
            <Reveal>
              <section className="site-frame relative overflow-hidden rounded-[1.75rem] p-7 sm:p-10">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-7">
                    <span className="site-eyebrow">Sell Your Bike</span>
                    <h1 className="site-display mt-3 text-4xl sm:text-5xl">Turn your old bike into cash or credit</h1>
                    <p className="site-lede mt-4">
                      Snap seven guided photos, let our AI identify the bike, and get an instant indicative offer —
                      no haggling, no waiting.
                    </p>
                    <ul className="mt-6 grid gap-2 sm:grid-cols-3">
                      {['7 guided photo angles', 'AI identifies the bike', 'Instant indicative offer'].map((b) => (
                        <li key={b} className="flex items-center gap-2 text-[12px] font-semibold text-[var(--site-ink-soft)]">
                          <Check className="h-4 w-4 text-[var(--site-green)]" /> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:col-span-5">
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-[var(--site-line)] bg-[rgba(255,255,255,0.03)]">
                          <Bike className="h-7 w-7 text-[var(--site-ink-faint)]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </Reveal>
            <Reveal>
              <SellYourBikeForm compact />
            </Reveal>
            {siteFooter}
          </div>
        );

      case 'faqs':
        return (
          <div className="space-y-8">
            <Reveal>{pageHeading('FAQs', 'Questions, answered', 'Published by your mechanics from the Staff Station.')}</Reveal>
            <div className="flex flex-wrap gap-2">
              {([{ key: 'all', label: 'All' }, ...faqGroups] as { key: 'all' | 'repairs' | 'parts' | 'general'; label: string }[]).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setFaqFilter(g.key)}
                  className={`site-btn site-btn-sm ${faqFilter === g.key ? 'site-btn-primary' : 'site-btn-ghost'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {faqGroups.map((group) => {
              const rows = content.faqs.filter((f) => f.section === group.key);
              if (faqFilter !== 'all' && faqFilter !== group.key) return null;
              if (rows.length === 0) return null;
              return (
                <section key={group.key} className="space-y-3">
                  <h3 className="site-eyebrow">{group.label}</h3>
                  <div className="space-y-2.5">
                    {rows.map((f) => (
                      <details key={f.id} className="site-glass group cursor-pointer p-5">
                        <summary className="flex list-none items-center justify-between gap-3 text-sm font-bold text-[var(--site-ink)] cursor-pointer">
                          <span>{f.q}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--site-green)] transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="site-lede mt-3 text-[13px]">{f.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
            {siteFooter}
          </div>
        );

      case 'visit':
      case 'location':
        return (
          <div className="space-y-10">
            <Reveal>{pageHeading('Visit', 'Find us & get in touch', content.mobileBody)}</Reveal>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7">
                {content.locationImage ? (
                  <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--site-line)] shadow-[var(--site-shadow)]">
                    <img src={content.locationImage} alt="Stakey's Cycles — Salford" className="h-72 w-full object-cover sm:h-96" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-7">
                      <Quote className="h-6 w-6 text-[var(--site-brass)]" />
                      <p className="font-editorial mt-2 max-w-xl text-lg italic text-white/95">
                        “{content.locationQuote}”
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="site-glass p-7">
                    <Quote className="h-6 w-6 text-[var(--site-brass)]" />
                    <p className="font-editorial mt-2 text-lg italic text-[var(--site-ink)]">“{content.locationQuote}”</p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-5">
                <div className="site-glass h-full p-7">
                  <h3 className="font-editorial text-xl font-semibold text-[var(--site-ink)]">{content.mobileTitle}</h3>
                  <p className="site-lede mt-2 text-[13px]">{content.mobileBody}</p>
                  <div className="mt-5 space-y-2.5">
                    <a href={call} className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--site-ink)]">
                      <Phone className="h-4 w-4 text-[var(--site-green)]" /> {content.phone}
                    </a>
                    <a href={mail} className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
                      <MessageCircle className="h-4 w-4 text-[var(--site-green)]" /> {content.email}
                    </a>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
                      <MessageCircle className="h-4 w-4 text-[var(--site-green)]" /> WhatsApp
                    </a>
                    <p className="flex items-center gap-2.5 text-[13px] text-[var(--site-ink-soft)]">
                      <MapPin className="h-4 w-4 text-[var(--site-green)]" /> Salford · mobile call-out
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <button type="button" onClick={onBookService} className="site-btn site-btn-primary site-btn-sm">
                      <CalendarCheck className="w-4 h-4" /> Book your appointment
                    </button>
                    <a href={call} className="site-btn site-btn-ghost site-btn-sm">
                      <Phone className="w-4 h-4" /> Call us out
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <section className="space-y-5">
              {sectionHeading('Riding weather', 'Riding conditions for the week ahead', 'Live seven-day forecast for your area, turned into plain “can I ride?” guidance.')}
              <WeatherForecast isDark={isDark} />
            </section>

            {content.galleryImages.length > 0 && (
              <section className="space-y-5">
                {sectionHeading('Gallery', 'From the workshop', undefined, (
                  <button type="button" onClick={() => goTo('gallery')} className="site-btn site-btn-ghost site-btn-sm">
                    See the gallery <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ))}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {content.galleryImages.slice(0, 3).map((img) => (
                    <figure key={img.id} className="site-glass site-glass-hover overflow-hidden">
                      <img src={img.url} alt="Stakey's Cycles workshop work" className="h-48 w-full object-cover" loading="lazy" />
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {ctaBand}
            {siteFooter}
          </div>
        );

      case 'weather':
        return (
          <div className="space-y-8">
            <Reveal>{pageHeading('Riding weather', 'Riding conditions for the week ahead', 'Live seven-day forecast for your area, turned into plain “can I ride?” guidance — plan a commute, a delivery shift or a weekend loop.')}</Reveal>
            <WeatherForecast isDark={isDark} />
            {siteFooter}
          </div>
        );

      case 'gallery':
        return (
          <div className="space-y-8">
            <Reveal>{pageHeading('Gallery', 'From the workshop', "Recent builds, repairs and the bikes we've brought back to life.")}</Reveal>
            {content.galleryImages.length === 0 ? (
              <div className="site-glass p-10 text-center">
                <p className="font-editorial text-lg text-[var(--site-ink)]">Photos coming soon.</p>
                <p className="site-lede mt-1 text-[13px]">We're refreshing our gallery with new workshop shots.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {content.galleryImages.map((img) => (
                  <figure key={img.id} className="site-glass site-glass-hover overflow-hidden">
                    <img src={img.url} alt="Stakey's Cycles workshop work" className="h-56 w-full object-cover" loading="lazy" />
                    <figcaption className="px-4 py-3 text-[11px] font-semibold text-[var(--site-ink-soft)]">
                      Stakey's Cycles — Salford
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {siteFooter}
          </div>
        );

      case 'priceList':
        return (
          <div className="space-y-10">
            <Reveal>{pageHeading('Price list', content.priceIntroTitle, content.priceIntroBody)}</Reveal>
            {content.priceNotes.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {content.priceNotes.map((note, i) => (
                  <p key={i} className="flex items-center gap-2 text-[11px] text-[var(--site-ink-faint)]">
                    <span className="h-1 w-1 rounded-full bg-[var(--site-green)]" /> {note}
                  </p>
                ))}
              </div>
            )}
            {(['bike', 'scooter'] as const).map((scope) => {
              const groups = groupedPriceRows(scope);
              return (
                <div key={scope} className="space-y-4">
                  <h3 className="site-eyebrow">
                    {scope === 'bike' ? 'Bicycle repair — labour only' : 'E-scooter repair — labour only'}
                  </h3>
                  {Object.entries(groups).map(([group, rows]) => (
                    <div key={group} className="site-glass overflow-hidden">
                      <div className="border-b border-[var(--site-line)] bg-[rgba(18,184,102,0.08)] px-5 py-3 text-[11px] font-black uppercase tracking-wider text-[var(--site-green)]">
                        {group}
                      </div>
                      <div className="divide-y divide-[var(--site-line)]">
                        {rows.map((row) => (
                          <div key={row.id} className="grid grid-cols-12 gap-2 px-5 py-3.5 items-start">
                            <div className="col-span-12 sm:col-span-8">
                              <div className="text-sm font-bold text-[var(--site-ink)]">{row.item}</div>
                              {row.desc && <p className="site-lede text-[11px]">{row.desc}</p>}
                              {row.note && <p className="mt-0.5 text-[10px] italic text-[var(--site-brass)]">{row.note}</p>}
                            </div>
                            <div className="col-span-12 sm:col-span-4 sm:text-right">
                              <span className="font-editorial text-lg font-semibold text-[var(--site-green)]">{row.price}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex justify-center">
              <a href={call} className="site-btn site-btn-primary">
                <Phone className="w-4 h-4" /> Call now for an exact quote
              </a>
            </div>
            {siteFooter}
          </div>
        );

      case 'join':
        return (
          <div className="space-y-10">
            <Reveal>
              <section className="site-frame relative overflow-hidden rounded-[1.75rem] p-8 sm:p-12">
                <div className="max-w-2xl">
                  <span className="site-eyebrow">Join the team</span>
                  <h1 className="site-display mt-3 text-4xl sm:text-5xl">{content.joinTitle}</h1>
                  <p className="site-lede mt-4 text-base">{content.joinBody}</p>
                  <ul className="mt-6 space-y-2.5">
                    {content.joinBullets.map((b, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-[var(--site-ink-soft)]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-green)]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <a href={call} className="site-btn site-btn-primary">
                      <Phone className="w-4 h-4" /> {content.joinCtaLabel}
                    </a>
                  </div>
                </div>
              </section>
            </Reveal>
            {siteFooter}
          </div>
        );

      case 'home':
      default:
        return (
          <div className="space-y-14">
            {heroSection}
            {trustMarquee}
            {editorialGallery}
            <CustomerErrorCodeHelper onBookService={onBookService} />
            {offersTeaser}
            {reviewSection}
            {ctaBand}
            {siteFooter}
          </div>
        );
    }
  };

  return (
    <div
      className={`site-canvas ${isDark ? '' : 'site-light'} font-ui min-h-screen rounded-[1.75rem] px-4 pb-10 pt-0 sm:px-6 lg:px-8`}
      data-seasonal-theme={seasonalWorld?.id}
      style={seasonalWorld ? { '--site-seasonal-accent': seasonalWorld.accent } as CSSProperties : undefined}
    >
      {content.siteAnnouncements.length > 0 && (
        <div className="mx-auto max-w-7xl pt-3">
          <div className="flex items-center justify-center gap-2.5 rounded-full border border-[var(--site-line)] bg-[color-mix(in_srgb,var(--site-card-solid)_60%,transparent)] px-4 py-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--site-brass)]" />
            <span key={ribbonIndex} className="animate-fade-in text-[12px] font-semibold tracking-wide text-[var(--site-ink-soft)]">
              {content.siteAnnouncements[ribbonIndex]}
            </span>
          </div>
        </div>
      )}

      {siteHeader}

      <main className="mx-auto max-w-7xl pt-10">{renderPage()}</main>
      {cartDrawer}
    </div>
  );
};
