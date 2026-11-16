#!/bin/sh
# Installs the built home APK on ONE adb device and starts it. Emulator only unless you say so.
#   sh tv-home/tools/install.sh emulator-5554 [dist/couch-tv-home.apk]
#   I_MEAN_A_REAL_TV=yes sh tv-home/tools/install.sh <ip:port> ...   (your own TV, debugging on)
# Never scans the network: it talks only to the one serial you give it.
set -e
SERIAL=${1:?usage: install.sh <adb serial> [apk]}
APK=${2:-dist/couch-tv-home.apk}
case "$SERIAL" in emulator-*) ;; *) [ "$I_MEAN_A_REAL_TV" = yes ] || { echo "Not an emulator. Set I_MEAN_A_REAL_TV=yes to install on a real TV."; exit 1; } ;; esac
adb -s "$SERIAL" install -r "$APK"
adb -s "$SERIAL" shell pm grant app.couchtv.launcher android.permission.READ_TV_LISTINGS || true
adb -s "$SERIAL" shell am start -n app.couchtv.launcher/.MainActivity --es bridge none
