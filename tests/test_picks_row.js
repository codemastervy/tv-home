// Own-picks row: random order, cleaned, at most MAX cards, never mutates the input.
var fs = require("fs"), vm = require("vm");
var ctx = { window: {}, module: {} }; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(__dirname + "/../tv-home/web/cards.js", "utf8"), ctx);
var CC = ctx.CustomCards, assert = require("assert");
var list = []; for (var i = 0; i < 12; i++) list.push({ title: "T" + i, app: "com.example.app" + i });
var frozen = JSON.stringify(list);
assert.strictEqual(CC.picks(list).length, CC.MAX, "at most MAX cards");
assert.strictEqual(JSON.stringify(list), frozen, "input untouched");
function seq(vals) { var k = 0; return function () { return vals[k++ % vals.length]; }; }
var a = CC.picks(list, seq([0.1, 0.9, 0.5, 0.3])).map(function (c) { return c.title; }).join();
var b = CC.picks(list, seq([0.1, 0.9, 0.5, 0.3])).map(function (c) { return c.title; }).join();
assert.strictEqual(a, b, "same rng, same order");
var orders = {}; for (var n = 0; n < 40; n++) orders[CC.picks(list).map(function (c) { return c.title; }).join()] = 1;
assert.ok(Object.keys(orders).length > 5, "order is random between opens");
assert.strictEqual(JSON.stringify(CC.picks([{ title: "x", url: "javascript:alert(1)" }, { nope: 1 }])), '[{"title":"x"}]', "bad links and cards dropped");
assert.strictEqual(CC.picks(null).length, 0);
console.log("Picks row tests passed.");
