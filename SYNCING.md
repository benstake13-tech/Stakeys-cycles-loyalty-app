# Branch sync playbook

Three branches ship three surfaces from one codebase. They must stay
**byte-identical apart from one file** and their histories must **stay linear**
(cherry-pick, never merge).

| Branch | Surface (`src/config/surface.ts` -> `DEFAULT_SURFACE`) |
| --- | --- |
| `staff-terminal` | `staff` |
| `customer-app` | `customer` |
| `main-website` | `website` |

`src/config/surface.ts` is the only intended per-branch difference. Everything
else is identical on all three. `main` is the GitHub default branch and is **not**
a surface - never push surface work to it.

See `SYNC-PLAN.md` for the rationale and the current-state audit.

## Invariants

1. **Content parity** - `git diff A B -- . ':(exclude)src/config/surface.ts'` is
   empty for every pair (`check-parity.sh`).
2. **Linear history** - `git rev-list --merges --count <branch>` is `0` on all
   three.
3. **Matching history** - the three branches' commit sequences are the same
   subjects in the same order (`check-history.sh`). A duplicated or missing
   cherry-pick leaves the *trees* identical but the *logs* different - this is
   the check that catches it.
4. **One difference** - only `DEFAULT_SURFACE` differs.

## Per-change procedure

```bash
# 0. (optional) see where the network stands.
npm run network:status

# 1. Land the change on the canonical branch, as its OWN commit.
git checkout staff-terminal
git commit -m "feat(...): ..."          # note the new SHA

# 2. Propagate to the other two surfaces (conflict rule + idempotency applied).
npm run sync -- <sha>          # = scripts/sync-branch.sh <sha> [more shas...]

# 3. Gate: parity + history + tests + tsc + all three surface builds.
npm run sync:verify            # = scripts/sync-verify.sh

# 4. Push all three (never main). NOT done automatically.
git push origin staff-terminal customer-app main-website

# 5. Re-check parity against the fresh remotes.
git fetch origin
npm run check:parity -- origin/staff-terminal origin/customer-app origin/main-website
```

### Idempotency (why a re-run is safe)

`sync-branch.sh` is **idempotent**: before cherry-picking a SHA onto a target it
checks whether the change is **already present** on that target and, if so,
skips it. Detection is:

1. **Provenance trailer (primary).** Every propagated commit is made with
   `git cherry-pick -x`, which appends
   `(cherry picked from commit <sha>)`. A re-run sees that trailer and skips.
2. **Patch-id (fallback).** If the exact trailer is missing, the commit's
   patch-id is compared against the target's. This is best-effort: patch-id
   changes when a commit is re-picked from a different base, so the trailer is
   the reliable signal.

This closes the failure that produced a real duplicate in this repo: a commit
that still *applied* a second time (because the target's copy of the file was an
earlier revision) is now recognised as already present and skipped, instead of
creating a second commit.

> Always propagate with `npm run sync` (or `git cherry-pick -x`) so the trailer
> exists. A hand-run `git cherry-pick` without `-x` relies on the weaker
> patch-id fallback.

### Conflict rule (what `sync-branch.sh` does for you)

For every conflict: **take the incoming change for every file except
`src/config/surface.ts`, which keeps the target branch's own version.** Then
`git add` and `git cherry-pick --continue` (forced non-interactive).

If a cherry-pick would become **empty**, the target branch was already ahead -
that is divergence, not something to paper over. The script stops.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run check:parity [a b c]` | Content parity + each branch's `DEFAULT_SURFACE`. Defaults to the three local branches. |
| `npm run check:history [a b c] [--deep]` | Linear history + matching commit sequences. Compares the last `HISTORY_WINDOW` (default 60) subjects; `--deep` on a full clone compares everything. |
| `npm run network:status [canonical]` | One-glance table: HEAD / commits / merges / surface / lockstep per branch. |
| `npm run sync -- <sha>...` | Cherry-pick the SHAs onto the other two branches (idempotent, rule-based); ends with a parity check. |
| `npm run sync:verify` | Parity + history + full vitest suite + `tsc --noEmit` + a build of all three surfaces. |

## Optional local guard

Enable the pre-push hook so a bad push is blocked locally:

```bash
git config core.hooksPath .githooks
```

It refuses to push a surface branch to `main`, refuses a push that introduces a
merge commit on a surface branch, and runs **both** `check-parity.sh` and
`check-history.sh`. It is opt-in because hooks are not cloned by default.

## Troubleshooting

- **`git cherry`/ahead-behind looks wrong** - this workspace is often a **shallow
  clone**, so patch-id/ahead-behind counts are unreliable *and the two logs have
  different depths*. Trust `check-parity` (a real content diff) and
  `check-history` (which compares the recent window only) - not raw counts.
- **Drift found** - `check-parity` prints the diverging paths; `check-history`
  prints `commits only on A` / `commits only on B`. A `+ subject` that also
  exists on the canonical branch is a **duplicate cherry-pick** - drop the extra
  commit (rebase) so the sequences match again. A missing commit is re-picked
  with `sync-branch.sh` (now idempotent). Never merge.
- **Conflict** - let `sync-branch.sh` resolve it; only fix the non-`surface.ts`
  files if the rule genuinely cannot apply.
- **Wrong surface got pushed** - set `DEFAULT_SURFACE` back on that branch and
  re-run `npm run check:parity` before pushing again.
- **Shallow clone** - `npm run check:history -- ... --deep` needs full depth;
  run `git fetch --deepen=<n>` (or `git fetch --unshallow`) first.
