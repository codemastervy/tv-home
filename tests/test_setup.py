"""Setup with scripted answers: valid input writes the right config, bad input is re-asked."""
import json, os, subprocess, sys, tempfile, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(answers, *extra):
    out = os.path.join(tempfile.mkdtemp(), "config.json")
    p = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "setup.py"), "--out", out, *extra],
                       input="\n".join(answers) + "\n", capture_output=True, text=True, timeout=30)
    return p, out


class Setup(unittest.TestCase):
    def test_full_run(self):
        p, out = run(["3", "dawn, night", "Netflix, youtube, com.example.tv",
                      "Film night", "netflix", "https://example.com/p.jpg",
                      "Docs", "https://example.com/docs", "", "", "Wellington", "-41.29, 174.78", "Pacific/Auckland"])
        self.assertEqual(p.returncode, 0, p.stderr)
        c = json.load(open(out)); h = c["home"]
        self.assertEqual(h["look"], "classic")
        self.assertEqual(h["scenes"], ["dawn", "night"])
        self.assertEqual(h["app_order"], ["com.netflix.ninja", "com.google.android.youtube.tv", "com.example.tv"])
        self.assertEqual(h["picks"][0], {"title": "Film night", "app": "com.netflix.ninja", "image": "https://example.com/p.jpg"})
        self.assertEqual(h["picks"][1], {"title": "Docs", "url": "https://example.com/docs"})
        self.assertEqual(c["weather"], {"lat": -41.29, "lon": 174.78, "place": "Wellington", "timezone": "Pacific/Auckland"})

    def test_defaults_and_no_weather(self):
        p, out = run(["", "", "", "", ""])
        c = json.load(open(out))
        self.assertEqual(c["home"]["look"], "night")
        self.assertEqual(c["home"]["scenes"], ["night", "golden", "water", "fog", "dawn"])
        self.assertEqual(c["home"]["picks"], [])
        self.assertNotIn("weather", c)

    def test_bad_answers_are_asked_again(self):
        p, out = run(["9", "2", "lava", "fog", "rm -rf /; x", "kodi", "Bad", "javascript:alert(1)", "kodi", "", "",
                      "Nowhere", "95,0", "10,20", "Not/AZone", "Europe/Paris"])
        self.assertEqual(p.returncode, 0, p.stderr)
        c = json.load(open(out))
        self.assertEqual((c["home"]["look"], c["home"]["scenes"], c["home"]["app_order"]), ("oled", ["fog"], ["org.xbmc.kodi"]))
        self.assertEqual(c["home"]["picks"], [{"title": "Bad", "app": "org.xbmc.kodi"}])
        self.assertEqual(c["weather"]["timezone"], "Europe/Paris")
        self.assertIn("Not a scene", p.stdout)
        self.assertIn("not a latitude", p.stdout)

    def test_does_not_overwrite_without_yes(self):
        p, out = run(["", "", "", "", ""])
        before = open(out).read()
        p2 = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "setup.py"), "--out", out],
                            input="no\n", capture_output=True, text=True, timeout=30)
        self.assertEqual(p2.returncode, 1)
        self.assertEqual(open(out).read(), before)


if __name__ == "__main__":
    unittest.main()
