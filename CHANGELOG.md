# Changelog

Based on couch-tv by Seagey (MIT). TV home only: no phone remote, no bridge, no AI.

## Unreleased
- Front end rewritten: wallpaper or banner look sharing one set of rows, top bar with Search, My List, Surprise me,
  Gemini, Settings and clock; per-platform "What's on ..." rows; search with genre and mood sections; My List.
- Recommendations: Watch Next and preview channels read per app (new `published()` bridge call), optional TMDB.
- Removed: profiles, scenes-only looks (night/oled/classic), the old settings tree, translations, smart home, kids mode.
- Setup: new questions for wallpaper, platform rows, TMDB, Gemini, clock. New tests (logic, no-ads with TMDB, emulator
  home modes and published feed).
