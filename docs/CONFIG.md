# Settings reference (`config.json`, git-ignored; `config.example.json` is the template)

```json
{
  "home": {
    "wallpaper": true,
    "scenes": ["night", "golden", "water", "fog", "dawn"], "scene_seconds": 20,
    "app_order": ["com.netflix.ninja", "com.disney.disneyplus"],
    "platform_rows": { "netflix": true, "disney": false },
    "gemini": true, "clock": "system", "show_date": true,
    "picks": [{ "title": "Friday film", "app": "com.netflix.ninja", "image": "https://example.com/a.jpg" }]
  },
  "tmdb": { "enabled": false, "api_key": "", "region": "NZ" },
  "weather": { "place": "Wellington", "lat": -41.29, "lon": 174.78, "timezone": "Pacific/Auckland" }
}
```
- **Platforms** the rows know about: `netflix`, `disney`, `prime`, `appletv`, `youtube`. A platform counts as yours when its
  app is installed and (if `app_order` is set) listed there. Nothing is ever shown for a platform that is not yours.
- **platform_rows**: missing = on. The same switches are in Settings on the TV, which wins over the file.
- **tmdb**: off unless `enabled` is true *and* a v3 key is set. `region` is a two-letter country code for availability.
  The key is only sent to api.themoviedb.org. It is built into your own APK, so do not share the APK.
- **demo**: `true` swaps in invented sample titles and generated art and ignores the TV's real feeds (used for the
  README pictures and the emulator tests, `tests/emulator/test-config.json`).
- On-TV changes are stored on the TV (`tvhome.settings`, `tvhome.mylist`) and survive restarts.
