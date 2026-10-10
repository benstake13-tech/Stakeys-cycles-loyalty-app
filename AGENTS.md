# AGENTS.md

Stakey's Cycles loyalty app — React 19 + Vite + TypeScript, deployed on Vercel.
Three surface branches drive three Vercel projects. Read this before touching
anything that could affect a deploy.

## The three-branch model (do not merge)

| Branch           | Surface   | Vercel project                  | Live domain                 |
| ---------------- | --------- | ------------------------------- | --------------------------- |
| `staff-terminal` | `staff`   | `stakeys-cycles-loyalty-app`    | www.stakeys-cycles.co.uk    |
| `main-website`   | `website` | `stakeys-cycles-loyalty-app-6jf5` | www.stakeyswheels.co.uk   |
| `customer-app`   | `customer`| `stakeys-cycles-loyalty-app-i34d` | `...-i34d.vercel.app`     |

- The branches are **never merged**. Make every change on `staff-terminal`, then
  cherry-pick it onto the other two:
  `bash scripts/sync-branch.sh <sha> [more shas...]`.
- The branches must stay **byte-identical apart from `src/config/surface.ts`**
  (the only intentionally divergent file) and keep a **linear** history.
- Gate before pushing: `bash scripts/sync-verify.sh`
  (parity → history → tests → typecheck → Vercel budget → build all 3 surfaces).

## Vercel Hobby limits (these silently block deploys)

1. **Max 12 Serverless Functions per deployment.** For this Vite app every file
   under `api/` is one function; `_`-prefixed files/dirs are ignored. Exceeding 12
   **fails the whole deployment**, so the domain keeps serving the last good build
   ("worked before, broken now"). Never add a bare `api/*.js` — put each route
   family behind ONE dynamic `api/<family>/[action].js` dispatcher (the path
   segment arrives as `req.query.action`). Guard: `scripts/check-vercel-budget.sh`
   and `vercel_function_budget.test.ts`.
2. **Build rate limit.** A burst of pushes exhausts it; every deploy then fails
   with `upgradeToPro=build-rate-limit` until the window resets (~24 h). Push
   sparingly.

## Environment variables are per-project and injected at BUILD time

Setting a Vercel env var does nothing until a **new build succeeds**. Env vars are
not shared across the three projects by default — set each one per project (or as
a team-shared var). Relevant keys: `META_SYSTEM_USER_TOKEN`, `ONESIGNAL_REST_API_KEY`,
`VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## How to tell whether a push is actually live

`git push` succeeding is NOT a deploy. Check the GitHub commit-status API on the
origin head:

```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/benstake13-tech/Stakeys-cycles-loyalty-app/commits/<sha>/status"
```

Contexts named `Vercel – stakeys-cycles-loyalty-app-*` show `success`/`failure`.
`failure` with `build-rate-limit` means nothing deployed.

The Growth-tab UI lives in the **lazy `assets/StaffPortal-*.js` chunk**, not
`index-*.js` — grep the StaffPortal chunk to confirm a feature is live.

## Tests

- `npm test` (vitest). Assertions use plain matchers: `.toBeTruthy()`,
  `queryByText(...) === null`. **There is no jest-dom** — `toBeInTheDocument()`
  throws "Invalid Chai property".

## CI

`.github/workflows/ci.yml` runs budget → typecheck → tests → build on every push
and PR to the deployment branches.
