# Bicycle inspection extension and marketplace restoration

The owner's brief: https://share.gemini.google/Pe4OjTRM120z (Comprehensive Bicycle Specification List).

This extends the existing identifier and customer repair-intake prompts, without replacing their original component sweep, cosmetic review, multilingual notes, condition checks, replacement leads, retakes, symptom questions, staff handoff or gateway configuration.

`bicycleInspectionChecklist.ts` supplies the detailed fields for frames, forks, shock and headset standards, drivetrain compatibility, front/rear brakes and wheels, cockpit, finishing kit, e-systems, geometry, weights, payload and accessories. Known values are retained individually; omitted values are explicitly unassessed. Geometry, weights and manufacturer limits are never treated as measurements from a photo. The same details survive garage/directory component storage and repair-report/staff-note round trips.

The fault sweep adds structural junctions, suspension pivots and seals, headset and contact points, hydraulic/cable brake evidence, chain and gear wear, rim/spoke/hub concerns, tyre/tubeless evidence, and motor retention, battery mounts and sensors. The brief's generic wear thresholds and diagnostic shortcuts are not applied as universal rules. Measured limits and physical procedures belong to the exact manufacturer's instructions and workshop assessment.

The public website again includes Marketplace in desktop/mobile navigation and recognises `?page=marketplace`. The customer launcher retains Sell Your Bike (shop trade-in) and adds Marketplace (private seller listings) as separate destinations. Browser visitors can browse approved listings; account actions remain in the installed app, preserving the app-only login requirement.

The missing marketplace tables were installed with migration `20261015024815_restore_marketplace_tables.sql`; `20261015025404_restrict_marketplace_column_writes.sql` removes overly broad inherited defaults and applies only the required column privileges. It preserves the existing marketplace model while putting its email-confirmation lookup and audit trigger functions in the private schema, restricting financial writes and enforcing moderation. Public browsing omits seller identity. Live rollback tests cover anonymous visibility, verified seller submission, owner access, blocked self-approval, staff approval and protected financial amounts. No test listings or payments were committed.

The existing `marketplace-payments` function remains in source. It was absent from deployed Edge Functions. Card checkout is not claimed as enabled: deployment, SumUp configuration, customer-app return routing and approval of the proposed fee/terms remain prerequisites. No payment credentials or commission terms were invented, and no purchase was attempted.
