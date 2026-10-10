#!/usr/bin/env bash
# Propagate one or more commits from the current surface branch onto the other
# two surface branches by CHERRY-PICK (never merge), applying the project rule
# automatically:
#
#   every conflict resolves to the INCOMING change, EXCEPT src/config/surface.ts
#   which always keeps the target branch's own version.
#
# The sync is IDEMPOTENT: a commit that is already present on a target (matched
# by its `-x` provenance trailer, or best-effort by patch-id) is skipped instead
# of re-applied, so re-running the sync can never duplicate a commit. Every
# propagated commit is stamped with `git cherry-pick -x` so the trail is
# explicit and check-history.sh can see it.
#
# Usage:
#   scripts/sync-branch.sh <sha> [more shas...]
#
# Run from the branch that holds the new commits (normally staff-terminal).
set -u

BRANCHES=(staff-terminal customer-app main-website)
SURFACE_FILE='src/config/surface.ts'

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <sha> [more shas...]" >&2
  exit 2
fi

# Resolve every argument to an absolute SHA *now*, before any checkout. A bare
# name like HEAD or a branch would otherwise resolve against the target branch
# after we switch to it.
commits=()
for ref in "$@"; do
  sha="$(git rev-parse --verify --quiet "${ref}^{commit}")" || {
    echo "ERROR: '$ref' is not a commit-ish." >&2
    exit 2
  }
  commits+=("$sha")
done

# Are we on one of the three surface branches?
source_branch="$(git rev-parse --abbrev-ref HEAD)"
found=0
for b in "${BRANCHES[@]}"; do [ "$b" = "$source_branch" ] && found=1; done
if [ "$found" -ne 1 ]; then
  echo "ERROR: run from a surface branch (${BRANCHES[*]}); you are on '$source_branch'." >&2
  exit 1
fi

# Refuse a dirty tree, except the memory files tooling edits.
dirty="$(git status --porcelain | grep -vE '^\s*[AM? ]{0,2}\s*\.openhands/memory/' || true)"
if [ -n "$dirty" ]; then
  echo "ERROR: working tree has uncommitted changes:" >&2
  echo "$dirty" >&2
  exit 1
fi

if [ -f .git/CHERRY_PICK_HEAD ] || [ -d .git/sequencer ]; then
  echo "ERROR: a cherry-pick is already in progress; finish or abort it first." >&2
  exit 1
fi

# Commit subjects on a branch (one per line), used to detect a commit whose
# provenance trailer already names the source SHA.
subjects_on() {
  git log --format='%s' "$1" 2>/dev/null
}

# True (0) when $sha's own patch-id already appears among $target's commits.
# Best-effort: patch-id changes if a commit is re-picked from a different base
# (see the duplicated sync-fix in this repo), so it supplements — never
# replaces — the `-x` trailer signal.
patch_present_on() {
  local sha="$1" target="$2" want have
  want="$(git show "$sha" | git patch-id --stable 2>/dev/null | awk '{print $1}')"
  [ -n "$want" ] || return 1
  have="$(git log -p "$target" 2>/dev/null | git patch-id --stable 2>/dev/null | awk '{print $1}')"
  printf '%s\n' "$have" | grep -qxF "$want"
}

# True (0) when the commit is already on $target: by explicit `-x` provenance
# trailer (primary) or by patch-id (fallback).
already_present() {
  local sha="$1" target="$2"
  # `git cherry-pick -x` appends: "(cherry picked from commit <sha>)"
  if subjects_on "$target" | grep -Fq "cherry picked from commit $sha"; then
    return 0
  fi
  patch_present_on "$sha" "$target"
}

# Resolve a conflicted cherry-pick using the project rule, continue, and detect
# an empty result (which means the target was already ahead -> divergence).
resolve_and_continue() {
  local target="$1" sha="$2"
  local unmerged
  unmerged="$(git diff --name-only --diff-filter=U)"
  if [ -z "$unmerged" ]; then
    echo "ERROR: cherry-pick stopped but no unmerged paths (target $target, $sha)." >&2
    return 1
  fi
  echo "  conflict in: $(echo "$unmerged" | tr '\n' ' ')"
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    if [ "$path" = "$SURFACE_FILE" ]; then
      git checkout --ours -- "$path"        # keep the target's own surface
      echo "  kept target version of $path"
    else
      git checkout --theirs -- "$path"      # incoming change wins
      echo "  took incoming $path"
    fi
    git add -- "$path"
  done <<< "$unmerged"

  # Force a non-interactive editor: GIT_EDITOR in the environment overrides the
  # -c core.editor setting, so set it explicitly or --continue hangs/fails.
  if ! GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true git cherry-pick --continue >/dev/null 2>&1; then
    # Continue failed: likely an empty commit once conflicts were resolved.
    if git status --porcelain | grep -q .; then
      echo "ERROR: could not continue cherry-pick of $sha on $target." >&2
      GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true git cherry-pick --continue
      return 1
    fi
    echo "ERROR: cherry-pick of $sha became EMPTY on $target. Either the commit" >&2
    echo "       only changed $SURFACE_FILE (nothing to propagate), or $target is" >&2
    echo "       already ahead of $source_branch (divergence). Investigate before" >&2
    echo "       syncing — do NOT paper over it." >&2
    git cherry-pick --abort >/dev/null 2>&1 || true
    return 1
  fi
  return 0
}

status=0
for target in "${BRANCHES[@]}"; do
  [ "$target" = "$source_branch" ] && continue
  echo "==> $source_branch -> $target"
  if ! git checkout "$target" >/dev/null 2>&1; then
    echo "ERROR: cannot checkout $target." >&2
    status=1
    break
  fi
  for sha in "${commits[@]}"; do
    if already_present "$sha" "$target"; then
      echo "  skip ${sha:0:7} — already on $target (idempotent)"
      continue
    fi
    echo "  cherry-pick ${sha:0:7}"
    # -x appends "(cherry picked from commit <sha>)" so the trail is explicit and
    # a re-run detects the commit without relying on patch-id.
    if git cherry-pick -x "$sha" >/dev/null 2>&1; then
      echo "  applied cleanly"
      continue
    fi
    if ! resolve_and_continue "$target" "$sha"; then
      echo "ERROR: failed to apply $sha on $target." >&2
      status=1
      break
    fi
    echo "  applied after conflict resolution"
  done
  [ "$status" -eq 0 ] || break
done

echo "==> returning to $source_branch"
git checkout "$source_branch" >/dev/null 2>&1 || true

if [ "$status" -ne 0 ]; then
  echo "SYNC FAILED — branches may be mid-cherry-pick; fix before pushing." >&2
  exit "$status"
fi

echo "==> parity check"
bash scripts/check-parity.sh
