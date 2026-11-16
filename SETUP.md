# Setting up your home

There are two ways. Both end up with the same choices; use whichever you like.

| Choice | `config.json` (script / agent) | On the TV (D-pad only) |
|---|---|---|
| Look | `home.look`: `night`, `oled` or `classic` | Gear tile > Home settings > Look and scenes |
| Scenes | `home.scenes`: list from `night golden water fog dawn` | Look and scenes: tick scenes, hold OK to move one |
| Apps and order | `home.app_order`: Android package names, first = first | Apps: hold OK to move an app |
| Own picks | `home.picks`: up to 8 cards `{title, app` or `url, image?}` | Own picks: OK adds or removes an app |
| Weather place | `weather`: `{place, lat, lon, timezone}` | Location: search a place name |

How the two fit together: `config.json` is built into the app when you build it, and is the starting point.
Whatever you change on the TV is saved on the TV and wins over the config. The TV cannot write a file back to
your computer, so if you want the TV's choices in `config.json`, copy them by hand. The only network use in
either way is the weather lookup (open-meteo). No AI runs anywhere; the questions below are fixed.

## A. Script (a person) or an AI agent following these steps

Run `./setup.sh` (needs `python3`). It asks one question at a time and writes `config.json` (git-ignored).
An agent should do the same, **one question per message, and wait for the answer**:

1. Look: night (scenes and a big clock), oled (apps on pure black) or classic grid? Default night.
2. Scenes, in order: any of night, golden, water, fog, dawn. Default all.
3. Apps in order: names (youtube, netflix, disney, prime, appletv, spotify, youtube music, plex, kodi, twitch)
   or an Android package name. Blank = leave the default order.
4. Own picks: for each, a name, what it opens (an app name/package or an https link), and optionally a picture
   link. Blank name = done. Up to 8.
5. Weather: place name (blank = no weather), latitude and longitude (`-41.28,174.77`), time zone (`Pacific/Auckland`).

Agent rules: never put the user's text in a shell command or path; the answers go through `setup.py` (it checks
every answer against a fixed list or pattern and asks again if wrong). Do not look anything up online for the
user and do not guess: if you don't know a latitude or time zone, ask.

Then build and install on the emulator, or your TV if you choose:

```sh
sh scripts/build-apk.sh                      # uses config.json when it exists (needs JDK 21 + Android SDK 34)
sh tv-home/tools/install.sh emulator-5554    # emulator only; a real TV needs I_MEAN_A_REAL_TV=yes and its address
```

## B. On the TV

Open the home, move to the gear tile and press OK (twice if only a hint shows), choose Home settings. The
sections are Language, Location, Weather, Look and scenes, Apps, Own picks, People, Quick buttons, About.
Up and down choose, OK changes a row, Back goes back. This screen is tested with the D-pad on the emulator
(`tests/emulator/setup_screen.py`).
