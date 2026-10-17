# Marketplace setup

The marketplace uses the existing customer authentication and `profiles` roles. Its authoritative database definition is `supabase/migrations/20261014_marketplace.sql`; do not use the general schema-sync SQL as a replacement for this migration because the marketplace depends on generated money columns, RLS policies, storage rules, and transaction functions.

## Enable the feature

1. Apply `20261014_marketplace.sql` to the Supabase project.
2. Configure the Edge Function secrets `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, and `SITE_URL` (the last one should be the customer-facing website origin). Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.
3. Deploy the `marketplace-payments` Edge Function. It accepts only authenticated, email-confirmed buyers and sellers. The service-role key and SumUp API key stay server-side.
4. Confirm the SumUp account can create hosted checkouts in GBP and validate a low-value end-to-end payment before enabling listings publicly.

Any signed-in, email-verified customer can upload listing photos to their own storage folder; no staff permission is required for photo upload. Seller listings remain private until a staff member approves them in Staff Terminal → Marketplace. The database verifies the seller owns an email-confirmed account; the UI does not expose the seller's contact data or frame serial number. The existing “Sell Your Bike” form remains the direct sale-to-shop route.

## Payment and accounting behavior

The 20% fee is the supplied proposal, stored as 2,000 basis points when a checkout is reserved. SumUp charges the buyer the full gross amount to the shop's merchant account. After the buyer returns from hosted checkout, the Edge Function fetches the checkout directly from SumUp; only a verified `PAID` result marks the listing sold. Database locking and a unique open-sale index prevent two checkouts from completing the same listing. Payment and listing updates run through a service-role-only SQL function.

The ledger keeps gross payment, fee and seller payable separate. The seller balance becomes `due` for staff review; this integration does not transfer money to sellers or create a split payment. Staff should complete any payout using the business's approved process and keep its payment reference with the transaction records. A checkout that is abandoned is released after an hour.

## Staff case records

`marketplace_records` keeps a bike and seller snapshot for each submitted listing, including its category, make/model, condition, description, asking price, frame serial check, inspection and photo references. `marketplace_record_events` is an append-only timeline of moderation, auction start/end and extensions, every bid with its bidder identity and amount, checkout, verified payment, refund and payout changes. Winner and buyer details are captured at the relevant auction or sale event. Snapshots remain after a listing is archived; historical imports are explicitly marked because current contact details cannot be represented as an earlier snapshot.

Both tables are readable only by staff/admin profiles through RLS and have no client write grants. Staff Terminal → Marketplace → Marketplace records lets the team review paginated case files. A staff-recorded offline sale requires the buyer's name, contact and actual sale amount, and is marked as unverified payment. The database prevents marking a listing sold without either that record or a completed marketplace transaction. These records contain personal contact details: keep staff access limited and handle retention or erasure requests through the business's data process. The photo paths are references to private Storage objects, not copies of the image bytes.

The product does not determine the business's legal role, VAT treatment, seller tax duties, consumer cancellation rights, ownership verification, or final terms. Get the fee structure and customer/seller wording approved for the actual operating and payment model before taking live orders. The current account check verifies email only; phone verification and seller payout onboarding are not implemented.

## Current operational limits

- Payment reconciliation runs when the buyer returns to the marketplace and invokes the server-side SumUp status check. A SumUp webhook receiver and scheduled reconciliation job are not included, so staff should reconcile paid checkouts that do not return through the customer flow.
- Payouts are queued for manual handling; automatic seller disbursement is not connected.
- Listing moderation and payment ledger access are restricted by Supabase RLS to staff/admin profiles; public users can read active listing fields only. Marketplace photos use a private Storage bucket and signed URLs, with read access limited to active listings, the seller, or staff.
