// Sample data for screenshots and emulator tests (config "demo": true). Invented titles and
// generated art only: no real posters, no network. Never used unless the config asks for it.
(function (root) {
  var HUES = { netflix: [350, 20], disney: [220, 260], prime: [195, 215], appletv: [270, 300], youtube: [0, 25] };
  function art(seed, h1, h2) {
    var r = function (i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h1 + ',70%,46%)"/><stop offset="1" stop-color="hsl(' + h2 + ',70%,18%)"/></linearGradient></defs>' +
      '<rect width="640" height="360" fill="url(#g)"/>';
    for (var i = 0; i < 5; i++) {
      s += '<circle cx="' + Math.round(r(i) * 640) + '" cy="' + Math.round(r(i + 9) * 360) + '" r="' + Math.round(50 + r(i + 4) * 130) +
        '" fill="hsl(' + Math.round(h1 + r(i + 2) * 50) + ',70%,60%)" opacity="' + (0.22 + r(i + 7) * 0.3).toFixed(2) + '"/>';
    }
    s += '<path d="M0 300 Q160 ' + Math.round(230 + r(3) * 60) + ' 320 290 T640 ' + Math.round(250 + r(5) * 50) + ' V360 H0Z" fill="#000" opacity="0.35"/></svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(s);
  }
  // [title, sub, genres, avail, kind]
  var T = {
    netflix: [["Harbour Lights", "Drama series, 3 seasons", [18, 80], "stream", "tv"], ["The Long Orbit", "Sci-Fi film, 2h 04m", [878, 53], "stream", "movie"],
      ["Salt and Ember", "Crime series, 2 seasons", [80, 18], "stream", "tv"], ["Nine Lives of Mo", "Comedy film, 1h 38m", [35, 10751], "stream", "movie"],
      ["Quiet Season", "Mystery series", [9648, 18], "stream", "tv"], ["Paper Kingdoms", "Animation film", [16, 10751], "stream", "movie"]],
    disney: [["Little Comet", "Animation film, 1h 32m", [16, 10751], "stream", "movie"], ["Rangers of Ember Hill", "Family series", [10751, 28], "stream", "tv"],
      ["The Lantern Keeper", "Fantasy film, 1h 51m", [10751, 16], "stream", "movie"], ["Deep Blue Diaries", "Documentary series", [99], "stream", "tv"],
      ["Captain Pip", "Comedy series", [35, 10751], "stream", "tv"]],
    prime: [["Night Shift Detectives", "Crime series, 4 seasons", [80, 53], "stream", "tv"], ["Second Wind", "Comedy film, 1h 44m", [35], "stream", "movie"],
      ["Last Train North", "Thriller film, 1h 58m", [53, 28], "rent", "movie"], ["Blue Mile", "Drama film, 2h 10m", [18], "buy", "movie"],
      ["Backyard Chefs", "Comedy series", [35], "stream", "tv"]],
    appletv: [["Orbit House", "Sci-Fi series, 2 seasons", [878, 18], "stream", "tv"], ["The Understudy", "Comedy series", [35, 18], "stream", "tv"],
      ["Mountain Letters", "Drama film, 1h 56m", [18, 10749], "rent", "movie"], ["Fast Lane Home", "Action film, 1h 49m", [28], "buy", "movie"]],
    youtube: [["Pocket Kitchen", "Cooking, 12 min", [99], "stream", "movie"], ["Tiny Trains of Europe", "Documentary, 24 min", [99], "stream", "movie"],
      ["Sunday Comedy Hour", "Stand-up special", [35], "stream", "movie"], ["Ocean Floor Live", "Nature, 41 min", [99], "stream", "movie"]]
  };
  var DESC = "A short invented description for the sample data, so the banner has a line of text to show under the title.";
  var catalog = [], n = 0;
  Object.keys(T).forEach(function (pid) {
    T[pid].forEach(function (r) {
      n++;
      var h = HUES[pid];
      catalog.push({ title: r[0], sub: r[1], genres: r[2], avail: r[3], kind: r[4], platform: pid, desc: DESC,
        art: art(n, h[0] + (n * 17) % 60, h[1] + (n * 11) % 50), source: "demo" });
    });
  });
  var watching = [["Harbour Lights", "netflix", "S2 E4", 0.62], ["Little Comet", "disney", "1h 12m left", 0.4], ["Night Shift Detectives", "prime", "S3 E7", 0.8],
    ["The Understudy", "appletv", "S1 E3", 0.25]].map(function (w, i) {
    var base = catalog.filter(function (c) { return c.title === w[0]; })[0];
    return { title: w[0], sub: w[2], platform: w[1], genres: base.genres, art: art(40 + i, HUES[w[1]][0] + 30, HUES[w[1]][1] + 20), progress: w[3], source: "demo", desc: DESC };
  });
  var picks = [["Friday film night", "netflix"], ["Kids pick", "disney"], ["Documentary night", "youtube"]].map(function (p, i) {
    return { title: p[0], sub: "Your pick", platform: p[1], art: art(70 + i, 150 + i * 40, 190 + i * 40), source: "pick" };
  });
  root.DEMO = { catalog: catalog, watching: watching, picks: picks, installed: Object.keys(HUES).map(function (k) { return k; }), art: art };
})(typeof window !== "undefined" ? window : this);
