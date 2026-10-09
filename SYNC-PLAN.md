# Three-branch upgrade plan — keep all surfaces in lockstep, never merge

Three branches ship three surfaces from one codebase. They must stay
**byte-identical apart from `src/config/surface.ts`** and their histories must
stay **linear** (cherry-pick, never merge). This document is the plan; the
tooling that enforces it is committed alongside.

## The invariants (what "no divergence" means precisely)

1. **Content parity.** For every pair of branches, the tree diff excluding
   `src/config/surface.ts` is empty.
   `git diff A B -- . ':(exclude)src/config/surface.ts'` → empty.
2. **Linear history.** `git rev-list --merges --count <branch>` is `0` on all
   three. The three logs are the same list of commit subjects in the same order,
   with different SHAs (each cherry-pick is a new commit).
3. **One intentional difference.** Only `DEFAULT_SURFACE` in
   `src/config/surface.ts` differs:

   | Branch | `DEFAULT_SURFACE` | Surface |
   | --- | --- | --- |
   | `staff-terminal` | `'staff'` | staff terminal |
   | `customer-app` | `'customer'` | customer app |
   | `main-website` | `'website'` | public marketing site |

`main` is the GitHub default branch and is **not** a surface — never push
surface work to it.

## Current state (verified 2026-10-09)

- `staff-terminal` `be2198c`, `customer-app` `f7f2728`, `main-website` `2f3bcd1`.
- Parity holds: only `src/config/surface.ts` differs. Zero merges anywhere.
- The tooling below is **built and in use**: the "booking form language" change and
  the follow-up memory commit were each propagated with `scripts/sync-branch.sh`
  and gated with `scripts/sync-verify.sh` (98 files / 728 tests, `tsc`, 3 builds).
- 334 tracked files; the vitest suite; `tsc` + 3-surface `vite build` gates.

## The upgrade: from "recipe + one diff check" to "recipe + guarded tooling"

Today `SYNCING.md` gives the recipe and `check-parity.sh` checks one thing
(content drift). The gaps that let apps fall out of step:

- Nothing **stops** a merge or a direct push to a surface branch.
- Conflicts are resolved by hand; the only rule ("take incoming for everything
  except `surface.ts`") is easy to get wrong mid-conflict.
- Nothing verifies the three branches still **build** and **pass tests** after a
  sync, so a bad cherry-pick can reach a domain.
- Nothing detects **history divergence** (a branch that was rebased/merged into)
  as opposed to content drift.

The upgrade closes those gaps with three small, dependency-free scripts plus an
optional local guard.

### Step 1 — Harden `scripts/check-parity.sh` (the gate)

Make it the single source of truth for invariant 1 **and** 3:

- Accept optional refs (`check-parity.sh [a b c]`) so it can compare the three
  branches or `origin/*` after a fetch; default to the three local branches.
- Diff each pair excluding `src/config/surface.ts`; fail listing every diverging
  path.
- Additionally assert each branch's `DEFAULT_SURFACE` equals its expected value
  (`staff` / `customer` / `website`) so a cherry-pick that clobbers the one
  intended difference is caught too.

### Step 2 — `scripts/sync-branch.sh` (the propaganda engine)

One command to propagate a commit to every other surface, with the conflict rule
baked in:

```bash
scripts/sync-branch.sh <sha> [more shas...]     # cherry-pick onto the other two
```

What it does:

1. Refuses to run on a dirty tree (except the known memory-file edits).
2. For each target branch: `git checkout <target>`, `git cherry-pick <sha...>`.
3. On conflict, applies the rule automatically: restore the target's own
   `src/config/surface.ts`, then `git checkout --theirs`/`--ours` per the rule
   (**incoming change wins for every file except `surface.ts`**), `git add`,
   `git -c core.editor=true cherry-pick --continue`.
4. Stops immediately if a cherry-pick yields an **empty** commit (`--allow-empty`
   is never used) — an empty cherry-pick means the branch was already ahead,
   which is a divergence signal, not something to paper over.
5. Runs `check-parity.sh` at the end; fails loudly if any pair drifted.

This makes the documented rule executable, so the same decision is applied every
time by every agent/human.

### Step 3 — `scripts/sync-verify.sh` (the release gate)

Prove the synced branches are actually healthy before pushing:

```bash
scripts/sync-verify.sh            # parity + tests + tsc + 3 surface builds
```

1. `check-parity.sh`.
2. `npm ci` if `node_modules` is missing.
3. `npx vitest run` (full suite).
4. `npx tsc --noEmit`.
5. Build all three surfaces, forcing the env var rather than trusting the branch
   default:
   `VITE_SURFACE=staff|customer|website npx vite build --outDir dist-<s>`.

A sync is "done" only when this is green on the three branches.

### Step 4 — Optional: local pre-push guard

`.githooks/pre-push` (enabled with `git config core.hooksPath .githooks`):

- Blocks a push that introduces a merge commit on a surface branch.
- Blocks a push to `main` from a surface branch.
- Runs `check-parity.sh` and blocks if any pair drifted.

It is opt-in (a hook is not cloned by default) so it never surprises a
contributor; CI, if added later, should run the same script.

### Step 5 — Rewrite `SYNCING.md` as the playbook

Fold the above into one page: invariants, the three commands
(`sync-branch` → `sync-verify` → push), the conflict rule, and the
"what to do if X" section (empty cherry-pick, drift found, wrong surface pushed).

## Operating procedure (per change)

```bash
# 1. Land the change on the canonical branch (staff-terminal), as its own commit.
git checkout staff-terminal && git commit -m "feat(...): ..."

# 2. Propagate to the other two surfaces (rule applied automatically).
scripts/sync-branch.sh <sha>

# 3. Gate: parity + tests + tsc + all three surface builds.
scripts/sync-verify.sh

# 4. Push all three (never main).
git push origin staff-terminal customer-app main-website

# 5. Re-check parity against the fresh remotes.
git fetch origin
scripts/check-parity.sh origin/staff-terminal origin/customer-app origin/main-website
```

## Guardrails / non-goals

- **Never `git merge`** surface branches; **never** push surface work to `main`.
- Only `src/config/surface.ts` may differ; any other difference is a bug.
- No merge commits: history stays linear so `git log` reads identically on all
  three and any single commit can be reproduced by cherry-pick.
- Remember this workspace is a **shallow clone**: `git cherry`/patch-id counts
  are unreliable, so trust the **content diff** (`check-parity.sh`), not the
  ahead/behind numbers.
- `.openhands/memory/*` is **tracked**, so it is part of parity: commit memory
  updates and sync them like any other change. The scripts still tolerate
  uncommitted memory edits as a dirty-tree exception while you work.

## Definition of done for this upgrade

- `check-parity.sh` validates content parity **and** the per-branch surface. ✅
- `sync-branch.sh` performs a rule-based cherry-pick of one or more SHAs onto the
  other two branches and self-checks parity. ✅
- `sync-verify.sh` runs parity + tests + `tsc` + the three surface builds. ✅
- `.githooks/pre-push` blocks merges, `main` pushes, and drift when enabled. ✅
- `SYNCING.md` documents the upgraded procedure in one place. ✅

## Steady-state loop (after this upgrade)

Every future change is one turn of the same crank:

1. Commit on `staff-terminal` (its own commit, so it can be cherry-picked).
2. `npm run sync -- <sha>` — propagates, resolving conflicts by the rule.
3. `npm run sync:verify` — parity + tests + `tsc` + 3 surface builds.
4. Push `staff-terminal customer-app main-website` (never `main`).
5. `git fetch origin && npm run check:parity -- origin/staff-terminal origin/customer-app origin/main-website`.

Note: `.openhands/memory/*` is tracked and therefore part of parity too — commit
memory updates like any other change and sync them the same way (or they will
show up as drift).
