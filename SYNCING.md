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
   empty for every pair.
2. **Linear history** - `git rev-list --merges --count <branch>` is `0` on all
   three; the three logs are the same commit subjects in the same order.
3. **One difference** - only `DEFAULT_SURFACE` differs.

## Per-change procedure

```bash
# 1. Land the change on the canonical branch, as its own commit.
git checkout staff-terminal
git commit -m "feat(...): ..."          # note the new SHA

# 2. Propagate to the other two surfaces (conflict rule applied automatically).
npm run sync -- <sha>          # = scripts/sync-branch.sh <sha> [more shas...]

# 3. Gate: parity + tests + tsc + all three surface builds.
npm run sync:verify            # = scripts/sync-verify.sh

# 4. Push all three (never main). NOT done automatically.
git push origin staff-terminal customer-app main-website

# 5. Re-check parity against the fresh remotes.
git fetch origin
npm run check:parity -- origin/staff-terminal origin/customer-app origin/main-website
```

### Conflict rule (what `sync-branch.sh` does for you)

For every conflict: **take the incoming change for every file except
`src/config/surface.ts`, which keeps the target branch's own version.** Then
`git add` and `git cherry-pick --continue`.

If a cherry-pick would become **empty**, the target branch was already ahead -
that is divergence, not something to paper over. The script stops.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run check:parity [a b c]` | Content parity + each branch's `DEFAULT_SURFACE`. Defaults to the three local branches. |
| `npm run sync -- <sha>...` | Cherry-pick the SHAs onto the other two branches, resolving conflicts by the rule; ends with a parity check. |
| `npm run sync:verify` | Parity, full vitest suite, `tsc --noEmit`, and a build of all three surfaces. |

## Optional local guard

Enable the pre-push hook so a bad push is blocked locally:

```bash
git config core.hooksPath .githooks
```

It refuses to push a surface branch to `main`, refuses a push that introduces a
merge commit on a surface branch, and runs the parity check. It is opt-in
because hooks are not cloned by default.

## Troubleshooting

- **`git cherry`/ahead-behind looks wrong** - this workspace is often a **shallow
  clone**, so patch-id counts are unreliable. Trust `check:parity` (a real
  content diff), not ahead/behind.
- **Drift found** - `npm run check:parity` prints the diverging paths. Cherry-pick
  the missing commit(s) with `sync-branch.sh`, or if a commit was merged in,
  reset that branch onto the canonical history (never merge).
- **Conflict** - let `sync-branch.sh` resolve it; only fix the non-`surface.ts`
  files if the rule genuinely cannot apply.
- **Wrong surface got pushed** - set `DEFAULT_SURFACE` back on that branch and
  re-run `npm run check:parity` before pushing again.
