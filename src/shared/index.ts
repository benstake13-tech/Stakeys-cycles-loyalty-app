/**
 * Shared core package boundary.
 *
 * Everything under `src/shared/` is code that BOTH the customer app and the
 * staff-only build (branch `staff-only-terminal`) depend on: the Supabase
 * data layer, the ShopContext store, domain types, catalogues and utilities.
 *
 * UI code (`src/components`, `src/App.tsx`) is deliberately NOT here — each
 * app owns its own screens. When you change anything in this folder, port the
 * same change to the staff branch (or vice-versa) so the two builds do not
 * drift.
 *
 * Import via the `@shared` alias (e.g. `import { useShop } from '@shared'`),
 * or a deep path (`@shared/utils/loyaltyCard`) when you want a single module.
 */
export * from './types/bikeShop';
export {
  STAKEY_APPS,
  APP_DEEP_LINKS,
  appPath,
  type AppId,
  type StakeyApp,
} from './data/appLinks';
export { ShopProvider, useShop } from './context/ShopContext';
export * from './data/websiteCatalog';
export {
  fetchWebsiteProducts,
  saveWebsiteProduct,
  deleteWebsiteProduct,
  setWebsiteProductPublished,
  fetchWebsiteOrders,
  updateWebsiteOrderStatus,
  updateWebsiteOrderPaymentReference,
  deleteWebsiteOrder,
  fetchGalleryItems,
  saveGalleryItem,
  deleteGalleryItem,
  uploadWebsiteImage,
  subscribeToWebsiteShop,
  checkWebsiteTables,
  provisionWebsiteSchema,
  formatMoney,
  summariseOrderItems,
  orderItemCount,
  isMissingTable,
  type WebsiteTableStatus,
} from './api/websiteService';
export {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  getStoredSupabaseUrl,
  getStoredSupabaseAnonKey,
  saveSupabaseConfig,
} from './supabase';
