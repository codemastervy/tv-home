#!/bin/sh
# Runs every emulator test against emulator-5554 (emulator only). Needs a booted Android TV AVD, a DEBUG build
# built with tests/emulator/test-config.json (gradlew assembleDebug -PconfigJson=...), python with `websockets`.
#   sh tests/emulator/run_all.sh [python]
PY=${1:-python3}
D=$(dirname "$0"); adb -s emulator-5554 get-state >/dev/null || { echo "no emulator-5554"; exit 2; }
rc=0; for t in home_modes published_feed; do echo "== $t"; "$PY" -I "$D/$t.py" || rc=1; done; exit $rc
