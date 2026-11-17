# Setting up

Two routes, same choices, same `config.json` shape. Whatever you change on the TV is saved on the TV and wins
over the file; the TV cannot write the file back.

| Choice | `config.json` | On the TV (Settings) |
|---|---|---|
| Wallpaper or banner | `home.wallpaper` true / false | What's on: Wallpaper |
| Scenes (wallpapers) | `home.scenes`, from `night golden water fog dawn` | file only |
| Apps and order | `home.app_order`: Android package names | file only |
| "What's on ..." row per platform | `home.platform_rows`: `{"netflix": true, ...}` | What's on: Rows |
| TMDB | `tmdb`: `{enabled, api_key, region}` | What's on: TMDB switch (the key goes in the file only) |
| Gemini button | `home.gemini` | What's on: Gemini button |
| Clock | `home.clock` system / 12 / 24, `home.show_date` | Look |
| Own picks | `home.picks`: up to 8 `{title, app or url, image?}` | Own picks |
| Weather | `weather`: `{place, lat, lon, timezone}` | Location, Weather |

## A. Script, or an AI agent following the same steps
`./setup.sh` (needs `python3`) asks these, one at a time, and writes `config.json` (git-ignored). An agent does
the same: **one question per message, wait for the answer.**

1. Wallpaper behind the home? (no = recommendations banner). Default yes.
2. Scenes, in order (only if wallpaper): any of night, golden, water, fog, dawn. Default all.
3. Apps in order: names (netflix, disney, prime, appletv, youtube, spotify, plex, kodi, twitch, ...) or package names.
4. For each streaming app you named: show its "What's on ..." row? Default yes.
5. TMDB (default no). If yes: country code (default NZ) and your own free v3 API key, or blank to add it to
   `config.json` later (`tmdb.api_key`). Get a key at themoviedb.org (free account, Settings, API).
6. Gemini button in the top bar? Default yes. It only opens the TV's own assistant.
7. Clock: system, 12 or 24 hour; show the date?
8. Own picks: name, what it opens (app or https link), optional picture link. Blank name = done.
9. Weather: place, latitude and longitude, time zone. Blank place = no weather.

Rules for an agent: put answers through `setup.py` only (it checks each one against a fixed list or pattern
and asks again), never into a shell command or path. Never look anything up online for the person. A TMDB key
is theirs: do not print it back, do not commit it, do not put it anywhere but `config.json`.

Then build and install on the emulator, or your own TV if you choose:
```sh
sh scripts/build-apk.sh
sh tv-home/tools/install.sh emulator-5554     # a real TV needs I_MEAN_A_REAL_TV=yes and its address
```
The key in `config.json` is built into your own APK (so keep the APK to yourself).

## B. On the TV
Top bar, Settings. Up and down choose, OK changes a row, Back goes back. "Make this my home screen" asks Android to
make this the home app.
