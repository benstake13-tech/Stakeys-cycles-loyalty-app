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
