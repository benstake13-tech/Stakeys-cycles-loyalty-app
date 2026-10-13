# Gemini and OneSignal Supabase configuration

The Shop Assistant and shared AI calls use Supabase `gemini-gateway`. Gemini credentials are never included in web or APK builds. The server reads `GEMINI_API_KEY` (or the legacy server-side `GOOGLE_API_KEY`) from Supabase Edge Function secrets. The default model is `gemini-3.5-flash-lite`; set `GEMINI_MODEL` in Supabase to change it.

In the Supabase project used by the app, open **Edge Functions > Secrets** and set `GEMINI_API_KEY` to your Google AI Studio key. Keep the value private. Setting a Vercel environment variable does not set a Supabase secret. Existing deployed functions receive updated secrets without rebuilding the APK.

If `gemini-gateway` is absent from Edge Functions, deploy it from `supabase/functions/gemini-gateway`. Do not disable authentication to resolve a missing-key error. A rejected key requires checking Google API restrictions and project access; a quota error requires checking quota/billing rather than replacing frontend variables.

## OneSignal push

Push configuration and dispatch use the authenticated `onesignal-gateway` Supabase Edge Function. Set these server-only Supabase secrets: `ONESIGNAL_APP_API_KEY` (OneSignal App API key), `ONESIGNAL_APP_ID`, and `ADMIN_NOTIFICATION_EMAIL`. Optionally set `ONESIGNAL_ANDROID_APP_ID` when Android uses a different OneSignal app ID. Set the public `VITE_ONESIGNAL_APP_ID` and optional `VITE_ONESIGNAL_ANDROID_APP_ID` in the website/app build environment. Never create a `VITE_ONESIGNAL_*API_KEY` variable.

Deploy `onesignal-gateway` after setting secrets. The app uses the OneSignal v16 SDK and the existing `public/OneSignalSDKWorker.js` service worker. If setup still fails, the Staff Push Diagnostics screen checks the Supabase function, app ID, device permission/subscription, and server dispatch without returning the key.

Local corrections improve missing-key, rejected-key, quota, missing-function and session diagnostics, preserve cancellation, and replace misleading frontend setup instructions. Client-side errors show a service-unavailable reply rather than pretending it is a normal assistant answer.

Live secret presence and validity have NOT been verified or changed: no Supabase management connection or Gemini/OneSignal credentials are available in this session. No production deployments or branch pushes were performed. The static Workshop Repair Guide is a separate bundled app; its optional Gemini feature is not wired to this gateway and no browser-side Gemini key is injected into it.
