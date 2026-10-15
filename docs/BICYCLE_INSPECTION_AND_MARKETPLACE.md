# Bicycle inspection extension and marketplace restoration

The owner's brief: https://share.gemini.google/Pe4OjTRM120z (Comprehensive Bicycle Specification List).

This extends the existing identifier and customer repair-intake prompts, without replacing their original component sweep, cosmetic review, multilingual notes, condition checks, replacement leads, retakes, symptom questions, staff handoff or gateway configuration.

`bicycleInspectionChecklist.ts` supplies the detailed fields for frames, forks, shock and headset standards, drivetrain compatibility, front/rear brakes and wheels, cockpit, finishing kit, e-systems, geometry, weights, payload and accessories. Known values are retained individually; omitted values are explicitly unassessed. Geometry, weights and manufacturer limits are never treated as measurements from a photo. The same details survive garage/directory component storage and repair-report/staff-note round trips.

The fault sweep adds structural junctions, suspension pivots and seals, headset and contact points, hydraulic/cable brake evidence, chain and gear wear, rim/spoke/hub concerns, tyre/tubeless evidence, and motor retention, battery mounts and sensors. The brief's generic wear thresholds and diagnostic shortcuts are not applied as universal rules. Measured limits and physical procedures belong to the exact manufacturer's instructions and workshop assessment.

The public website again includes Marketplace in desktop/mobile navigation and recognises `?page=marketplace`. The customer launcher retains Sell Your Bike (shop trade-in) and adds Marketplace (private seller listings) as separate destinations. Browser visitors can browse approved listings; account actions remain in the installed app, preserving the app-only login requirement.

The missing marketplace tables were installed with migration `20261015024815_restore_marketplace_tables.sql`; `20261015025404_restrict_marketplace_column_writes.sql` removes overly broad inherited defaults and applies only the required column privileges. It preserves the existing marketplace model while putting its email-confirmation lookup and audit trigger functions in the private schema, restricting financial writes and enforcing moderation. Public browsing omits seller identity. Live rollback tests cover anonymous visibility, verified seller submission, owner access, blocked self-approval, staff approval and protected financial amounts. No test listings or payments were committed.

The existing `marketplace-payments` function remains in source. It was absent from deployed Edge Functions. Card checkout is not claimed as enabled: deployment, SumUp configuration, customer-app return routing and approval of the proposed fee/terms remain prerequisites. No payment credentials or commission terms were invented, and no purchase was attempted.

## UK technical diagnostic layer (15 October 2026)

The existing identification and customer repair tools now request five additive `technicalAudit` sections: vehicle profile, UK legal/safety review, compatibility, wear/corrosion and remediation. Saved customer reports and garage identification retain these sections. They are preliminary AI findings, not safety, legal or manufacturer certification. Unknowns stay unverified. Model-specific interfaces, exact documentation and measured dimensions take precedence over generic brand rules.

The manual capacity check calculates `(front max − front min) + (rear max − rear min)` and independently compares the entered maximum rear sprocket. Passing these two entered limits does not approve indexing, mounting, chain length or full compatibility. No AI-estimated measurement is silently entered into this calculator.

Primary references checked while implementing:
- https://www.gov.uk/electric-bike-rules
- https://www.gov.uk/government/publications/electrically-assisted-pedal-cycles-eapcs/electrically-assisted-pedal-cycles-eapcs-in-great-britain-information-sheet
- https://www.hopetech.com/_repository/1/documents/RX4Instructions_Min_EN_FR_DE.pdf — RX4+ etched M/D fluid designation, not cap colour.
- https://www.brompton.com/stories/design-and-engineering/g-line-research-and-development — G Line has 20-inch wheels; classic Brompton dimensions are not universal.
- https://www.microshift.com/models/sl-m9505-r/ — documented Sword/ADVENT X compatibility is model-specific.
- https://support.sram.com/hc/en-us/articles/6496285693339-What-is-the-total-drivetrain-tooth-capacity-of-SRAM-RED-or-Force-eTap-AXS-rear-derailleurs — capacity formula, not a universal derailleur limit.

These references guide the prompt; they do not mean each user's bike has been checked against a live manufacturer catalogue. Exact saved stock references are candidates requiring staff confirmation. Fitted part code differences are flagged as possible non-stock; never automatically valued as upgrades.

## Editor, themes and selected milestones

Gallery/product uploads use the existing public `shop-gallery` bucket with unique paths, image type/size validation and an HTTP image-read check before attaching the URL. Publishing waits for uploads, verifies the complete database acknowledgement, and rejects stale/partial responses. Old in-flight reads cannot replace a newer publication. Local cache quota errors do not hide remote content. Active seasonal themes suppress decorative auth photography and website canvas effects; normal photography returns with the theme disabled.

Marketplace submission, approval and recorded sale trigger existing transparent cyclist variants only after successful writes; garage and booking milestones retain their existing deduplication. Public marketplace browsing is available on the marketing host. Hosted branch surface selection overrides stale per-project surface variables; native APK selection remains explicit.

Marketplace card checkout requires deployment/configuration of `marketplace-payments` and `VITE_MARKETPLACE_PAYMENTS_ENABLED=true`. Until configured, customers are directed to arrange a purchase with the workshop. No payment credentials or fees are fabricated or activated by this change.
