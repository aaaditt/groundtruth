// The talk deck: a web page that behaves like slides (docs/21, site/talk/slides.json).
//
//   Next   right arrow, Page Down (clickers), Space, Enter, the Next button, a tap on a
//          clip or still, or a swipe with three or more fingers (one finger is left alone,
//          to use the live pages)
//   Back   left arrow, Page Up, Backspace, the Back button, or the opposite swipe
//   A still can build in steps (a block diagram adds one group of blocks per press).
//   F full screen   N speaker notes   P presenter window   L show a live slide's fallback
//   B black screen  Home / End first / last slide
//
// Presenting online (remote.js): the deck opened as talk/?room=CODE is screen-shared; each
// speaker opens talk/?presenter&room=CODE on their own laptop or phone. A press there moves
// the deck, and every presenter window follows it.
//
// Three kinds of slide: a clip that plays to its next STOP and waits for the presenter
// (media/cues.json; at a stop the camera holds still but the city keeps moving, from a
// seamless loop in media/holds/; pressing Next while it plays jumps to the stop), a still drawn
// here from data/*.json (the numbers are never typed: every one comes from the files that
// src/presentation_data.py writes from the real data), and a live page of the website in
// an iframe, with a fallback that appears by itself if the page isn't ready in 5 seconds.
// All text goes in with textContent, never innerHTML.
"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
const W = 1920, H = 1080, LIVE_TIMEOUT = 5000, SWIPE_PX = 120;
const $ = (id) => document.getElementById(id);
const DECK_KEYS = new Set(["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " ", "Enter", "Backspace",
  "Home", "End", "f", "F", "n", "N", "p", "P", "l", "L", "b", "B", "."]);

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
function s(tag, attrs = {}, text) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}
const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`;
const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (n) => n.toLocaleString("en-GB");

let BEATS = [], DATA = {}, CUES = {}, cur = -1, step = 0, started = false;
const isPresenter = new URLSearchParams(location.search).has("presenter");

// ------------------------------------------------------------------ charts (static slides)
// Each returns the slide's content. h(title) is the slide headline, src the source line.
function figure(b, sub) {
  const box = el("div", { class: "fig" }, el("h2", {}, b.title));
  if (sub) box.append(el("p", { class: "sub" }, sub));
  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
  box.append(svg);
  return { box, svg };
}
const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
const text = (svg, x, y, str, cls = "lab", anchor = "start") =>
  svg.append(s("text", { x, y, class: cls, "text-anchor": anchor }, str));

// the five promises, worded the same on the opening slide and the scorecard
const PROMISES = ["Read the day from the ground", "Shape beats loudness", "Let its mistakes find unusual days",
  "Test it on holidays it never saw", "Move it to another city"];

// ------------------------------------------------------------------ block diagrams
// Boxes joined by arrows. Each group of boxes is a <g data-step="k">: it appears when the
// presenter reaches step k of the slide (slides.json "static.steps"), so a diagram is
// explained one part at a time. Every number on them comes from data/*.json.
const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function arrowHead(svg, id) {
  const m = s("marker", { id, viewBox: "0 0 12 12", refX: 11, refY: 6, markerWidth: 18, markerHeight: 18,
    orient: "auto", markerUnits: "userSpaceOnUse" });
  m.append(s("path", { d: "M0,0 L12,6 L0,12 z", class: "ah" }));
  const d = s("defs"); d.append(m); svg.append(d);
}
function stepGroup(svg, k) { const g = s("g", { "data-step": String(k), class: "stp" }); svg.append(g); return g; }
// a box: a title in Newsreader and up to three short lines under it
function box(g, x, y, w, h, title, lines = [], tone = "", kicker = "") {
  g.append(s("rect", { x, y, width: w, height: h, rx: 12, class: `blk ${tone}` }));
  const dy = kicker ? 34 : 0;
  if (kicker) text(g, x + 26, y + 44, kicker, "blk-k");
  text(g, x + 26, y + 54 + dy, title, "blk-t");
  lines.forEach((t, i) => text(g, x + 26, y + 100 + dy + i * 38, t, "blk-s"));
}

// the studies before ours, verified against each paper's abstract (docs/02, "Papers")
// (the talk shows three; all seven papers, and what each gave this project: docs/22)
const LIT = [
  { lane: "Describe a city's noise", papers: [
    ["2017", "Díaz et al.", "Barcelona", "traced to traffic, the", "metro and crowds"]] },
  { lane: "Measure the pandemic", papers: [
    ["2021", "Nimiya et al.", "Tokyo, 2017–2021", "weekdays and Sundays", "recovered differently"]] },
  { lane: "Map it street by street", papers: [
    ["2025", "Liu et al.", "San Jose, 50 km of fibre", "maps activity street", "by street"]] },
];
function arrow(g, id, pts, dashed = false) {
  g.append(s("polyline", { points: pts.map((q) => q.join(",")).join(" "), class: `flow${dashed ? " dashed" : ""}`, "marker-end": `url(#${id})` }));
}
// a bracket over a run of boxes, naming what they are
function bracket(g, x0, x1, y, label) {
  g.append(s("polyline", { points: `${x0},${y + 14} ${x0},${y} ${x1},${y} ${x1},${y + 14}`, class: "brk" }));
  text(g, (x0 + x1) / 2, y - 14, label, "ax", "middle");
}

const CHARTS = {
  // one real guess, start to finish: the Wednesday in Brussels the model never saw
  guess(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-guess");
    const ex = DATA.ml.brussels.example, fd = DATA.forest.day, days = DATA.ml.days;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    // the day's 25 numbers
    box(g0, 120, 280, 620, 420, `${DATA.forest.n_features} numbers in`, [`${fmtDate(ex.date)}, Brussels`], "data");
    const base = 530, sc = 110 / Math.max(...ex.shape.map(Math.abs)), bw = 18;
    ex.shape.forEach((v, h) => g0.append(s("rect", { x: 150 + h * 22, y: v > 0 ? base - v * sc : base, width: bw,
      height: Math.max(2, Math.abs(v) * sc), class: "grey" })));
    g0.append(s("line", { x1: 146, x2: 680, y1: base, y2: base, class: "rule" }));
    const lv = Math.max(-1, Math.min(1, ex.level / 3)) * 110;
    g0.append(s("rect", { x: 690, y: lv > 0 ? base - lv : base, width: bw, height: Math.max(2, Math.abs(lv)), class: "city" }));
    text(g0, 150, 680, "24 for the shape, hour by hour", "ax");
    text(g0, 708, 680, "level", "ax", "middle");
    arrow(g0, "ah-guess", [[750, 490], [818, 490]]);
    box(g0, 830, 400, 300, 180, `${DATA.forest.n_trees} trees`, ["each asks a few", "yes/no questions"], "model");
    // the real votes
    arrow(g1, "ah-guess", [[1140, 490], [1208, 490]]);
    const max = Math.max(...Object.values(fd.votes));
    days.forEach((d, i) => {
      const v = fd.votes[d], y = 300 + i * 56, weekend = i >= 5;
      text(g1, 1220, y + 34, d, "lab");
      g1.append(s("rect", { x: 1300, y: y + 8, width: Math.max(3, 420 * v / max), height: 36, class: weekend ? "sea" : "city" }));
      text(g1, 1300 + Math.max(3, 420 * v / max) + 14, y + 36, String(v), "lab");
    });
    text(g1, 1220, 720, "votes from the trees", "ax");
    // the two answers
    const top = days.reduce((a, d) => (fd.votes[d] > fd.votes[a] ? d : a), days[0]);
    const wk = days.slice(0, 5).reduce((a, d) => a + fd.votes[d], 0);
    const full = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
    text(g2, 120, 830, `Which day? ${full[top]}.`, "num");
    text(g2, 120, 880, `Wrong: it was a ${full[fd.true]}.`, "lab t-grey");
    text(g2, 1000, 830, `Weekday or weekend? Weekday.`, "num");
    text(g2, 1000, 880, `Right: ${wk} of ${DATA.forest.n_trees} trees agree.`, "lab t-good");
    return fig;
  },

  // which of the 25 numbers the forest leans on (Brussels, all ordinary days)
  importance(b) {
    const { box: fig, svg } = figure(b);
    const im = DATA.ml.brussels.importance, all = [...im.shape, im.level];
    const max = Math.max(...all), x0 = 160, bw = 52, gap = 12, base = 820, hmax = 440;
    const order = im.shape.map((v, h) => [v, h]).sort((a, c) => c[0] - a[0]);
    const top = new Set(order.slice(0, 3).map(([, h]) => h));
    const rank = 1 + all.filter((v) => v > im.level).length;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1);
    all.forEach((v, i) => {
      const x = x0 + i * (bw + gap) + (i === 24 ? 30 : 0), hgt = hmax * v / max;
      g0.append(s("rect", { x, y: base - hgt, width: bw, height: hgt, class: i === 24 ? "city" : "grey" }));
      if (i < 24 && i % 3 === 0) text(g0, x + bw / 2, base + 40, `${String(i).padStart(2, "0")}:00`, "ax", "middle");
      if (i < 24 && top.has(i)) {
        g1.append(s("rect", { x, y: base - hgt, width: bw, height: hgt, class: "ink" }));
        text(g1, x + bw / 2, base - hgt - 16, `${String(i).padStart(2, "0")}:00`, "lab", "middle");
      }
    });
    text(g0, x0 + 24 * (bw + gap) + 30 + bw / 2, base + 40, "level", "ax", "middle");
    text(g0, 120, 300, "How much each number helps the trees split the days (Brussels, all ordinary days)", "ax");
    text(g1, 120, 940, `The level, how loud the whole day was, ranks ${rank} of 25. The shape of the day does the work.`, "lab");
    return fig;
  },

  // where it goes wrong: real day (rows) against the model's guess (columns)
  confusion(b) {
    const { box: fig, svg } = figure(b);
    const days = DATA.ml.days, br = DATA.ml.brussels, po = DATA.ml.pooled, cell = 64;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    function matrix(g, x0, y0, cm, pctMode, title, sub) {
      text(g, x0, y0 - 92, title, "lab");
      text(g, x0, y0 - 54, sub, "ax");
      days.forEach((d, j) => text(g, x0 + j * cell + cell / 2, y0 - 12, d, "ax", "middle"));
      cm.forEach((row, i) => {
        const n = row.reduce((a, v) => a + v, 0);
        text(g, x0 - 14, y0 + i * cell + cell / 2 + 10, days[i], "ax", "end");
        row.forEach((v, j) => {
          const share = n ? v / n : 0;
          g.append(s("rect", { x: x0 + j * cell, y: y0 + i * cell, width: cell - 3, height: cell - 3,
            class: "ink", opacity: (0.06 + 0.9 * share).toFixed(3) }));
          text(g, x0 + j * cell + cell / 2 - 1, y0 + i * cell + cell / 2 + 9, pctMode ? `${Math.round(100 * share)}` : String(v),
            share > 0.45 ? "cm-t on" : "cm-t", "middle");
        });
      });
    }
    const xl = 260, xr = 1140, y0 = 360;
    matrix(g0, xl, y0, br.confusion, false, `Brussels: ${br.n_days} ordinary days`, "rows: the real day · columns: its guess");
    // the two blocks
    const sum = (rows, cols) => rows.reduce((a, i) => a + cols.reduce((c, j) => c + br.confusion[i][j], 0), 0);
    const wd = [0, 1, 2, 3, 4], we = [5, 6];
    const weRight = br.confusion[5][5] + br.confusion[6][6], weN = sum(we, [0, 1, 2, 3, 4, 5, 6]);
    const wdAsWe = sum(wd, we), wdN = sum(wd, [0, 1, 2, 3, 4, 5, 6]);
    g1.append(s("rect", { x: xl - 4, y: y0 - 4, width: 5 * cell + 5, height: 5 * cell + 5, class: "blk-o city-s" }));
    g1.append(s("rect", { x: xl + 5 * cell - 4, y: y0 + 5 * cell - 4, width: 2 * cell + 5, height: 2 * cell + 5, class: "blk-o sea-s" }));
    text(g1, xl, y0 + 7 * cell + 54, "Weekdays blur into each other,", "lab t-city");
    text(g1, xl, y0 + 7 * cell + 96, `but the weekend is right ${weRight} of ${weN} times;`, "lab t-sea");
    text(g1, xl, y0 + 7 * cell + 138, `a weekday is called a weekend ${wdAsWe} in ${wdN}.`, "lab");
    matrix(g2, xr, y0, po.confusion, true, `All ${po.n_stations} seismometers: ${fmt(po.n_days)} days`, "the same, in % of each real day");
    text(g2, xr, y0 + 7 * cell + 54, "The same two blocks, everywhere.", "lab");
    return fig;
  },

  // everything we built: data -> code -> the website's pages
  sitemap(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-site");
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    const sc = DATA.story.scale;
    box(g0, 120, 330, 320, 170, "2019–20", ["Lecocq et al. 2020"], "data");
    box(g0, 120, 540, 320, 170, "Every night", ["EarthScope,", `${sc.start.slice(0, 4)} – today`], "data");
    box(g0, 500, 330, 360, 170, "Python", ["groundtruth/, src/:", "every result, docs/04"], "model");
    box(g0, 500, 540, 360, 170, "GitHub Action", ["each morning: score", "yesterday, save it"], "model");
    arrow(g0, "ah-site", [[446, 415], [492, 415]]);
    arrow(g0, "ah-site", [[446, 625], [492, 625]]);
    const pages = [["Tour", "the story in two minutes"], ["Globe", "any day, 2019 to today"],
      ["Ask", "its guess for any day"], ["Research map", "every seismometer scored"],
      ["City Pulse", "yesterday, every night"], ["Game", "can you beat the model?"],
      ["About", "how it works, its limits"], ["Demo video", "two minutes, to share"]];
    const px = (i) => 960 + (i % 2) * 430, py = (i) => 260 + Math.floor(i / 2) * 150;
    pages.forEach(([t, l], i) => box(i < 4 ? g1 : g2, px(i), py(i), 410, 130, t, [l], "use"));
    arrow(g1, "ah-site", [[866, 520], [952, 520]]);
    text(g2, 120, 900, "One static website, no server: every page reads the same saved files.", "lab");
    return fig;
  },

  // the whole method on one page: the six steps of docs/03-methodology.md, in order
  pipeline(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-pipe");
    const f = DATA.forest, fo = DATA.folds;
    const w = 500, gap = 90, X = (i) => 120 + i * (w + gap), h = 210, y1 = 300, y2 = 640;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    const data = [["One row per day", ["4–14 Hz, glitches dropped,", "local time, hourly medians"]],
      [`${f.n_features} features`, ["24 for the shape of the day,", "1 for its level"]],
      ["Calendar labels", ["weekends, holidays, lockdown;", "only ordinary days train"]]];
    data.forEach(([t, l], i) => {
      box(g0, X(i), y1, w, h, t, l, "data", `Step ${i + 1}`);
      if (i) arrow(g0, "ah-pipe", [[X(i) - gap + 8, y1 + h / 2], [X(i) - 8, y1 + h / 2]]);
    });
    // the row turns: down from step 3, back to step 4
    const mid = (y1 + h + y2) / 2;
    const model = [["Random forest", [`${f.n_trees} trees vote on the day,`, "rare days weighted up"], g1],
      ["Honest testing", ["whole weeks held out,", `${fo.n_folds} rounds, balanced accuracy`], g1],
      ["Unusual days", ["its own surprise, above", "95% of ordinary days"], g2]];
    arrow(g1, "ah-pipe", [[X(2) + w / 2, y1 + h + 6], [X(2) + w / 2, mid], [X(0) + w / 2, mid], [X(0) + w / 2, y2 - 8]]);
    model.forEach(([t, l, g], i) => {
      box(g, X(i), y2, w, h, t, l, i < 2 ? "model" : "use", `Step ${i + 4}`);
      if (i) arrow(g, "ah-pipe", [[X(i) - gap + 8, y2 + h / 2], [X(i) - 8, y2 + h / 2]]);
    });
    text(g2, 120, 940, "The six steps of docs/03-methodology.md. The next slides open them one by one.", "ax");
    return fig;
  },

  // who listened to cities before us (verified papers, DOIs in the source line)
  research(b) {
    const { box: fig, svg } = figure(b);
    const lw = 300, cw = 430, gap = 26, x0 = 120 + lw + 20, h = 172, top = 250, rowH = 200;
    LIT.forEach((lane, r) => {
      const g = stepGroup(svg, r), y = top + r * rowH;
      text(g, 120, y + 60, lane.lane.split(" ").slice(0, 2).join(" "), "lab");
      text(g, 120, y + 100, lane.lane.split(" ").slice(2).join(" "), "lab");
      lane.papers.forEach(([yr, who, where, l1, l2], i) => {
        const x = x0 + i * (cw + gap);
        g.append(s("rect", { x, y, width: cw, height: h, rx: 12, class: "blk" }));
        text(g, x + 24, y + 46, `${who}, ${yr}`, "blk-t");
        text(g, x + 24, y + 86, where, "blk-s t-ink");
        text(g, x + 24, y + 124, l1, "blk-s");
        text(g, x + 24, y + 160, l2, "blk-s");
      });
    });
    return fig;
  },

  // where they stopped, and what this project adds
  gap(b) {
    const { box: fig, svg } = figure(b);
    const r = DATA.results, sc = DATA.story.scale;
    const years = Math.floor((Date.parse(sc.end) - Date.parse(sc.start)) / (365.25 * 864e5));
    const rows = [
      ["measured averages: an hour,", "a type of day, a lockdown", "guesses one day at a time, graded", "only on weeks it never saw", 0],
      ["one city, or one event", "", `${r.n_stations} seismometers, then ${sc.stations} cities over`, `${years} years, and a city it never heard`, 0],
      ["compared the noise with", "phone mobility data", "needs no phones: its own mistakes", "find holidays, with no labels", 1],
      ["removed people to see", "earthquakes", "keeps people as the signal, and tested", "it on earthquakes too: it didn't help", 1],
      ["needed dense arrays", "or new fibre", "uses seismometers already in place,", "and a test runs every night", 2],
    ];
    const xa = 120, xb = 1000, y0 = 290, rh = 132;
    text(svg, xa, y0 - 30, "The studies before ours", "ax");
    text(svg, xb, y0 - 30, "This project", "ax t-city");
    rows.forEach(([a1, a2, b1, b2, k], i) => {
      const g = stepGroup(svg, k), y = y0 + i * rh;
      g.append(s("line", { x1: xa, x2: 1800, y1: y + 104, y2: y + 104, class: "rule" }));
      text(g, xa, y + 40, a1, "lab t-grey"); if (a2) text(g, xa, y + 80, a2, "lab t-grey");
      text(g, xb, y + 40, b1, "lab"); text(g, xb, y + 80, b2, "lab");
    });
    return fig;
  },

  // where every recording comes from (site/data/sources.json, src/sources_export.py)
  sources(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-src");
    const src = DATA.sources, nets = Object.entries(src.networks);
    const withDoi = nets.filter(([, n]) => n.doi).length;
    const y0 = 250, h = 112, gapY = 22, xl = 120, wl = 760, xr = 960;
    src.datasets.forEach((d, i) => {
      const g = stepGroup(svg, i === 0 ? 0 : 1), y = y0 + i * (h + gapY);
      box(g, xl, y, wl, h, d.name, [d.what], "data");
      arrow(g, "ah-src", [[xl + wl + 8, y + h / 2], [xr - 24, y + h / 2]]);
      text(g, xr, y + h / 2 - 6, "used for", "ax");
      text(g, xr, y + h / 2 + 36, d.used_for, "lab");
    });
    // behind the recordings: every network, each with its own DOI
    const g2 = stepGroup(svg, 2), yN = y0 + 4 * (h + gapY) + 40;
    text(g2, 120, yN, `Behind them: ${nets.length} seismic networks, ${withDoi} with a DOI (dashed: none). Click any station on the website to see its own.`, "lab");
    const cw = 54, per = 31;
    nets.forEach(([code, n], i) => {
      const x = 120 + (i % per) * cw, y = yN + 22 + Math.floor(i / per) * 46;
      g2.append(s("rect", { x, y, width: cw - 6, height: 38, rx: 6, class: n.doi ? "chip" : "chip nodoi" }));
      text(g2, x + (cw - 6) / 2, y + 27, code, "chip-t", "middle");
    });
    return fig;
  },

  // how a mistake becomes an alarm, on the real Christmas Day in Brussels
  alarm(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-alarm");
    const m = DATA.mistakes, x = m.christmas.brussels;
    // the threshold: 95% of Brussels' ordinary days were less surprising than this
    const normal = m.calendar.filter((d) => d.period === "baseline").map((d) => d.confusion).sort((a, c) => a - c);
    const q95 = normal[Math.min(normal.length - 1, Math.floor(0.95 * normal.length))];
    const realDay = DOW[x.dow], guess = DOW[x.pred];
    const w = 304, gap = 40, X = (i) => 120 + i * (w + gap), y = 330, h = 220;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    box(g0, X(0), y, w, h, "A new day", [`${realDay},`, "25 December 2019,", `${m.city}: never seen`], "data");
    box(g0, X(1), y, w, h, "The forest", [`guesses ${guess}`, `gives ${realDay}`, `a ${pct(1 - x.confusion)} chance`], "model");
    arrow(g0, "ah-alarm", [[X(1) - gap + 6, y + h / 2], [X(1) - 8, y + h / 2]]);
    box(g1, X(2), y, w, h, "Surprise", ["1 − its chance", "for the real day", `= ${x.confusion.toFixed(2)}`], "model");
    arrow(g1, "ah-alarm", [[X(2) - gap + 6, y + h / 2], [X(2) - 8, y + h / 2]]);
    box(g2, X(3), y, w, h, "Unusual?", ["95% of ordinary", "days score below", `${q95.toFixed(2)}: this is above`], "model");
    box(g2, X(4), y, w, h, "Flag it", ["no labels,", "no holiday list"], "use");
    arrow(g2, "ah-alarm", [[X(3) - gap + 6, y + h / 2], [X(3) - 8, y + h / 2]]);
    arrow(g2, "ah-alarm", [[X(4) - gap + 6, y + h / 2], [X(4) - 8, y + h / 2]]);
    // the scale of it: the real tally across every seismometer
    text(g2, 120, 760, `${pct(m.holidays_called_weekend)}`, "mid t-city");
    text(g2, 120, 815, `of ${fmt(m.n_holidays)} weekday holidays it never saw`, "lab");
    text(g2, 120, 857, "were read as a weekend", "lab");
    text(g2, 1000, 760, `${m.confusion_wins} of ${m.n_stations}`, "mid");
    text(g2, 1000, 815, "seismometers: this alarm beat the", "lab");
    text(g2, 1000, 857, "standard unusual-day alarm", "lab");
    return fig;
  },

  // what runs every night, and what was built once
  nightly(b) {
    const { box: fig, svg } = figure(b);
    arrowHead(svg, "ah-night");
    const sc = DATA.story.scale;
    const w = 420, X = (i) => 120 + i * 540, y1 = 300, h = 190;
    const g0 = stepGroup(svg, 0), g1 = stepGroup(svg, 1), g2 = stepGroup(svg, 2);
    box(g0, X(0), y1, w, h, "Seismometers", ["the live cities", "record all day"], "data");
    box(g0, X(1), y1, w, h, "EarthScope", ["publishes the spectra", "about two days later"], "data");
    box(g0, X(2), y1, w, h, "GitHub Action", ["wakes every morning", "at 06:00 UTC"], "model");
    arrow(g0, "ah-night", [[X(1) - 114, y1 + h / 2], [X(1) - 8, y1 + h / 2]]);
    arrow(g0, "ah-night", [[X(2) - 114, y1 + h / 2], [X(2) - 8, y1 + h / 2]]);
    // two models score each new day
    const y2 = 580, mw = 420;
    box(g1, X(2), y2, mw, 150, "Frozen model", ["one year, never changes"], "model");
    box(g1, X(2), y2 + 180, mw, 150, "Learning model", ["guesses a day, then learns it"], "model");
    arrow(g1, "ah-night", [[X(2) + w / 2, y1 + h + 6], [X(2) + w / 2, y2 - 8]]);
    // published
    box(g2, X(1), y2 + 70, w, 190, "Saved in git", ["site/data, one commit", "a day"], "use");
    box(g2, X(0), y2 + 70, w, 190, "The website", ["Vercel publishes it:", "globe, Ask, City Pulse"], "use");
    arrow(g2, "ah-night", [[X(2) - 6, y2 + 75], [X(1) + w + 60, y2 + 75], [X(1) + w + 60, y2 + 165], [X(1) + w + 8, y2 + 165]]);
    arrow(g2, "ah-night", [[X(2) - 6, y2 + 255], [X(1) + w + 60, y2 + 255], [X(1) + w + 60, y2 + 165]]);
    arrow(g2, "ah-night", [[X(1) - 6, y2 + 165], [X(0) + w + 8, y2 + 165]]);
    text(g2, X(0), 960, `Built once on a laptop and saved the same way: Ask's models, ${sc.stations} cities, ${sc.start.slice(0, 4)}–${sc.end.slice(0, 4)}.`, "ax");
    return fig;
  },

  question() {
    const box = el("div", { class: "fig" });
    box.append(el("p", { class: "q" }, "Can a seismometer tell what day of the week it is?"));
    box.append(el("ul", { class: "promises" },
      ...PROMISES.map((t) => el("li", {}, t))));
    return box;
  },

  spectrum(b) {
    const d = DATA.spectrum, f = d.freqs, day = d.weekday[11], night = d.weekday[3];
    const band = (lo, hi) => { const k = f.map((v, i) => i).filter((i) => f[i] >= lo && f[i] <= hi);
      return k.reduce((a, i) => a + day[i] - night[i], 0) / k.length; };
    const people = Math.pow(10, band(4, 14) / 10), sea = Math.pow(10, band(0.1, 1) / 10);
    const { box, svg } = figure(b, "Shaking power by speed, under Brussels, on an ordinary weekday.");
    const x0 = 150, x1 = 1500, y0 = 850, y1 = 360, lf = (v) => Math.log10(v);
    const fx = (v) => x0 + (lf(v) - lf(f[0])) / (lf(20) - lf(f[0])) * (x1 - x0);
    const all = [...day, ...night].filter((v, i) => f[i % f.length] <= 20);
    const lo = Math.min(...all) - 3, hi = Math.max(...all) + 3;
    const fy = (v) => y0 - (v - lo) / (hi - lo) * (y0 - y1);
    svg.append(s("rect", { x: fx(0.1), y: y1 - 10, width: fx(1) - fx(0.1), height: y0 - y1 + 10, fill: "#2e5c95", opacity: .16 }));
    svg.append(s("rect", { x: fx(4), y: y1 - 10, width: fx(14) - fx(4), height: y0 - y1 + 10, fill: "#a7480c", opacity: .14 }));
    const keep = f.map((v, i) => i).filter((i) => f[i] <= 20);
    svg.append(s("path", { d: line(keep.map((i) => [fx(f[i]), fy(night[i])])), class: "grey-s", "stroke-width": 5 }));
    svg.append(s("path", { d: line(keep.map((i) => [fx(f[i]), fy(day[i])])), class: "ink-s", "stroke-width": 5 }));
    const last = keep[keep.length - 1];
    text(svg, x1 + 20, fy(day[last]) + 10, "11 in the morning");
    text(svg, x1 + 20, fy(night[last]) + 10, "3 at night", "lab t-grey");
    svg.append(s("line", { x1: x0, x2: x1, y1: y0, y2: y0, class: "rule" }));
    [0.1, 1, 10].forEach((v) => text(svg, fx(v), y0 + 44, `${v} Hz`, "ax", "middle"));
    text(svg, x0, y0 + 90, "slower, one wobble every few seconds", "ax");
    text(svg, x1, y0 + 90, "faster, many wobbles a second", "ax", "end");
    text(svg, fx(0.32), y1 - 30, `the sea: day ÷ night ${sea.toFixed(1)}×`, "lab t-sea", "middle");
    text(svg, fx(7.5), y1 - 30, `people: day ÷ night ${Math.round(people)}×`, "num t-city", "middle");
    return box;
  },

  bands(b) {
    const d = DATA.bands;
    const { box, svg } = figure(b, `Weekday or weekend, read from one band at a time. Median of ${d.n_stations} cities.`);
    const x0 = 520, x1 = 1640, top = 360, gap = 104, fx = (v) => x0 + v * (x1 - x0);
    d.bands.forEach((r, i) => {
      const y = top + i * gap, people = r.band === "4-14 Hz", sea = r.band.startsWith("0.1");
      const name = sea ? `${r.band}: the sea` : people ? `${r.band}: the people band` : r.band;
      text(svg, x0 - 30, y + 46, name, `lab ${sea ? "t-sea" : people ? "t-city" : "t-grey"}`, "end");
      svg.append(s("rect", { x: x0, y, width: x1 - x0, height: 64, class: "pale" }));
      svg.append(s("rect", { x: x0, y, width: fx(r.weekend_median) - x0, height: 64, class: sea ? "sea" : people ? "city" : "grey" }));
      text(svg, fx(r.weekend_median) + 18, y + 50, pct(r.weekend_median), "num");
    });
    const yb = top + d.bands.length * gap;
    svg.append(s("line", { x1: fx(.5), x2: fx(.5), y1: top - 30, y2: yb, class: "chance" }));
    text(svg, fx(.5), yb + 40, "a coin toss", "ax", "middle");
    return box;
  },

  weeks(b) {
    const d = DATA.folds;
    const { box, svg } = figure(b, "Each shade is one round's hidden weeks.");
    const weeks = [...new Set(d.days.map((x) => x.week))];
    const cell = 64, x0 = 220, y0 = 330;
    const tint = ["#161b21", "#59616f", "#8a7a4a", "#b9b2a3", "#d4c7a1"];   // neutral: orange and blue mean people and sea
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((n, k) => text(svg, x0 - 24, y0 + k * cell + 42, n, "ax", "end"));
    d.days.forEach((x) => {
      const c = weeks.indexOf(x.week);
      svg.append(s("rect", { x: x0 + c * cell, y: y0 + x.dow * cell, width: cell - 6, height: cell - 6, fill: tint[x.fold] }));
    });
    text(svg, x0, y0 + 7 * cell + 56, `${d.city}: ${d.n_days} ordinary days in ${d.n_weeks} weeks, ${d.n_folds} rounds`, "ax");
    text(svg, x0, y0 + 7 * cell + 116, "Scored with balanced accuracy: weekdays and weekends count equally,", "lab");
    text(svg, x0, y0 + 7 * cell + 162, "so always saying “weekday” scores a coin toss.", "lab");
    return box;
  },

  results(b) {
    const r = DATA.results;
    const { box, svg } = figure(b);
    text(svg, 120, 470, pct(r.weekend_median), "big");
    text(svg, 120, 530, "weekday or weekend, in a typical city", "lab");
    text(svg, 1000, 470, pct(r.dow_median), "big");
    text(svg, 1000, 530, "the exact day, where guessing gets 14%", "lab");
    // every seismometer as a dot on a 0-100% ruler of weekday-or-weekend scores (the 95%)
    const x0 = 120, x1 = 840, y = 720, fx = (v) => x0 + v * (x1 - x0);
    svg.append(s("line", { x1: x0, x2: x1, y1: y, y2: y, class: "rule" }));
    [0, .5, 1].forEach((v) => text(svg, fx(v), y + 46, pct(v), "ax", "middle"));
    const ctl = new Set(r.controls.map((c) => c.station));
    r.stations.forEach((st, i) => { if (!ctl.has(st.station))
      svg.append(s("circle", { cx: fx(st.weekend), cy: y - 16 - (i % 5) * 12, r: 7, class: "ink", opacity: .35 })); });
    r.controls.forEach((c) => svg.append(s("circle", { cx: fx(c.weekend), cy: y - 16, r: 9, fill: "none", stroke: "#59616f", "stroke-width": 3 })));
    const cx = fx(Math.min(...r.controls.map((c) => c.weekend)));
    svg.append(s("line", { x1: cx, x2: cx, y1: y - 30, y2: y - 92, stroke: "#59616f", "stroke-width": 2 }));
    text(svg, cx - 10, y - 104, "almost nobody lives there", "ax");
    text(svg, x0, y + 96, `Each dot: one of ${r.n_stations} seismometers.`, "ax");
    const sv = r.shape_vs_level;
    // under the 47%: what the shape adds to the exact day
    const bx = 1000, bw = 560, by = 640;
    [["loudness alone", sv.level_dow_median, "grey"], ["with the shape", sv.both_dow_median, "ink"]].forEach(([k, v, cls], j) => {
      text(svg, bx, by + j * 96, k, "ax");
      svg.append(s("rect", { x: bx, y: by + 14 + j * 96, width: bw * v / sv.both_dow_median, height: 40, class: cls }));
      text(svg, bx + bw * v / sv.both_dow_median + 16, by + 46 + j * 96, pct(v), "lab");
    });
    return box;
  },

  weekend(b) {
    const r = DATA.results, a = DATA.applied, u = a.uae;
    const { box, svg } = figure(b);
    text(svg, 120, 420, pct(r.unseen_city_pooled_weekend), "mid");
    text(svg, 120, 470, "on a city it never heard", "lab");
    // Salfit: share of each day called weekend by a model that only knew Sat-Sun countries
    const sal = a.weekend_shift.filter((x) => x.city === "Salfit");
    const x0 = 700, bw = 150, base = 640, hmax = 240;
    text(svg, x0, 330, "Salfit, Palestine: called “weekend”", "lab");
    sal.forEach((x, i) => {
      const hgt = x.called_weekend * hmax, fri = x.day === "Fri";
      svg.append(s("rect", { x: x0 + i * (bw + 24), y: base - hgt, width: bw, height: hgt, class: fri ? "city" : "grey" }));
      text(svg, x0 + i * (bw + 24) + bw / 2, base - hgt - 14, pct(x.called_weekend), "lab small", "middle");
      text(svg, x0 + i * (bw + 24) + bw / 2, base + 40, x.day, "ax", "middle");
    });
    text(svg, x0, base + 90, "Jeddah, the third Friday city, didn't transfer.", "ax");
    text(svg, 1460, 420, `${Math.round(u.sunday_change * 100)}%`.replace("-", "−"), "mid t-city");
    text(svg, 1460, 470, "UAE Sundays after the", "lab");
    text(svg, 1460, 512, "2022 weekend change", "lab");
    text(svg, 1460, 570, "predicted before the data", "lab small");
    text(svg, 1460, 612, `luck: ${Math.round(u.p * 1000)} in 1,000`, "lab small");
    return box;
  },

  dare(b) {
    const nf = DATA.applied.noise_floor, q = DATA.story.quake_waveform;
    const { box, svg } = figure(b, "Detecting earthquakes that already happened. Never predicting them.");
    const col = (x, head, sub, rows, verdict, ok) => {
      text(svg, x, 380, head, "num");
      text(svg, x, 428, sub, "ax");
      const max = Math.max(...rows.map((r) => r[1]));
      rows.forEach(([name, v, cls], i) => {
        const y = 480 + i * 92;
        text(svg, x, y + 30, name, "lab small");
        svg.append(s("rect", { x, y: y + 44, width: 620 * v / max, height: 34, class: cls }));
        text(svg, x + 620 * v / max + 14, y + 72, `${fmt(v)} found`, "lab");
      });
      text(svg, x, 480 + rows.length * 92 + 70, verdict, `num it ${ok ? "t-good" : "t-grey"}`);
    };
    col(120, "Fifteen-minute averages", `${fmt(nf.pairs)} earthquake-station pairs, 2019–20`,
      [["with the people subtracted", nf.learned, "city"], ["raw recording", nf.raw, "grey"]],
      `Not supported (p = ${nf.p.toFixed(3)})`, false);
    if (q) {
      const ok = q.learned > q.raw && q.p < 0.05;
      col(1000, "Second by second", `${fmt(q.pairs)} pairs at ${q.stations} stations, 2021–26`,
        [["with the people subtracted", q.learned, "city"], ["rolling median", q.rolling, "sea"], ["raw recording", q.raw, "grey"]],
        `${ok ? "Supported" : "Not supported"} (p ${q.p < 0.001 ? "< 0.001" : `= ${q.p.toFixed(3)}`})`, ok);
    } else {
      text(svg, 1000, 380, "Second by second", "num");
      text(svg, 1000, 470, "Written down in advance (docs/20).", "lab");
      text(svg, 1000, 520, "Result not in yet.", "lab t-grey");
    }
    return box;
  },

  limits(b) {
    const { box } = figure(b);
    box.append(el("ul", { class: "promises", style: "flex-direction:column;gap:40px;top:300px;bottom:auto" },
      ...["Lockdown didn't look like Sundays. It looked like no day the model had heard.",
        "Our shape-and-level split is about as good as raw hourly numbers, not better.",
        "One season, and national holidays only."].map((t) => el("li", { style: "max-width:1600px;font-size:48px;line-height:1.25;color:var(--ink);padding-top:26px" }, t))));
    return box;
  },

  method(b) {
    const sc = DATA.story.scale;
    const { box, svg } = figure(b);
    text(svg, 120, 470, String(sc.stations), "big");
    text(svg, 120, 530, "cities", "lab");
    const years = Math.floor((Date.parse(sc.end) - Date.parse(sc.start)) / (365.25 * 864e5));
    text(svg, 560, 470, String(years), "big");
    text(svg, 560, 530, `years, ${sc.start.slice(0, 4)} to ${sc.end.slice(0, 4)}`, "lab");
    text(svg, 1000, 470, fmt(sc.ordinary_days), "big");
    text(svg, 1000, 530, "ordinary days", "lab");
    const rows = [["Before", "149 seismometers, one season, 25 numbers a day, random forest"],
      ["Now", "three frequency bands, every half hour, gradient boosting"],
      ["Same rule", "graded only on whole weeks the model never saw"]];
    rows.forEach(([k, v], i) => { text(svg, 120, 700 + i * 70, k, "lab t-city"); text(svg, 400, 700 + i * 70, v, "lab"); });
    return box;
  },

  curve(b) {
    const st = DATA.story, lc = st.learning_curve;
    const { box, svg } = figure(b, `Weekday or weekend: ${pct(st.ask.weekend_bal_median)}. The exact day is the hard part.`);
    const x0 = 220, x1 = 1100, y0 = 820, y1 = 300, fy = (v) => y0 - v * (y0 - y1);
    const fx = (i) => x0 + i * (x1 - x0) / (lc.length - 1);
    svg.append(s("line", { x1: x0, x2: 1700, y1: fy(1 / 7), y2: fy(1 / 7), class: "chance" }));
    text(svg, x0, fy(1 / 7) - 14, "guessing", "ax");
    svg.append(s("path", { d: line(lc.map((p, i) => [fx(i), fy(p.exact_median)])), class: "ink-s", "stroke-width": 6 }));
    lc.forEach((p, i) => {
      svg.append(s("circle", { cx: fx(i), cy: fy(p.exact_median), r: 12, class: "ink" }));
      text(svg, fx(i), fy(p.exact_median) - 30, pct(p.exact_median), "lab", "middle");
      text(svg, fx(i), y0 + 46, p.days === "all" ? "all" : fmt(+p.days), "ax", "middle");
    });
    text(svg, (x0 + x1) / 2, y0 + 96, "ordinary days each city's model learned from", "ax", "middle");
    const xb = 1620, wk = st.ask.week_dow_median;
    svg.append(s("rect", { x: xb, y: fy(wk), width: 180, height: y0 - fy(wk), class: "city" }));
    text(svg, xb + 90, fy(wk) - 22, pct(wk), "num t-city", "middle");
    text(svg, xb + 90, fy(wk) - 80, "a different question:", "ax", "middle");
    text(svg, xb + 90, y0 + 46, "the week", "ax", "middle");
    text(svg, xb + 90, y0 + 82, "around the day", "ax", "middle");
    // Result 18: one model for all cities together, on the same days (a hollow dot by "all")
    const pool = st.pooled_model.P1, xa = fx(lc.length - 1);
    svg.append(s("circle", { cx: xa, cy: fy(pool), r: 12, fill: "none", stroke: "#59616f", "stroke-width": 4 }));
    text(svg, xa + 26, fy(pool) + 10, `${pct(pool)}: all ${st.scale.stations} cities in one model`, "lab small");
    return box;
  },

  memo(b) {
    const m = DATA.story.memorisation;
    const { box, svg } = figure(b);
    if (!m) { text(svg, 120, 420, "Not computed yet (src/memorisation.py).", "lab t-grey"); return box; }
    text(svg, 120, 480, pct(m.seen_median), "big");
    text(svg, 120, 540, "on days it trained on", "lab");
    text(svg, 1000, 480, pct(m.unseen_median), "big t-city");
    text(svg, 1000, 540, "on weeks it never saw", "lab");
    text(svg, 120, 700, `Same models, same seven years, median of ${m.stations} cities. The gap is memorisation,`, "lab");
    text(svg, 120, 750, "which is why every number in this talk is on unseen weeks.", "lab");
    return box;
  },

  scorecard(b) {
    const r = DATA.results, m = DATA.mistakes, sc = DATA.story.scale;
    const { box, svg } = figure(b);
    const rows = [[PROMISES[0], pct(r.weekend_median)],
      [PROMISES[1], `+${Math.round(r.shape_vs_level.median_gain_dow * 100)} points`],
      [PROMISES[2], `${m.confusion_wins} of ${m.n_stations} seismometers`],
      [PROMISES[3], `${pct(m.holidays_called_weekend)} called weekend`],
      [PROMISES[4], pct(r.unseen_city_pooled_weekend)],
      ["And further", `${sc.stations} cities over seven years, and a live test`]];
    rows.forEach(([k, v], i) => {
      const y = 330 + i * 106;
      svg.append(s("line", { x1: 120, x2: 1800, y1: y + 34, y2: y + 34, class: "rule" }));
      text(svg, 120, y, k, "lab");
      text(svg, 1800, y, v, `num ${i === 5 ? "t-city" : ""}`, "end");
    });
    return box;
  },
};

// ------------------------------------------------------------------ building the slides
function build(b, i) {
  const slide = el("section", { class: "slide", "aria-label": b.title, "data-i": String(i) });
  if (b.kind === "static") slide.append(CHARTS[b.static.chart](b));
  if (b.kind === "video") {
    const v = el("video", { class: "main", muted: "", playsinline: "", preload: "none", "data-src": `media/${b.video.clip}.mp4`,
      poster: `media/${b.video.clip}.jpg` });
    v.muted = true; v.loop = !!b.video.loop;
    slide.append(v);
    // one looping "hold" per stop: the camera still, the city still moving
    cuesOf(b).forEach((q, k) => {
      if (!q.hold) return;
      const h = el("video", { class: "hold", "data-k": String(k), muted: "", playsinline: "", loop: "", preload: "none", "data-src": `media/${q.hold}` });
      h.muted = true; h.loop = true;
      slide.append(h);
    });
    if (b.video.then) {
      const over = el("div", { class: "over" }, CHARTS[b.video.then](b));
      if (b.source) over.append(el("p", { class: "src" }, b.source));
      slide.append(over);
      v.addEventListener("ended", () => over.classList.add("on"));
    }
  }
  if (b.kind === "live") {          // the stage holds only the fallback; the page is in #live
    const fb = b.live.fallback;
    const holder = el("div", { class: "fallback", hidden: "" });
    if (fb.clip) {
      const v = el("video", { muted: "", playsinline: "", preload: "none", "data-src": `media/${fb.clip}.mp4`, poster: `media/${fb.clip}.jpg` });
      v.muted = true; holder.append(v);
    } else {
      holder.append(el("div", { class: "shot" }, el("img", { src: `media/${fb.still}.png`, alt: b.title }),
        el("p", {}, "Screenshot of the live page; the network or the page didn't load in time.")));
    }
    slide.append(holder);
  }
  if (b.source && b.kind === "static") slide.append(el("p", { class: "src" }, b.source));
  return slide;
}

// ------------------------------------------------------------------ live pages
const frames = new Map();            // beat index -> {iframe, ready, timer}
function liveSrc(b, k) { return k > 0 && b.live.steps ? b.live.steps[k - 1].src : b.live.src; }
function liveReady(b, k) { return k > 0 && b.live.steps ? b.live.steps[k - 1].ready : b.live.ready; }

function ensureFrame(i) {
  if (frames.has(i)) return frames.get(i);
  const b = BEATS[i];
  const f = el("iframe", { src: liveSrc(b, 0), title: b.title, loading: "eager" });
  const rec = { iframe: f, ready: false, step: 0 };
  frames.set(i, rec);
  f.addEventListener("load", () => { hookFrame(f); watchReady(i); });
  $("live").append(f);
  return rec;
}
function watchReady(i) {
  const rec = frames.get(i), b = BEATS[i];
  if (!rec) return;
  rec.ready = false;
  const sel = liveReady(b, rec.step);
  const t0 = Date.now();
  const poll = () => {
    if (!frames.has(i)) return;
    let doc = null;
    try { doc = rec.iframe.contentDocument; } catch (e) { /* not same-origin: cannot check */ }
    if (doc && doc.querySelector(sel)) { rec.ready = true; if (cur === i) showLive(i); return; }
    if (Date.now() - t0 < 60000) setTimeout(poll, 200);
  };
  poll();
}
function dropFrame(i) { const rec = frames.get(i); if (rec) { rec.iframe.remove(); frames.delete(i); } }

// keys and swipes inside a live page belong to the deck first (same origin, so we can listen)
function hookFrame(f) {
  try {
    const w = f.contentWindow, d = f.contentDocument;
    w.addEventListener("keydown", onKey, true);
    for (const t of ["touchstart", "touchmove", "touchend", "touchcancel"]) d.addEventListener(t, onTouch, { capture: true, passive: false });
  } catch (e) { /* a page from elsewhere: keys stay with it */ }
}

function showLive(i) {
  const b = BEATS[i], rec = frames.get(i), slide = slides[i];
  const fb = slide.querySelector(".fallback");
  if (rec && rec.ready && !slide.dataset.forced) {
    fb.hidden = true; fb.querySelectorAll("video").forEach((v) => v.pause());
    rec.iframe.classList.add("on");
    document.body.classList.add("dark");
    // bring the part we talk about into view (each step can name its own section)
    const sc = rec.step > 0 && b.live.steps ? b.live.steps[rec.step - 1].scroll : b.live.scroll;
    if (sc && !rec.scrolled) {
      try { rec.iframe.contentDocument.querySelector(sc).scrollIntoView({ block: rec.step > 0 ? "start" : "center" }); } catch (e) { /* ignore */ }
      rec.scrolled = true;
    }
  }
}
function showFallback(i) {
  const slide = slides[i], fb = slide.querySelector(".fallback"), rec = frames.get(i);
  if (rec) rec.iframe.classList.remove("on");
  document.body.classList.remove("dark");
  fb.hidden = false;
  fb.querySelectorAll("video").forEach(playFromStart);
}

// ------------------------------------------------------------------ media
function playFromStart(v) {
  if (!v.src) { v.src = v.dataset.src; }
  try { v.currentTime = 0; } catch (e) { /* not loaded yet */ }
  const p = v.play(); if (p) p.catch(() => {});
}
function preloadVideo(i) {
  const slide = slides[i]; if (!slide) return;
  slide.querySelectorAll("video").forEach((v) => { if (!v.src) { v.preload = "auto"; v.src = v.dataset.src; } });
}
function unloadVideo(i) {
  const slide = slides[i]; if (!slide) return;
  slide.querySelectorAll("video").forEach((v) => { if (v.src) { v.pause(); v.removeAttribute("src"); v.load(); } });
}

// a still that builds: every group with data-step <= k is shown
function showSteps(slide, k) {
  slide.querySelectorAll("[data-step]").forEach((g) => g.classList.toggle("shown", +g.dataset.step <= k));
}

// ------------------------------------------------------------------ clips with stops
// A clip with stops is played in segments: segment k runs from stop k-1 (or the start) to
// stop k, then holds there until the presenter presses Next. `step` is the segment.
let vs = { i: -1, k: 0, held: false };
function cuesOf(b) { return (b && b.kind === "video" && CUES[b.video.clip]) || []; }
const mainOf = (i) => slides[i].querySelector("video.main");
function seek(v, t) { try { v.currentTime = t; } catch (e) { /* not loaded yet */ } }
function holdsOff(i) {
  slides[i].querySelectorAll("video.hold.on").forEach((h) => {
    h.classList.remove("on");                      // fades out (talk.css), then stops
    setTimeout(() => { if (!h.classList.contains("on")) h.pause(); }, 600);
  });
}
function playSegment(i, k) {
  const cues = cuesOf(BEATS[i]), v = mainOf(i);
  vs = { i, k, held: false };
  if (!v.src) v.src = v.dataset.src;
  if (k === 0) seek(v, 0); else if (Math.abs(v.currentTime - cues[k - 1].at) > 0.1) seek(v, cues[k - 1].at);
  const p = v.play(); if (p) p.catch(() => {});
  holdsOff(i);
  if (k >= cues.length) return;                    // the last segment runs to the end
  const stopAt = cues[k].at;
  const tick = () => {
    if (vs.i !== i || vs.k !== k || vs.held || cur !== i) return;
    if (v.currentTime >= stopAt - 0.02) return holdAt(i, k);
    wait();
  };
  // once per decoded frame where the browser can (exact), else once per screen refresh
  const wait = () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick));
  wait();
}
function holdAt(i, k) {
  const q = cuesOf(BEATS[i])[k], v = mainOf(i);
  vs = { i, k, held: true };
  sendState();
  v.pause();
  seek(v, q.at);                                   // the frame the hold loop starts on
  const h = slides[i].querySelector(`video.hold[data-k="${k}"]`);
  if (!h) return;                                  // nothing moves here: a plain pause
  if (!h.src) h.src = h.dataset.src;
  seek(h, 0);
  h.addEventListener("playing", () => { if (vs.i === i && vs.k === k && vs.held) h.classList.add("on"); }, { once: true });
  const p = h.play(); if (p) p.catch(() => {});
}
function toEnd(i) {                                // Next while the last segment still plays
  const v = mainOf(i);
  if (v.duration) { v.pause(); seek(v, v.duration - 0.04); }
  slides[i].querySelectorAll(".over").forEach((o) => o.classList.add("on"));
  vs.held = true;
}
function announce() {                              // the address bar, notes and presenter
  if (history.replaceState) history.replaceState(null, "", `#/${cur + 1}${step ? `.${step}` : ""}`);
  drawProgress();
  renderNotes();
  sendState();
}
// Where the deck is, for the presenter windows (remote.js). `waiting` = nothing is playing:
// the deck is waiting for a press, so the speaker can talk. `elapsed` rather than the start
// time, because the laptops' clocks need not agree.
const pos = () => `${cur}.${step}`;
function sendState() {
  if (isPresenter || !BEATS.length) return;
  const b = BEATS[cur], cues = cuesOf(b);
  const waiting = !started ? true : !cues.length || (vs.i === cur && vs.held);
  // before the start nothing is on screen (cur is -1): the presenters show slide 1's script
  Link.send({ type: "state", i: Math.max(0, cur), k: step, started, waiting, elapsed: t0 ? Date.now() - t0 : 0 });
}
// A press from a presenter window counts only if it was meant for the slide the deck is on:
// if two speakers press at the same moment, the deck moves once, not twice.
function onLink(m) {
  if (m.type === "hello") return sendState();
  if (m.type !== "cmd" || !started) return sendState();
  if (m.at !== pos()) return sendState();
  if (m.cmd === "next") next(); else if (m.cmd === "back") back();
  sendState();                         // even if nothing moved (a clip caught up to its stop)
}

// ------------------------------------------------------------------ navigation
let slides = [], liveTimer = null;
function go(i, k = 0) {
  i = Math.max(0, Math.min(BEATS.length - 1, i));
  if (i === cur && k === step) return;
  const prev = cur;
  if (prev >= 0 && prev !== i) {
    slides[prev].classList.remove("on");
    slides[prev].querySelectorAll("video").forEach((v) => v.pause());
    slides[prev].querySelectorAll("video.hold").forEach((h) => h.classList.remove("on"));
    slides[prev].querySelectorAll(".over").forEach((o) => o.classList.remove("on"));
    const rec = frames.get(prev); if (rec) rec.iframe.classList.remove("on");
  }
  cur = i; step = k;
  const b = BEATS[i], slide = slides[i];
  slide.classList.add("on");
  document.body.classList.remove("dark");
  clearTimeout(liveTimer);
  if (b.kind === "static") showSteps(slide, k);
  if (b.kind === "video") {
    if (cuesOf(b).length) playSegment(i, Math.min(k, cuesOf(b).length));
    else slide.querySelectorAll("video.main").forEach(playFromStart);
  }
  if (b.kind === "live") {
    const rec = ensureFrame(i);
    if (rec.step !== k) {                        // a scripted step: the page moves by itself
      // each step's URL has its own query string, so it is always a full page load
      rec.step = k; rec.ready = false; rec.scrolled = false;
      rec.iframe.classList.remove("on");
      rec.iframe.src = liveSrc(b, k);
    }
    slide.dataset.forced = "";
    delete slide.dataset.forced;
    if (rec.ready) showLive(i);
    else {
      slide.querySelector(".fallback").hidden = true;
      liveTimer = setTimeout(() => { if (cur === i && !(frames.get(i) || {}).ready) showFallback(i); }, LIVE_TIMEOUT);
    }
  }
  // look ahead: preload the next clips and any live page coming up
  for (let j = 0; j < BEATS.length; j++) {
    const bj = BEATS[j];
    if (j === i + 1 || j === i) preloadVideo(j); else if (Math.abs(j - i) > 2) unloadVideo(j);
    if (bj.kind === "live") {
      const ahead = bj.live.preload || 2;
      if (i >= j - ahead && i <= j + 1) ensureFrame(j); else if (j !== i) dropFrame(j);
    }
  }
  announce();
}
function next() {
  const b = BEATS[cur], cues = cuesOf(b);
  if (b && b.kind === "static" && b.static.steps && step < b.static.steps) return go(cur, step + 1);
  if (cues.length && vs.i === cur) {
    if (!vs.held && vs.k < cues.length) return holdAt(cur, vs.k);    // behind? catch up to the stop
    if (vs.held && vs.k < cues.length && !cues[vs.k].final) return go(cur, vs.k + 1);
    if (!vs.held && vs.k >= cues.length) { const v = mainOf(cur); if (!v.ended) return toEnd(cur); }
  }
  if (b && b.kind === "live" && b.live.steps && step < b.live.steps.length) return go(cur, step + 1);
  go(cur + 1);
}
function back() {
  const cues = cuesOf(BEATS[cur]);
  if (cues.length && vs.i === cur) {                // back to the previous stop
    const j = Math.min(vs.k, cues.length) - 1;
    if (j >= 0) {
      slides[cur].querySelectorAll(".over").forEach((o) => o.classList.remove("on"));
      holdsOff(cur); step = j; holdAt(cur, j); announce(); return;
    }
    return backToSlide(cur - 1);
  }
  if (step > 0) return go(cur, step - 1);
  return backToSlide(cur - 1);
}
// going back lands where that slide was left: a clip at its last stop, not replaying it
function backToSlide(p) {
  if (p < 0) return;
  const bp = BEATS[p];
  go(p, bp.kind === "static" && bp.static.steps ? bp.static.steps : 0);    // a diagram, fully built
  const n = cuesOf(BEATS[p]).length;
  if (n) { step = n - 1; holdAt(p, n - 1); announce(); }
}

// ------------------------------------------------------------------ input
function onKey(e) {
  if (!DECK_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!started && !isPresenter) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } return; }
  e.preventDefault(); e.stopImmediatePropagation();
  switch (e.key) {
    case "ArrowRight": case "PageDown": case " ": case "Enter": next(); break;
    case "ArrowLeft": case "PageUp": case "Backspace": back(); break;
    case "Home": go(0); break;
    case "End": go(BEATS.length - 1); break;
    case "f": case "F": toggleFullscreen(); break;
    case "n": case "N": $("notes").hidden = !$("notes").hidden; renderNotes(); break;
    case "p": case "P": window.open(`${location.pathname}?presenter${Link.room ? `&room=${Link.room}` : ""}`, "groundtruth-presenter", "width=1100,height=760"); break;
    case "l": case "L": if (BEATS[cur].kind === "live") { slides[cur].dataset.forced = "1"; showFallback(cur); } break;
    case "b": case "B": case ".": $("blackout").hidden = !$("blackout").hidden; break;
  }
}
// three or more fingers moving sideways change the slide; fewer are left to the page
let swipe = null;
function onTouch(e) {
  if (e.type === "touchstart" && e.touches.length >= 3) {
    swipe = { x: [...e.touches].reduce((a, t) => a + t.clientX, 0) / e.touches.length, dx: 0 };
  }
  if (!swipe) return;
  e.preventDefault(); e.stopPropagation();
  if (e.type === "touchmove" && e.touches.length) {
    swipe.dx = [...e.touches].reduce((a, t) => a + t.clientX, 0) / e.touches.length - swipe.x;
  }
  if (e.type === "touchend" || e.type === "touchcancel") {
    if (e.touches.length === 0) {
      if (swipe.dx < -SWIPE_PX) next(); else if (swipe.dx > SWIPE_PX) back();
      swipe = null;
    }
  }
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}

// ------------------------------------------------------------------ layout and chrome
function fit() {
  const bar = document.body.classList.contains("photo") ? 0
    : parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 88;
  const vw = innerWidth, vh = innerHeight - bar, k = Math.min(vw / W, vh / H);
  const st = $("stage");
  st.style.transform = `translate(${(vw - W * k) / 2}px, ${(vh - H * k) / 2}px) scale(${k})`;
}
// the progress strip is a real seismogram: Brussels, Wednesday 15 January 2020, drawn as far
// as the talk has got (city_day.json, the same recording as the clips)
let traceLen = 1;
function drawTrace() {
  const samples = DATA.city_day.days.wednesday.samples, box = $("trace");
  const n = samples.length, vals = samples.map((p) => Math.log10(p[1]));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pts = vals.map((v, i) => [i / (n - 1) * 1000, 52 - (v - lo) / (hi - lo) * 48]);
  const svg = s("svg", { viewBox: "0 0 1000 56", preserveAspectRatio: "none" });
  const d = line(pts);
  svg.append(s("path", { d, class: "all", "vector-effect": "non-scaling-stroke" }));
  // the inked part is the same line, clipped to the share of the talk that is done
  const clip = s("clipPath", { id: "trace-done" });
  clip.append(s("rect", { x: 0, y: 0, width: 0, height: 56, class: "upto" }));
  svg.append(clip);
  svg.append(s("path", { d, class: "done", "vector-effect": "non-scaling-stroke", "clip-path": "url(#trace-done)" }));
  box.replaceChildren(svg);
  traceLen = 1000;
}
function drawProgress() {
  const main = BEATS.filter((b) => !b.backup).length;
  const upto = document.querySelector("#trace .upto");
  const frac = Math.min(1, (cur + 1) / main);
  if (upto) upto.setAttribute("width", String(traceLen * frac));
  $("count").textContent = BEATS[cur].backup ? "backup" : `${cur + 1} of ${main}`;
}
// each speaker has a colour in the notes (talk.css .who-*), so everyone sees at a glance
// whose turn it is. "[Name] " inside a script hands over to that person mid-slide.
const SPEAKERS = ["Aadit", "Shraddha", "Aradhya"];
const whoClass = (name) => `who-${SPEAKERS.includes(name) ? name.toLowerCase() : "none"}`;
const firstSpeaker = (b) => b.speaker.split(",")[0].trim();
// one part of the script -> its runs, one per speaker: [{who, text}]
function runsOf(text, who) {
  const runs = [];
  text.split(/\[(Aadit|Shraddha|Aradhya)\]\s*/).forEach((piece, i) => {
    if (i % 2) { who = piece; return; }
    if (piece.trim()) runs.push({ who, text: piece.trim() });
  });
  return runs;
}
function nameTag(who) { return el("span", { class: `name ${whoClass(who)}` }, who); }

function renderNotes() {
  const box = $("notes");
  if (box.hidden && !isPresenter) return;
  const b = BEATS[cur], nb = BEATS[cur + 1];
  const kids = [];
  if (isPresenter) kids.push(el("p", { class: "clock" }, clockText()));
  kids.push(el("h3", {}, `${cur + 1}. ${b.title}, about ${b.seconds} s`));
  // practice cues (slides.json): what is on screen, and what the next press does
  if (b.screen) kids.push(el("p", { class: "cue" }, `On screen: ${b.screen}`));
  // the script with every press inside it: words, then PRESS (what it does), then the words
  // for after it. A clip's parts are slides.json "say" (one per stretch between its stops:
  // talk while it plays); a still or live slide's notes are cut at their "(Next...)" marks.
  // The part for right now is lit, the ones already said are dimmed.
  const presses = b.presses || [];
  const parts = b.say || b.notes.split(/\s*\(Next[^)]*\)\s*/);
  const cls = (k) => (k === step ? " now" : k < step ? " done" : "");
  if (b.say) kids.push(el("p", { class: "cue" }, "Clip: start talking the moment it starts."));
  // every run of words carries its speaker's colour and name; the name shows again only
  // when the speaker changes
  let who = firstSpeaker(b), shown = null;
  const say = (t, c) => runsOf(t, who).forEach((r) => {
    who = r.who;
    const p = el("p", { class: `say ${whoClass(r.who)}${c}` });
    if (r.who !== shown) { p.append(nameTag(r.who)); shown = r.who; }
    p.append(r.text);
    kids.push(p);
  });
  if (parts.length === presses.length + 1) {
    parts.forEach((t, k) => {
      say(t, cls(k));
      if (k < presses.length) kids.push(el("p", { class: `press${cls(k)}` }, `⏵ PRESS: ${presses[k]}`));
    });
  } else say(b.notes, " now");
  const end = el("p", { class: `press${cls(presses.length)}` });
  if (nb) {
    const next = firstSpeaker(nb);
    end.append(`⏭ PRESS: next slide, ${nb.title}  `, nameTag(next),
      next === who ? " keeps going" : " speaks next");
  } else end.append("Last slide.");
  kids.push(end);
  box.replaceChildren(...kids);
  // keep the lit part in view, but only scroll when the place in the script changes
  const where = `${cur}.${step}`;
  if (where !== renderNotes.at) {
    renderNotes.at = where;
    const now = box.querySelector(".say.now");
    if (now && isPresenter) now.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
let t0 = null;
const clockText = () => { if (!t0) return "0:00"; const sec = Math.floor((Date.now() - t0) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };

function start() {
  started = true; t0 = Date.now();
  $("start").hidden = true;
  if (!document.fullscreenElement && document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().catch(() => {});
  const m = /^#\/(\d+)(?:\.(\d+))?$/.exec(location.hash);
  go(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] : 0);
  sendState();
}

async function main() {
  const deck = await (await fetch("slides.json", { cache: "no-cache" })).json();
  BEATS = deck.beats;
  const names = ["results", "bands", "spectrum", "folds", "mistakes", "applied", "story", "city_day", "forest", "stations", "ml"];
  const files = await Promise.all(names.map((n) => fetch(`data/${n}.json`, { cache: "no-cache" }).then((r) => r.json())));
  names.forEach((n, i) => { DATA[n] = files[i]; });
  DATA.sources = await fetch("../data/sources.json", { cache: "no-cache" }).then((r) => r.json());
  // where each clip stops (src/talk_build.py); without it every clip just plays through
  CUES = await fetch("media/cues.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  await document.fonts.ready;

  if (isPresenter) { presenter(); return; }
  slides = BEATS.map(build);
  $("stage").append(...slides);
  // ?shot=N[&then=1][&step=k]: slide N alone, full 1920x1080, no controls, nothing moving. Used by
  // presentation/story/build_pptx.cjs to photograph each slide for the PowerPoint.
  const shot = new URLSearchParams(location.search).get("shot");
  if (shot) {
    document.body.classList.add("photo");
    $("start").hidden = true;
    const i = +shot - 1, b = BEATS[i], slide = slides[i];
    slide.classList.add("on");
    if (b.kind === "live") slide.querySelector(".fallback").hidden = false;
    if (new URLSearchParams(location.search).has("then")) slide.querySelectorAll(".over").forEach((o) => o.classList.add("on"));
    const at = new URLSearchParams(location.search).get("step");
    showSteps(slide, at == null ? 99 : +at);
    slide.querySelectorAll("video").forEach((v) => { v.removeAttribute("src"); });   // poster = last frame
    $("stage").style.transform = "none";      // the window is exactly 1920 x 1080: no scaling
    document.body.dataset.ready = "1";
    return;
  }
  drawTrace();
  fit();
  addEventListener("resize", fit);
  addEventListener("keydown", onKey, true);
  for (const t of ["touchstart", "touchmove", "touchend", "touchcancel"]) addEventListener(t, onTouch, { capture: true, passive: false });
  $("next").addEventListener("click", next);
  // one tap on a clip or a still = Next (live pages keep their taps: they sit above the stage)
  $("stage").addEventListener("click", () => { if (started && BEATS[cur] && BEATS[cur].kind !== "live") next(); });
  $("back").addEventListener("click", back);
  $("go").addEventListener("click", start);
  $("blackout").addEventListener("click", () => { $("blackout").hidden = true; });
  Link.on(onLink);
  roomSetup();
  Link.connect();
  setInterval(sendState, 3000);        // a heartbeat: presenters know the deck is still there
}

// The start screen's "Present online": make a room code, put it in the address, and show
// the link the speakers open. Reloading the page keeps the room (it's in the address).
function roomSetup() {
  $("roomline").hidden = false;
  const link = () => `${location.origin}${location.pathname}?presenter&room=${Link.room}`;
  if (Link.room) {
    $("mkroom").hidden = true;
    $("copyroom").hidden = false;
    // never print the link here: the audience may see this screen once it is shared, and
    // anyone with the link can move the deck. Copy it, or read it in the presenter window.
    $("roomtext").textContent = "Online.";
    $("copyroom").addEventListener("click", () => {
      navigator.clipboard.writeText(link()).then(() => { $("copyroom").textContent = "Copied"; }, () => {});
    });
    Link.onStatus((st) => { $("roomline").dataset.status = st; });
  } else {
    $("mkroom").addEventListener("click", () => {
      location.search = `?room=${Link.makeRoom()}`;    // reloads the deck, now in the room
    });
  }
}

// ------------------------------------------------------------------ presenter window
// talk/?presenter[&room=CODE]: the script for the slide the deck is on, the clock, and big
// Back / Next buttons. Its keys are the deck's keys, sent to the deck instead of used here.
function presenter() {
  document.body.classList.add("presenter");
  $("notes").hidden = false; $("pbar").hidden = false; $("pbuttons").hidden = false;
  $("plegend").replaceChildren(...SPEAKERS.map(nameTag));
  let deck = null, lastHeard = 0;      // the deck's last report
  cur = 0;
  const press = (cmd) => { if (deck) Link.send({ type: "cmd", cmd, at: `${deck.i}.${deck.k}` }); };
  const draw = () => {
    const fresh = Date.now() - lastHeard < 8000;
    $("pdot").className = Link.status === "off" ? "off" : fresh ? "live" : "lost";
    const where = Link.room ? "online" : "this computer only";
    $("pstate").textContent = !deck || !fresh
      ? `Looking for the deck (${where}, ${Link.status})`
      : !deck.started ? `Deck is on its start screen (${where})`
      : `Deck on slide ${deck.i + 1}${deck.k ? `.${deck.k}` : ""}: ${deck.waiting ? "waiting for a press" : "playing to the next stop"}`;
    renderNotes();
  };
  // anyone in the room can send; only believe a slide number that exists
  const ok = (m) => Number.isInteger(m.i) && m.i >= 0 && m.i < BEATS.length && Number.isInteger(m.k) && m.k >= 0
    && Number.isFinite(m.elapsed);
  Link.on((m) => {
    if (m.type !== "state" || !ok(m)) return;
    deck = m; lastHeard = Date.now();
    cur = m.i; step = m.k || 0; started = m.started;
    t0 = m.started ? Date.now() - m.elapsed : null;
    draw();
  });
  Link.onStatus((st) => { if (st === "online") Link.send({ type: "hello" }); draw(); });
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); press("next"); }
    if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); press("back"); }
  });
  // a clicked button lets go of the keyboard, or the next Space would press it a second time
  // the link for the other speakers, shown only here (never on the shared deck)
  if (Link.room) {
    $("plink").hidden = false;
    $("plink").textContent = `Presenter link: ${location.origin}${location.pathname}?presenter&room=${Link.room}`;
  }
  $("pnext").addEventListener("click", (e) => { e.currentTarget.blur(); press("next"); });
  $("pback").addEventListener("click", (e) => { e.currentTarget.blur(); press("back"); });
  Link.connect();
  Link.send({ type: "hello" });        // the same-computer road answers at once
  draw();
  setInterval(draw, 1000);
}
main();
