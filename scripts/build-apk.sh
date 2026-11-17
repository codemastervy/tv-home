#!/bin/sh
# Builds the couch-tv TV apps (release APKs) and prints where they are.
#   dist/couch-tv-home.apk    the TV home (options A and B), from tv-home/android
#
# Needs JDK 21 and the Android SDK with platform 34 and build tools 34 (docs/SETUP.md, "Building the
# app"). Gradle itself is not needed: the Gradle wrapper (tv-home/android/gradlew) fetches 8.11.1.
#
# Usage, from the repo root:
#   [JAVA_HOME=/path/to/jdk-21] [ANDROID_HOME=/path/to/android-sdk] [CONFIG=config.json]
#   [BRIDGE_URLS=http://my-computer.local:5400] [UPDATE_REPO=owner/name] sh scripts/build-apk.sh
# CONFIG is the settings file built into the home's own copy (default: config.example.json, so a
# build is the same on every computer). apply.sh hands the TV your config.json at install time
# anyway, so the default is fine for everyone.
# UPDATE_REPO is whose GitHub releases Home settings, Updates offers (default Seagey/couch-tv):
# a fork with releases of its own sets it, and UPDATE_REPO= (empty) switches updates off.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$ROOT/config.json" ] && CONFIG=${CONFIG:-$ROOT/config.json}
CONFIG=${CONFIG:-$ROOT/config.example.json}
case "$CONFIG" in /*) ;; *) CONFIG="$ROOT/$CONFIG" ;; esac

if [ -z "${ANDROID_HOME:-}" ]; then
  for d in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "/opt/android-sdk"; do
    [ -d "$d/platforms" ] && ANDROID_HOME=$d && break
  done
fi
[ -n "${ANDROID_HOME:-}" ] || { echo "Set ANDROID_HOME to your Android SDK (docs/SETUP.md, Building the app)."; exit 1; }
[ -d "$ANDROID_HOME/platforms/android-34" ] || { echo "No Android platform 34 in $ANDROID_HOME: sdkmanager \"platforms;android-34\" \"build-tools;34.0.0\""; exit 1; }
export ANDROID_HOME
if [ -z "${JAVA_HOME:-}" ] && [ -x /usr/libexec/java_home ]; then
  JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
fi
[ -n "${JAVA_HOME:-}" ] || { echo "Set JAVA_HOME to a JDK 21 (docs/SETUP.md, Building the app)."; exit 1; }
export JAVA_HOME

GW="$ROOT/tv-home/android/gradlew"
mkdir -p "$ROOT/dist"
EXTRA=""
[ -n "${BRIDGE_URLS:-}" ] && EXTRA="-PbridgeUrls=$BRIDGE_URLS"
[ -n "${UPDATE_REPO+set}" ] && EXTRA="$EXTRA -PupdateRepo=$UPDATE_REPO"

echo "Building the TV home (settings built in: $CONFIG)"
"$GW" -p "$ROOT/tv-home/android" --no-daemon -q clean assembleRelease "-PconfigJson=$CONFIG" $EXTRA
cp "$ROOT/tv-home/android/app/build/outputs/apk/release/app-release.apk" "$ROOT/dist/couch-tv-home.apk"
echo "Built: $ROOT/dist/couch-tv-home.apk"
