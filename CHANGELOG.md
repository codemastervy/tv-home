# Changelog (fork of Seagey/couch-tv, MIT)

Upstream is the `upstream` git remote. Pull updates with `git fetch upstream`.
This fork is the guest/rental TV home only (couch-tv option A): no phone remote, no bridge.

## Unreleased
- Removed: bridge/, remote/ (phone web UI), on-tv/, standalone/, sync/, other TV brands
  (lg, samsung, roku, tvos, vega, titan), their scripts, docs and tests, and the CI workflow.
  This also removes the Claude assistant (`claude -p`): no AI at runtime.
- MainActivity: any bridge address is ignored and a saved one is dropped; `alone()` is always true.
- scripts/build-apk.sh builds only the TV home, with self-update off (`UPDATE_REPO=`).
- Not used, ever: network discovery (find-tvs.py was removed).
- Picks row: `home.picks` (own cards, shown in random order, never fetched). Tests: tests/test_picks_row.js.
- Self-update off by default (`updateRepo` empty).
- Tests: tests/test_no_ads.sh; tests/emulator/{focus_order,continue_watching,picks_row}.py + run_all.sh.
- docs/TRACK-A.md: what is kept/removed and what is only emulator-proven.
- Setup: `setup.py` / `setup.sh` (one question at a time, fixed lists, writes git-ignored config.json) and SETUP.md for a person or an
  AI agent; `home.app_order`; the TV's Home settings gains an Own picks section. Tests: tests/test_setup.py, tests/emulator/setup_screen.py.
- Removed the broken `apply.sh`/`home-config.py` (they needed the removed bridge); `tv-home/tools/install.sh` replaces them (emulator-only by default).
- New README and own screenshots in docs/screens/ (upstream's screenshots removed).
