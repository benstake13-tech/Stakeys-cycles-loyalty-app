# Google Business metrics repair

Repair the existing staff Google Business screen by reusing its established OAuth and Business Performance UI, rather than the API-key profile placeholder. Keep existing Growth/Meta data and all surface access controls. Only the signed-in Google account's token is sent to Google's fixed API endpoints; do not introduce a public server credential.

Display the last 28 complete UTC days of profile impressions, website clicks, call-button clicks, direction requests, Search/Maps and desktop/mobile breakdowns, bookings and messaging clicks. These are profile interactions, not confirmed calls, physical visits or all website sessions. Preserve missing data as unavailable, rather than fabricated zeros. Expose the actual reporting dates and provider errors. Allow selection when multiple locations exist; never silently choose a different business. Refresh expired saved tokens through the existing refresh flow.

Use one shared Google API implementation in local Express and deployed Vercel routes, staying within the existing function budget. Paginate account/location discovery. Reuse existing OAuth consent and configuration. Live verification requires the owner's Google authorisation and API access. Sync all branches, run the release gate and publish once.
