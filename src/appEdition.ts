/** Android builds are compiled with VITE_APP_EDITION, the browser remains unchanged. */
export type AppEdition = 'web' | 'customer' | 'staff';
const value = import.meta.env.VITE_APP_EDITION;
export const APP_EDITION: AppEdition =
  value === 'customer' || value === 'staff' ? value : 'web';
export const IS_MOBILE_EDITION = APP_EDITION !== 'web';
