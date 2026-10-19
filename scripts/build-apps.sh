#!/usr/bin/env bash
# Builds BOTH installable Android apps (staff + customer) from one checkout.
#
# The two apps share this codebase; the only difference is the web surface
# bundled into each and the installable identity (application id, app name,
# icon tint), which the Android product flavors set. This script re-syncs the
# web assets once per app so each APK contains the right surface, then builds
# the two debug APKs.
#
# Usage:
#   scripts/build-apps.sh                       # both apps, production API
#   scripts/build-apps.sh --api https://staging # point both at another API
#   scripts/build-apps.sh --only staff          # just one app
#   scripts/build-apps.sh --release             # release variants (need signing)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_BASE="https://www.stakeys-cycles.co.uk"
ONLY=""
BUILD_TYPE="Debug"
OUT="$ROOT/preview/apps"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --api) API_BASE="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    --release) BUILD_TYPE="Release"; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# Remove any previous output for the requested flavors before preflight. A
# failed build must never leave an older APK looking like its new result.
if [ -z "$ONLY" ] || [ "$ONLY" = "staff" ]; then rm -f "$OUT/stakeys-staff.apk"; fi
if [ -z "$ONLY" ] || [ "$ONLY" = "customer" ]; then rm -f "$OUT/stakeys-customer.apk"; fi

# Never publish a successful APK build without the Firebase client registration
# needed by OneSignal's Android FCM transport. CI can supply the base64 config
# via its protected environment; the decoded JSON stays git-ignored.
if [ -z "$ONLY" ]; then
  node scripts/check-native-push-config.mjs staff customer
else
  node scripts/check-native-push-config.mjs "$ONLY"
fi

# The Android toolchain is not always on PATH in a bare shell.
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1 || true)"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:${BT:+$BT:}$PATH"

command -v java >/dev/null || { echo "java not found (set JAVA_HOME)"; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found (set ANDROID_HOME)"; exit 1; }
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# app key -> Gradle flavor (capitalised) + surface env + output file stem
apps() {
  case "$1" in
    staff)    echo "Staff|staff|Stakey's Staff" ;;
    customer) echo "Customer|customer|Stakey's Cycles" ;;
  esac
}

build_one() {
  local app="$1"
  local spec flavor surface label
  spec="$(apps "$app")"
  flavor="${spec%%|*}"; rest="${spec#*|}"; surface="${rest%%|*}"; label="${rest#*|}"

  echo ""
  echo "=============================================================="
  echo " Building $app app  (surface=$surface, flavor=$flavor, $BUILD_TYPE)"
  echo "=============================================================="

  # 1. web bundle for this surface, with the API origin inlined for native.
  VITE_SURFACE="$surface" VITE_API_BASE_URL="$API_BASE" \
    npx vite build

  # 2. copy that bundle into the native project + refresh plugins/config.
  npx cap sync android

  # 3. build the flavor's APK.
  # Discard packaging intermediates from interrupted builds. Reusing them can
  # leave extra truncated DEX entries in an otherwise correctly signed APK.
  ( cd android && ./gradlew clean "assemble${flavor}${BUILD_TYPE}" )

  # 4. collect it under a predictable name.
  local src="android/app/build/outputs/apk/${surface}/$(echo "$BUILD_TYPE" | tr '[:upper:]' '[:lower:]')/app-${surface}-$(echo "$BUILD_TYPE" | tr '[:upper:]' '[:lower:]').apk"
  [ -f "$src" ] || { echo "expected APK not found: $src" >&2; exit 1; }
  python3 scripts/check-apk-integrity.py "$src"
  mkdir -p "$OUT"
  local dest="$OUT/stakeys-${app}.apk"
  cp "$src" "$dest"

  local pkg
  pkg="$(aapt dump badging "$dest" 2>/dev/null | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
  if [ "$pkg" != "uk.co.stakeyscycles.$app" ]; then
    rm -f "$dest"
    echo "APK package mismatch for $app: found ${pkg:-none}" >&2
    exit 1
  fi
  echo "  -> $dest"
  echo "     package: $pkg   label: $label   api: $API_BASE"
}

if [ -z "$ONLY" ] || [ "$ONLY" = "staff" ];    then build_one staff;    fi
if [ -z "$ONLY" ] || [ "$ONLY" = "customer" ]; then build_one customer; fi

echo ""
echo "Done. APKs in $OUT:"
ls -la "$OUT"/*.apk 2>/dev/null || true
