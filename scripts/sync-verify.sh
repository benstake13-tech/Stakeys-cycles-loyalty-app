#!/usr/bin/env bash
# Release gate for a three-branch sync. Run AFTER syncing, BEFORE pushing.
#
#   1. content parity + per-branch surface (check-parity.sh)
#   2. install deps if missing
#   3. full vitest suite
#   4. tsc --noEmit
#   5. build each surface, forced via VITE_SURFACE (not the branch default)
#
# Usage: scripts/sync-verify.sh
set -u

BRANCHES=(staff-terminal customer-app main-website)
SURFACES=(staff customer website)

echo "==> 1/5 parity"
bash scripts/check-parity.sh || exit 1

if [ ! -d node_modules ]; then
  echo "==> 2/5 installing dependencies"
  npm ci || exit 1
else
  echo "==> 2/5 dependencies present"
fi

echo "==> 3/5 tests"
npx vitest run || exit 1

echo "==> 4/5 typecheck"
npm run lint || exit 1

echo "==> 5/5 surface builds"
for s in "${SURFACES[@]}"; do
  echo "  building VITE_SURFACE=$s"
  rm -rf "dist-$s"
  VITE_SURFACE="$s" npx vite build --outDir "dist-$s" >/dev/null || exit 1
done
rm -rf dist-staff dist-customer dist-website

echo "SYNC VERIFY OK: ${BRANCHES[*]} in parity; tests, types and all three surfaces built."
