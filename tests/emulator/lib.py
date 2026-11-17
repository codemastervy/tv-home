"""Shared helpers for the emulator tests. Emulator only: any serial that is not emulator-* is refused.
Reads the home through the WebView's DevTools socket (debug builds only) and drives it with adb key events."""
import asyncio, json, subprocess, sys, time, urllib.request
import websockets

SERIAL = "emulator-5554"
assert SERIAL.startswith("emulator-"), "emulator only"
PKG, PORT = "app.couchtv.launcher", 9333


def adb(*a, raw=False):
    r = subprocess.run(["adb", "-s", SERIAL, *a], capture_output=True)
    return r.stdout if raw else r.stdout.decode(errors="replace")


def key(k, wait=0.55):
    adb("shell", "input", "keyevent", k)
    time.sleep(wait)


D, R, L, U, OK, BACK = ("KEYCODE_DPAD_DOWN", "KEYCODE_DPAD_RIGHT", "KEYCODE_DPAD_LEFT", "KEYCODE_DPAD_UP",
                        "KEYCODE_DPAD_CENTER", "KEYCODE_BACK")


def shot(path):
    open(path, "wb").write(adb("exec-out", "screencap", "-p", raw=True))


class Page:
    def __init__(self):
        self.n = 0

    async def __aenter__(self):
        pid = adb("shell", "pidof", PKG).strip()
        adb("forward", f"tcp:{PORT}", f"localabstract:webview_devtools_remote_{pid}")
        tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
        self.ws = await websockets.connect(tabs[0]["webSocketDebuggerUrl"], max_size=None)
        return self

    async def __aexit__(self, *a):
        await self.ws.close()
        adb("forward", "--remove", f"tcp:{PORT}")

    async def ev(self, expr):
        self.n += 1
        await self.ws.send(json.dumps({"id": self.n, "method": "Runtime.evaluate",
                                       "params": {"expression": expr, "returnByValue": True, "awaitPromise": True}}))
        while True:
            r = json.loads(await self.ws.recv())
            if r.get("id") == self.n:
                return r["result"]["result"].get("value")

    async def focus(self):
        return await self.ev("(function(){var a=document.querySelector('.focus');return a?(a.getAttribute('data-k')||'')+'|'+(a.getAttribute('aria-label')||a.textContent).replace(/\\s+/g,' ').trim().slice(0,40):null})()")

    async def state(self):
        return await self.ev("JSON.stringify(window.__home.state())")


def start(config_settings=None):
    """Fresh start of the home. config_settings: dict saved as the on-TV settings first (None = none)."""
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "pm", "clear", PKG)
    adb("shell", "pm", "grant", PKG, "android.permission.READ_TV_LISTINGS")
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")
    time.sleep(8)


async def set_settings(p, st):
    s = json.dumps(json.dumps({"s": st, "updated": 1, "pending": False}))
    await p.ev(f"TVOS.keep('tvhome.settings', {s}); localStorage.setItem('tvhome.settings', {s}); location.reload(); 1")
    time.sleep(5)
