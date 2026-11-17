// Pure logic for the home: config defaults, which platforms count as "yours", My List, taste and
// search matching. No DOM and no network here, so tests/test_logic.js can run it under node.
(function (root) {
  var PLATFORMS = [
    { id: "netflix", name: "Netflix", pkg: "com.netflix.ninja", tmdb: 8, color: "#e50914" },
    { id: "disney", name: "Disney+", pkg: "com.disney.disneyplus", tmdb: 337, color: "#1a3fb0" },
    { id: "prime", name: "Prime Video", pkg: "com.amazon.amazonvideo.livingroom", tmdb: 119, color: "#0b87c9" },
    { id: "appletv", name: "Apple TV", pkg: "com.apple.atve.androidtv.appletv", tmdb: 350, color: "#3b3b42" },
    { id: "youtube", name: "YouTube", pkg: "com.google.android.youtube.tv", tmdb: 192, color: "#d92b2b" }
  ];
  // TMDB genre ids by the names the search screen shows
  var GENRES = [
    { id: 35, name: "Comedy" }, { id: 28, name: "Action" }, { id: 18, name: "Drama" }, { id: 53, name: "Thriller" },
    { id: 878, name: "Sci-Fi" }, { id: 10751, name: "Family" }, { id: 99, name: "Documentary" },
    { id: 10749, name: "Romance" }, { id: 16, name: "Animation" }, { id: 27, name: "Horror" },
    { id: 9648, name: "Mystery" }, { id: 80, name: "Crime" }
  ];
  // moods are sets of genres
  var MOODS = [{ id: "m-feel", name: "Feel-good", genres: [35, 10751] }, { id: "m-edge", name: "Edge of seat", genres: [53, 9648] }];
  // TvContract canonical genres (what preview programs carry) -> TMDB ids
  var CANON = { COMEDY: 35, ACTION: 28, DRAMA: 18, FAMILY_KIDS: 10751, MOVIES: 0, ANIMAL_WILDLIFE: 99, ARTS: 99, NEWS: 99,
    SCIFI: 878, THRILLER: 53, ROMANCE: 10749, MYSTERY: 9648, CRIME: 80, HORROR: 27, ANIMATION: 16, DOCUMENTARY: 99 };
  var REGION = /^[A-Z]{2}$/, KEY = /^[A-Za-z0-9]{16,64}$/;

  function bool(v, d) { return typeof v === "boolean" ? v : d; }

  function normalize(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var h = raw.home || {}, t = raw.tmdb || {};
    var clock = ["system", "12", "24"].indexOf(String(h.clock)) >= 0 ? String(h.clock) : "system";
    var rows = {};
    if (h.platform_rows && typeof h.platform_rows === "object") {
      PLATFORMS.forEach(function (p) { if (typeof h.platform_rows[p.id] === "boolean") rows[p.id] = h.platform_rows[p.id]; });
    }
    return {
      demo: raw.demo === true,
      weather: raw.weather || null,
      home: {
        wallpaper: bool(h.wallpaper, true),
        scenes: Array.isArray(h.scenes) && h.scenes.length ? h.scenes : ["night", "golden", "water", "fog", "dawn"],
        scene_seconds: Math.max(5, Math.min(300, Number(h.scene_seconds) || 20)),
        app_order: Array.isArray(h.app_order) ? h.app_order : [],
        picks: Array.isArray(h.picks) ? h.picks : [],
        platform_rows: rows,
        gemini: bool(h.gemini, true),
        clock: clock,
        show_date: bool(h.show_date, true)
      },
      tmdb: {
        enabled: t.enabled === true,
        api_key: KEY.test(String(t.api_key || "")) ? String(t.api_key) : "",
        region: REGION.test(String(t.region || "")) ? String(t.region) : "NZ"
      }
    };
  }

  // device settings (changed on the TV) win over the built-in config
  function merge(cfg, st) {
    st = st || {};
    var o = JSON.parse(JSON.stringify(cfg));
    ["wallpaper", "gemini", "show_date"].forEach(function (k) { if (typeof st[k] === "boolean") o.home[k] = st[k]; });
    if (["system", "12", "24"].indexOf(st.clock) >= 0) o.home.clock = st.clock;
    if (st.platform_rows && typeof st.platform_rows === "object") {
      Object.keys(st.platform_rows).forEach(function (k) { if (platformById(k) && typeof st.platform_rows[k] === "boolean") o.home.platform_rows[k] = st.platform_rows[k]; });
    }
    if (typeof st.tmdb_enabled === "boolean") o.tmdb.enabled = st.tmdb_enabled;
    if (KEY.test(String(st.tmdb_key || ""))) o.tmdb.api_key = st.tmdb_key;
    return o;
  }

  function tmdbActive(cfg) { return !!(cfg.tmdb.enabled && cfg.tmdb.api_key); }

  // Platforms that are "yours": installed, and in app_order when one is set. Order follows the apps row.
  function configured(cfg, installed) {
    var have = {};
    (installed || []).forEach(function (p) { have[p] = 1; });
    var order = cfg.home.app_order;
    var list = PLATFORMS.filter(function (p) { return have[p.pkg] && (!order.length || order.indexOf(p.pkg) >= 0); });
    if (order.length) list.sort(function (a, b) { return order.indexOf(a.pkg) - order.indexOf(b.pkg); });
    return list;
  }
  function platformById(id) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].id === id) return PLATFORMS[i]; return null; }
  function rowOn(cfg, p) { return cfg.home.platform_rows[p.id] !== false; }
  function platformOfPkg(pkg) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].pkg === pkg) return PLATFORMS[i]; return null; }

  function canonGenres(s) {
    var out = [];
    String(s || "").split(",").forEach(function (g) { var id = CANON[g.trim().toUpperCase()]; if (id && out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  // ----- My List: a list of item records, newest first, keyed by item.key
  function keyOf(it) { return it.key || ((it.platform || it.pkg || "") + "|" + String(it.title || "").toLowerCase()); }
  function listHas(list, it) { var k = keyOf(it); return list.some(function (x) { return keyOf(x) === k; }); }
  function listToggle(list, it) {
    if (listHas(list, it)) { var k = keyOf(it); return list.filter(function (x) { return keyOf(x) !== k; }); }
    var c = {}; ["title", "sub", "art", "pkg", "platform", "pid", "url", "genres", "avail", "desc", "source"].forEach(function (f) { if (it[f] != null) c[f] = it[f]; });
    c.key = keyOf(it);
    return [c].concat(list).slice(0, 60);
  }

  // ----- taste: genre ids ordered by how often they appear in the given items
  function taste(items, n) {
    var count = {};
    (items || []).forEach(function (it) { (it.genres || []).forEach(function (g) { count[g] = (count[g] || 0) + 1; }); });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, n || 2).map(Number);
  }
  function rank(items, genres) {
    if (!genres || !genres.length) return items.slice();
    var score = function (it) { return (it.genres || []).filter(function (g) { return genres.indexOf(g) >= 0; }).length; };
    return items.map(function (it, i) { return { it: it, i: i, s: score(it) }; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (x) { return x.it; });
  }
  function dedupe(items) {
    var seen = {};
    return items.filter(function (it) { var k = String(it.title).toLowerCase() + "|" + (it.platform || ""); if (seen[k]) return false; seen[k] = 1; return true; });
  }

  // on-device search: text and/or genre ids, only items of the given platform ids
  function match(items, q, genres, platformIds) {
    q = String(q || "").trim().toLowerCase();
    return items.filter(function (it) {
      if (platformIds && it.platform && platformIds.indexOf(it.platform) < 0) return false;
      if (q && (String(it.title).toLowerCase().indexOf(q) < 0 && String(it.desc || "").toLowerCase().indexOf(q) < 0)) return false;
      if (genres && genres.length && !(it.genres || []).some(function (g) { return genres.indexOf(g) >= 0; })) return false;
      return true;
    });
  }

  function pick(items, rnd) { return items.length ? items[Math.floor((rnd || Math.random)() * items.length)] : null; }

  function clockText(d, mode, sys24) {
    var is24 = mode === "24" || (mode === "system" && sys24);
    var h = d.getHours(), m = ("0" + d.getMinutes()).slice(-2);
    if (is24) return ("0" + h).slice(-2) + ":" + m;
    return ((h % 12) || 12) + ":" + m + (h < 12 ? " am" : " pm");
  }

  root.Logic = { PLATFORMS: PLATFORMS, GENRES: GENRES, MOODS: MOODS, normalize: normalize, merge: merge, tmdbActive: tmdbActive,
    configured: configured, rowOn: rowOn, platformOfPkg: platformOfPkg, canonGenres: canonGenres, keyOf: keyOf,
    listHas: listHas, listToggle: listToggle, taste: taste, rank: rank, dedupe: dedupe, match: match, pick: pick, clockText: clockText };
  if (typeof module !== "undefined") module.exports = root.Logic;
})(typeof window !== "undefined" ? window : this);
