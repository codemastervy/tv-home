// Config defaults, platform rules, My List, taste and search matching, and "TMDB off means no request".
var fs = require("fs"), vm = require("vm"), assert = require("assert");
var W = __dirname + "/../tv-home/web/";
var L = require(W + "logic.js");

// --- config
var d = L.normalize({});
assert.strictEqual(d.home.wallpaper, true); assert.strictEqual(d.home.gemini, true);
assert.strictEqual(d.tmdb.enabled, false); assert.strictEqual(d.tmdb.region, "NZ");
assert.strictEqual(L.normalize({ tmdb: { enabled: true, api_key: "bad key; rm" } }).tmdb.api_key, "", "odd keys are dropped");
assert.strictEqual(L.tmdbActive(L.normalize({ tmdb: { enabled: true } })), false, "enabled without a key is not active");
var KEY = "abcdef0123456789abcdef0123456789";
assert.strictEqual(L.tmdbActive(L.normalize({ tmdb: { enabled: true, api_key: KEY } })), true);
assert.strictEqual(L.normalize({ home: { clock: "99" } }).home.clock, "system");
var m = L.merge(L.normalize({}), { wallpaper: false, gemini: false, platform_rows: { disney: false, bogus: false }, clock: "24", tmdb_enabled: true, tmdb_key: KEY });
assert.strictEqual(m.home.wallpaper, false); assert.strictEqual(m.home.gemini, false); assert.strictEqual(m.home.clock, "24");
assert.strictEqual(m.home.platform_rows.disney, false); assert.strictEqual(m.home.platform_rows.bogus, undefined);
assert.ok(m.tmdb.enabled && m.tmdb.api_key === KEY);

// --- platforms: only configured and installed ones, in apps-row order
var cfg = L.normalize({ home: { app_order: ["com.disney.disneyplus", "com.netflix.ninja"], platform_rows: { netflix: false } } });
var ps = L.configured(cfg, ["com.netflix.ninja", "com.disney.disneyplus", "com.amazon.amazonvideo.livingroom"]);
assert.deepStrictEqual(ps.map(function (p) { return p.id; }), ["disney", "netflix"], "prime is installed but not in app_order");
assert.strictEqual(L.rowOn(cfg, ps[0]), true); assert.strictEqual(L.rowOn(cfg, ps[1]), false);
assert.deepStrictEqual(L.configured(L.normalize({}), ["com.netflix.ninja"]).map(function (p) { return p.id; }), ["netflix"]);
assert.deepStrictEqual(L.configured(L.normalize({}), []), []);

// --- My List
var a = { title: "Alpha", platform: "netflix", art: "x" }, b = { title: "Beta", platform: "disney" };
var list = L.listToggle([], a); assert.strictEqual(list.length, 1); assert.ok(L.listHas(list, a));
list = L.listToggle(list, b); assert.strictEqual(list[0].title, "Beta", "newest first");
assert.ok(L.listHas(list, { title: "ALPHA", platform: "netflix" }), "case-insensitive");
list = L.listToggle(list, a); assert.deepStrictEqual(list.map(function (x) { return x.title; }), ["Beta"]);
assert.strictEqual(L.listToggle(list, b).length, 0);

// --- taste and ranking, search
var seen = [{ genres: [35, 10751] }, { genres: [35, 10751] }, { genres: [18] }];
assert.deepStrictEqual(L.taste(seen, 2), [35, 10751]);
var items = [{ title: "A", genres: [18] }, { title: "B", genres: [35] }, { title: "C", genres: [35, 10751] }];
assert.deepStrictEqual(L.rank(items, [35, 10751]).map(function (x) { return x.title; }), ["C", "B", "A"]);
assert.deepStrictEqual(L.rank(items, []).map(function (x) { return x.title; }), ["A", "B", "C"]);
var pool = [{ title: "Orbit", platform: "netflix", genres: [878] }, { title: "Laugh", platform: "disney", genres: [35] }, { title: "Laugh 2", platform: "hulu", genres: [35] }];
assert.deepStrictEqual(L.match(pool, "orb", [], ["netflix", "disney"]).map(function (x) { return x.title; }), ["Orbit"]);
assert.deepStrictEqual(L.match(pool, "", [35], ["netflix", "disney"]).map(function (x) { return x.title; }), ["Laugh"], "nothing from a platform that is not yours");
assert.strictEqual(L.pick([], Math.random), null); assert.strictEqual(L.pick([1, 2, 3], function () { return 0.99; }), 3);
assert.deepStrictEqual(L.canonGenres("COMEDY,FAMILY_KIDS"), [35, 10751]);
assert.strictEqual(L.clockText(new Date(2026, 0, 1, 15, 5), "12", true), "3:05 pm");
assert.strictEqual(L.clockText(new Date(2026, 0, 1, 15, 5), "system", true), "15:05");

// --- TMDB: off means not one request; on means only api.themoviedb.org
function load(fetchStub) {
  var ctx = { window: {}, fetch: fetchStub, console: console, encodeURIComponent: encodeURIComponent, Promise: Promise };
  ctx.window = ctx; ctx.Logic = L;
  vm.runInNewContext(fs.readFileSync(W + "sources.js", "utf8"), ctx);
  return ctx.Sources;
}
var calls = [];
var S = load(function (u) { calls.push(u); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ results: [] }); } }); });
var off = L.normalize({ tmdb: { enabled: false, api_key: KEY } });
var net = L.PLATFORMS[0];
Promise.all([S.platformRow(off, net, { published: [], taste: [] }), S.search(off, [net], "x", [], { pool: [] }), S.genresOf(off, "x")]).then(function () {
  assert.strictEqual(calls.length, 0, "TMDB off: no request, got " + calls);
  var on = L.normalize({ tmdb: { enabled: true, api_key: KEY, region: "NZ" } });
  return S.platformRow(on, net, { published: [], taste: [35] }).then(function () {
    assert.ok(calls.length > 0 && calls.every(function (u) { return u.indexOf("https://api.themoviedb.org/3/") === 0; }), "only api.themoviedb.org");
    assert.ok(calls.every(function (u) { return u.indexOf("watch_region=NZ") > 0 && u.indexOf("with_watch_providers=8") > 0; }), "filtered by region and provider");
    assert.ok(calls.some(function (u) { return u.indexOf("rent") > 0; }), "rent/buy offers are asked for");
    console.log("Logic tests passed.");
  });
}).catch(function (e) { console.error(e); process.exit(1); });
