# Google Business Profile performance

Open **Staff app → Google Business** (or the Google section in Business Performance), authorise the Google account that manages Stakeys Cycles, then select the business location. Existing saved connections refresh automatically when possible. No paid connector is required.

## Connection setup

Use a Google Cloud project approved for the Business Profile APIs. Enable Account Management, Business Information and Business Profile Performance APIs; zero API quota requires Google's access approval. Create an OAuth web client, configure the consent screen and allow `https://www.googleapis.com/auth/business.manage`. If the consent application is in testing, add the owner's Google account as a test user; testing authorisations can expire.

For the staff Vercel production project configure:
- `VITE_GOOGLE_CLIENT_ID`: public web OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: matching server-only client secret.

Add the staff site's authorised JavaScript origin `https://www.stakeys-cycles.co.uk` and exact redirect URI `https://www.stakeys-cycles.co.uk/oauth/callback` to that OAuth client. If using another deployed origin, configure its matching origin and callback too. Redeploy after setting environment variables. Never use an API key as a substitute for owner OAuth authorisation, and never set a `VITE_` secret.

## What the numbers mean

Reporting covers the last 28 completed UTC days and shows the actual dates. Profile views combine Google's daily Search and Maps impression counters; a person may count across surfaces/days. Website clicks are outbound profile clicks, not all website sessions. Calls count call-button taps, not connected calls. Directions are requests, not physical shop visits. Google bookings and messaging apply only when those profile features are supported. Search/Maps mobile and desktop breakdowns appear separately. `—` means the API did not return data; a returned zero stays zero. Google reporting may lag.

All website traffic and visitor/session data need a separate website analytics source; they cannot be inferred from Business Profile clicks. Ratings, review content and monthly search keyword reports are separate Google endpoints and are not claimed by this performance dashboard.

Google documentation:
- https://developers.google.com/my-business/reference/performance/rest/v1/DailyMetric
- https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
- https://developers.google.com/my-business/content/prereqs

## Shared connection: direct data on every staff device

The staff Google screen now reads a protected shared shop connection. Sign in to the staff website as the owner allowed by server `ADMIN_EMAILS`, then press **Link once for all staff devices** if Google is already authorised (otherwise authorise Google). The offline refresh token is verified and saved server-side, and removed from that browser's local Google token store. Other staff devices only need their normal staff-app login.

Enable **My Business Account Management API**, **My Business Business Information API**, and **Business Profile Performance API** in the same Google Cloud project as the OAuth client. A successful OAuth consent does not itself enable these APIs. Google approval is required if the project has zero API quota. The screenshot's disabled-API error cannot be fixed by refreshing the app.

Reports update on open, every five minutes while visible, and when returning online or to the page. Last-success figures remain available on the server when Google is temporarily unavailable; the screen labels saved/stale data and its update time. There is no paid cron service and no claim that Google's figures are real-time. Only explicit owner selection changes the shared business location. Google revocation/expiry requires owner reconnection; consent-app Testing mode can impose short-lived offline grants.

Database verification: `public.google_business_connection` has RLS enabled, no client policy and no anon/authenticated privileges. Only the server service role reads/writes it. Authenticated staff read through `/api/business/google-shared`; owner allowlisting additionally protects connect/disconnect/location changes. Never reapply an old broad profiles policy migration over the live role guards.

## Quota errors on the free API

API enablement, OAuth consent and Basic API Access approval are separate. A Google `429` does not by itself establish a billing problem or a zero quota. The report records only whitelisted diagnostic metadata. An explicit `quota_limit_value=0` shows the Basic API Access action; an unknown/positive limit shows quota/usage guidance. Disabled-service metadata selects the actual project and API when Google supplies it. Other provider errors remain visible alongside unavailable metric cards, and no data is invented. The Google performance view does not redirect to Google's external business dashboard.

Authoritative references:
- https://developers.google.com/my-business/content/limits
- https://developers.google.com/my-business/content/pricing

The Google Cloud quota console could not be loaded in the agent browser. No claim is made that approval has been granted or that a configured zero limit has been verified until the API returns that metadata.
