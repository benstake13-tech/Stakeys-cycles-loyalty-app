# Customer photo repair reports

The customer booking form's problem step offers **Show us what is wrong**. Riders can add up to six labelled photos, record onset/history, answer follow-up questions and explicitly request a Gemini review. No model call runs merely because a photo was added. The existing server gateway selects the model and tier; no browser key or paid fallback was added.

The review covers ten bicycle systems, distinguishes observations from reported symptoms and hypotheses, and requests safer close-ups where details are unclear. It provides replacement identification leads, readable markings, search terms and compatibility checks. These are not verified catalogue matches, current stock, quotations, safe-to-ride clearances or definitive diagnoses. Internal faults, measurements and part fit require a mechanic and manufacturer documentation. This feature does not promise knowledge of every bicycle repair.

Customers can attach photos and answers without AI when the service fails. Editing inputs invalidates the old analysis. Unsaved photo/answer drafts must be attached before the booking can be submitted. Photo reports await successful database persistence before confirmation; missing `bike_details` cannot silently drop the evidence. Failed submissions retain the form.

## Staff handoff

The full readable job sheet is appended to booking `notes`, which existing staff apps already display. The structured report and compressed photos live under `bike_details.repairAssessment` in the existing JSON column. The small staff booking-card reader displays that evidence and offers an encoded web search for replacement candidates. Staff must independently verify supplier availability, price and compatibility. Photo evidence is not copied into the garage identity or marketplace listings.

Each data URL is limited to 110,000 characters (six total), keeping the report below the Realtime payload ceiling. JPEG/PNG/WebP input is supported; unsupported HEIC files need exporting first. Failed compression is visible rather than silently sending oversized images. Photos are stored in the protected booking row rather than a public image bucket; do not photograph people, addresses or unrelated personal details.

## Database prerequisite

`20261015014930_protect_customer_repair_photos.sql` removes legacy public read/update/all policies that override owner/staff restrictions. The existing owner/staff select, update, insert and delete policies must be present. Anonymous website guests may insert rows only with `customer_id IS NULL`; they cannot read booking records. Signed-in customers retain their own booking access, and staff retain workshop access. The change was applied and checked against the linked project without creating test bookings or notifications.

## Verification

Tests cover photo evidence validation, conservative part matching, all-system coverage, manual fallback, cancellation/stale responses, follow-up answers, report persistence, missing-column rejection, booking retry and accordion photo retention, and the staff reader. The live gateway was exercised using a repository bicycle illustration, not a customer booking. Live supplier matching and real-world diagnostic accuracy are not established by those tests.
