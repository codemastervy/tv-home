"""Emulator test for the What's on home, in sample mode (tests/emulator/test-config.json, demo: true): focus order
top bar / hero / apps / Continue watching / rows, the hero following the focused app, wallpaper on vs off
(only the hero differs), My List (add, persist, remove) and Search (typing, genre chip, rent tag).
Emulator only. Needs a DEBUG build installed with that config (see run_all.sh)."""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

SET_NO_WALL = {"wallpaper": False}


async def st(p):
    return json.loads(await p.state())


async def boot(settings=None):
    start()
    async with Page() as p:
        if settings:
            await set_settings(p, settings)
    time.sleep(1)
    key(D, 0.5); key(OK, 0.8)   # "Not now" on the make-this-your-home question


async def walk(p):
    """Down the page from the first app and back up: the zones visited, in order."""
    seen = []
    for k in [U, U, D, D, D, D, D, D, U, U, U, U, U]:
        key(k, 0.45)
        s = await st(p)
        seen.append((s["zone"], s["xr"] if s["zone"] == "xrow" else None))
    return seen


async def main():
    # ---- wallpaper on
    await boot()
    async with Page() as p:
        s = await st(p)
        assert s["zone"] == "grid" and s["wallpaper"] is True, s
        assert [r["id"] for r in s["rows"]] == ["netflix", "disney", "prime", "appletv", "youtube"], s["rows"]
        assert s["hero"] == "Harbour Lights", s["hero"]   # the focused app (Netflix) has its own published title in the hero
        assert await p.ev("document.documentElement.classList.contains('no-wall')") is False
        on = await walk(p)
        print("wallpaper on:", on)
        assert [z for z, _ in on][:8] == ["hero", "quick", "hero", "grid", "shelf", "xrow", "xrow", "xrow"], on
        assert on[-1][0] == "hero", on
        # hero changes with the focused app
        key(D, 0.5); key(R, 0.5)   # down from the hero onto the first app, then the second
        s = await st(p)
        assert s["zone"] == "grid" and s["heroApp"] == "disney" and s["hero"] == "Little Comet", s
        print("hero follows app focus: ok")
        # My List from the hero
        key(U, 0.5); key(R, 0.4); key(OK, 0.6)
        s = await st(p)
        assert s["list"] == ["Little Comet"], s["list"]
    # persists over a restart (no pm clear)
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")
    time.sleep(9)
    async with Page() as p:
        assert (await st(p))["list"] == ["Little Comet"]
        print("My List persists: ok")
        # open My List from the top buttons and remove with the hold sheet
        for k in [U, U, L, L, L, L]: key(k, 0.4)
        key(OK, 0.7)
        assert (await st(p))["overlay"] == "list"
        await p.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));1")
        await asyncio.sleep(0.9)
        await p.ev("document.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,bubbles:true}));1")
        time.sleep(0.5)
        assert (await st(p))["overlay"] == "sheet"
        key(D, 0.4); key(OK, 0.6)
        s = await st(p)
        assert s["list"] == [], s
        print("My List remove via sheet: ok")
        key(BACK, 0.6)
        # Search: type, chip, rent tag
        key(L, 0.4)   # Back returned to My List's button; Search is the one before it
        key(OK, 0.7)
        assert (await st(p))["overlay"] == "search"
        for ch in "last":
            await p.ev(f"document.dispatchEvent(new KeyboardEvent('keydown',{{key:'{ch}',bubbles:true}}));1")
            time.sleep(0.2)
        time.sleep(0.5)
        s = await st(p)
        assert s["q"] == "last" and "Last Train North" in s["results"], s
        assert await p.ev("!!document.querySelector('.xtag')"), "rent tag"
        print("search text + rent tag: ok")
        for _ in range(4): await p.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true}));1"); time.sleep(0.15)
        # genre chip: Comedy (first chip): right off the keyboard
        key(U, 0.3)
        for _ in range(8): key(R, 0.25)
        s = await st(p)
        assert s["pane"] == "chips", s["pane"]
        key(OK, 0.8)
        s = await st(p)
        assert s["results"] and "Second Wind" in s["results"] and "Last Train North" not in s["results"], s["results"]
        print("genre chip: ok")
        key(BACK, 0.6)
    # ---- wallpaper off: same walk, only the hero differs
    await boot(SET_NO_WALL)
    async with Page() as p:
        s = await st(p)
        assert s["wallpaper"] is False and [r["id"] for r in s["rows"]] == ["netflix", "disney", "prime", "appletv", "youtube"], s
        assert await p.ev("document.documentElement.classList.contains('no-wall')") is True
        assert await p.ev("getComputedStyle(document.getElementById('scenes')).display") == "none"
        off = await walk(p)
        print("wallpaper off:", off)
        assert off == on, (on, off)
    print("reco emulator tests: ok")

asyncio.run(main())
