#!/bin/sh
# Builds the DEBUG app with a test config and installs it on emulator-5554 only. Usage: build.sh test-config.json|real-config.json
# Needs the Android SDK and a JDK (see SETUP.md); ANDROID_HOME / JAVA_HOME as usual.
D=$(cd "$(dirname "$0")" && pwd)
adb -s emulator-5554 get-state >/dev/null || { echo "no emulator-5554"; exit 2; }
"$D/../../tv-home/android/gradlew" -q -p "$D/../../tv-home/android" assembleDebug "-PconfigJson=$D/${1:-test-config.json}" || exit 1
adb -s emulator-5554 install -r "$D/../../tv-home/android/app/build/outputs/apk/debug/app-debug.apk"
