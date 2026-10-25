# Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a consistent dock, a tidy scrolling drawer and a browse-only public marketplace.
**Architecture:** Reuse navigation components and callbacks. Apply the website access boundary before marketplace data loading and UI rendering.
**Tech Stack:** React, TypeScript, existing Lucide/SVG icons, CSS, Vitest.
**Spec:** docs/superpowers/specs/2026-10-25-navigation-design.md

## Global Constraints
No new packages or paid services. Native/customer/staff auth remains intact. Keep all three branches in parity apart from src/config/surface.ts and run scripts/sync-verify.sh before any push.

## Review Focus
- Cached admin sessions on the public website must not reveal private tools/data.
- Native sign-in/listing creation must remain usable.
- Keyboard shortcuts, focus restoration and reduced motion must survive the redesign.
- Long drawer lists and small/short viewports must scroll without moving the header.
- A saved Hangers tab must not reopen the removed staff tool.

### Task 1: Public marketplace boundary
Files: MarketplacePanel.tsx, WebsiteReplica.tsx, marketplace_access.test.tsx.
- [ ] Add tests for browse-only guest/cached-admin actions without a login screen or seller/private reads.
- [ ] Run tests and confirm the missing boundary fails.
- [ ] Introduce publicBrowseOnly, derive effective staff/user state before reads, and show app-use guidance for blocked actions.
- [ ] Run marketplace tests; native/customer expectations must remain green.

### Task 2: Drawer cleanup
Files: StaffAppDrawer.tsx, StaffNavigation.css, StaffPortal.tsx, staff_app_drawer_folders.test.tsx.
- [ ] Pin removal of the Hangers entry, description visibility and whitespace-tolerant search in tests.
- [ ] Confirm failures, then implement compact rows and remove the staff Hangers route/import/persisted restoration.
- [ ] Preserve one folder scroll container, fixed header/search and touch pan-y.
- [ ] Run staff navigation/drawer tests.

### Task 3: Dock consistency
Files: StaffDockIcons.tsx, MacOSDock.tsx/CSS, WebsiteDock.tsx/CSS, dock tests.
- [ ] Pin a consistent vector icon family and restrained pointer response.
- [ ] Replace mixed sprites with vector glyphs and consolidate conflicting website styles while preserving slideshow rules.
- [ ] Keep routes, settings controls, keyboard navigation and reduced-motion safeguards.
- [ ] Run dock tests and inspect desktop/phone layouts where browser tooling permits.

### Integration
- [ ] Review diff, run full tests/typecheck/budget and all surface builds using sync-verify.
- [ ] Commit on staff-terminal, cherry-pick to customer-app/main-website and verify parity/history.
- [ ] Publish verified changes and check deployment status.
