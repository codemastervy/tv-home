# Track A: personal TV home (fork notes)

Fork of Seagey/couch-tv (MIT), TV home only (couch-tv "option A"). Upstream stays as the `upstream` remote.

## What was removed
bridge/ (phone remote server), remote/ (phone web UI), on-tv/, standalone/, sync/, the Samsung/LG/Roku/
Apple TV/Fire/Philips remotes, their scripts, docs and tests, the CI workflow, `scripts/find-tvs.py`
(network discovery, never used) and `scripts/check-tv.py`. This also removes the Claude assistant
(`claude -p`): no AI at runtime. In the app, `MainActivity.alone()` is always true and any bridge address
passed in is ignored and erased, so nothing probes the network for a bridge. There is no QR code in
upstream's TV home (searched the whole tree), so there was nothing to remove. The phone remote used a typed
address, not a QR. Control of the TV comes from Home Assistant's own remote (Track B).

## What the home keeps and shows (emulator results)
- Scenes, clock, weather header, people bubble, app row, Sleep timer: working on the API 34 TV emulator.
- **Ads:** none. `tests/test_no_ads.sh` lists every host the home references (9) and fails on any host
  not on an allowlist or that looks like an ad/tracker network. Self-update is off in this fork
  (`updateRepo` defaults to empty), so github.com is not contacted. The one real network call is weather
  (open-meteo); the app's art route only fetches pictures that the TV's Watch Next list handed it.
- **Continue watching (kept):** the home reads Android's own TV provider (`content://android.media.tv/
  watch_next_program`, plus preview channels such as Stremio's "Continue Watching") with
  `READ_TV_LISTINGS`. That is the data Google TV's own "Continue watching" row is made from, and it does not
  need Google's home to be running. Proven on the emulator by seeding a Watch Next row
  (`tests/emulator/continue_watching.py`).
- **Not kept: Google's recommendation banner / "For you" rows.** Those come from Google's own home app
  and are not exposed through a public provider. A replacement home cannot show them. Only apps that publish
  Watch Next entries or their own preview channels are readable. Whether the real TCL does the same is only
  provable on the TCL (not tested).
- **Random picks row (new):** `home.picks` in the config is a list of your own cards (title, subtitle, an
  installed app package or an http(s) link). They show in random order on each open in the shelf, at most 8,
  and D-pad scrolls them (`tests/test_picks_row.js`, `tests/emulator/picks_row.py`). They are not fetched
  from apps: no public API gives an app's recommendations. Your own list is the source, as the brief allowed.
  The setup (SETUP.md) writes them; `tests/emulator/test-config.json` has test ones.

## Tests
- Unit/JS: `for f in tests/*.js; do node $f; done` and `sh tests/test_no_ads.sh`.
- Emulator (emulator-5554 only, refuses other serials; needs a DEBUG build, because WebView debugging is
  how the tests read focus): `gradlew -p tv-home/android assembleDebug -PconfigJson=$PWD/config.example.json`,
  install it, then `sh tests/emulator/run_all.sh <python with websockets>`.
  `focus_order.py` presses the D-pad and checks the exact order across header, shelf and apps row (and wrap-around).
- Build: `UPDATE_REPO= sh scripts/build-apk.sh` needs JDK 21 and Android SDK 34.

## Only proven on the emulator
Everything above. Not proven on the TCL: the home taking over from Google's home (the emulator needed an
explicit launch; `apply.sh`'s Home-button watch was not exercised), TCL's own ad row, which Watch Next
apps the TCL has, remote focus feel. Nothing was installed on the real TV.

## Open choices (placeholders until answered)
Colours/look, which apps in which order, which scenes, the real picks, and the weather place (default is
Sydney from upstream's example config).
