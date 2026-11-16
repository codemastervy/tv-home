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
N, A, H = "tile.ncard", "tile.app", "people.head"   # a picks/continue card, an app tile, the profile bubble
WALK = [(D, N), (R, N), (R, N), (R, N), (R, N),                  # shelf (picks), it wraps at the end
        (D, A), (R, "Settings"), (R, "More apps"), (R, "YouTube"), (R, "Cast moderator"),   # apps row wraps
        (L, "YouTube"), (U, N), (U, H)]                          # up: back to the shelf, then the header


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
    adb("forward", "--remove", f"tcp:{PORT}")
    got = [t for t in trail]
    print("\n".join(f"{i}: {t}" for i, t in enumerate(got)))
    exp = [None] + [e for _, e in WALK]
    bad = [(i, g, e) for i, (g, e) in enumerate(zip(got, exp)) if e not in (None, "?") and e not in (g or "")]
    assert not bad, f"focus order differs: {bad}"
    print("focus order: ok")


asyncio.run(main())
