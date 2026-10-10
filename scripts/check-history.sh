#!/usr/bin/env bash
# Verifies the three deployment branches keep a matching, LINEAR history — the
# history half of the "no divergence, no merge" invariant. check-parity.sh only
# proves the trees match; this proves the commit sequences match too, so a
# duplicated or missing cherry-pick (which leaves the trees identical but the
# logs different) is caught.
#
# Usage:
#   scripts/check-history.sh                 # the three local branches
#   scripts/check-history.sh A B C [--deep]  # arbitrary refs (e.g. origin/*)
#
# Checks per branch:
#   1. zero merge commits (history is linear)
#   2. the commit-subject sequence, normalised, is identical to the canonical
#      branch's (over the shared/shallow window by default, or full history
#      with --deep)
set -u

if [ "$#" -eq 0 ]; then
  BRANCHES=(staff-terminal customer-app main-website)
else
  # Drop a trailing --deep flag before reading the refs.
  args=()
  DEEP=0
  for a in "$@"; do
    if [ "$a" = "--deep" ]; then DEEP=1; else args+=("$a"); fi
  done
  if [ "${#args[@]}" -ne 3 ]; then
    echo "usage: $0 [a b c] [--deep]" >&2
    exit 2
  fi
  BRANCHES=("${args[0]}" "${args[1]}" "${args[2]}")
fi
DEEP="${DEEP:-0}"

# Normalise a subject so only intentional per-branch suffixes are removed:
#   "... (customer-app)" / "... (main-website)" / "... (staff-terminal)"
#   the " (cherry picked from commit <sha>)" trailer added by cherry-pick -x
normalize() {
  sed -E \
    -e 's/ \(customer-app\)$//' \
    -e 's/ \(main-website\)$//' \
    -e 's/ \(staff-terminal\)$//' \
    -e 's/ \(cherry picked from commit [0-9a-f]+\)$//'
}

# Compare only the most recent WINDOW commits (default 60). This is deliberate:
# this workspace is a SHALLOW clone whose depth differs per branch, so the OLD
# end of each log has unrelated extra history — comparing it produces false
# drift. Cherry-picks append to the tip, so a duplicated/missing pick shows up
# in the trailing window. Use --deep on a FULL clone to compare everything.
WINDOW="${HISTORY_WINDOW:-60}"

subjects() {
  if [ "$DEEP" = "1" ]; then
    if git rev-parse --is-shallow-repository 2>/dev/null | grep -qx true; then
      echo "WARNING: --deep on a shallow clone; run 'git fetch --deepen=<n>' first." >&2
    fi
    git log --format='%s' "$1" 2>/dev/null | normalize
  else
    git log -n "$WINDOW" --format='%s' "$1" 2>/dev/null | normalize
  fi
}

fail=0

# 1. Linear history: no merge commits on any branch.
for b in "${BRANCHES[@]}"; do
  merges="$(git rev-list --merges --count "$b" 2>/dev/null || echo 0)"
  if [ "$merges" != "0" ]; then
    echo "NON-LINEAR: $b has $merges merge commit(s); surface branches must stay linear."
    fail=1
  else
    echo "OK: $b is linear (0 merges)"
  fi
done

# 2. Subject-sequence parity vs the canonical (first) branch. Compared as a
#    multiset so a duplicate/missing pick is the *only* difference reported
#    (window-edge shifts do not masquerade as per-line drift), then the ordering
#    is confirmed by a straight comparison of the multisets' sorted forms.
base="${BRANCHES[0]}"
base_subj="$(subjects "$base")"
base_sorted="$(printf '%s\n' "$base_subj" | sort)"
for other in "${BRANCHES[@]:1}"; do
  subj="$(subjects "$other")"
  subj_sorted="$(printf '%s\n' "$subj" | sort)"
  if [ "$subj_sorted" = "$base_sorted" ]; then
    if [ "$subj" = "$base_subj" ]; then
      echo "OK: $other commit sequence matches $base"
    else
      # Same set of commits, different order — still a divergence signal.
      echo "HISTORY DRIFT: $other has $base's commits in a different order."
      fail=1
    fi
    continue
  fi
  echo "HISTORY DRIFT: $other does not match $base's commit sequence."
  echo "  commits only on $base:"
  comm -23 <(printf '%s\n' "$base_sorted") <(printf '%s\n' "$subj_sorted") | sed 's/^/    - /'
  echo "  commits only on $other:"
  comm -13 <(printf '%s\n' "$base_sorted") <(printf '%s\n' "$subj_sorted") | sed 's/^/    + /'
  echo "  (a '+ subject' that also appears on $base is a DUPLICATE cherry-pick;"
  echo "   a '- subject' is a commit missing from $other or pushed out of the window)"
  fail=1
done

if [ "$fail" -ne 0 ]; then
  echo "HISTORY CHECK FAILED" >&2
else
  echo "HISTORY OK"
fi
exit "$fail"
