# Assistant Gemini key configuration

The assistant calls Supabase `gemini-gateway`. It does not use the Vercel `GEMINI_API_KEY` or browser `VITE_GEMINI_API_KEY`.

In the Supabase project used by the app, open Edge Functions > Secrets and set `GEMINI_API_KEY` to your Google AI Studio key. Keep the value private. The deployed `gemini-gateway` function reads this secret. Setting a Vercel environment variable does not set a Supabase secret. Existing deployed functions receive updated secrets without rebuilding the APK.

If `gemini-gateway` is absent from Edge Functions, its source is in `supabase/functions/gemini-gateway/index.ts` and must be deployed separately. Do not disable authentication to resolve a missing-key error. A rejected key requires checking Google API restrictions and project access; a quota error requires checking quota/billing rather than replacing frontend variables.

Local corrections improve missing-key, rejected-key, quota, missing-function and session diagnostics, preserve cancellation, and replace misleading frontend setup instructions. Client-side errors show a service-unavailable reply rather than pretending it is a normal assistant answer.

Live secret presence and validity have NOT been verified or changed: no Supabase management connection or Gemini credential is available in this session. No production deployments or branch pushes were performed. The separate legacy Workshop Repair Guide still uses its existing browser-key integration; this change concerns the shared assistant gateway.
