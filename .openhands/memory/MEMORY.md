# Project Memory — Stakeys Cycles Loyalty App

React 19 + Vite + TS + Supabase loyalty/rewards app for a bike shop.

## Key facts
- `UserProfile` primary key is `uid` (NOT `id`). `CustomerBike` has `category/categoryLabel/brand/model/...`, optional `scrapedData`, `aiIdentification`.
- `addCustomerBike(bike)` adds to the *current user's* garage (`ShopContext.tsx`). `addCustomerBikeForUser(userId, bike)` adds to any user's garage — use this for staff-side flows. Both optimistically update `users`/`currentUser` then persist via `insertCustomerBikeToDb`.
- AI Bike Identifier: `src/components/AiBikeIdentifier.jsx` (uses `useShop`). Vision backend `src/api/visionService.js` uses `@google/genai` structured JSON output. Reads `import.meta.env.VITE_GEMINI_API_KEY`; shows a graceful "not configured" state when unset. Optional `addBike` prop overrides the default persistence (used by staff dossier).
- `SegmentedTabs` / `SegmentedTab` shared component in `src/components/SegmentedTabs.tsx`, used by CustomerPortal + StaffPortal nav.

## Environment / tooling quirks
- Prize wheel persistence previously lived ONLY in localStorage (`ShopContext` `_wheels` key was written but never read), and the customer spin called a `spin_loyalty_wheel` RPC that does not exist in the DB — so every spin failed. Fix wired wheel config + draws + vouchers + `last_spun_at` to Supabase (see `supabase/migrations/20261003_prize_wheel_persistence.sql` and `SUPABASE_SQL_SETUP`). The default wheel lives in `src/utils/prizeWheelHelper.ts` as `DEFAULT_PRIZE_WHEEL` and seeds the DB on first load when the table is empty.
- `.env.example` previously listed `GEMINI_API_KEY` (non-VITE); it must be `VITE_GEMINI_API_KEY` because the key is used in the browser bundle. Do not put the secret `GEMINI_API_KEY` in client code.
- npm install here needs `--legacy-peer-deps` (react-custom-roulette pins React 18 peer). After such an install, transitive deps can be pruned — `react-is` (needed by recharts) had to be re-added or `vite build` fails with "Rolldown failed to resolve import react-is".
- `server.ts` registers the Vite dev middleware AFTER the `/api/*` routes; if Vite middleware is added first it swallows API calls and returns index.html.
- New env keys documented in `.env.example`: OneSignal (`VITE_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_SAFARI_WEB_ID`) and OAuth (`VITE_GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `VITE_META_APP_ID`/`META_APP_SECRET`).
- Pre-existing typecheck errors that are NOT caused by new work: `backendDataService`, `INITIAL_DRAWS`/`INITIAL_USERS` in ShopContext, implicit `any` params in ShopContext/CustomerPortal. Filter these when checking for regressions.
- Preview hosts: port 12000 → https://work-1-brtoqzogszwxfnlw.prod-runtime.all-hands.dev/ ; port 12001 → work-2.
- Sandbox cannot reach the live Supabase project, so staff/customer login cannot be exercised locally; the login form returned "Invalid credentials" and values were not retained. Use the `preview.html` + `src/preview.tsx` render trick to smoke-test auth-gated modals (delete both after).

## History
- Removed hardcoded `STAFF_MASTER_PIN = '210803'`; staff auth is now Supabase email/password.
- Refactored CustomerPortal/StaffPortal tab strips to `SegmentedTabs`.
- Added AI Bike Identifier, wired into CustomerPortal (customer garage) and CustomerAccountDossier (staff can identify for a customer).
- 2026-10-03: Rebuilt the barcode/QR scanner (`QRCodeScannerModal.tsx`) from the broken html5-qrcode `Html5QrcodeScanner` wrapper to the lower-level `Html5Qrcode` class (formatsToSupport, lifecycle-safe stop/getState, camera switch, image upload, manual entry). It was previously dead code — never rendered anywhere. Wired an "Scan Member Code" button into StaffPortal header; resolves via `src/utils/membershipCode.ts` (normalize/resolveCustomer, customer-only).
- 2026-10-03: The customer "Digital Membership Pass & Barcode" section was actually two Google Looker Studio iframes (no scannable code at all). Replaced with `MembershipPassCard.tsx` (qrcode.react QR + jsbarcode CODE128) whose payload `STK-123456|urn:stakeys:membership:STK-123456` the scanner understands.
- 2026-10-03: Added OneSignal web push (`src/utils/onesignalPush.ts` + `public/OneSignalSDKWorker.js` + `/api/onesignal/*`) with server-to-server sends so staff phones get booking alerts even with the app closed. "Enable Push" button added to StaffPortal. SW file is the official 3-line `importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')` shim; v16 SDK instance is ONLY reachable via the `OneSignalDeferred` queue (window.OneSignal is a stub) — never call init twice, and never `window.OneSignal.login()` directly.
- 2026-10-03: Added Google + Meta business performance in staff area (`BusinessPerformanceTab.tsx`, `oauthService.ts`, `businessInsights.ts`) with OAuth2 PKCE popup "Authorise" buttons; code->token exchange + refresh + provider API calls proxied server-side (secrets never in the browser). Tab id `business_performance`.

