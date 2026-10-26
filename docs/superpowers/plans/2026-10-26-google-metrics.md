# Google Metrics Repair Implementation Plan

**Goal:** Show Google Business performance in its dedicated staff screen and the existing Growth dashboard.
**Architecture:** Reuse existing OAuth tokens and BusinessPerformanceTab; share Google API reads between Vercel and Express.
**Spec:** ../specs/2026-10-26-google-metrics-design.md

- [x] Reproduce missing metrics, malformed location requests, hidden provider failures and expired saved connection behaviour in tests.
- [x] Extract Google reads to api/business/_google.js; paginate accounts/locations, validate locations, request 28 complete UTC days and supported metrics; preserve unavailable values.
- [x] Extend businessInsights.ts with location selection, readable provider errors, reporting dates and metric definitions.
- [x] Replace GoogleBusinessTab placeholder with Google-only BusinessPerformanceTab; retain full Google/Meta Growth dashboard.
- [ ] Run full release gate, sync branches and publish.

Setup limitation: staff production project has no Google OAuth environment settings. Owner consent and Google Business Profile API approval cannot be fabricated. Provide exact setup instructions and do not claim live data was verified.
