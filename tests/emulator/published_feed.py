"""Emulator test: what a non-system app can read from the TV provider. Seeds a preview channel with two
programs (as the shell, emulator only), then checks the launcher's TVOS.published() returns them and that
the diagnosis says READ_TV_LISTINGS alone was enough. Needs a debug build, not the sample-data mode result."""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

CH = "content://android.media.tv/channel"
PP = "content://android.media.tv/preview_program"


def seed():
    out = adb("shell", f"content insert --uri {CH} --bind input_id:s:app.test/.Svc --bind type:s:TYPE_PREVIEW --bind display_name:s:SeedChan")
    q = adb("shell", f"content query --uri {CH} --projection _id:display_name")
    cid = [l for l in q.splitlines() if "display_name=SeedChan" in l][-1].split("_id=")[1].split(",")[0]
    for t, g in (("SeedFilmOne", "COMEDY"), ("SeedFilmTwo", "DRAMA")):
        adb("shell", f"content insert --uri {PP} --bind channel_id:i:{cid} --bind type:i:0 --bind title:s:{t} --bind short_description:s:seeded --bind canonical_genre:s:{g}")
    return cid


def unseed():
    for row in adb("shell", f"content query --uri {PP} --projection _id:package_name").splitlines():
        if "package_name=com.android.shell" in row:
            adb("shell", f"content delete --uri {PP}/" + row.split("_id=")[1].split(",")[0])
    for row in adb("shell", f"content query --uri {CH} --projection _id:package_name").splitlines():
        if "package_name=com.android.shell" in row:
            adb("shell", f"content delete --uri {CH}/" + row.split("_id=")[1].split(",")[0])


async def main():
    unseed(); seed()
    try:
        start()
        async with Page() as p:
            r = json.loads(await p.ev("TVOS.published()"))
        titles = [i["title"] for i in r["items"] if i["package"] == "com.android.shell"]
        print("diag:", r["diag"])
        assert r["diag"]["permission"] is True and r["diag"]["previewPrograms"] >= 2, r["diag"]
        assert sorted(titles) == ["SeedFilmOne", "SeedFilmTwo"], titles
        assert {i["genre"] for i in r["items"] if i["package"] == "com.android.shell"} == {"COMEDY", "DRAMA"}
        print("published feed: ok")
    finally:
        unseed()

asyncio.run(main())
