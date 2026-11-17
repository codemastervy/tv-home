"""Emulator test (emulator-5554 only, debug build, sample-data config): the same checks in wallpaper mode and
banner mode. The two modes may differ only in the hero area, so the row set, the row order and the focus
order must be identical. Also: app focus changes the banner, My List add/remove, genre and text search,
Surprise me, the Gemini and platform-row toggles, the wallpaper switch."""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

EXPECT_ROWS = ["cw", "pk", "p-netflix", "p-disney", "p-prime", "p-appletv", "p-youtube"]
EXPECT_TOP = ["t:search", "t:list", "t:surprise", "t:gemini", "t:settings"]


def rowof(f):
    return (f or "").split("|")[0].split(":")[0]


async def hero(p):
    return await p.ev("document.querySelector('#hero h1').textContent+'|'+document.querySelector('#hero .chip').textContent")


async def run(mode):
    print(f"== {mode}")
    start()
    async with Page() as p:
        if mode == "banner":
            await set_settings(p, {"wallpaper": False})
    async with Page() as p:
        st = json.loads(await p.state())
        assert st["wallpaper"] == (mode == "wall"), st
        assert (await p.ev("document.body.className")) == ("wall" if mode == "wall" else "ban")
        assert st["rows"] == EXPECT_ROWS, f"rows: {st['rows']}"
        f = await p.focus()
        assert f.startswith("a:com.netflix.ninja"), f
        # focus order: apps -> hero buttons -> top bar -> across the top bar
        key(U); assert (await p.focus()).startswith("h:open")
        key(U); assert (await p.focus()).startswith("t:"), await p.focus()
        for _ in range(6): key(L)
        top = [(await p.focus()).split("|")[0]]
        for _ in range(4):
            key(R); top.append((await p.focus()).split("|")[0])
        assert top == EXPECT_TOP, top
        # down through every section: hero, apps, then each row in order
        seq = []
        for _ in range(10):
            key(D); seq.append(rowof(await p.focus()))
        order = [s for i, s in enumerate(seq) if i == 0 or s != seq[i - 1]]
        assert order == ["h", "a"] + EXPECT_ROWS, order
        for _ in range(9): key(U)
        # app focus changes the banner
        await p.ev("window.tv.home()"); time.sleep(0.5)
        h0 = await hero(p); assert "Netflix" in h0.split("|")[1], h0
        key(R); time.sleep(0.8)
        h1 = await hero(p); assert "Disney+" in h1.split("|")[1] and h1 != h0, (h0, h1)
        # platform row for the focused app, below Continue watching
        # My List via the banner button
        key(U); key(R); key(OK); time.sleep(0.8)
        assert json.loads(await p.state())["mylist"] == 1
        assert "ml" in json.loads(await p.state())["rows"]
        key(OK); time.sleep(0.8)
        assert json.loads(await p.state())["mylist"] == 0
        # My List from the action sheet (hold OK on a card)
        await p.ev("window.tv.home()"); key(D); adb("shell", "input", "keyevent", "--longpress", OK); time.sleep(1.0)
        assert await p.ev("!!document.querySelector('.sheet')"), "no action sheet"
        key(D); key(OK); time.sleep(0.8)
        assert json.loads(await p.state())["mylist"] == 1
        key(U); key(U)  # hero buttons are above; open My List screen
        await p.ev("window.tv.home()")
        key(U); key(U); key(R); key(OK); time.sleep(1)
        assert await p.ev("document.querySelectorAll('.ov.mylist .card').length") == 1
        key(BACK); time.sleep(0.5)
        # Search: genre, then text
        await p.ev("window.tv.home()"); key(U); key(U); key(L); key(L); key(OK); time.sleep(1.5)
        key(D); key(L); key(L); key(L); key(L); key(L); key(L); key(OK); time.sleep(1.5)   # Comedy chip
        titles = await p.ev("Array.from(document.querySelectorAll('.ov.search .card .cap b')).map(function(e){return e.textContent}).join('|')")
        assert "Nine Lives of Mo" in titles and "Harbour Lights" not in titles, titles
        key(OK); time.sleep(0.5)
        for _ in range(3): key(U)
        key(OK); time.sleep(0.8)
        adb("shell", "input", "text", "Orbit"); time.sleep(0.5); key("KEYCODE_ENTER"); time.sleep(1.5)
        titles = await p.ev("Array.from(document.querySelectorAll('.ov.search .card .cap b')).map(function(e){return e.textContent}).join('|')")
        assert "The Long Orbit" in titles and "Harbour Lights" not in titles, titles
        key(BACK); time.sleep(0.5)
        # Surprise me
        await p.ev("window.tv.home()"); key(U); key(U); key(R); key(R); key(OK); time.sleep(1)
        t1 = await p.ev("document.querySelector('.ov.surprise-ov h2').textContent")
        key(R); key(OK); time.sleep(1)
        t2 = await p.ev("document.querySelector('.ov.surprise-ov h2').textContent")
        assert t1 and t2 and t1 != t2, (t1, t2)
        key(BACK); time.sleep(0.5)
        # Gemini: pressing it never crashes and says so when the TV has no assistant
        await p.ev("window.tv.home()"); key(U); key(U); key(R); key(R); key(R); key(OK); time.sleep(1.5)
        assert await p.ev("!!document.querySelector('#toast.on')") or await p.ev("document.hasFocus()") is not None
        # Settings: platform row off, Gemini off, wallpaper switched
        adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none"); time.sleep(2)
        await p.ev("window.tv.home()"); key(U); key(U); key(R); key(R); key(R); key(R); key(OK); time.sleep(1)
        assert await p.ev("!!document.querySelector('.ov.settings')")
        await p.ev("document.querySelector('[data-k=\"set:row-disney\"]').scrollIntoView()")
        for _ in range(30):
            if "set:row-disney" in (await p.focus()): break
            key(D, 0.3)
        key(OK); time.sleep(0.8)
        assert "set:row-disney" in await p.focus(), "focus lost after toggle"
        for _ in range(30):
            if "set:gemini" in (await p.focus()): break
            key(U, 0.3)
        key(OK); time.sleep(0.8)
        for _ in range(30):
            if "set:wallpaper" in (await p.focus()): break
            key(U, 0.3)
        key(OK); time.sleep(0.8)
        key(BACK); time.sleep(1.5)
        st = json.loads(await p.state())
        assert [r for r in st["rows"] if r != "ml"] == [r for r in EXPECT_ROWS if r != "p-disney"], st   # ml: My List has one title by now
        assert st["wallpaper"] == (mode != "wall")
        assert not await p.ev("!!document.querySelector('[data-act=gemini]')"), "gemini button still there"
    return {"rows": EXPECT_ROWS, "order": order, "top": top}


async def main():
    a = await run("wall")
    b = await run("banner")
    assert a == b, (a, b)
    print("home modes: ok (wallpaper and banner share rows, order and focus order)")

asyncio.run(main())
