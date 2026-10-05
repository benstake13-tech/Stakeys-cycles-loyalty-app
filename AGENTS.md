# AGENTS.md

## Repository shape

This repository is a **single Vite + React 19 + TypeScript app** with two
builds that share one codebase and one Supabase backend:

- **Customer build** — branch `fix/booking-approval-signup-notifications`
  (and `main`). Loyalty pass, booking, prize wheel, customer garage.
- **Staff-only build** — branch `staff-only-terminal`. Same repo, but the
  customer side is removed; the app is the workshop terminal only.

## `src/shared/` is the shared package

Everything under **`src/shared/`** is code BOTH builds depend on:

| Folder | Contents |
|---|---|
| `src/shared/context/` | `ShopContext` — the whole app store (auth, bookings, loyalty, till, staff) |
| `src/shared/types/` | Domain types (`bikeShop.ts`) |
| `src/shared/data/` | Static catalogues / reference data |
| `src/shared/utils/` | Pure domain logic (loyalty, discounts, notifications, schema sync, …) |
| `src/shared/api/` | Data-access services (Supabase / backend) |
| `src/shared/lib/` | Low-level clients (`supabase.ts` auth client) |
| `src/shared/supabase.ts`, `src/shared/firebaseConfig.ts` | Client config |

UI code (`src/components/`, `src/App.tsx`) is **not** shared — each build owns
its own screens.

### Importing shared code

Use the `@shared` alias:

```ts
import { useShop } from '@shared';                       // barrel
import { roundMoney } from '@shared/utils/discountService'; // deep path
```

Deep paths are preferred when you only need one module (avoids pulling the
whole barrel). The alias is configured in `tsconfig.json`, `vite.config.ts`
and `vitest.config.ts`.

### Keeping the two builds in sync

Any change inside `src/shared/` must be applied to **both** branches, or the
customer and staff builds silently drift. Practical rule:

1. Make shared changes on the customer branch.
2. Port the identical diff to `staff-only-terminal` (cherry-pick the commit,
   or re-apply the same edit) before releasing either build.

Do **not** move a shared module out of `src/shared/` or add a customer-only
dependency into it — that breaks the staff build.

## Commands

```bash
npm test          # vitest run
npm run lint      # tsc --noEmit
npm run build     # vite build
npm run dev       # tsx server.ts
```
