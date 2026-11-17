"""Setup with scripted answers: valid input writes the right config, bad input is re-asked."""
import json, os, subprocess, sys, tempfile, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = "abcdef0123456789abcdef0123456789"


def run(answers, *extra):
    out = os.path.join(tempfile.mkdtemp(), "config.json")
    p = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "setup.py"), "--out", out, *extra],
                       input="\n".join(answers) + "\n", capture_output=True, text=True, timeout=30)
    return p, out


class Setup(unittest.TestCase):
    def test_full_run(self):
        p, out = run(["no", "Netflix, youtube, disney, com.example.tv",    # banner look, apps
                      "yes", "no", "yes",                                   # platform rows: netflix, youtube off, disney on
                      "yes", "nz", KEY,                                     # TMDB on, region, key
                      "no", "24", "no",                                     # Gemini off, 24 hour, no date
                      "Film night", "netflix", "https://example.com/p.jpg", "",
                      "Wellington", "-41.29, 174.78", "Pacific/Auckland"])
        self.assertEqual(p.returncode, 0, p.stderr)
        c = json.load(open(out)); h = c["home"]
        self.assertEqual(h["wallpaper"], False)
        self.assertEqual(h["app_order"], ["com.netflix.ninja", "com.google.android.youtube.tv", "com.disney.disneyplus", "com.example.tv"])
        self.assertEqual(h["platform_rows"], {"netflix": True, "youtube": False, "disney": True})
        self.assertEqual(c["tmdb"], {"enabled": True, "api_key": KEY, "region": "NZ"})
        self.assertEqual((h["gemini"], h["clock"], h["show_date"]), (False, "24", False))
        self.assertEqual(h["picks"][0], {"title": "Film night", "app": "com.netflix.ninja", "image": "https://example.com/p.jpg"})
        self.assertEqual(c["weather"]["timezone"], "Pacific/Auckland")
        self.assertNotIn("people", c)

    def test_defaults(self):
        p, out = run([""] * 12)
        c = json.load(open(out)); h = c["home"]
        self.assertEqual((h["wallpaper"], h["gemini"], h["clock"], h["show_date"]), (True, True, "system", True))
        self.assertEqual(h["scenes"], ["night", "golden", "water", "fog", "dawn"])
        self.assertEqual(c["tmdb"]["enabled"], False)
        self.assertEqual(h["platform_rows"], {})
        self.assertNotIn("weather", c)

    def test_bad_answers_are_asked_again(self):
        p, out = run(["maybe", "yes", "lava", "fog", "rm -rf /; x", "kodi",
                      "yes", "x1", "nz", "short", "",
                      "yes", "1:30", "12", "yes",
                      "Bad", "javascript:alert(1)", "kodi", "", "",
                      "Nowhere", "95,0", "10,20", "Not/AZone", "Europe/Paris"])
        self.assertEqual(p.returncode, 0, p.stderr)
        c = json.load(open(out))
        self.assertEqual(c["home"]["scenes"], ["fog"])
        self.assertEqual(c["home"]["app_order"], ["org.xbmc.kodi"])
        self.assertEqual(c["tmdb"], {"enabled": True, "api_key": "", "region": "NZ"})
        self.assertEqual(c["home"]["clock"], "12")
        self.assertEqual(c["home"]["picks"], [{"title": "Bad", "app": "org.xbmc.kodi"}])
        self.assertEqual(c["weather"]["timezone"], "Europe/Paris")
        for msg in ("Please answer yes or no", "Not a scene", "Two letters", "does not look like", "Answer system", "not a latitude"):
            self.assertIn(msg, p.stdout)

    def test_does_not_overwrite_without_yes(self):
        p, out = run([""] * 12)
        before = open(out).read()
        p2 = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "setup.py"), "--out", out],
                            input="no\n", capture_output=True, text=True, timeout=30)
        self.assertEqual(p2.returncode, 1)
        self.assertEqual(open(out).read(), before)


if __name__ == "__main__":
    unittest.main()
