// Where titles come from: (1) what apps publish to the TV (TvContract preview channels and Watch
// Next, read by the app through TVOS), (2) optional TMDB, only when switched on and a key is set,
// (3) sample data in demo mode. Nothing here is an ad or a sponsored tile.
(function (root) {
  var L = root.Logic;
  var TV = root.TVOS || null;
  var IMG = "https://image.tmdb.org/t/p/w780", API = "https://api.themoviedb.org/3";
  var cache = {};

  function fromNative(fn) { try { return TV && TV[fn] ? JSON.parse(TV[fn]() || "null") : null; } catch (e) { return null; } }

  function installedPackages() {
    var a = fromNative("apps");
    return Array.isArray(a) ? a.map(function (x) { return x["package"]; }) : [];
  }

  // Android's Watch Next list -> Continue watching items
  function watchNext() {
    var a = fromNative("watchNext") || [];
    return a.map(function (w) {
      var pkg = w["package"] || (w.app && w.app["package"]) || "";
      var p = L.platformOfPkg(pkg);
      var sub = [w.season && w.episode ? "S" + w.season + " E" + w.episode : "", w.episode_title || ""].filter(Boolean).join(" ");
      return { title: w.title, sub: sub || (w.app && w.app.name) || "", art: w.backdrop || "", pkg: pkg, platform: p ? p.id : "", wn: w.id,
        progress: w.progress || 0, source: "watchnext", genres: [] };
    });
  }

  // preview-channel programs other apps published
  function published() {
    var r = fromNative("published");
    if (!r) return { items: [], diag: null };
    return {
      diag: r.diag,
      items: (r.items || []).map(function (x) {
        var p = L.platformOfPkg(x["package"]);
        return { title: x.title, sub: x.channel || "", desc: x.desc || "", art: x.art || "", pkg: x["package"], platform: p ? p.id : "",
          pid: x.id, genres: L.canonGenres(x.genre), source: "published" };
      })
    };
  }

  // ---- TMDB
  function tget(cfg, path, params) {
    var q = "api_key=" + encodeURIComponent(cfg.tmdb.api_key) + "&language=en-NZ&watch_region=" + cfg.tmdb.region;
    Object.keys(params || {}).forEach(function (k) { q += "&" + k + "=" + encodeURIComponent(params[k]); });
    var url = API + path + "?" + q;
    if (cache[url]) return cache[url];
    return (cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error("tmdb " + r.status); return r.json(); })
      .catch(function () { delete cache[url]; return { results: [] }; }));
  }
  function tItem(r, kind, p, avail) {
    return { title: r.title || r.name, sub: (kind === "tv" ? "Series" : "Film") + (avail === "rent" ? " - rent" : avail === "buy" ? " - buy" : ""),
      desc: r.overview || "", art: r.backdrop_path ? IMG + r.backdrop_path : (r.poster_path ? IMG + r.poster_path : ""), platform: p.id, pkg: p.pkg,
      genres: r.genre_ids || [], avail: avail, kind: kind, source: "tmdb" };
  }
  function tmdbDiscover(cfg, p, genres, kinds, monet, avail) {
    return Promise.all(kinds.map(function (k) {
      var prm = { with_watch_providers: p.tmdb, with_watch_monetization_types: monet, sort_by: "popularity.desc" };
      if (genres && genres.length) prm.with_genres = genres.join("|");
      return tget(cfg, "/discover/" + k, prm).then(function (j) { return (j.results || []).slice(0, 8).map(function (r) { return tItem(r, k, p, avail); }); });
    })).then(function (lists) { return [].concat.apply([], lists); });
  }
  function interleave(lists) {
    var out = [], n = Math.max.apply(null, lists.map(function (l) { return l.length; }).concat([0]));
    for (var i = 0; i < n; i++) lists.forEach(function (l) { if (l[i]) out.push(l[i]); });
    return out;
  }
  // "What's on <platform>": the app's own published entries first (they are personalised by the app),
  // then TMDB seeded by the taste genres of My List + Continue watching, then rent/buy offers.
  function platformRow(cfg, p, ctx) {
    var own = ctx.published.filter(function (x) { return x.platform === p.id; });
    own = L.rank(own, ctx.taste);
    if (cfg.demo) {
      var d = root.DEMO.catalog.filter(function (x) { return x.platform === p.id; });
      return Promise.resolve(L.dedupe(own.concat(L.rank(d, ctx.taste))));
    }
    if (!L.tmdbActive(cfg) || !p.tmdb) return Promise.resolve(L.dedupe(own));
    var g = ctx.taste.slice(0, 2);
    var want = function (genres) {
      return Promise.all([tmdbDiscover(cfg, p, genres, ["movie", "tv"], "flatrate", "stream"),
        tmdbDiscover(cfg, p, genres, ["movie"], "rent|buy", "rent")]);
    };
    return want(g).then(function (res) {
      return res[0].length + res[1].length >= 4 || !g.length ? res : want([]);
    }).then(function (res) {
      return L.dedupe(own.concat(interleave([res[0]]), res[1].slice(0, 4))).slice(0, 18);
    });
  }

  // search over the configured platforms only
  function search(cfg, plats, q, genres, ctx) {
    var ids = plats.map(function (p) { return p.id; });
    var local = L.match(ctx.pool, q, genres, ids);
    if (cfg.demo) return Promise.resolve(L.dedupe(local));
    if (!L.tmdbActive(cfg)) return Promise.resolve(L.dedupe(local));
    var jobs;
    if (q) {
      jobs = [tget(cfg, "/search/multi", { query: q }).then(function (j) {
        var hits = (j.results || []).filter(function (r) { return r.media_type === "movie" || r.media_type === "tv"; }).slice(0, 10);
        return Promise.all(hits.map(function (r) {
          return tget(cfg, "/" + r.media_type + "/" + r.id + "/watch/providers", {}).then(function (w) {
            var reg = (w.results || {})[cfg.tmdb.region] || {}, out = [];
            plats.forEach(function (p) {
              ["flatrate", "rent", "buy"].some(function (t) {
                var has = (reg[t] || []).some(function (x) { return x.provider_id === p.tmdb; });
                if (has) out.push(tItem(r, r.media_type, p, t === "flatrate" ? "stream" : t));
                return has;
              });
            });
            return out;
          });
        })).then(function (l) { return [].concat.apply([], l); });
      })];
    } else {
      jobs = plats.filter(function (p) { return p.tmdb; }).map(function (p) {
        return Promise.all([tmdbDiscover(cfg, p, genres, ["movie", "tv"], "flatrate", "stream"), tmdbDiscover(cfg, p, genres, ["movie"], "rent|buy", "rent")])
          .then(function (r) { return r[0].concat(r[1].slice(0, 3)); });
      });
    }
    return Promise.all(jobs).then(function (l) { return L.dedupe(local.concat([].concat.apply([], l))); });
  }

  // a title's genres, for taste, when the platform did not say (one lookup, cached)
  function genresOf(cfg, title) {
    if (!L.tmdbActive(cfg)) return Promise.resolve([]);
    return tget(cfg, "/search/multi", { query: title }).then(function (j) {
      var r = (j.results || [])[0]; return r && r.genre_ids ? r.genre_ids : [];
    });
  }

  root.Sources = { installedPackages: installedPackages, watchNext: watchNext, published: published, platformRow: platformRow, search: search, genresOf: genresOf };
})(typeof window !== "undefined" ? window : this);
