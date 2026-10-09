#!/usr/bin/env bash
# Verifies the three deployment branches stay byte-identical apart from the one
# intentionally-divergent file, src/config/surface.ts.
#
# The three branches must NEVER be merged — each change is committed on
# staff-terminal and cherry-picked onto customer-app and main-website so the
# lines stay linear. Run this after a cherry-pick, before pushing.
set -u

BRANCHES=(staff-terminal customer-app main-website)
EXCLUDE=':(exclude)src/config/surface.ts'
fail=0

for other in "${BRANCHES[@]:1}"; do
  diff="$(git diff "staff-terminal" "$other" -- . "$EXCLUDE")"
  if [ -n "$diff" ]; then
    echo "DRIFT: staff-terminal vs $other differs outside src/config/surface.ts:"
    git diff --stat "staff-terminal" "$other" -- . "$EXCLUDE"
    fail=1
  else
    echo "OK: $other matches staff-terminal (apart from surface.ts)"
  fi
done

exit "$fail"
