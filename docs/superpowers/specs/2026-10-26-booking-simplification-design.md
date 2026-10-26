# Booking simplification

The customer and workshop booking screens should feel simpler and seamless while retaining detailed booking information. This is a reversible presentation change on the existing React components; booking records, permissions, notifications, approval, SOS, repair, collection and pricing behaviour stay intact.

## Approaches

A replacement wizard would shorten the initial form, but risks hiding validation and disrupting existing repair/SOS flows. Removing fields would lose useful detail. The chosen scoped approach uses progressive disclosure around optional controls, retaining the established form and summary/detail cards.

## Customer

Use a shorter hero and one sticky language selector. Keep the live booking overview in the normal document flow to avoid competing sticky headers. Keep the four step navigation controls and all current fields and language strings. Open the first actionable section initially; show explicit next-step buttons and retain mounted field state as sections close. Give contact its own fourth section and functioning navigation target. Reopen the relevant section on invalid or missing input. Preserve the visible specialized SOS flow. Expose the expanded state of step/detail buttons to assistive technology. Fold optional discount entry into a native keyboard-accessible disclosure; codes from incoming links and applied codes remain exposed. Closing a disclosure preserves entered data.

## Workshop

Keep Active Jobs / Completed and the displayed result count visible. Place status and vehicle filters behind a labelled button that exposes its expanded state, with a clear-filters action visible whenever any filter applies. Keep every existing filter and primary booking action. The phone intake opens at the form; the complete call script remains available as optional expandable help.

## Verification

Exercise disclosure opening, filter selection and reset, phone script access, discount entry retention and existing booking creation. Run booking UI regressions and TypeScript checks. The integrating agent owns broader suite checks, branch synchronization and deployment. No backend, schema, authentication or surface configuration changes are included.
