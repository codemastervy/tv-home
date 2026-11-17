#!/usr/bin/env python3
"""Interactive setup for the TV home. Asks one question at a time and writes config.json
(git-ignored). Plain questions and fixed tables only: no network, no AI, nothing typed here is
ever run as a command. Scripted use: pipe the answers in, one per line (see tests/test_setup.py).

  python3 setup.py [--out config.json] [--force]
"""
import json, os, re, sys
from zoneinfo import ZoneInfo

SCENES = ["night", "golden", "water", "fog", "dawn"]
# Fixed table: the name you type -> Android package. Anything else must look like a package name.
APPS = {
    "youtube": "com.google.android.youtube.tv", "netflix": "com.netflix.ninja",
    "disney": "com.disney.disneyplus", "prime": "com.amazon.amazonvideo.livingroom",
    "appletv": "com.apple.atve.androidtv.appletv", "spotify": "com.spotify.tv.android",
    "youtube music": "com.google.android.youtube.tvmusic", "plex": "com.plexapp.android",
    "kodi": "org.xbmc.kodi", "twitch": "tv.twitch.android.app",
}
PKG = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$")
URL = re.compile(r"^https?://[^\s'\"<>\\`$]+$", re.I)
MAX_PICKS = 8


def ask(q, default=None):
    d = f" [{default}]" if default not in (None, "") else ""
    try:
        a = input(f"\n{q}{d}\n> ").strip()
    except EOFError:
        a = ""
    return a or (default or "")


def yes(q, default="yes"):
    while True:
        a = ask(q + " (yes/no)", default).lower()
        if a in ("yes", "y"):
            return True
        if a in ("no", "n"):
            return False
        print("  Please answer yes or no.")


def pick_wallpaper():
    return yes("1 Wallpaper: a full-screen scene behind the home? (no = a recommendations banner instead)")


def pick_scenes():
    while True:
        a = ask("2 Scenes, in the order they take turns. Choose from: " + ", ".join(SCENES) +
                ". Comma separated, blank = all", "")
        names = [x.strip().lower() for x in a.split(",") if x.strip()] or list(SCENES)
        bad = [n for n in names if n not in SCENES]
        if not bad:
            return list(dict.fromkeys(names))
        print("  Not a scene:", ", ".join(bad))


def pick_apps():
    print("\n3 Apps, first = first on the home. Names I know: " + ", ".join(APPS) +
          ".\n    Or type an Android package name (like com.example.app). Comma separated.")
    while True:
        a = ask("Your apps, in order (blank = leave the default order)", "")
        out, bad = [], []
        for x in [y.strip() for y in a.split(",") if y.strip()]:
            p = APPS.get(x.lower()) or (x if PKG.match(x) else None)
            (out if p else bad).append(p or x)
        if not bad:
            return list(dict.fromkeys(out))
        print("  Not an app name or package:", ", ".join(bad))


# package -> platform id, for the per-platform "What's on ..." rows
PLATFORMS = {"com.netflix.ninja": "netflix", "com.disney.disneyplus": "disney",
             "com.amazon.amazonvideo.livingroom": "prime", "com.apple.atve.androidtv.appletv": "appletv",
             "com.google.android.youtube.tv": "youtube"}
NAMES = {"netflix": "Netflix", "disney": "Disney+", "prime": "Prime Video", "appletv": "Apple TV", "youtube": "YouTube"}
KEY = re.compile(r"^[A-Za-z0-9]{16,64}$")
REGION = re.compile(r"^[A-Z]{2}$")


def pick_platform_rows(apps):
    rows = {}
    for pkg in apps:
        pid = PLATFORMS.get(pkg)
        if pid:
            rows[pid] = yes(f"4 Show a \"What's on {NAMES[pid]}\" row (that app's own recommendations)?")
    return rows


def pick_tmdb():
    print("\n5 TMDB (optional, off by default): adds suggestions and search results from themoviedb.org for your apps only,"
          "\n  including rent/buy. Needs your own free API key; it goes in config.json, which git ignores.")
    if not yes("Turn TMDB on?", "no"):
        return {"enabled": False, "api_key": "", "region": "NZ"}
    while True:
        region = ask("  Country code for what is available to you", "NZ").upper()
        if REGION.match(region):
            break
        print("  Two letters, like NZ.")
    while True:
        key = ask("  Your TMDB v3 API key (blank = I will add it to config.json later)", "")
        if not key or KEY.match(key):
            break
        print("  That does not look like a v3 API key (16-64 letters and digits).")
    return {"enabled": True, "api_key": key, "region": region}


def pick_gemini():
    return yes("6 Gemini button in the top bar (opens the TV's own assistant; this app has no AI)?")


def pick_clock():
    while True:
        a = ask("7 Clock: system (follow the TV), 12 or 24 hour", "system").lower()
        if a in ("system", "12", "24"):
            break
        print("  Answer system, 12 or 24.")
    return a, yes("  Show the date under the clock?")


def pick_picks():
    print(f"\n8 Your own picks: cards shown in a random order (up to {MAX_PICKS}). Leave the name blank to finish.")
    out = []
    while len(out) < MAX_PICKS:
        title = ask(f"Pick {len(out) + 1} name (blank = done)", "")
        title = re.sub(r"[\x00-\x1f\x7f]+", " ", title).strip()[:40]
        if not title:
            break
        while True:
            target = ask("  Opens which app (name or package) or link (https://...)?", "")
            card = {"title": title}
            if target.lower() in APPS or PKG.match(target):
                card["app"] = APPS.get(target.lower(), target)
            elif URL.match(target):
                card["url"] = target
            else:
                print("  Please give a known app name, a package name, or an http(s) link.")
                continue
            break
        img = ask("  Picture link (https://..., blank = none)", "")
        if img:
            if URL.match(img):
                card["image"] = img
            else:
                print("  Not an http(s) link, so no picture.")
        out.append(card)
    return out


def pick_weather():
    place = ask("9 Weather place name (blank = no weather on the home)", "")
    if not place:
        return None
    place = re.sub(r"[\x00-\x1f\x7f]+", " ", place).strip()[:60]
    while True:
        ll = ask("  Latitude and longitude, like -41.28,174.77 (look it up on a map)", "")
        m = re.fullmatch(r"\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*", ll)
        if m and abs(float(m.group(1))) <= 90 and abs(float(m.group(2))) <= 180:
            break
        print("  That is not a latitude,longitude pair.")
    while True:
        tz = ask("  Time zone name, like Pacific/Auckland", "")
        try:
            ZoneInfo(tz)
            break
        except Exception:
            print("  Not a time zone name (Region/City).")
    return {"lat": float(m.group(1)), "lon": float(m.group(2)), "place": place, "timezone": tz}


def build():
    wall = pick_wallpaper()
    scenes = pick_scenes() if wall else list(SCENES)
    apps = pick_apps()
    rows = pick_platform_rows(apps)
    tmdb = pick_tmdb()
    gemini = pick_gemini()
    clock, date = pick_clock()
    picks, weather = pick_picks(), pick_weather()
    cfg = {"home": {"wallpaper": wall, "scenes": scenes, "scene_seconds": 20, "app_order": apps,
                    "platform_rows": rows, "gemini": gemini, "clock": clock, "show_date": date, "picks": picks},
           "tmdb": tmdb}
    if weather:
        cfg["weather"] = weather
    return cfg


def main(argv):
    out = "config.json"
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    if os.path.exists(out) and "--force" not in argv:
        if ask(f"{out} already exists. Overwrite? (yes/no)", "no").lower() != "yes":
            print("Left it alone.")
            return 1
    cfg = build()
    with open(out, "w") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    print(f"\nWrote {out} (git-ignored). Next: CONFIG={out} sh scripts/build-apk.sh, then see SETUP.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
