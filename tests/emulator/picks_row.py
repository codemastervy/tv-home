"""Own-picks row on the emulator: the row shows the picks from the config in random order and
scrolls with the D-pad. Emulator only; needs a DEBUG build."""
import asyncio, json, subprocess, sys, time, urllib.request
import websockets

SERIAL = sys.argv[1] if len(sys.argv) > 1 else "emulator-5554"
assert SERIAL.startswith("emulator-"), "emulator only"
PKG, PORT = "app.couchtv.launcher", 9335


def adb(*a):
    return subprocess.run(["adb", "-s", SERIAL, *a], capture_output=True, text=True).stdout


async def ev_factory():
    pid = adb("shell", "pidof", PKG).strip()
    adb("forward", f"tcp:{PORT}", f"localabstract:webview_devtools_remote_{pid}")
    tabs = None
    for _ in range(10):   # the DevTools socket can need a moment after launch
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
            break
        except Exception:
            time.sleep(2)
    assert tabs, "WebView DevTools not reachable (is this a debug build?)"
    ws = await websockets.connect(tabs[0]["webSocketDebuggerUrl"], max_size=None)
    n = [0]

    async def ev(expr):
        n[0] += 1
        await ws.send(json.dumps({"id": n[0], "method": "Runtime.evaluate",
                                  "params": {"expression": expr, "returnByValue": True}}))
        while True:
            r = json.loads(await ws.recv())
            if r.get("id") == n[0]:
                return r["result"]["result"].get("value")
    return ev, ws


async def launch():
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")  # resets the crash guard, like apply.sh
    time.sleep(9)
    ev, ws = await ev_factory()
    first = await ev("(document.querySelector('.focus')||{}).textContent||''")
    if "Yes, show me" in first:
        adb("shell", "input", "keyevent", "KEYCODE_DPAD_DOWN"); time.sleep(.5)
        adb("shell", "input", "keyevent", "KEYCODE_DPAD_CENTER"); time.sleep(1)
    return ev, ws


async def titles():
    ev, ws = await launch()
    try:
        r = await ev("Array.from(document.querySelectorAll('.ccard')).map(function(e){return e.textContent.trim()})")
        return r
    finally:
        await ws.close()
        adb("forward", "--remove", f"tcp:{PORT}")


async def main():
    seen = [tuple(await titles()) for _ in range(4)]
    print(seen)
    assert all(len(t) == 3 for t in seen), "the 3 placeholder picks should show"
    assert len(set(seen)) > 1, "order never changed across 4 opens"
    ev, ws = await launch()
    try:
        # DOWN x? reaches the shelf row; walk RIGHT through the cards, focus must advance on picks
        got = []
        for k in ["KEYCODE_DPAD_UP"] + ["KEYCODE_DPAD_RIGHT"] * 4:   # UP from the apps lands on the shelf, RIGHT scrolls along it
            adb("shell", "input", "keyevent", k); time.sleep(.6)
            got.append(await ev("(document.querySelector('.focus')||{}).textContent||''"))
        print(got)
        picks_focused = [g for g in got if "Test pick" in g]
        assert len(set(picks_focused)) >= 2, "D-pad did not scroll through the picks"
    finally:
        await ws.close()
        adb("forward", "--remove", f"tcp:{PORT}")
    print("picks row: ok (3 picks, random order, D-pad scrolls)")

asyncio.run(main())
