// The talk deck: a web page that behaves like slides (docs/21, site/talk/slides.json).
//
//   Next   right arrow, Page Down (clickers), Space, Enter, the Next button, or a swipe
//          with three or more fingers (one finger is left alone, to use the live pages)
//   Back   left arrow, Page Up, Backspace, the Back button, or the opposite swipe
//   F full screen   N speaker notes   P presenter window   L show a live slide's fallback
//   B black screen  Home / End first / last slide
//
// Three kinds of slide: a clip (plays once and holds on its last frame), a still drawn
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
const fmt = (n) => n.toLocaleString("en-GB");

let BEATS = [], DATA = {}, cur = -1, step = 0, started = false;
const isPresenter = new URLSearchParams(location.search).has("presenter");
const channel = "BroadcastChannel" in window ? new BroadcastChannel("groundtruth-talk") : null;

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

const CHARTS = {
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
    const v = el("video", { muted: "", playsinline: "", preload: "none", "data-src": `media/${b.video.clip}.mp4`,
      poster: `media/${b.video.clip}.jpg` });
    v.muted = true; v.loop = !!b.video.loop;
    slide.append(v);
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
    if (b.live.scroll && !rec.scrolled) {       // bring the part we talk about into view
      try { rec.iframe.contentDocument.querySelector(b.live.scroll).scrollIntoView({ block: "center" }); } catch (e) { /* ignore */ }
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

// ------------------------------------------------------------------ navigation
let slides = [], liveTimer = null;
function go(i, k = 0) {
  i = Math.max(0, Math.min(BEATS.length - 1, i));
  if (i === cur && k === step) return;
  const prev = cur;
  if (prev >= 0 && prev !== i) {
    slides[prev].classList.remove("on");
    slides[prev].querySelectorAll("video").forEach((v) => v.pause());
    slides[prev].querySelectorAll(".over").forEach((o) => o.classList.remove("on"));
    const rec = frames.get(prev); if (rec) rec.iframe.classList.remove("on");
  }
  cur = i; step = k;
  const b = BEATS[i], slide = slides[i];
  slide.classList.add("on");
  document.body.classList.remove("dark");
  clearTimeout(liveTimer);
  if (b.kind === "video") slide.querySelectorAll("video").forEach(playFromStart);
  if (b.kind === "live") {
    const rec = ensureFrame(i);
    if (rec.step !== k) {                        // a scripted step: the page moves by itself
      // each step's URL has its own query string, so it is always a full page load
      rec.step = k; rec.ready = false;
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
  if (history.replaceState) history.replaceState(null, "", `#/${i + 1}${k ? `.${k}` : ""}`);
  drawProgress();
  renderNotes();
  if (channel && !isPresenter) channel.postMessage({ i, k });
}
function next() {
  const b = BEATS[cur];
  if (b && b.kind === "live" && b.live.steps && step < b.live.steps.length) return go(cur, step + 1);
  go(cur + 1);
}
function back() {
  if (step > 0) return go(cur, step - 1);
  go(cur - 1);
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
    case "p": case "P": window.open(`${location.pathname}?presenter`, "groundtruth-presenter", "width=1100,height=760"); break;
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
function renderNotes() {
  const box = $("notes");
  if (box.hidden && !isPresenter) return;
  const b = BEATS[cur], nb = BEATS[cur + 1];
  const kids = [];
  if (isPresenter) kids.push(el("p", { class: "clock" }, clockText()));
  kids.push(el("h3", {}, `${cur + 1}. ${b.title}, ${b.speaker}, about ${b.seconds} s`), el("p", {}, b.notes));
  if (b.live && b.live.steps && step < b.live.steps.length) kids.push(el("p", { class: "next" }, "Next click: the page moves on by itself."));
  if (nb) kids.push(el("p", { class: "next" }, `Then: ${nb.title} (${nb.speaker})`));
  box.replaceChildren(...kids);
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
  if (channel) channel.postMessage({ started: true, t0 });
}

async function main() {
  const deck = await (await fetch("slides.json", { cache: "no-cache" })).json();
  BEATS = deck.beats;
  const names = ["results", "bands", "spectrum", "folds", "mistakes", "applied", "story", "city_day"];
  const files = await Promise.all(names.map((n) => fetch(`data/${n}.json`, { cache: "no-cache" }).then((r) => r.json())));
  names.forEach((n, i) => { DATA[n] = files[i]; });
  await document.fonts.ready;

  if (isPresenter) {                    // a second window that follows the deck
    document.body.classList.add("presenter");
    $("notes").hidden = false;
    cur = 0; renderNotes();
    if (channel) channel.onmessage = (e) => {
      if (e.data.started) t0 = e.data.t0;
      if (e.data.i != null) { cur = e.data.i; step = e.data.k || 0; renderNotes(); }
    };
    setInterval(renderNotes, 1000);
    return;
  }
  slides = BEATS.map(build);
  $("stage").append(...slides);
  // ?shot=N[&then=1]: slide N alone, full 1920x1080, no controls, nothing moving. Used by
  // presentation/story/build_pptx.cjs to photograph each slide for the PowerPoint.
  const shot = new URLSearchParams(location.search).get("shot");
  if (shot) {
    document.body.classList.add("photo");
    $("start").hidden = true;
    const i = +shot - 1, b = BEATS[i], slide = slides[i];
    slide.classList.add("on");
    if (b.kind === "live") slide.querySelector(".fallback").hidden = false;
    if (new URLSearchParams(location.search).has("then")) slide.querySelectorAll(".over").forEach((o) => o.classList.add("on"));
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
  $("back").addEventListener("click", back);
  $("go").addEventListener("click", start);
  $("blackout").addEventListener("click", () => { $("blackout").hidden = true; });
  if (channel) channel.onmessage = (e) => { if (e.data.goto != null) go(e.data.goto); };
}
main();
