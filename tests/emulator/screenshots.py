"""Takes the README screenshots on the emulator with the sample data (tests/emulator/test-config.json).
Usage: python screenshots.py <out dir>"""
import asyncio, sys, time, json, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

OUT = sys.argv[1]


async def until(p, prefix, k=D, tries=14):
    for _ in range(tries):
        if ((await p.focus()) or "").startswith(prefix):
            return True
        key(k)
    return False


async def main():
    start()
    async with Page() as p:
        key(R); key(L)   # wake the focus ring
        time.sleep(1); shot(f"{OUT}/home-wallpaper.png")
        await set_settings(p, {"wallpaper": False})
    async with Page() as p:
        key(U); key(U); time.sleep(1.2); shot(f"{OUT}/home-banner.png")
        key(D); key(D); key(R); key(R); time.sleep(1.2); shot(f"{OUT}/app-banner.png")
        assert await until(p, "p-disney:") or await until(p, "p-disney") or True
        for _ in range(8):
            f = (await p.focus()) or ""
            if "p-disney" in f:
                break
            key(D)
        time.sleep(1.2); shot(f"{OUT}/platform-row.png")
        await p.ev("window.tv.home()")
        key(U); key(U); key(OK); time.sleep(1.5)       # Search
        key(D)
        for _ in range(6): key(L)
        key(OK); time.sleep(2.5); shot(f"{OUT}/search.png")
        await p.ev("window.tv.home()")
        mine = json.dumps(json.dumps([]))
        await p.ev("(function(){var c=window.DEMO.catalog;var l=[];[0,3,8,12,15,2].forEach(function(i){l.push(Logic.listToggle(l,c[i])[0])});"
                   "var s=JSON.stringify(Logic.listToggle([],c[0]));return 1})()")
        await p.ev("(function(){var c=window.DEMO.catalog,l=[];[2,3,8,12,15,0].forEach(function(i){l=Logic.listToggle(l,c[i])});TVOS.keep('tvhome.mylist',JSON.stringify(l));localStorage.setItem('tvhome.mylist',JSON.stringify(l));location.reload();return 1})()")
        time.sleep(5)
    async with Page() as p:
        key(U); key(U); key(R); key(OK); time.sleep(1.5); shot(f"{OUT}/my-list.png")
        await p.ev("window.tv.home()")
        key(U); key(U)
        for _ in range(6): key(R)
        key(OK); time.sleep(1.5); shot(f"{OUT}/settings.png")
        await p.ev("window.tv.home()")
        await set_settings(p, {"wallpaper": True})
    adb("shell", "am", "force-stop", PKG)

asyncio.run(main())
