#!/usr/bin/env bash
# Verify which build each live domain is actually serving.
# Usage: bash scripts/check-live.sh [needle]
#   needle defaults to "Fault Code Explainer".
#
# For each domain it prints the served JS bundle hash, its edge cache age, and
# whether the bundle contains the needle. A stale "age" (hours) means the alias
# is pointing at an old deployment that is not being rebuilt.
set -u

NEEDLE="${1:-Fault Code Explainer}"
DOMAINS=(
  "www.stakeys.co.uk|main website"
  "www.stakeys-cycles.co.uk|staff"
  "www.stakeyswheels.co.uk|customer"
)

printf '%-26s %-22s %-9s %-8s %s\n' "DOMAIN" "BUNDLE" "AGE" "HAS?" "SURFACE"
printf '%s\n' "------------------------------------------------------------------------------------"

for entry in "${DOMAINS[@]}"; do
  domain="${entry%%|*}"
  label="${entry##*|}"
  html="$(curl -fsSL "https://$domain/" 2>/dev/null || true)"
  bundle="$(printf '%s' "$html" | grep -oE '/assets/index-[A-Za-z0-9._-]+\.js' | head -1)"
  bundle="${bundle##*/}"
  age="$(curl -fsSI "https://$domain/" 2>/dev/null | grep -i '^age:' | tr -d '\r' | awk '{print $2}')"
  age="${age:-0}"
  ageh="$((age/3600))h$(((age%3600)/60))m"
  if [ -n "$bundle" ]; then
    js="$(curl -fsSL "https://$domain/assets/$bundle" 2>/dev/null || true)"
    if printf '%s' "$js" | grep -qF "$NEEDLE"; then has="YES"; else has="no"; fi
  else
    has="?"
  fi
  printf '%-26s %-22s %-9s %-8s %s\n' "$domain" "${bundle:-<none>}" "$ageh" "$has" "$label"
done

echo
echo "Needle checked: '$NEEDLE'"
echo "If the main website shows 'no' but you've pushed, the alias is stale —"
echo "redeploy the project that owns it (Vercel -> Project -> Domains)."
