# Branch sync recipe

Three branches ship three surfaces. They must stay **byte-identical apart from
one file** and must **never be merged**.

| Branch | Surface (`src/config/surface.ts` → `DEFAULT_SURFACE`) |
| --- | --- |
| `staff-terminal` | `staff` |
| `customer-app` | `customer` |
| `main-website` | `website` |

`src/config/surface.ts` is the only intended per-branch difference. Everything
else is identical on all three.

## Recipe

1. Make each change as its own logical commit on `staff-terminal`.
2. Cherry-pick that commit onto the other two (same order) — **never** `merge`:
   ```bash
   git checkout customer-app  && git cherry-pick <sha>
   git checkout main-website  && git cherry-pick <sha>
   ```
   Resolve conflicts so only `src/config/surface.ts` keeps each branch's own
   `DEFAULT_SURFACE`; take the incoming change for everything else.
3. Verify parity (must be empty apart from `surface.ts`):
   ```bash
   npm run check:parity
   ```
4. Push all three:
   ```bash
   git push origin staff-terminal customer-app main-website
   ```
5. Re-check parity against the fresh remotes:
   ```bash
   git fetch origin
   git diff origin/staff-terminal origin/customer-app  -- . ':(exclude)src/config/surface.ts'
   git diff origin/staff-terminal origin/main-website  -- . ':(exclude)src/config/surface.ts'
   ```

`npm run check:parity` runs `scripts/check-parity.sh`, which fails if any branch
has drifted outside `src/config/surface.ts`.
