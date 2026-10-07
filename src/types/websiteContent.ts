/**
 * Website marketing-site content model.
 * Mirrors the public Square site (stakeyscycles.square.site) so staff can
 * manage the marketing site directly from the Staff Station.
 */
export type WebsitePageId =
  | 'home'
  | 'location'
  | 'faqs'
  | 'gallery'
  | 'priceList'
  | 'shop'
  | 'offers'
  | 'join';

export type WebFaqSection = 'repairs' | 'parts' | 'general';

export interface WebFaq {
  id: string;
  section: WebFaqSection;
  q: string;
  a: string;
}

export interface WebPriceItem {
  id: string;
  scope: 'bike' | 'scooter';
/** Display group heading — e.g. "Standard Service Packages" */
  group: string;
  item: string;
/** Ballpark price range as displayed — e.g. "£20" */
  price: string;
/** Footnote — e.g. "parts not included" */
  note?: string;
/** Optional descriptor — e.g. "Replace inner tube (wheel in bike)" */
  desc: string;
}

export type WebProductCategory =
  | 'Second hand parts'
  | 'Mens Bikes'
  | "women's Bikes"
  | "Children's bikes";

export interface WebProduct {
  id: string;
  name: string;
  price: number;
  wasPrice?: number;
  category: WebProductCategory;
/** Public CDN image URL, as used by the Square storefront. */
  image: string;
/** Short sales pitch shown on the product card. */
  description?: string;
/** Units available. Cart quantity can never exceed this. */
  stock: number;
}

export interface WebCartItem {
  productId: string;
  name: string;
  price: number;
/** Image URL shown in the cart line. */
  image: string;
  qty: number;
}

export interface EcommerceOrder {
  id: string;
/** Display name as entered by the customer. */
  customerName: string;
/** Contact phone or email entered by the customer. */
  contact: string;
  items: WebCartItem[];
/** Total (GBP, pence precision handled at render). */
  total: number;
/** Optional note from the customer. */
  note?: string;
/** ISO timestamp of the order submission. */
  createdAt: string;
}

export interface WebGalleryImage {
  id: string;
  url: string;
}

export interface WebSocialLink {
  id: string;
/** Platform label shown to staff, e.g. "Instagram" */
  platform: string;
  url: string;
}

export interface WebsiteContent {
  /** Hero marketing intro (Home). */
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBlurb: string;
/** Primary call-to-action label for booking. */
  calloutCta: string;
/** External booking link used as fallback when the app booking flow is unavailable. */
  calloutUrl: string;
/** Contact details reused across pages. */
  phone: string;
  email: string;
/** Home "LEAVE A REVIEW" blurb. */
  reviewBlurb: string;
/** Home feedback section. */
  feedbackTitle: string;
  feedbackBody: string;
/** Location page. */
  locationQuote: string;
  mobileTitle: string;
  mobileBody: string;
  locationImage: string;
/** FAQs. */
  faqs: WebFaq[];
/** Price list page. */
  priceIntroTitle: string;
  priceIntroBody: string;
  priceNotes: string[];
  priceList: WebPriceItem[];
/** Shop page. */
  shopNoticeTitle: string;
  shopNoticeBody: string;
  /** Customer-facing disclaimers shown above the shop and at checkout. */
  shopDisclaimers: string[];
  /** Rotating ribbon at the very top of the public website — its own voice. */
  siteAnnouncements: string[];
  shopImage: string;
  shopCategories: WebProductCategory[];
  products: WebProduct[];
/** Gallery page. */
  galleryImages: WebGalleryImage[];
/** Join the Team. */
  joinTitle: string;
  joinBody: string;
  joinBullets: string[];
/** Join CTA label (tel/mailto handled by staff CMS. */
  joinCtaLabel: string;
/** Socials + footer contact links. */
  socials: WebSocialLink[];
  updatedAt: string;
}