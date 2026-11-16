"""Focus-order test on the Android TV emulator (never a real TV).
Drives the D-pad with adb and reads document.activeElement from the home's WebView over the
Chrome DevTools protocol (needs a DEBUG build: WebView debugging is on only there).
Usage: focus_order.py [serial, default emulator-5554]   (refuses any serial that is not emulator-*)
"""
import asyncio, json, subprocess, sys, time, urllib.request
import websockets

SERIAL = sys.argv[1] if len(sys.argv) > 1 else "emulator-5554"
assert SERIAL.startswith("emulator-"), "emulator only"
PKG = "app.couchtv.launcher"
PORT = 9333
# (key, label that must be focused afterwards). Default layout: header (profile) top-left,
# Sleep timer top-right, a shelf of 3 random picks, one apps row: YouTube, Cast moderator, Settings, More apps.
# Picks are shuffled on every open, so the shelf is checked by kind, the apps row by name.
D, R, L, U = "KEYCODE_DPAD_DOWN", "KEYCODE_DPAD_RIGHT", "KEYCODE_DPAD_LEFT", "KEYCODE_DPAD_UP"
N, A = "tile.ncard", "tile.app"   # a picks/continue card, an app tile (picks are shuffled: shelf checked by kind)
# Start: the first app (YouTube, from home.app_order in tests/emulator/test-config.json). The middle of the
# apps row depends on what the emulator image has installed, so it is checked as a loop: RIGHT must visit
# only app tiles, include Settings, end on "More apps" and wrap to YouTube; LEFT from YouTube is "More apps".
# UP from the row goes to the shelf (a pick), then Sleep timer, then back to the row.
WALK = [(R, A)] * 3 + [(L, A)] * 3 + [(U, N), (U, "Sleep timer"), (U, "YouTube")]


def adb(*a):
    return subprocess.run(["adb", "-s", SERIAL, *a], capture_output=True, text=True).stdout


def key(k):
    adb("shell", "input", "keyevent", k)
    time.sleep(0.6)


async def main():
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")  # resets the crash guard, like apply.sh
    time.sleep(7)
    pid = adb("shell", "pidof", PKG).strip()
    adb("forward", f"tcp:{PORT}", f"localabstract:webview_devtools_remote_{pid}")
    tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
    ws_url = tabs[0]["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url, max_size=None) as ws:
        n = 0

        async def ev(expr):
            nonlocal n
            n += 1
            await ws.send(json.dumps({"id": n, "method": "Runtime.evaluate",
                                      "params": {"expression": expr, "returnByValue": True}}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == n:
                    return r["result"]["result"].get("value")

        # The home draws focus itself: the focused tile carries the CSS class "focus".
        probe = ("(function(){var a=document.querySelector('.focus');if(!a)return null;"
                 "var t=(a.getAttribute('aria-label')||a.textContent||a.id||'').replace(/\\s+/g,' ').trim().slice(0,30);"
                 "return a.className.split(' ').slice(0,2).join('.')+'|'+t})()")
        # First run asks "Make couch-tv your home screen?": answer "Not now" (DOWN, OK) so the row is reachable.
        first = await ev(probe) or ""
        if "Yes, show me" in first:
            key("KEYCODE_DPAD_DOWN")
            key("KEYCODE_DPAD_CENTER")
            time.sleep(1)
        trail = [await ev(probe)]
        # Walk and compare with the expected focus order for the default layout.
        # (When apps/rows are customised, update EXPECTED: it is the written spec of the focus order.)
        for k, _ in WALK:
            key(k)
            trail.append(await ev(probe))
        row = []   # now loop RIGHT around the apps row
        for _ in range(12):
            key(R); row.append((await ev(probe)) or "")
            if "YouTube" in row[-1]:
                break
        names = [r.split("|")[-1] for r in row]
        print("apps row after YouTube:", names)
        assert names[-1] == "YouTube" and "Settings" in names and names[-2] == "More apps", f"apps row loop wrong: {names}"
        key(L)
        assert "More apps" in ((await ev(probe)) or ""), "LEFT from YouTube should wrap to More apps"
    adb("forward", "--remove", f"tcp:{PORT}")
    got = [t for t in trail]
    print("\n".join(f"{i}: {t}" for i, t in enumerate(got)))
    assert "YouTube" in (got[0] or ""), "app_order did not put YouTube first"
    exp = [None] + [e for _, e in WALK]
    bad = [(i, g, e) for i, (g, e) in enumerate(zip(got, exp)) if e not in (None, "?") and e not in (g or "")]
    assert not bad, f"focus order differs: {bad}"
    print("focus order: ok")


asyncio.run(main())
