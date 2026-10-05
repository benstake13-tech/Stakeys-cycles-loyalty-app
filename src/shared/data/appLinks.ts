/**
 * The three Stakey's Cycles apps and how they link to each other.
 *
 * There are three separate deployments, all sharing one Supabase backend:
 *
 *   1. Marketing website  — repo `Stakeys-cycles`, branch `main`.
 *   2. Customer app       — this repo, branch `fix/booking-approval-signup-notifications`
 *                           (loyalty pass, booking, prize wheel, customer garage).
 *   3. Staff terminal     — this repo, branch `staff-only-terminal`.
 *
 * The customer app and the staff terminal are two builds of one codebase that
 * share `src/shared/`. The staff terminal is served from the apex domain and
 * the customer app from `www`, which keeps the two builds on one domain.
 *
 * Every URL can be overridden per environment (e.g. a Vercel preview) with the
 * matching `VITE_*` variable, so a preview deployment links to its own build
 * instead of production.
 */
export type AppId = 'website' | 'customer' | 'staff';

export interface StakeyApp {
  id: AppId;
  label: string;
  description: string;
  url: string;
}

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

const WEBSITE_URL = env.VITE_WEBSITE_URL || 'https://stakeyscycles.vercel.app';
const CUSTOMER_APP_URL = env.VITE_CUSTOMER_APP_URL || 'https://www.stakeyswheels.co.uk';
const STAFF_TERMINAL_URL = env.VITE_STAFF_TERMINAL_URL || 'https://stakeyswheels.co.uk';

export const STAKEY_APPS: Record<AppId, StakeyApp> = {
  website: {
    id: 'website',
    label: 'Public website',
    description: 'Repairs, prices, shop and booking for customers.',
    url: WEBSITE_URL,
  },
  customer: {
    id: 'customer',
    label: 'Customer app',
    description: 'Loyalty pass, service bookings and the prize wheel.',
    url: CUSTOMER_APP_URL,
  },
  staff: {
    id: 'staff',
    label: 'Staff terminal',
    description: 'Workshop terminal: bookings, till, customers and shop.',
    url: STAFF_TERMINAL_URL,
  },
};

/** Join a path onto an app's base URL, collapsing duplicate slashes. */
export function appPath(app: AppId, path = '/'): string {
  const base = STAKEY_APPS[app].url.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Deep links other apps rely on. Keep these paths in step with the website
 * router (repo `Stakeys-cycles`, `src/App.tsx`) and the customer app router.
 */
export const APP_DEEP_LINKS = {
  websiteHome: appPath('website', '/'),
  websiteShop: appPath('website', '/shop'),
  websiteGallery: appPath('website', '/gallery'),
  websitePriceList: appPath('website', '/price-list'),
  websiteBooking: appPath('website', '/book'),
  customerHome: appPath('customer', '/'),
  staffHome: appPath('staff', '/'),
} as const;
