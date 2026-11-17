// The home. One code path for both looks: "wallpaper" and "banner" differ only in the hero area
// (body.wall / body.ban in home.css); the bars, rows, search and focus order are the same.
(function () {
  var L = window.Logic, S = window.Sources, TV = window.TVOS || null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/></svg>',
    gemini: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h12M4 12h12M4 17h8M19 14v6M16 17h6"/></svg>',
    dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>'
  };

  // ---------- storage and config
  function kget(k) { try { if (TV && TV.kept) { var v = TV.kept(k); if (v) return JSON.parse(v); } } catch (e) {} try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function kset(k, v) { var j = JSON.stringify(v); try { localStorage.setItem(k, j); } catch (e) {} try { if (TV && TV.keep) TV.keep(k, j); } catch (e) {} }
  var BASE = L.normalize(window.COUCH_CONFIG || {});
  var ST = kget("tvhome.settings") || {};
  var cfg = L.merge(BASE, ST);
  var mylist = kget("tvhome.mylist") || [];
  function setting(k, v) { ST[k] = v; kset("tvhome.settings", ST); cfg = L.merge(BASE, ST); }

  // ---------- state
  var D = { apps: [], plats: [], wn: [], pub: [], diag: null, rows: [], cols: {}, items: {}, hero: null, featured: null, stack: [], nextId: 1 };
  var cur = null, hold = null;

  function reg(it) { it._id = it._id || ("i" + D.nextId++); D.items[it._id] = it; return it._id; }

  // ---------- apps
  function loadApps() {
    var list;
    if (cfg.demo) {
      list = window.DEMO.installed.map(function (id) { var p = L.PLATFORMS.filter(function (x) { return x.id === id; })[0]; return { pkg: p.pkg, name: p.name, plat: p }; });
    } else {
      var a = []; try { a = TV && TV.apps ? JSON.parse(TV.apps()) : []; } catch (e) {}
      list = a.map(function (x) { return { pkg: x["package"], name: x.label, plat: L.platformOfPkg(x["package"]) }; })
        .filter(function (x) { return x.pkg !== "com.android.vending" && x.pkg !== "com.android.tv.settings"; });
      var ord = cfg.home.app_order;
      list.sort(function (x, y) {
        var i = ord.indexOf(x.pkg), j = ord.indexOf(y.pkg);
        if (i < 0 && j < 0) return (y.plat ? 1 : 0) - (x.plat ? 1 : 0);
        if (i < 0) return 1; if (j < 0) return -1; return i - j;
      });
    }
    D.apps = list.slice(0, 9);
    D.plats = L.configured(cfg, D.apps.map(function (x) { return x.pkg; })).filter(function (p) {
      return D.apps.some(function (a) { return a.pkg === p.pkg; });
    });
    // platform rows follow the order of the apps row
    D.plats.sort(function (a, b) { return idx(a) - idx(b); });
    function idx(p) { for (var i = 0; i < D.apps.length; i++) if (D.apps[i].pkg === p.pkg) return i; return 99; }
  }
  function platById(id) { for (var i = 0; i < L.PLATFORMS.length; i++) if (L.PLATFORMS[i].id === id) return L.PLATFORMS[i]; return null; }

  // ---------- data
  function continueItems() {
    var w = D.wn.slice();
    if (cfg.demo) w = window.DEMO.watching.concat(w);
    return w.filter(allowed);
  }
  // nothing for platforms the user has not configured (items without a known platform, e.g. own picks, stay)
  function allowed(it) {
    if (!it.platform) return true;
    return D.plats.some(function (p) { return p.id === it.platform; });
  }
  function pool() {
    var all = [];
    D.rows.forEach(function (r) { if (r.kind === "platform") all = all.concat(r.items); });
    return L.dedupe(all.concat(D.pub.filter(allowed), cfg.demo ? window.DEMO.catalog.filter(allowed) : []));
  }
  function tasteNow() { return L.taste(mylist.concat(continueItems()), 2); }

  function buildRows() {
    var rows = [];
    var cw = continueItems();
    if (cw.length) rows.push({ id: "cw", kind: "cw", title: "Continue watching", items: cw });
    if (mylist.length) rows.push({ id: "ml", kind: "ml", title: "My List", items: mylist });
    var picks = cfg.demo && !cfg.home.picks.length ? window.DEMO.picks : window.CustomCards.picks(cfg.home.picks).map(function (c) {
      return { title: c.title, sub: c.subtitle || "Your pick", art: c.image || "", pkg: c.app || "", url: c.url || "", platform: "", source: "pick" };
    });
    if (picks.length) rows.push({ id: "pk", kind: "pk", title: "Your picks", items: picks });
    D.plats.forEach(function (p) {
      if (!L.rowOn(cfg, p)) return;
      var items = D.cols[p.id];
      if (items && items.length) rows.push({ id: "p-" + p.id, kind: "platform", plat: p, title: "What's on " + p.name, items: items });
    });
    D.rows = rows;
  }

  function loadData() {
    loadApps(); D.hero = null;
    // sample-data mode never reads the TV's real feeds, so screenshots hold nothing but invented titles
    D.wn = cfg.demo ? [] : S.watchNext();
    var pb = cfg.demo ? { items: [], diag: null } : S.published(); D.pub = pb.items; D.diag = pb.diag;
    var lookups = [];
    if (L.tmdbActive(cfg)) D.wn.slice(0, 4).forEach(function (w) { if (!w.genres.length) lookups.push(S.genresOf(cfg, w.title).then(function (g) { w.genres = g; })); });
    return Promise.all(lookups).then(function () {
      var ctx = { published: D.pub.filter(allowed), taste: tasteNow() };
      var jobs = D.plats.filter(function (p) { return L.rowOn(cfg, p); }).map(function (p) {
        return S.platformRow(cfg, p, ctx).then(function (items) { D.cols[p.id] = items; });
      });
      return Promise.all(jobs);
    }).then(function () {
      var all = pool(); D.featured = all.length ? all[Math.floor(Math.random() * all.length)] : null;
    });
  }

  // ---------- rendering
  function art(it) {
    var p = platById(it.platform);
    var bg = it.art ? 'url("' + String(it.art).replace(/"/g, "%22") + '")' : "linear-gradient(135deg," + (p ? p.color : "#2d3a66") + ",#10162c)";
    return bg;
  }
  function cardHTML(it, rowId, n) {
    var tag = it.avail === "rent" ? "Rent" : it.avail === "buy" ? "Buy" : "";
    var plat = platById(it.platform);
    return '<div class="card f glass" data-k="' + esc(rowId + ":" + L.keyOf(it)) + '" data-r="' + esc(rowId) + '" data-id="' + reg(it) + '" aria-label="' + esc(it.title) + '">' +
      '<div class="art" style="background-image:' + esc(art(it)) + '"></div>' + (tag ? '<span class="tag">' + tag + "</span>" : "") +
      '<div class="cap"><b>' + esc(it.title) + "</b><i>" + esc(it.sub || (plat ? plat.name : "")) + "</i></div>" +
      (it.progress ? '<div class="prog"><u style="width:' + Math.round(it.progress * 100) + '%"></u></div>' : "") + "</div>";
  }
  function renderTop() {
    $("top-left").innerHTML =
      '<div class="pill-btn glass f" data-k="t:search" data-r="t" data-act="search" aria-label="Search">' + ICON.search + "Search</div>" +
      '<div class="pill-btn glass f" data-k="t:list" data-r="t" data-act="mylist" aria-label="My List">' + ICON.list + "My List</div>" +
      '<div class="pill-btn glass f" data-k="t:surprise" data-r="t" data-act="surprise" aria-label="Surprise me">' + ICON.dice + "Surprise me</div>";
    $("top-right").innerHTML =
      (cfg.home.gemini ? '<div class="round glass f" data-k="t:gemini" data-r="t" data-act="gemini" aria-label="Gemini">' + ICON.gemini + "</div>" : "") +
      '<div class="round glass f" data-k="t:settings" data-r="t" data-act="settings" aria-label="Settings">' + ICON.gear + "</div>";
  }
  function heroItem() {
    var f = cur && cur.closest && cur.closest("#apps") ? cur : null;
    if (f) {
      var a = D.apps[+f.getAttribute("data-i")];
      if (a) {
        var items = a.plat ? (D.cols[a.plat.id] || []) : D.pub.filter(function (x) { return x.pkg === a.pkg; });
        var it = items[0];
        return it ? Object.assign({}, it, { chip: a.name }) : { title: a.name, sub: "Open " + a.name, pkg: a.pkg, platform: a.plat ? a.plat.id : "", chip: a.name, plain: true };
      }
    }
    if (D.hero && !D.hero.plain) return D.hero;
    return D.featured ? Object.assign({}, D.featured, { chip: "Recommended for you" }) : { title: "Welcome home", sub: "Your apps and what to watch next", chip: "Home", plain: true };
  }
  function renderHero() {
    var it = heroItem(); D.hero = it;
    var inList = L.listHas(mylist, it);
    $("hero").innerHTML = '<div class="art" style="background-image:' + esc(art(it)) + '"></div><div class="copy">' +
      '<span class="chip">' + esc(it.chip || "") + "</span><h1>" + esc(it.title) + '</h1><p class="sub">' + esc(it.sub || "") + "</p>" +
      (it.desc ? '<p class="desc">' + esc(it.desc) + "</p>" : "") +
      '<div class="acts"><div class="btn glass f" data-k="h:open" data-r="h" data-act="hopen" aria-label="Open">Open</div>' +
      (it.plain ? "" : '<div class="btn glass f" data-k="h:list" data-r="h" data-act="hlist" aria-label="My List">' + (inList ? "In My List - remove" : "Add to My List") + "</div>") + "</div></div>";
  }
  function renderApps() {
    $("apps").innerHTML = '<div class="rowline">' + D.apps.map(function (a, i) {
      var c = a.plat ? a.plat.color : "#2d3a66";
      var face = cfg.demo || !TV ? esc(a.name.charAt(0)) : '<img src="http://tvos.invalid/icon/' + esc(a.pkg) + '" alt="" onerror="this.remove()">';
      return '<div class="app f" data-k="a:' + esc(a.pkg) + '" data-r="a" data-i="' + i + '" aria-label="' + esc(a.name) + '"><div class="ico glass" style="background-color:' + (cfg.demo ? c : "") + '">' + face + '</div><div class="nm">' + esc(a.name) + "</div></div>";
    }).join("") + "</div>";
  }
  function renderRows() {
    buildRows();
    $("rows").innerHTML = D.rows.map(function (r) {
      var sub = "";
      return '<section class="row" data-row="' + r.id + '"><h2>' + esc(r.title) + sub + '</h2><div class="clip"><div class="track">' +
        r.items.map(function (it) { return cardHTML(it, r.id); }).join("") + "</div></div></section>";
    }).join("");
  }
  function applyLook() {
    document.body.className = cfg.home.wallpaper ? "wall" : "ban";
    startScenes();
  }
  function renderAll() {
    var k = cur && cur.getAttribute("data-k");
    D.items = {};
    applyLook(); renderTop(); renderApps(); renderRows(); renderHero(); tickClock();
    setFocus(findKey(k) || firstApp());
  }
  function firstApp() { return document.querySelector("#apps .f"); }
  function findKey(k, root) {
    if (!k) return null;
    var els = (root || document).querySelectorAll(".f");
    for (var i = 0; i < els.length; i++) if (els[i].getAttribute("data-k") === k) return els[i];
    return null;
  }

  // ---------- focus
  function scopeRoot() { return D.stack.length ? D.stack[D.stack.length - 1].el : document.body; }
  function grid() {
    var root = scopeRoot(), out = [], map = {};
    Array.prototype.forEach.call(root.querySelectorAll(".f"), function (el) {
      if (!D.stack.length && el.closest(".ov,.sheet")) return;
      var r = el.getAttribute("data-r") || "x";
      if (!map[r]) { map[r] = []; out.push(map[r]); }
      map[r].push(el);
    });
    // home order: top bar, hero buttons, apps, then the rows
    return out;
  }
  function setFocus(el) {
    if (!el) return;
    if (cur) cur.classList.remove("focus");
    cur = el; el.classList.add("focus");
    if (!D.stack.length) {
      var inHero = !!el.closest("#apps");
      if (inHero || el.closest("#top")) { renderHeroKeepFocus(); }
      scrollHome(el);
      var clip = el.closest(".clip");
      if (clip) clip.scrollLeft = Math.max(0, el.offsetLeft - 14 * rem());
    } else {
      var sc = el.closest(".scroll");
      if (sc) { var top = el.offsetTop - sc.offsetTop; if (top < sc.scrollTop || top + el.offsetHeight > sc.scrollTop + sc.clientHeight) sc.scrollTop = Math.max(0, top - 8 * rem()); }
    }
  }
  function renderHeroKeepFocus() {
    var before = cur, h = D.hero ? D.hero.title : "";
    if (cur && cur.closest("#apps")) { var n = heroItem(); if (n.title === h && n.chip === (D.hero && D.hero.chip)) return; renderHero(); cur = before; }
  }
  function rem() { return parseFloat(getComputedStyle(document.documentElement).fontSize); }
  function scrollHome(el) {
    var row = el.closest(".row"), y = 0;
    if (row) y = Math.max(0, row.offsetTop - 19 * rem());
    $("page").style.transform = "translateY(" + (-y) + "px)";
    document.body.classList.toggle("scrolled", y > 0);
  }
  function move(dx, dy) {
    var g = grid(), r = -1, c = -1;
    for (var i = 0; i < g.length; i++) { var j = g[i].indexOf(cur); if (j >= 0) { r = i; c = j; } }
    if (r < 0) { setFocus(g[0] && g[0][0]); return; }
    if (dx) { var n = c + dx; if (n >= 0 && n < g[r].length) setFocus(g[r][n]); return; }
    var nr = r + dy; if (nr < 0 || nr >= g.length) return;
    var x = cur.getBoundingClientRect(); x = x.left + x.width / 2;
    var best = g[nr][0], bd = 1e9;
    g[nr].forEach(function (e) { var b = e.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - x); if (d < bd) { bd = d; best = e; } });
    setFocus(best);
  }

  // ---------- actions
  function toast(t) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 3000); }
  function openItem(it) {
    var ok = false;
    try {
      if (TV && !cfg.demo) {
        if (it.wn) ok = TV.openWatchNext(String(it.wn));
        else if (it.pid) ok = TV.openPublished(it.pid);
        else if (it.url) ok = TV.openUrl(it.url);
        if (!ok && it.pkg) ok = TV.launch(it.pkg);
      }
    } catch (e) {}
    if (!ok) toast(cfg.demo ? "Sample data: this would open " + ((platById(it.platform) || {}).name || it.title) : "Could not open " + it.title);
  }
  function toggleList(it) {
    var had = L.listHas(mylist, it);
    mylist = L.listToggle(mylist, it); kset("tvhome.mylist", mylist);
    toast(had ? "Removed from My List" : "Added to My List");
    if (!D.stack.length) { var k = cur && cur.getAttribute("data-k"); renderRows(); renderHero(); setFocus(findKey(k) || firstApp()); }
  }
  function gemini(q) {
    var ok = false;
    try { ok = TV ? (q ? TV.assistQuery(q) : TV.assist()) : false; } catch (e) {}
    if (!ok) toast("No assistant found on this TV");
  }
  function itemOf(el) { return D.items[el.getAttribute("data-id")]; }

  function activate(el, long) {
    var act = el.getAttribute("data-act");
    if (act) return doAct(act, el);
    if (el.classList.contains("card")) { var it = itemOf(el); return it && (long ? sheet(it) : openItem(it)); }
    if (el.classList.contains("app")) { var a = D.apps[+el.getAttribute("data-i")]; if (a) { try { if (TV && !cfg.demo) TV.launch(a.pkg); else toast("Sample data: this would open " + a.name); } catch (e) {} } }
  }
  function doAct(act, el) {
    switch (act) {
      case "search": return openSearch();
      case "mylist": return openMyList();
      case "surprise": return openSurprise();
      case "gemini": return gemini();
      case "settings": return openSettings();
      case "hopen": return D.hero && (D.hero.plain ? openItem(D.hero) : openItem(D.hero));
      case "hlist": if (D.hero) { toggleList(D.hero); } return;
      case "close": return closeTop();
    }
  }

  // ---------- overlays
  function openOv(cls, html, onClose) {
    var el = document.createElement("div"); el.className = "ov " + cls; el.innerHTML = html; document.body.appendChild(el);
    D.stack.push({ el: el, onClose: onClose, prev: cur });
    return el;
  }
  function closeTop() {
    var o = D.stack.pop(); if (!o) return false;
    o.el.remove();
    if (o.onClose) o.onClose();
    var back = o.prev && document.body.contains(o.prev) ? o.prev : (findKey(o.prev && o.prev.getAttribute("data-k")) || firstApp());
    cur = null; setFocus(back);
    if (!D.stack.length) { D.items = D.items; }
    return true;
  }
  function sheet(it) {
    var inList = L.listHas(mylist, it);
    var el = document.createElement("div"); el.className = "sheet";
    el.innerHTML = '<div class="panel glass"><h2>' + esc(it.title) + '</h2><p class="sub">' + esc(it.sub || "") + "</p>" +
      '<div class="btn glass f" data-r="s1" data-k="s:open" data-act="s-open">Open</div>' +
      '<div class="btn glass f" data-r="s2" data-k="s:list" data-act="s-list">' + (inList ? "Remove from My List" : "Add to My List") + "</div>" +
      '<div class="btn glass f" data-r="s3" data-k="s:close" data-act="close">Close</div></div>';
    document.body.appendChild(el);
    D.stack.push({ el: el, prev: cur, sheetItem: it });
    setFocus(el.querySelector(".f"));
  }
  document.addEventListener("click", function () {});

  function gridHTML(items, rid, cols) {
    var h = "";
    items.forEach(function (it, i) { h += cardHTML(it, rid + Math.floor(i / cols)); });
    return h;
  }

  // ----- search
  var SQ = { q: "", genres: [], label: "", results: null };
  function openSearch() {
    SQ = { q: "", genres: [], label: "", results: null };
    var chips = L.GENRES.map(function (g, i) { return chip("g" + g.id, g.name, i); }).concat(L.MOODS.map(function (m, i) { return chip(m.id, m.name, L.GENRES.length + i); }));
    function chip(id, name, i) { return '<div class="chipb glass f" data-act="chip" data-chip="' + id + '" data-r="c' + Math.floor(i / 7) + '" data-k="c:' + id + '">' + esc(name) + "</div>"; }
    var el = openOv("search", '<h1>Search</h1><div class="field glass f" data-r="q" data-k="q:input" data-act="qfocus">' + ICON.search +
      '<input id="q" type="text" placeholder="Search shows and movies, or pick a genre" autocomplete="off" spellcheck="false"></div>' +
      '<div class="chips">' + chips.join("") + "</div>" +
      '<div class="scroll"><h3 id="sh"></h3><div class="grid" id="sres"></div></div>' +
      '<p class="hint">Only your platforms. OK opens a title, hold OK to add it to My List. Ask Gemini hands your words to the TV\'s own assistant.</p>');
    var inp = el.querySelector("#q");
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); inp.blur(); runSearch(); }
      else if (e.key === "ArrowDown" || e.key === "Escape") { e.preventDefault(); inp.blur(); if (e.key === "ArrowDown") move(0, 1); }
      e.stopPropagation();
    });
    setFocus(el.querySelector(".f"));
    runSearch();
  }
  function runSearch() {
    var o = D.stack[D.stack.length - 1]; if (!o || !o.el.classList.contains("search")) return;
    var q = o.el.querySelector("#q").value.trim();
    SQ.q = q;
    var sh = o.el.querySelector("#sh"), res = o.el.querySelector("#sres");
    if (!q && !SQ.genres.length) { sh.textContent = D.plats.length ? "Popular on your platforms" : "Add streaming apps in setup to search them"; }
    else sh.textContent = (SQ.label || (q ? "Results for “" + q + "”" : "")) + (SQ.label && q ? " - " + q : "");
    res.innerHTML = '<div class="empty-note">Searching...</div>';
    var token = SQ.token = (SQ.token || 0) + 1;
    S.search(cfg, D.plats, q, SQ.genres, { pool: pool() }).then(function (items) {
      if (token !== SQ.token || !document.body.contains(res)) return;
      var list = items.slice(0, 20);
      var extra = q ? '<div class="chipb glass f" data-act="askgem" data-r="ask" data-k="ask:gemini">' + ICON.gemini.replace("<svg", '<svg style="width:3rem;height:3rem;margin-right:1rem"') + 'Ask Gemini about “' + esc(q) + "”</div>" : "";
      res.innerHTML = (extra ? '<div style="width:100%">' + extra + "</div>" : "") +
        (list.length ? gridHTML(list, "res", 5) : '<div class="empty-note">Nothing on your platforms for that' + (L.tmdbActive(cfg) || cfg.demo ? "." : ". Turn on TMDB in Settings to search beyond what your apps publish.") + "</div>");
    });
  }

  // ----- my list
  function openMyList() {
    var el = openOv("mylist", '<h1>My List</h1><div class="scroll"><div class="grid" id="mlg"></div></div><p class="hint">OK opens a title, hold OK to remove it.</p>');
    renderMyList(el); setFocus(el.querySelector(".f") || el);
  }
  function renderMyList(el) {
    var g = el.querySelector("#mlg");
    g.innerHTML = mylist.length ? gridHTML(mylist, "ml", 5) : '<div class="empty-note">Nothing here yet. Hold OK on any title to add it.</div>';
  }

  // ----- surprise me
  function openSurprise(prevTitle) {
    var all = pool().concat(continueItems().filter(function (x) { return x.source !== "x"; }));
    all = L.dedupe(all).filter(function (x) { return x.title !== prevTitle; });
    var it = L.pick(all);
    var prev = D.stack.length && D.stack[D.stack.length - 1].el.classList.contains("surprise-ov") ? D.stack.pop() : null;
    if (prev) prev.el.remove();
    var el = openOv("surprise-ov", it ?
      '<h1>Surprise me</h1><div class="surprise"><div class="big" style="background-image:' + esc(art(it)) + '"></div><div><h2 style="font-size:5rem">' + esc(it.title) + '</h2><p class="sub" style="color:var(--mute);margin:1rem 0 1rem">' +
      esc(it.sub || "") + ((platById(it.platform) || {}).name ? " on " + esc(platById(it.platform).name) : "") + '</p><p style="max-width:70rem;margin-bottom:2rem;color:rgba(255,255,255,.88)">' + esc((it.desc || "").slice(0, 120)) + "</p>" +
      '<div class="acts" style="display:flex;gap:2rem;flex-wrap:wrap"><div class="btn glass f" data-r="su" data-k="su:open" data-act="su-open">Open it</div><div class="btn glass f" data-r="su" data-k="su:again" data-act="su-again">Another</div>' +
      '<div class="btn glass f" data-r="su" data-k="su:list" data-act="su-list">' + (L.listHas(mylist, it) ? "In My List" : "Add to My List") + "</div></div></div></div>" :
      '<h1>Surprise me</h1><p class="empty-note">Nothing to pick from yet.</p>');
    if (prev) el.__prev = prev.prev;
    el.__item = it;
    if (prev) D.stack[D.stack.length - 1].prev = prev.prev;
    setFocus(el.querySelector(".f") || el);
  }

  // ----- settings
  function openSettings(keep) {
    var rows = [];
    var tm = L.tmdbActive(cfg);
    function tog(id, label, on, note) { rows.push('<div class="setrow glass f" data-r="' + id + '" data-k="set:' + id + '" data-act="set" data-set="' + id + '"><span>' + label + '</span><span class="v">' + (note || (on ? "On" : "Off")) + "</span></div>"); }
    function head(t) { rows.push('<div class="sethead">' + t + "</div>"); }
    function info(t) { rows.push('<p class="setinfo">' + t + "</p>"); }
    head("Look");
    tog("wallpaper", "Wallpaper (off = recommendations banner)", cfg.home.wallpaper);
    tog("clock", "Clock format", 0, cfg.home.clock === "system" ? "Same as TV" : cfg.home.clock + " hour");
    tog("show_date", "Show the date", cfg.home.show_date);
    head("Top bar");
    tog("gemini", "Gemini button (opens the TV's own assistant)", cfg.home.gemini);
    head("Platform rows (What's on ...)");
    if (!D.plats.length) info("No streaming apps configured. Add them in config.json (home.app_order) or run setup.");
    D.plats.forEach(function (p) { tog("row-" + p.id, "What's on " + p.name, L.rowOn(cfg, p)); });
    head("Recommendations");
    tog("tmdb", "TMDB suggestions and search (off by default)", cfg.tmdb.enabled, cfg.tmdb.enabled && !cfg.tmdb.api_key ? "On, no key" : null);
    rows.push('<div class="setrow glass f" data-r="key" data-k="set:key" data-act="set" data-set="key"><span>TMDB key</span><span class="v">' + (cfg.tmdb.api_key ? "Set (" + esc(cfg.tmdb.region) + ")" : "Not set - tmdb.api_key in config.json") + "</span></div>");
    info("Without TMDB, rows use what your apps publish to the TV. With TMDB, rows are ranked by the genres of My List and Continue watching, only for your platforms in " + esc(cfg.tmdb.region) + ", including rent and buy.");
    head("Home screen");
    rows.push('<div class="setrow glass f" data-r="home" data-k="set:home" data-act="set" data-set="home"><span>Make this my home screen</span><span class="v">' + esc(homeState()) + "</span></div>");
    head("Credits");
    info("This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.");
    info("Based on couch-tv by Seagey (MIT). Gemini is the TV's own assistant: this app contains no AI.");
    var el = openOv("settings", '<h1>Settings</h1><div class="scroll">' + rows.join("") + '<div class="setrow glass f" data-r="done" data-k="set:done" data-act="close"><span>Done</span><span></span></div></div>', function () { renderAll(); loadAndRender(); });
    var f = keep && findKey(keep, el); setFocus(f || el.querySelector(".f"));
  }
  function homeState() { try { return TV && TV.homeState ? TV.homeState() : "-"; } catch (e) { return "-"; } }
  function doSet(id) {
    var o = D.stack[D.stack.length - 1], keep = "set:" + id;
    if (id === "wallpaper") setting("wallpaper", !cfg.home.wallpaper);
    else if (id === "gemini") setting("gemini", !cfg.home.gemini);
    else if (id === "show_date") setting("show_date", !cfg.home.show_date);
    else if (id === "clock") setting("clock", { system: "12", "12": "24", "24": "system" }[cfg.home.clock]);
    else if (id === "tmdb") setting("tmdb_enabled", !cfg.tmdb.enabled);
    else if (id.indexOf("row-") === 0) { var pr = ST.platform_rows || {}, pid = id.slice(4); pr[pid] = !(cfg.home.platform_rows[pid] !== false); setting("platform_rows", pr); }
    else if (id === "key") { return keyEntry(); }
    else if (id === "home") { try { if (TV && TV.requestHome) TV.requestHome(); } catch (e) {} return; }
    o.el.remove(); D.stack.pop(); var prev = o.prev; 
    openSettings(keep); D.stack[D.stack.length - 1].prev = prev;
    applyLook(); tickClock();
  }
  function keyEntry() {
    var v = window.prompt ? null : null;
    var el = document.createElement("div"); el.className = "sheet";
    el.innerHTML = '<div class="panel glass"><h2>TMDB key</h2><p class="sub">Type it with the TV keyboard, or put it in config.json instead.</p><div class="field glass f" data-r="k1" data-k="k:input" data-act="qfocus" style="width:90rem"><input id="kin" type="text" autocomplete="off" spellcheck="false" placeholder="API key (v3)"></div><div class="btn glass f" data-r="k2" data-k="k:save" data-act="key-save">Save</div></div>';
    document.body.appendChild(el); D.stack.push({ el: el, prev: cur });
    el.querySelector("input").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } e.stopPropagation(); });
    setFocus(el.querySelector(".f"));
  }

  // ---------- keys
  var enterDown = false, fired = false;
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault(); move(k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0);
    } else if (k === "Enter") {
      e.preventDefault();
      if (!cur) return;
      // Android's WebView sends the held key again as a plain keydown, so a second one before the keyup is a hold
      var again = e.repeat || enterDown; enterDown = true;
      if (again) { if (!fired && cur.classList.contains("card")) { fired = true; var it = itemOf(cur); if (it) sheet(it); } return; }
      fired = false;
    } else if (k === "ContextMenu" || e.keyCode === 82) {
      e.preventDefault(); if (cur && cur.classList.contains("card")) { var it2 = itemOf(cur); if (it2) sheet(it2); }
    } else if (k === "Escape" || k === "Backspace" || k === "GoBack") { e.preventDefault(); back(); }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault(); enterDown = false;
    if (fired) { fired = false; return; }
    if (cur) press(cur);
  });
  function press(el) {
    var act = el.getAttribute("data-act"), o = D.stack[D.stack.length - 1];
    switch (act) {
      case "qfocus": var i = el.querySelector("input"); if (i) i.focus(); return;
      case "chip": return chipPress(el);
      case "askgem": return gemini(SQ.q);
      case "set": return doSet(el.getAttribute("data-set"));
      case "s-open": if (o) { var s = o.sheetItem; closeTop(); openItem(s); } return;
      case "s-list": if (o) { var s2 = o.sheetItem; closeTop(); toggleList(s2); refreshOverlay(); } return;
      case "su-open": return openItem(o.el.__item);
      case "su-again": return openSurprise(o.el.__item && o.el.__item.title);
      case "su-list": toggleList(o.el.__item); o.el.querySelector('[data-act="su-list"]').textContent = L.listHas(mylist, o.el.__item) ? "In My List" : "Add to My List"; return;
      case "key-save": var v = o.el.querySelector("input").value.trim(); closeTop(); if (/^[A-Za-z0-9]{16,64}$/.test(v)) { setting("tmdb_key", v); toast("Key saved on this TV"); var so = D.stack.pop(); so.el.remove(); openSettings("set:key"); } else toast("That does not look like a TMDB v3 key"); return;
    }
    activate(el, false);
  }
  function refreshOverlay() {
    var o = D.stack[D.stack.length - 1]; if (!o) return;
    if (o.el.classList.contains("mylist")) { renderMyList(o.el); setFocus(o.el.querySelector(".f") || null); }
  }
  function chipPress(el) {
    var id = el.getAttribute("data-chip"), o = D.stack[D.stack.length - 1];
    var on = el.classList.contains("on");
    Array.prototype.forEach.call(o.el.querySelectorAll(".chipb.on"), function (c) { c.classList.remove("on"); });
    if (on) { SQ.genres = []; SQ.label = ""; }
    else {
      el.classList.add("on");
      var m = L.MOODS.filter(function (x) { return x.id === id; })[0];
      if (m) { SQ.genres = m.genres; SQ.label = m.name; }
      else { var gid = +id.slice(1); SQ.genres = [gid]; SQ.label = L.GENRES.filter(function (g) { return g.id === gid; })[0].name; }
    }
    runSearch();
  }
  function back() {
    if (document.activeElement && document.activeElement.tagName === "INPUT") { document.activeElement.blur(); return; }
    if (closeTop()) return;
    goStart();
  }
  function goStart() { cur = null; setFocus(firstApp()); }

  // ---------- clock, weather, wallpaper
  var wx = "";
  function tickClock() {
    var d = new Date(), sys24 = true;
    try { sys24 = TV && TV.is24Hour ? TV.is24Hour() : false; } catch (e) {}
    $("time").textContent = L.clockText(d, cfg.home.clock, sys24);
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    $("date").textContent = cfg.home.show_date ? days[d.getDay()] + " " + d.getDate() + " " + mon[d.getMonth()] + (wx ? " · " + wx : "") : (wx || "");
  }
  function weather() {
    var w = cfg.weather; if (!w || !w.lat) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + w.lat + "&longitude=" + w.lon + "&current=temperature_2m&timezone=" + encodeURIComponent(w.timezone || "auto"))
      .then(function (r) { return r.json(); }).then(function (j) { if (j.current) { wx = Math.round(j.current.temperature_2m) + "°"; tickClock(); } }).catch(function () {});
  }
  var scene = { i: 0, t: 0, on: 0 };
  function startScenes() {
    clearInterval(scene.t);
    if (!cfg.home.wallpaper) return;
    var list = cfg.home.scenes, phs = document.querySelectorAll("#bg .ph");
    function show() {
      var ph = phs[scene.on = 1 - scene.on], id = list[scene.i++ % list.length];
      ph.style.backgroundImage = 'url("backgrounds/scene-' + id + '.jpg")';
      ph.classList.add("on"); phs[1 - scene.on].classList.remove("on");
    }
    show(); scene.t = setInterval(show, cfg.home.scene_seconds * 1000);
  }

  // ---------- start
  function loadAndRender() {
    return loadData().then(function () { renderAll(); }).catch(function () { renderAll(); });
  }
  window.tv = {
    home: function () { while (closeTop()) {} goStart(); },
    back: back, settingsKey: function () { if (!D.stack.length) openSettings(); },
    resume: function () { loadAndRender(); }, pause: function () {}, homeAnswered: function () {}, photosAdded: function () {}, update: function () {}
  };
  window.__home = { state: function () { return { wallpaper: cfg.home.wallpaper, rows: D.rows.map(function (r) { return r.id; }, 0), plats: D.plats.map(function (p) { return p.id; }), mylist: mylist.length, diag: D.diag, focus: cur && cur.getAttribute("data-k") }; } };
  loadApps(); renderTop(); renderApps(); renderHero(); applyLook(); tickClock(); setFocus(firstApp());
  loadAndRender().then(weather);
  setInterval(tickClock, 15000);
})();
