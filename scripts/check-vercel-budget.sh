#!/usr/bin/env bash
# Fails if the deployment would exceed Vercel's Hobby serverless-function cap.
#
# Vercel Hobby allows at most 12 Serverless Functions per deployment. For a
# non-Next framework (this repo uses Vite) EVERY file under api/ becomes one
# function; files/directories whose name starts with "_" are ignored by Vercel.
# Exceeding the cap fails the WHOLE deployment, so the live domain silently keeps
# serving the last good build ("worked before, broken now").
#
# Never add a bare api/*.js file. Put each route family behind ONE dynamic
# api/<family>/[action].js dispatcher (the path segment becomes req.query.action).
#
# Mirrored by vercel_function_budget.test.ts so the vitest suite catches it too.
#
# Usage: scripts/check-vercel-budget.sh [limit]   (default limit 12)
set -u

LIMIT="${1:-12}"

if [ ! -d api ]; then
  echo "no api/ directory — nothing to count"
  exit 0
fi

# Every *.js under api/ whose path has no "_"-prefixed segment, sorted.
FUNCS="$(find api -type f -name '*.js' \
  | sed 's|^\./||' \
  | awk -F/ '{ ok=1; for (i=1;i<=NF;i++) if ($i ~ /^_/) ok=0; if (ok) print }' \
  | sort)"

COUNT="$(printf '%s\n' "$FUNCS" | grep -c . || true)"

echo "Vercel serverless functions under api/ (limit ${LIMIT}):"
printf '%s\n' "$FUNCS" | sed 's/^/  - /'
echo "count: ${COUNT}/${LIMIT}"

if [ "$COUNT" -gt "$LIMIT" ]; then
  echo "VERCEL FUNCTION BUDGET EXCEEDED: ${COUNT} > ${LIMIT}." >&2
  echo "Deployment would FAIL. Consolidate routes into an api/<family>/[action].js dispatcher." >&2
  exit 1
fi

echo "VERCEL BUDGET OK"
