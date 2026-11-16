"""Continue-watching test on the emulator: a Watch Next row (what Google TV shows as "Continue
watching") is seeded into the system TV provider, and must appear on the couch-tv home.
Emulator only. Needs a DEBUG build (WebView debugging)."""
import asyncio, json, subprocess, sys, time, urllib.request
import websockets

SERIAL = sys.argv[1] if len(sys.argv) > 1 else "emulator-5554"
assert SERIAL.startswith("emulator-"), "emulator only"
PKG, PORT, TITLE = "app.couchtv.launcher", 9334, "SeededContinueShow"
URI = "content://android.media.tv/watch_next_program"


def adb(*a):
    return subprocess.run(["adb", "-s", SERIAL, *a], capture_output=True, text=True).stdout


def clear_seeded():
    """The provider refuses selections, so delete by row id (rows seeded from adb shell belong to com.android.shell)."""
    import re
    out = adb("shell", f"content query --uri {URI} --projection _id:package_name")
    for m in re.finditer(r"_id=(\d+), package_name=com\.android\.shell", out):
        adb("shell", f"content delete --uri {URI}/{m.group(1)}")


async def page_text():
    pid = adb("shell", "pidof", PKG).strip()
    adb("forward", f"tcp:{PORT}", f"localabstract:webview_devtools_remote_{pid}")
    try:
        tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
        async with websockets.connect(tabs[0]["webSocketDebuggerUrl"], max_size=None) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                      "params": {"expression": "document.body.innerText", "returnByValue": True}}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == 1:
                    return r["result"]["result"].get("value") or ""
    finally:
        adb("forward", "--remove", f"tcp:{PORT}")


async def main():
    adb("shell", "pm", "grant", PKG, "android.permission.READ_TV_LISTINGS")
    clear_seeded()
    adb("shell", f"content insert --uri {URI} --bind type:i:0 --bind watch_next_type:i:0 "
                 f"--bind title:s:{TITLE} --bind internal_provider_id:s:seed "
                 f"--bind last_engagement_time_utc_millis:l:{int(time.time())}000")
    try:
        adb("shell", "am", "force-stop", PKG)
        adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", "--es", "bridge", "none")  # resets the crash guard, like apply.sh
        time.sleep(8)
        txt = await page_text()
        assert TITLE in txt, "seeded Watch Next row is not on the home"
        print("continue watching: ok (seeded row shown on the home)")
    finally:
        clear_seeded()

asyncio.run(main())
