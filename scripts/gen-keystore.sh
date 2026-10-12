#!/usr/bin/env bash
# Generates the Android release signing key and its (git-ignored) credentials.
#
# Run once per project, on a machine you trust, then BACK UP both files: every
# future release of the app must be signed with the same key, and Android/Play
# identify the app by it. Neither file is committed (see android/.gitignore).
#
# Usage:
#   scripts/gen-keystore.sh                 # prompt for a strong store password
#   STORE_PASSWORD='…' scripts/gen-keystore.sh   # non-interactive (CI seeding)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

KS="android/stakeys-release.jks"
PROPS="android/keystore.properties"
ALIAS="stakeys"
DNAME="CN=Stakey's Cycles, OU=Workshop, O=Stakey's Cycles, L=Salford, ST=Greater Manchester, C=GB"

command -v keytool >/dev/null || { echo "keytool not found (set JAVA_HOME)" >&2; exit 1; }

if [ -f "$KS" ]; then
  echo "Refusing to overwrite the existing keystore: $KS" >&2
  echo "Delete it deliberately if you really mean to replace the signing key." >&2
  exit 1
fi

PASSWORD="${STORE_PASSWORD:-}"
if [ -z "$PASSWORD" ]; then
  read -r -s -p "New keystore password: " PASSWORD; echo
  read -r -s -p "Confirm password: " CONFIRM; echo
  [ "$PASSWORD" = "$CONFIRM" ] || { echo "Passwords do not match." >&2; exit 1; }
fi
[ "${#PASSWORD}" -ge 6 ] || { echo "Store password must be at least 6 characters." >&2; exit 1; }

keytool -genkeypair -v -keystore "$KS" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASSWORD" -keypass "$PASSWORD" -dname "$DNAME"

umask 077
cat > "$PROPS" <<EOF
storeFile=stakeys-release.jks
storePassword=$PASSWORD
keyAlias=$ALIAS
keyPassword=$PASSWORD
EOF

echo
echo "Wrote $KS and $PROPS (both git-ignored)."
echo "Back them up somewhere safe — losing the key means you can never update the app."
