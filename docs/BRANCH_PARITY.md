# Active surface branch parity — 13 October 2026

Scope: local `staff-terminal`, `customer-app` and `main-website`. Shared tracked files are identical; `src/config/surface.ts` intentionally selects staff, customer or website. Historical feature branches and backup refs are not deployment surfaces and are not overwritten.

Canonical reconciliation preserves the staff till, stock, tax/KPI, push and theme work; the customer booking entry and premium header; and the website photography, marketing layout and sell-from-garage flow. The latest GitHub staff sales-KPI files (47d68fed) and customer header change (5f168eb0) were retrieved through the GitHub connector and incorporated. Website source matches its inspected head a138569. No unrelated feature-branch work was imported.

Validation: 168 test files / 1412 tests passed; TypeScript passed; staff, customer and website production builds passed; Vercel function budget 9/12. Builds retain the existing large-chunk warning. Tests emit jsdom canvas/scroll warnings but pass. Android APK compilation and physical-device testing are outside these checks.

Pre-existing commit histories are preserved. Content parity does not imply identical historical commit sequences. The strict history script can still report historical divergence; no history was rewritten to conceal it. Backup branches preserve the pre-sync local tips.

All changes remain local. Nothing was pushed or deployed; GitHub branch heads are therefore unchanged. A shell fetch did not complete successfully; remote incremental changes were inspected using the GitHub connector instead. Recheck remote heads before any future push.
