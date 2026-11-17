#!/bin/sh
# Runs every emulator test against emulator-5554 (emulator only). Needs: a booted Android TV AVD, the Android
# SDK, python with `websockets`. It builds and installs the DEBUG app twice: with the sample-data config
# (test-config.json) and with a plain one (real-config.json). Usage: sh tests/emulator/run_all.sh [python]
PY=${1:-python3}
D=$(cd "$(dirname "$0")" && pwd)
rc=0
adb -s emulator-5554 get-state >/dev/null || { echo "no emulator-5554"; exit 2; }
reset() { adb -s emulator-5554 shell pm clear app.couchtv.launcher >/dev/null; adb -s emulator-5554 shell pm grant app.couchtv.launcher android.permission.READ_TV_LISTINGS; }
sh "$D/build.sh" test-config.json >/dev/null || exit 1
reset
for t in reco setup_screen published_feed; do echo "== $t"; "$PY" -I "$D/$t.py" || rc=1; done
sh "$D/build.sh" real-config.json >/dev/null || exit 1
reset
"$PY" -I -c "exec(open('$D/continue_watching.py').read().split('async def main')[0]); clear_seeded()"
for t in continue_watching picks_row; do echo "== $t"; "$PY" -I "$D/$t.py" || rc=1; done
exit $rc
