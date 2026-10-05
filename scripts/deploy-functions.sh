#!/usr/bin/env bash
#
# Deploy the Supabase Edge Functions from this repo.
#
# Why this script exists: `supabase login` / `supabase link` are interactive and
# are frequently blocked ("generate a token for your first build"). This uses a
# personal access token instead, so it runs non-interactively.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/deploy-functions.sh
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/deploy-functions.sh send-email notify-booking
#
# The project ref defaults to the production project; override with SUPABASE_PROJECT_REF.
# Get a token from https://supabase.com/dashboard/account/tokens
#
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhojocpygcnkxvkrcuxh}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens, then:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_xxx $0" >&2
  exit 1
fi

# Functions invoked by database triggers with a shared-secret header, not a JWT.
NO_JWT_FUNCTIONS=(booking-email-notification booking-push-notification onesignal-notification)

ALL_FUNCTIONS=(
  booking-email-notification
  booking-push-notification
  send-email
  notify-booking
  onesignal-send
  onesignal-notification
  spin-wheel
  gbp-performance
  stamp-log
)

# Resolve the Supabase CLI (global install or via npx).
if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(npx --yes supabase)
fi

# Deploy only the functions named on the command line, or all of them.
if [[ $# -gt 0 ]]; then
  FUNCTIONS=("$@")
else
  FUNCTIONS=("${ALL_FUNCTIONS[@]}")
fi

for fn in "${FUNCTIONS[@]}"; do
  extra=()
  for no_jwt in "${NO_JWT_FUNCTIONS[@]}"; do
    if [[ "$fn" == "$no_jwt" ]]; then extra=(--no-verify-jwt); fi
  done
  echo "==> deploying ${fn} ${extra[*]:-}"
  "${SUPABASE[@]}" functions deploy "$fn" --project-ref "$PROJECT_REF" "${extra[@]}"
done

echo
echo "Done. Listing functions for ${PROJECT_REF}:"
"${SUPABASE[@]}" functions list --project-ref "$PROJECT_REF"
