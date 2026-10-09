#!/usr/bin/env bash
# Verifies the three deployment branches stay byte-identical apart from the one
# intentionally-divergent file, src/config/surface.ts.
#
# The three branches must NEVER be merged — each change is committed on
# staff-terminal and cherry-picked onto customer-app and main-website so the
# lines stay linear. Run this after a cherry-pick, before pushing.
#
# Usage:
#   scripts/check-parity.sh                       # compare the three local branches
#   scripts/check-parity.sh A B C                 # compare arbitrary refs (e.g. origin/*)
#
# Checks:
#   1. content parity: A vs B and A vs C differ only by src/config/surface.ts
#   2. surface: each branch's DEFAULT_SURFACE matches its expected value
set -u

EXCLUDE=':(exclude)src/config/surface.ts'
fail=0

if [ "$#" -eq 0 ]; then
  BRANCHES=(staff-terminal customer-app main-website)
elif [ "$#" -eq 3 ]; then
  BRANCHES=("$1" "$2" "$3")
else
  echo "usage: $0 [staff-branch customer-branch website-branch]" >&2
  exit 2
fi

# Expected DEFAULT_SURFACE per branch (matches SYNCING.md).
expected_surface() {
  case "$1" in
    */staff-terminal|staff-terminal) echo "staff" ;;
    */customer-app|customer-app)     echo "customer" ;;
    */main-website|main-website)     echo "website" ;;
    *) echo "" ;;
  esac
}

base="${BRANCHES[0]}"

for other in "${BRANCHES[@]:1}"; do
  diff="$(git diff "$base" "$other" -- . "$EXCLUDE")"
  if [ -n "$diff" ]; then
    echo "DRIFT: $base vs $other differs outside src/config/surface.ts:"
    git diff --stat "$base" "$other" -- . "$EXCLUDE"
    fail=1
  else
    echo "OK: $other matches $base (apart from surface.ts)"
  fi
done

for b in "${BRANCHES[@]}"; do
  want="$(expected_surface "$b")"
  [ -n "$want" ] || continue
  got="$(git show "$b:src/config/surface.ts" 2>/dev/null \
        | grep -oE "DEFAULT_SURFACE: AppSurface = '[a-z]+'" \
        | grep -oE "'[a-z]+'" | tr -d "'")"
  if [ "$got" != "$want" ]; then
    echo "WRONG SURFACE: $b has DEFAULT_SURFACE='${got:-<missing>}', expected '$want'"
    fail=1
  else
    echo "OK: $b surface = '$got'"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "PARITY CHECK FAILED" >&2
else
  echo "PARITY OK"
fi
exit "$fail"
