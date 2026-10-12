# Stakey's Cycles — Gemini AI assistants

The app's photo-based bike identification assistant uses the **Google Gemini API** with the **`gemini-3.5-flash-lite`** model (latest stable Flash-Lite at the time of this update).

## Keep the API key secret

Configure the following secret **on the application server or serverless deployment**, not in Vite frontend variables:

```text
GEMINI_API_KEY=<your Google AI Studio Gemini API key>
```

Never commit a real key to Git, paste it into browser JavaScript, or prefix it with `VITE_`. Restart/redeploy the server after adding it.

## How it works

- `src/server/geminiVision.ts` centralizes the Gemini model and server-side AI request.
- `src/api/visionService.js` sends the uploaded image to the app's own endpoint; it never receives or stores your API key.
- `server.ts` serves `POST /api/gemini/scan-bike` when running `bun run dev`.
- `api/gemini/scan-bike.ts` provides the same route for Vercel deployments, where `GEMINI_API_KEY` must be configured as a project environment variable.
- The customer UI resizes large images before upload, shows the AI suggestion and asks the customer to review it before saving any bike information.

## Hosting / deployment notes

A **static-only** deployment of Vite's `dist/` directory cannot execute the Gemini backend. If you host only HTML/CSS/JS assets (including a GitHub Pages-style deployment), you must add a supported server/API deployment and route `/api/gemini/*` requests to it. Otherwise the scanner will receive a 404/HTML response even if the frontend build succeeds.

The new GitHub Actions build checks the frontend bundle and the server-side AI module without requiring a secret during CI. This tests compilation, not whether a live API key and its permissions work.

## Test after deployment

1. Log in to the customer app and open **My Garage**.
2. Choose **Scan your bike with AI**, upload a JPEG, PNG or WebP photo.
3. Check that you get a suggested make/model and a **Review and add to garage** button.
4. Confirm the details before saving the bike.
5. In browser developer tools, confirm the request is sent to `/api/gemini/scan-bike` and that no Gemini API key is present in the browser bundle or request.

Avoid sending photos containing personally identifying information unnecessarily. Identification is approximate; a qualified mechanic should confirm repairs and part fitment.

## Other app features

The local bike specification catalogue, repair issue checklist and derailleur-hanger lookup are deterministic data tools, not Gemini-powered assistants. Their existing results are unchanged to avoid unexpectedly replacing verified catalogue information with generated guesses. New generative assistants should reuse the server-side Gemini model and `GEMINI_API_KEY` pattern.
