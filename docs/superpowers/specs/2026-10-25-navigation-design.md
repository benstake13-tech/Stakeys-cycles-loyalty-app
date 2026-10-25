# Navigation and public marketplace

Continue the three requested agent tasks in the existing shared React app. The initial agents audited the code; their execution service then reached its usage limit, so the controller implements their findings.

## Design
- Dock: compact frosted charcoal shelf, consistent emerald line icons in matching tiles, readable labels, restrained pointer magnification, full reduced-motion support. Keep all existing destinations and shortcuts. Staff phone navigation remains drawer-only.
- Drawer: preserve the existing scrolling flex layout, sticky search/header and grouped sections. Replace oversized tiles with compact labelled rows and clear descriptions. Remove Derailleur Hangers from the staff app and prevent restoring its persisted tab.
- Public marketplace: browse listings and auctions on the main website; replace member actions with app-use guidance. Do not render sign-in/registration there or use a cached customer/staff session for private reads or actions. Customer/staff app authentication stays available.

## Approaches
Fixing only a few CSS sizes would retain the mixed raster/SVG materials and conflicting hover rules. Replacing navigation entirely would risk shortcuts and existing routes. The implementation uses existing components, consolidates dock styles, and replaces mixed artwork with one icon system. This is the controller's design choice under the user's delegated redesign request and instruction to continue.

## Constraints
No paid services, new packages, auth/backend policy changes or unrelated feature removal. Keep branches separate and identical except src/config/surface.ts; use staff-terminal and cherry-pick changes. Verify the full release gate before publishing.
