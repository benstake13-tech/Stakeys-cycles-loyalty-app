# Shared Google Metrics Implementation Plan

**Goal:** Show persistent Google metrics directly on authenticated staff devices.
**Spec:** ../specs/2026-10-26-shared-google-metrics-design.md
**Architecture:** Server-only RLS-protected credential/cache table; JWT/role/owner allowlist gateway in existing business dispatcher; shared client reader and five-minute refresh lifecycle.

- [x] Write failing endpoint tests for anonymous/customer access, staff reads, owner-only writes and cached reports on Google failure.
- [x] Add migration, shared handler, local Express route and report mapper without increasing function budget.
- [x] Write failing cross-location, remote-disconnect and stale-tab-selection regression tests; fix version and lifecycle races.
- [x] Apply and verify database RLS/grants; review live profile role guard and existing owner allowlist.
- [x] Add automatic polling and focus/online refresh with last-success retention and clear freshness labels.
- [ ] Run complete release checks and sync three branches.
- [ ] Build signed staff APK, verify package/version/signature and save download.
- [ ] Deploy and verify unauthenticated endpoint rejects access and staff login remains accessible.

Google API enablement and the owner's one-time linking action remain necessary external setup; no real metrics can be claimed before these succeed.
