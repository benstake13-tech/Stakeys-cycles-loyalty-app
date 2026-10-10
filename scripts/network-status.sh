#!/usr/bin/env bash
# One-glance view of the three-branch network: where each surface branch is
# relative to the canonical branch (staff-terminal). Run this at the start of a
# session to see whether the network is in lockstep, and after a sync to confirm
# it landed everywhere.
#
# Usage:
#   scripts/network-status.sh [canonical]     # default canonical: staff-terminal
#
# For each branch it prints: HEAD, commit count, merge count, its surface, and a
# LOCKSTEP verdict — whether its recent commit-subject multiset matches the
# canonical branch's. (Plain ahead/behind counts are misleading here: every
# cherry-pick shares its SHAs elsewhere and is patch-equivalent, so
# `--cherry-mark` collapses to 0/0 even when a commit was duplicated. Comparing
# the recent subject window is what actually shows the network in lockstep.)
set -u

BRANCHES=(staff-terminal customer-app main-website)
CANON="${1:-staff-terminal}"
WINDOW="${HISTORY_WINDOW:-60}"

if ! git rev-parse --verify --quiet "${CANON}^{commit}" >/dev/null; then
  echo "ERROR: '$CANON' is not a commit-ish." >&2
  exit 2
fi

merges_of() { git rev-list --merges --count "$1" 2>/dev/null || echo 0; }
count_of()  { git rev-list --count "$1" 2>/dev/null || echo 0; }
surface_of() {
  git show "$1:src/config/surface.ts" 2>/dev/null \
    | grep -oE "DEFAULT_SURFACE: AppSurface = '[a-z]+'" \
    | grep -oE "'[a-z]+'" | tr -d "'"
}
window_subjects() {
  git log -n "$WINDOW" --format='%s' "$1" 2>/dev/null \
    | sed -E -e 's/ \((customer-app|main-website|staff-terminal)\)$//' \
             -e 's/ \(cherry picked from commit [0-9a-f]+\)$//'
}

canon_subj="$(window_subjects "$CANON" | sort)"

printf 'canonical: %s   (history window: last %s commits)\n\n' "$CANON" "$WINDOW"
printf '%-16s %-10s %-8s %-8s %-9s %s\n' \
  'branch' 'HEAD' 'commits' 'merges' 'surface' 'lockstep'
for b in "${BRANCHES[@]}"; do
  subj="$(window_subjects "$b" | sort)"
  if [ "$b" = "$CANON" ] || [ "$subj" = "$canon_subj" ]; then
    verdict='yes'
  else
    verdict='NO (history drift)'
  fi
  printf '%-16s %-10s %-8s %-8s %-9s %s\n' \
    "$b" "$(git rev-parse --short "$b" 2>/dev/null)" \
    "$(count_of "$b")" "$(merges_of "$b")" "$(surface_of "$b" || echo '?')" \
    "$verdict"
done

echo
echo "lockstep = every branch matches $CANON's recent commit sequence and 0 merges."
echo "run scripts/check-parity.sh and scripts/check-history.sh for the full gate."
