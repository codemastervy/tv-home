// What's on: the hero, the "What's on <platform>" rows, Search, My List, Surprise me and the hold-OK
// sheet. app.js owns the focus and calls in here (see recoNav and friends); everything on screen is
// drawn with the home's own classes (glass, ncard, round buttons). No AI in this file: the Gemini
// button only hands a question to the TV's own assistant.
(function (root) {
  "use strict";
  var L = root.Logic, S = root.Sources, C = null;
  var R = { hi: 0, xr: 0, xi: 0 };
  var cfg = null, plats = [], pub = [], rows = [], listItems = [], hero = null, heroKey = "", prevZone = "grid";
  var OV = null;   // the open overlay: {kind: "search"|"list"|"surprise"|"sheet", ...}
  var LIST_KEY = "tvhome.mylist", seq = 0, lastPick = "";
  var KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
  var KB_COLS = 8;

  function t(k, v) { return C.t(k, v); }
  function esc(s) { return C.esc(s); }
  function $(id) { return document.getElementById(id); }
  function tx(k, v) { return t("r_" + k, v); }

  R.cfg = function () { return L.merge(L.normalize(root.COUCH_CONFIG), C ? C.st() : {}); };
  R.wallpaper = function () { return R.cfg().home.wallpaper; };
  R.gemini = function () { return R.cfg().home.gemini; };
  R.platforms = function () { return plats; };

  function sorted(list) {
    var order = C.packages();
    return list.slice().sort(function (a, b) { return order.indexOf(a.pkg) - order.indexOf(b.pkg); });
  }
  function rowOf(pid) { for (var i = 0; i < rows.length; i++) if (rows[i].p.id === pid) return rows[i]; return null; }

  // ---------------------------------------------------------------- setup
  R.init = function (c) {
    C = c;
    var saved = C.kept(LIST_KEY);
    listItems = Array.isArray(saved) ? saved : [];
    R.apply();
    R.tick();
    setInterval(R.tick, 15000);
  };
  // wallpaper on: the scenes; off: no scenes, and the hero becomes a wide banner (the only difference)
  R.apply = function () {
    cfg = R.cfg();
    var h = document.documentElement;
    h.classList.toggle("no-wall", !cfg.home.wallpaper);
    h.classList.toggle("reco", true);
  };
  R.tick = function () {
    var el = $("rclock");
    if (!el || !C) return;
    var d = new Date(), c = R.cfg();
    var time = L.clockText(d, C.is24() ? "24" : "12", true);
    var date = "";
    if (c.home.show_date) { try { date = d.toLocaleDateString(C.locale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { date = d.toDateString().slice(0, 10); } }
    el.innerHTML = "<b>" + esc(time) + "</b>" + (date ? "<span>" + esc(date) + "</span>" : "");
  };

  // ---------------------------------------------------------------- data
  function shows() {   // Continue watching, as items
    return (C.shows() || []).map(function (it) {
      var pkg = it.app && it.app["package"], p = L.platformOfPkg(pkg || "");
      var ep = it.season && it.episode ? "S" + it.season + " E" + it.episode : (it.episode_title || "");
      return { title: it.title, sub: ep, art: it.backdrop || it.poster || "", pkg: pkg, platform: p ? p.id : "", wn: it.id, genres: it.genres || [], source: "watchnext" };
    });
  }
  function pool() {
    var all = [];
    rows.forEach(function (r) { all = all.concat(r.items); });
    all = all.concat(pub);
    if (cfg && cfg.demo && root.DEMO) all = all.concat(root.DEMO.catalog);
    var ids = plats.map(function (p) { return p.id; });
    return L.dedupe(all.filter(function (x) { return !x.platform || ids.indexOf(x.platform) >= 0; }));
  }
  R.refresh = function () {
    cfg = R.cfg();
    var mine = L.configured(cfg, C.packages());
    plats = sorted(mine);
    var p = S.published();
    pub = cfg.demo ? [] : p.items;
    var taste = L.taste(listItems.concat(shows()), 2);
    var my = ++seq;
    var jobs = plats.filter(function (x) { return L.rowOn(cfg, x); }).map(function (x) {
      return S.platformRow(cfg, x, { published: pub, taste: taste, pool: pool() }).then(function (items) { return { p: x, items: items }; }, function () { return { p: x, items: [] }; });
    });
    return Promise.all(jobs).then(function (list) {
      if (my !== seq) return;
      rows = list.filter(function (r) { return r.items.length; });
      R.renderRows();
      C.repaint();
    });
  };

  // ---------------------------------------------------------------- hero
  function itemKey(it) { return it ? L.keyOf(it) + "|" + (it.source || "") : ""; }
  function setHero(it, app) {
    var k = itemKey(it) + "|" + (app ? app.id : "") + "|" + R.wallpaper() + "|" + L.listHas(listItems, it || {});
    if (k === heroKey) return;
    heroKey = k; hero = it;
    var el = $("reco-hero");
    if (!el) return;
    el.classList.toggle("none", !it && R.wallpaper());
    if (!it) { el.innerHTML = '<div class="rh-body"><h1 class="rh-title">' + esc(tx("hero_empty")) + '</h1><p class="rh-sub">' + esc(tx("hero_empty_sub")) + "</p></div>"; return; }
    var p = app || L.platformOfPkg(it.pkg || ""), icon = it.pkg ? C.iconUrl(it.pkg) : null;
    var isApp = it.source === "app", inList = L.listHas(listItems, it);
    el.style.setProperty("--art", it.art ? 'url("' + String(it.art).replace(/["\\\n]/g, encodeURIComponent) + '")' : "none");
    el.classList.toggle("has-art", !!it.art);
    el.innerHTML = '<div class="rh-body"><div class="rh-app">' + (icon ? '<img src="' + esc(icon) + '" alt="" onerror="this.remove()">' : "") +
      esc(p ? p.name : (it.appName || "")) + (it.avail === "rent" || it.avail === "buy" ? '<em>' + esc(tx("avail_" + it.avail)) + "</em>" : "") + "</div>" +
      '<h1 class="rh-title">' + esc(it.title) + "</h1>" + (it.sub ? '<p class="rh-sub">' + esc(it.sub) + "</p>" : "") +
      (it.desc ? '<p class="rh-desc">' + esc(it.desc) + "</p>" : "") +
      '<div class="rh-btns"><span class="rbtn" id="rh-open">' + esc(tx(isApp ? "open_app" : "open")) + "</span>" +
      (isApp ? "" : '<span class="rbtn" id="rh-list">' + esc(tx(inList ? "in_list" : "add_list")) + "</span>") + "</div></div>";
  }
  R.heroDefault = function () {
    var first = rows.length ? rows[0].items[0] : null;
    setHero(first, rows.length ? rows[0].p : null);
  };
  R.heroApp = function (pkg, name) {
    var p = L.platformOfPkg(pkg || "");
    if (!p) return R.heroDefault();
    var r = rowOf(p.id);
    if (r) return setHero(r.items[0], p);
    setHero({ title: name || p.name, sub: tx("nothing_yet", { app: name || p.name }), pkg: pkg, platform: p.id, source: "app", art: "" }, p);
  };
  R.heroItem = function (it) { if (it) setHero(it, L.platformOfPkg(it.pkg || "")); else R.heroDefault(); };
  R.heroReset = function () { R.hi = 0; };
  function heroBtns() { var o = [$("rh-open"), $("rh-list")]; return o.filter(Boolean); }
  R.heroStep = function (d) { R.hi = Math.max(0, Math.min(heroBtns().length - 1, R.hi + d)); };
  R.heroOk = function () {
    if (!hero) return;
    if (R.hi === 0) R.open(hero); else R.toggleList(hero);
  };
  R.heroHold = function () { if (!hero || hero.source === "app") return false; R.sheet(hero); return true; };

  // ---------------------------------------------------------------- cards and rows
  function cardHTML(it, cls) {
    var p = L.platformOfPkg(it.pkg || ""), icon = it.pkg ? C.iconUrl(it.pkg) : null;
    var name = p ? p.name : (it.appName || "");
    var tag = it.avail === "rent" || it.avail === "buy" ? '<span class="xtag">' + esc(tx("avail_" + it.avail)) + "</span>" : "";
    var star = L.listHas(listItems, it) ? '<span class="xmark" title="' + esc(tx("in_list")) + '">' + C.icon("list") + "</span>" : "";
    return '<div class="tile ncard xcard ' + (cls || "") + '">' +
      (it.art ? '<img class="thumb" src="' + esc(it.art) + '" alt="" decoding="async">' : '<span class="thumb none"></span>') +
      '<div class="t"><div class="nap">' + (icon ? '<img src="' + esc(icon) + '" alt="" onerror="this.remove()">' : "") + esc(name) + tag + "</div><b>" + esc(it.title) + "</b>" +
      (it.sub ? "<i>" + esc(it.sub) + "</i>" : "") + "</div>" + star + "</div>";
  }
  R.renderRows = function () {
    var box = $("reco-rows");
    if (!box) return;
    box.innerHTML = rows.map(function (r) {
      return '<section class="xrow"><header class="shelf-head"><h2>' + esc(tx("whats_on", { app: r.p.name })) + '</h2></header>' +
        '<div class="shelf-clip"><div class="shelf-track">' + r.items.map(function (it) { return cardHTML(it); }).join("") + "</div></div></section>";
    }).join("");
    rows.forEach(function (r, i) {
      r.el = box.children[i];
      r.cards = Array.prototype.slice.call(r.el.querySelectorAll(".xcard"));
      r.track = r.el.querySelector(".shelf-track");
    });
    if (R.xr >= rows.length) R.xr = Math.max(0, rows.length - 1);
    R.layout();
  };
  R.rowCount = function () { return rows.length; };
  R.current = function () { var r = rows[R.xr]; return r ? r.items[R.xi] || null : null; };
  R.at = function (r, x) {   // enter the rows at row r, on the card nearest to x
    R.xr = Math.max(0, Math.min(rows.length - 1, r));
    R.xi = nearest(rows[R.xr], x);
  };
  function nearest(r, x) {
    var best = 0, bd = Infinity;
    (r ? r.cards : []).forEach(function (el, i) {
      var b = el.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - x);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function centreOf() {
    var r = rows[R.xr], el = r && r.cards[R.xi];
    if (!el) return 0;
    var b = el.getBoundingClientRect();
    return b.left + b.width / 2;
  }
  // up and down, left and right in the rows; returns "up" when the focus leaves through the top
  R.rowMove = function (dx, dy) {
    var r = rows[R.xr];
    if (dx) { R.xi = Math.max(0, Math.min(r.items.length - 1, R.xi + dx)); return ""; }
    if (dy < 0) { if (R.xr === 0) return "up"; var x = centreOf(); R.xr--; R.xi = nearest(rows[R.xr], x); }
    else if (dy > 0 && R.xr < rows.length - 1) { var x2 = centreOf(); R.xr++; R.xi = nearest(rows[R.xr], x2); }
    return "";
  };
  R.currentEl = function () { var r = rows[R.xr]; return r ? r.cards[R.xi] || null : null; };
  R.openCurrent = function () { var it = R.current(); if (it) R.open(it); };
  R.holdRow = function () { var it = R.current(); if (!it) return false; R.sheet(it); return true; };
  R.xrowHero = function () { var it = R.current(); if (it) R.heroItem(it); };
  R.clear = function () {
    rows.forEach(function (r) { (r.cards || []).forEach(function (el) { el.classList.remove("focus"); }); });
    ["rh-open", "rh-list"].forEach(function (id) { var e = $(id); if (e) e.classList.remove("focus"); });
  };
  R.paintFocus = function (zone) {
    if (zone === "hero") {
      var b = heroBtns();
      R.hi = Math.min(R.hi, b.length - 1);
      if (b[R.hi]) b[R.hi].classList.add("focus");
    } else if (zone === "xrow") {
      var r = rows[R.xr], el = r && r.cards[R.xi];
      if (el) el.classList.add("focus");
      R.xrowHero();
      scrollRow(r);
    }
    R.layout();
  };
  function scrollRow(r) {
    if (!r || !r.cards.length) return;
    var el = r.cards[0], step = el.offsetWidth + parseFloat(getComputedStyle(r.track).columnGap || 0);
    var fit = Math.max(1, Math.floor((r.track.parentNode.clientWidth + step - el.offsetWidth) / step));
    var first = Math.max(0, Math.min(R.xi - fit + 1, r.cards.length - fit));
    var rtl = document.documentElement.dir === "rtl";
    r.track.style.transform = "translateX(" + (rtl ? first * step : -first * step) + "px)";
  }
  // where the rows sit, and how far the whole page has moved up when a lower row has the focus
  R.layout = function (zone) {
    var home = document.querySelector(".home"), box = $("reco-rows");
    if (!home || !box) return;
    var kw = !document.getElementById("shelf-section").classList.contains("empty");
    var top = kw ? 59.5 : 47.5;
    box.style.top = top + "rem";
    var vy = 0, z = zone || C.zone();
    if (z === "xrow") {
      var rowTop = top + R.xr * 13.75;
      vy = Math.min(0, 64.5 - (rowTop + 11.5));
    }
    home.style.setProperty("--vy", vy + "rem");
    // rows that have moved up under the hero fade out
    rows.forEach(function (r, i) { if (r.el) r.el.style.opacity = top + i * 13.75 + vy < 31 ? "0" : ""; });
    document.documentElement.classList.toggle("scrolled", vy < 0);
    document.documentElement.classList.toggle("scrolled2", vy < -8);
  };

  // ---------------------------------------------------------------- open, My List, assistant
  R.open = function (it) {
    var TV = C.TV;
    try {
      if (it.pid != null && TV && TV.openPublished && TV.openPublished(String(it.pid))) return;
      if (it.wn != null && TV && TV.openWatchNext && TV.openWatchNext(String(it.wn))) return;
    } catch (e) {}
    if (it.pkg && C.launch(it.pkg)) {
      if (it.source === "tmdb" || it.source === "demo") C.toast(tx("opening_search", { app: (L.platformOfPkg(it.pkg) || {}).name || "", title: it.title }));
      return;
    }
    C.toast(tx("cant_open"));
  };
  R.toggleList = function (it) {
    listItems = L.listToggle(listItems, it);
    C.keep(LIST_KEY, listItems);
    heroKey = "";
    var had = L.listHas(listItems, it);
    C.toast(tx(had ? "added" : "removed", { title: it.title }));
    R.renderRows();
    if (hero && L.keyOf(hero) === L.keyOf(it)) setHero(hero, L.platformOfPkg(hero.pkg || ""));
    // Genres of a title the platform did not describe (taste): one cached lookup, only with TMDB on
    if (had && !(it.genres || []).length) S.genresOf(cfg, it.title).then(function (g) {
      if (!g.length) return;
      listItems = listItems.map(function (x) { return L.keyOf(x) === L.keyOf(it) ? Object.assign({}, x, { genres: g }) : x; });
      C.keep(LIST_KEY, listItems);
    });
    if (OV && OV.kind === "list") drawList();
    return had;
  };
  R.listItems = function () { return listItems; };
  R.assist = function (q) {
    var TV = C.TV, ok = false;
    try { ok = !!(TV && (q ? TV.assistQuery && TV.assistQuery(q) : TV.assist && TV.assist())); } catch (e) {}
    if (!ok) C.toast(tx("no_assistant"));
  };

  // ---------------------------------------------------------------- overlays
  function ov() { return $("reco-ov"); }
  function openOv(kind, extra) {
    if (!OV) prevZone = C.zone();
    OV = Object.assign({ kind: kind }, extra || {});
    C.setZone("reco");
    var el = ov();
    el.className = "reco-ov on k-" + kind;
    document.documentElement.classList.add("reco-open");
    document.documentElement.classList.toggle("reco-full", kind !== "sheet");
  }
  function closeOv() {
    var el = ov();
    OV = null;
    el.className = "reco-ov";
    el.innerHTML = "";
    document.documentElement.classList.remove("reco-open", "reco-full");
    C.setZone(prevZone);
    C.repaint();
  }
  R.isOpen = function () { return !!OV; };
  R.back = function () {
    if (!OV) return;
    if (OV.kind === "sheet" && OV.under) { var u = OV.under; OV = u; ov().className = "reco-ov on k-" + u.kind; draw(); return; }
    closeOv();
  };
  R.paint = function () { if (OV) draw(); };
  function draw() { if (!OV) return; ({ search: drawSearch, list: drawList, surprise: drawSurprise, sheet: drawSheet })[OV.kind](); }
  function focusCls(on) { return on ? " focus" : ""; }

  // ---- hold-OK sheet
  R.sheet = function (it, extra) {
    var under = OV;
    var opts = [{ id: "open", label: tx("open") }, { id: "list", label: tx(L.listHas(listItems, it) ? "remove_list" : "add_list") }];
    (extra || []).forEach(function (e) { opts.push(e); });
    opts.push({ id: "close", label: tx("close") });
    if (under) { OV = Object.assign({ kind: "sheet", item: it, opts: opts, i: 0, under: under }); ov().className = "reco-ov on k-sheet over"; }
    else openOv("sheet", { item: it, opts: opts, i: 0, under: null });
    draw();
  };
  function drawSheet() {
    var o = OV, el = ov();
    var inner = '<div class="r-sheet"><div class="r-sheet-t">' + esc(o.item.title) + "</div>" +
      o.opts.map(function (x, i) { return '<div class="r-opt' + focusCls(i === o.i) + '">' + esc(x.label) + "</div>"; }).join("") + "</div>";
    if (o.under) {   // over another screen: keep that screen drawn underneath
      var keep = OV; OV = o.under; draw(); OV = keep;
      el.insertAdjacentHTML("beforeend", inner);
    } else el.innerHTML = inner;
  }
  function sheetOk() {
    var o = OV, x = o.opts[o.i], it = o.item, extra = x.run;
    var under = o.under;
    if (x.id === "close") return R.back();
    if (under) { OV = under; ov().className = "reco-ov on k-" + under.kind; } else closeOv();
    if (x.id === "open") R.open(it);
    else if (x.id === "list") R.toggleList(it);
    else if (extra) extra();
    if (OV) draw(); else C.repaint();
  }

  // ---- Search
  function chipList() {
    var out = L.GENRES.map(function (g) { return { id: g.id, name: g.name, genres: [g.id] }; });
    return out.concat(L.MOODS.map(function (m) { return { id: m.id, name: m.name, genres: m.genres }; }));
  }
  R.openSearch = function () {
    openOv("search", { q: "", chip: null, pane: "kb", k: 0, c: 0, r: 0, res: [], busy: false, note: "" });
    runSearch();
    draw();
  };
  function runSearch() {
    var o = OV; if (!o || o.kind !== "search") return;
    var my = ++o.ticket || (o.ticket = 1); o.ticket = my;
    var chip = o.chip != null ? chipList().filter(function (c) { return c.id === o.chip; })[0] : null;
    var genres = chip ? chip.genres : [];
    var p = pool();
    if (!o.q && !genres.length) {   // nothing typed: what is on your apps, by your taste
      o.res = L.rank(p, L.taste(listItems.concat(shows()), 2)).slice(0, 12); o.heading = "on_apps"; o.busy = false; return;
    }
    o.heading = "results"; o.busy = true;
    S.search(cfg, plats, o.q, genres, { pool: p }).then(function (res) {
      if (!OV || OV.kind !== "search" || OV.ticket !== my) return;
      OV.res = res; OV.busy = false; OV.r = 0; draw();
    });
  }
  function drawSearch() {
    var o = OV, el = ov(), chips = chipList();
    var kb = KEYS.map(function (k, i) { return '<span class="rkey' + focusCls(o.pane === "kb" && o.k === i) + '">' + esc(k) + "</span>"; }).join("") +
      '<span class="rkey wide' + focusCls(o.pane === "kb" && o.k === KEYS.length) + '">' + esc(tx("space")) + "</span>" +
      '<span class="rkey wide' + focusCls(o.pane === "kb" && o.k === KEYS.length + 1) + '">' + esc(tx("delete")) + "</span>";
    var gem = R.gemini() ? '<span class="rbtn' + focusCls(o.pane === "ask") + '">' + C.icon("sparkle") + esc(o.q ? tx("ask_q", { q: o.q }) : tx("ask")) + "</span>" : "";
    var cb = chips.map(function (c, i) { return '<span class="rchip' + (o.chip === c.id ? " on" : "") + focusCls(o.pane === "chips" && o.c === i) + '">' + esc(c.name) + "</span>"; }).join("");
    var res = o.res.length ? o.res.map(function (it, i) { return cardHTML(it, (o.pane === "res" && o.r === i) ? "focus" : ""); }).join("") :
      '<p class="r-none">' + esc(o.busy ? tx("searching") : tx(plats.length ? "no_results" : "no_platforms")) + "</p>";
    el.innerHTML = '<div class="r-search"><div class="r-left"><h1>' + esc(tx("search")) + '</h1>' +
      '<div class="r-query' + (o.q ? "" : " empty") + '">' + (o.q ? esc(o.q) : esc(tx("type_hint"))) + '<i class="caret"></i></div>' +
      '<div class="r-kb">' + kb + "</div>" + (gem ? '<div class="r-ask">' + gem + "</div>" : "") + "</div>" +
      '<div class="r-right"><div class="r-chips">' + cb + '</div><h2>' + esc(tx(o.heading || "on_apps")) + "</h2>" +
      '<div class="r-res"><div class="r-grid" id="r-grid">' + res + "</div></div></div></div>";
    if (o.pane === "res") scrollGrid(o.r, 2);
  }
  function scrollGrid(i, cols) {
    var g = $("r-grid"), box = g && g.parentNode, el = g && g.children[i];
    if (!el) return;
    var top = el.offsetTop, bot = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 8;
    else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = bot - box.clientHeight + 8;
  }
  function searchMove(dx, dy) {
    var o = OV, nk = KEYS.length + 2;
    if (o.pane === "kb") {
      if (dx) {
        if (dx > 0 && o.k % KB_COLS === KB_COLS - 1 || (dx > 0 && o.k === nk - 1)) { o.pane = "chips"; o.c = 0; }
        else o.k = Math.max(0, Math.min(nk - 1, o.k + dx));
      } else if (dy > 0) { if (o.k + KB_COLS < nk) o.k += KB_COLS; else if (R.gemini()) o.pane = "ask"; }
      else if (o.k >= KB_COLS) o.k -= KB_COLS;
    } else if (o.pane === "ask") {
      if (dy < 0) { o.pane = "kb"; o.k = Math.min(nk - 1, Math.max(0, KEYS.length - KB_COLS + 4)); }
      else if (dx > 0 && o.res.length) { o.pane = "res"; o.r = 0; }
    } else if (o.pane === "chips") {
      var per = 5, n = chipList().length;
      if (dx < 0 && o.c % per === 0) { o.pane = "kb"; o.k = KB_COLS - 1; }
      else if (dx) o.c = Math.max(0, Math.min(n - 1, o.c + dx));
      else if (dy > 0) { if (o.c + per < n) o.c += per; else if (o.res.length) { o.pane = "res"; o.r = 0; } }
      else if (o.c >= per) o.c -= per;
    } else if (o.pane === "res") {
      var m = o.res.length;
      if (dx) { var nx = o.r + dx; if (dx < 0 && o.r % 2 === 0) { o.pane = "kb"; o.k = KB_COLS - 1; } else o.r = Math.max(0, Math.min(m - 1, nx)); }
      else if (dy > 0) o.r = Math.min(m - 1, o.r + 2);
      else if (o.r < 2) { o.pane = "chips"; o.c = 0; } else o.r -= 2;
    }
    draw();
  }
  function typed(ch) {
    var o = OV; if (!o || o.kind !== "search") return;
    if (ch === "\b") o.q = o.q.slice(0, -1); else if (o.q.length < 40) o.q += ch;
    runSearch(); draw();
  }
  function searchOk() {
    var o = OV;
    if (o.pane === "kb") {
      if (o.k < KEYS.length) typed(KEYS[o.k]); else if (o.k === KEYS.length) typed(" "); else typed("\b");
    } else if (o.pane === "ask") R.assist(o.q);
    else if (o.pane === "chips") { var c = chipList()[o.c]; o.chip = o.chip === c.id ? null : c.id; runSearch(); draw(); }
    else if (o.pane === "res" && o.res[o.r]) R.open(o.res[o.r]);
  }

  // ---- My List
  R.openList = function () { openOv("list", { i: 0 }); drawList(); };
  function drawList() {
    var o = OV, el = ov();
    if (!o || o.kind !== "list") return;
    o.i = Math.max(0, Math.min(o.i, listItems.length - 1));
    el.innerHTML = '<div class="r-list"><h1>' + esc(tx("my_list")) + '<small>' + esc(listItems.length ? tx(listItems.length === 1 ? "n_title" : "n_titles", { n: listItems.length }) : "") + "</small></h1>" +
      (listItems.length ? '<div class="r-res big"><div class="r-grid cols3" id="r-grid">' + listItems.map(function (it, i) { return cardHTML(it, i === o.i ? "focus" : ""); }).join("") + "</div></div>" :
        '<p class="r-none">' + esc(tx("list_empty")) + "</p>") + '<p class="r-hint">' + esc(tx("list_hint")) + "</p></div>";
    scrollGrid(o.i, 3);
  }
  function listMove(dx, dy) {
    var o = OV, n = listItems.length;
    if (!n) return;
    o.i = Math.max(0, Math.min(n - 1, o.i + dx + dy * 3));
    drawList();
  }

  // ---- Surprise me
  R.openSurprise = function () {
    openOv("surprise", { it: null, b: 0 });
    pickOne();
    draw();
  };
  function pickOne() {
    var p = pool(), c = p.filter(function (x) { return L.keyOf(x) !== lastPick; });
    var it = L.pick(c.length ? c : p);
    if (it) lastPick = L.keyOf(it);
    OV.it = it;
  }
  function drawSurprise() {
    var o = OV, el = ov(), it = o.it;
    if (!it) { el.innerHTML = '<div class="r-surprise"><h1>' + esc(tx("surprise")) + '</h1><p class="r-none">' + esc(tx("nothing_to_pick")) + "</p></div>"; return; }
    var p = L.platformOfPkg(it.pkg || ""), inList = L.listHas(listItems, it);
    var b = [tx("open"), tx("another"), tx(inList ? "in_list" : "add_list")];
    el.innerHTML = '<div class="r-surprise"><div class="r-sc"><div class="r-sart">' + (it.art ? '<img src="' + esc(it.art) + '" alt="">' : "") + '</div><div class="r-sbody">' +
      '<div class="rh-app">' + esc(p ? p.name : "") + (it.avail === "rent" || it.avail === "buy" ? "<em>" + esc(tx("avail_" + it.avail)) + "</em>" : "") + "</div>" +
      '<h1 class="rh-title">' + esc(it.title) + "</h1>" + (it.sub ? '<p class="rh-sub">' + esc(it.sub) + "</p>" : "") + (it.desc ? '<p class="rh-desc">' + esc(it.desc) + "</p>" : "") +
      '<p class="r-ask-open">' + esc(tx("surprise_q", { app: p ? p.name : "" })) + '</p><div class="rh-btns">' +
      b.map(function (x, i) { return '<span class="rbtn' + focusCls(o.b === i) + '">' + esc(x) + "</span>"; }).join("") + "</div></div></div></div>";
  }
  function surpriseOk() {
    var o = OV;
    if (!o.it) return;
    if (o.b === 0) { var it = o.it; closeOv(); R.open(it); }
    else if (o.b === 1) { pickOne(); draw(); }
    else { R.toggleList(o.it); draw(); }
  }

  // ---- shared entry points from app.js
  R.move = function (dx, dy) {
    if (!OV) return;
    if (OV.kind === "search") searchMove(dx, dy);
    else if (OV.kind === "list") listMove(dx, dy);
    else if (OV.kind === "sheet") { if (dy) { OV.i = Math.max(0, Math.min(OV.opts.length - 1, OV.i + dy)); draw(); } }
    else if (OV.kind === "surprise") { if (dx) { OV.b = Math.max(0, Math.min(2, OV.b + dx)); draw(); } }
  };
  R.ok = function () {
    if (!OV) return;
    if (OV.kind === "search") searchOk();
    else if (OV.kind === "list") { var it = listItems[OV.i]; if (it) R.open(it); }
    else if (OV.kind === "sheet") sheetOk();
    else if (OV.kind === "surprise") surpriseOk();
  };
  R.hold = function () {
    if (!OV) return false;
    var it = OV.kind === "search" && OV.pane === "res" ? OV.res[OV.r] : OV.kind === "list" ? listItems[OV.i] : OV.kind === "surprise" ? OV.it : null;
    if (!it) return false;
    R.sheet(it);
    return true;
  };
  // a key from a physical keyboard or the TV's own: letters and digits type, Backspace deletes
  R.key = function (e) {
    if (!OV || OV.kind !== "search" || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "Backspace") { typed("\b"); return true; }
    if (e.key && e.key.length === 1 && /[a-z0-9 ]/i.test(e.key)) { typed(e.key.toLowerCase()); return true; }
    return false;
  };
  // state for the emulator tests (window.__home.state())
  R.state = function () {
    return { hero: hero ? hero.title : null, heroApp: hero ? hero.platform : null, wallpaper: R.wallpaper(), rows: rows.map(function (r) { return { id: r.p.id, n: r.items.length, first: r.items[0] && r.items[0].title }; }),
      list: listItems.map(function (x) { return x.title; }), overlay: OV ? OV.kind : null, pane: OV ? OV.pane : null, q: OV ? OV.q : null, results: OV && OV.res ? OV.res.map(function (x) { return x.title; }) : null,
      xr: R.xr, xi: R.xi, hi: R.hi, platforms: plats.map(function (p) { return p.id; }) };
  };

  root.Reco = R;
})(window);
