"""On-TV setup screen (Home settings) on the emulator, D-pad only: opens from the Settings tile,
checks the order of the sections (look and scenes, apps, own picks, location/weather, ...), then
walks the Own picks list and toggles one. Emulator only; needs a DEBUG build."""
import asyncio, json, os, subprocess, sys, time, urllib.request
import websockets

SERIAL = sys.argv[1] if len(sys.argv) > 1 else "emulator-5554"
assert SERIAL.startswith("emulator-"), "emulator only"
PKG, PORT = "app.couchtv.launcher", 9336
SECTIONS = ["What's on", "Language", "Location", "Weather", "Look and scenes", "Apps", "Own picks", "Quick buttons", "About"]
PICKS = ["YouTube", "Netflix", "Disney+", "Prime Video", "Apple TV", "Spotify", "YouTube Music", "Plex", "Kodi", "Twitch"]


def adb(*a):
    return subprocess.run(["adb", "-s", SERIAL, *a], capture_output=True, text=True).stdout


def shot(name):
    """Set SHOTS=<dir> to save screenshots of the screens as the test walks them (used for docs/screens/)."""
    d = os.environ.get("SHOTS")
    if d:
        with open(os.path.join(d, name + ".png"), "wb") as f:
            f.write(subprocess.run(["adb", "-s", SERIAL, "exec-out", "screencap", "-p"], capture_output=True).stdout)


def key(k):
    adb("shell", "input", "keyevent", "KEYCODE_" + k)
    time.sleep(0.6)


async def main():
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")
    time.sleep(9)
    adb("forward", f"tcp:{PORT}", f"localabstract:webview_devtools_remote_{adb('shell', 'pidof', PKG).strip()}")
    tabs = None
    for _ in range(10):
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json")); break
        except Exception:
            time.sleep(2)
    assert tabs, "DevTools not reachable (debug build?)"
    async with websockets.connect(tabs[0]["webSocketDebuggerUrl"], max_size=None) as ws:
        n = [0]

        async def ev(expr):
            n[0] += 1
            await ws.send(json.dumps({"id": n[0], "method": "Runtime.evaluate", "params": {"expression": expr, "returnByValue": True}}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == n[0]:
                    return r["result"]["result"].get("value")

        def txt(sel):
            return f"((document.querySelector('{sel}')||{{}}).textContent||'').trim()"

        first = await ev(txt(".focus"))
        if "Yes, show me" in first:
            key("DPAD_DOWN"); key("DPAD_CENTER"); time.sleep(1)
        shot("home")
        # the dock has no gear tile: Settings is the top-right button, reached with Up from the dock
        assert not await ev("document.querySelector('#grid .face.tool svg path[d^=\"M19.4 15\"]')"), "the dock still has a gear tile"
        for _ in range(3):
            if await ev("(document.querySelector('.qbtn.focus')||{}).id || ''") == "q-settings":
                break
            key("DPAD_UP")
        assert await ev("(document.querySelector('.qbtn.focus')||{}).id || ''") == "q-settings", "never reached the top-right Settings button"
        key("DPAD_CENTER"); time.sleep(1)
        assert await ev("document.getElementById('settings').classList.contains('on')"), "setup screen did not open"
        key("DPAD_LEFT")                        # make sure the section list (left column) has focus
        got = [await ev(txt(".ssec.focus,.ssec.on"))]
        shot("setup-language")
        for _ in SECTIONS[1:]:
            key("DPAD_DOWN"); got.append(await ev(txt(".ssec.focus,.ssec.on")))
            if got[-1] in ("Look and scenes", "Location"):
                shot("setup-" + got[-1].split()[0].lower())
        print("sections:", got)
        assert got == SECTIONS, f"section order differs: {got}"
        for _ in range(2):
            key("DPAD_UP")                      # About -> Quick -> Own picks
        assert await ev(txt(".ssec.focus,.ssec.on")) == "Own picks"
        key("DPAD_RIGHT")                       # into the rows
        shot("setup-picks")
        rows = []
        for i in range(len(PICKS)):
            rows.append((await ev(txt(".srow.focus,.row.focus,#set-rows .focus"))).split("\n")[0][:20])
            if i < len(PICKS) - 1:
                key("DPAD_DOWN")
        print("picks rows:", rows)
        assert [r[:len(p)] for r, p in zip(rows, PICKS)] == PICKS, f"picks list order differs: {rows}"
        before = await ev("document.querySelectorAll('#set-rows .sbox.on').length")
        for _ in range(len(PICKS) - 1):
            key("DPAD_UP")
        key("DPAD_CENTER")                      # OK on YouTube adds or removes it (what is saved on the TV wins)
        after = await ev("document.querySelectorAll('#set-rows .sbox.on').length")
        assert abs(after - before) == 1, f"OK did not toggle the pick ({before} -> {after})"
        key("DPAD_CENTER")                      # and back, so the test can be run again
        assert await ev("document.querySelectorAll('#set-rows .sbox.on').length") == before
        key("BACK")
    adb("forward", "--remove", f"tcp:{PORT}")
    print("setup screen: ok")

asyncio.run(main())
