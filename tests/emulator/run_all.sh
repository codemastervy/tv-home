#!/bin/sh
# Runs every emulator test against emulator-5554 (emulator only). Needs: a booted Android TV AVD,
# a DEBUG build installed (gradlew assembleDebug), python with `websockets`. Usage: sh tests/emulator/run_all.sh [python]
PY=${1:-python3}
D=$(dirname "$0"); adb -s emulator-5554 get-state >/dev/null || { echo "no emulator-5554"; exit 2; }
adb -s emulator-5554 shell pm clear app.couchtv.launcher >/dev/null  # start from a clean app (no saved picks or first-run state)
adb -s emulator-5554 shell pm grant app.couchtv.launcher android.permission.READ_TV_LISTINGS
"$PY" -I -c "exec(open('$D/continue_watching.py').read().split('async def main')[0]); clear_seeded()"
rc=0; for t in focus_order continue_watching picks_row setup_screen; do echo "== $t"; "$PY" -I "$D/$t.py" || rc=1; done; exit $rc
