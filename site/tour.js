// The front-door tour. Five stops, all drawn from the real data files in data/:
//   game.json         Brussels' average Wednesday and Sunday, and the real days for the quiz
//   history.json      every day since 2019 for 33 cities (the March 2020 drum record)
//   stations_2020.json the published-study cities and their model scores (the headline result)
//   stars.json        the Yale Bright Star Catalogue (the sky behind the Earth)
// Text goes in with textContent only (helpers in common.js).
"use strict";

const RAD = Math.PI / 180;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const DOW_SUN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const hourLabel = (h) => h === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
const cleanCity = (c) => c.replace(/ \(near .*\)$/, "");
const median = (xs) => {
  const s = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------- returning visitors: the browser remembers the tour was seen ----------
const store = {
  get() { try { return localStorage.getItem("gt-toured") === "1"; } catch (e) { return false; } },
  set() { try { localStorage.setItem("gt-toured", "1"); } catch (e) { /* private mode: fine */ } },
};
if (store.get()) {
  const p = $("primary"), s = $("secondary");
  p.textContent = "Open the globe"; p.href = "globe.html";
  s.textContent = "Replay the tour"; s.href = "#day";
}
for (const id of ["skip", "secondary", "open-globe"]) $(id).addEventListener("click", () => store.set());

// ---------- the tour bar follows the section under it ----------
const bar = $("tourbar");
const sections = [...document.querySelectorAll("section[data-stop]")];
const watchBar = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const s = e.target;
    document.body.dataset.tone = s.dataset.tone;
    const n = +s.dataset.stop;
    $("stop").textContent = n > 1 && n < 5 ? `Stop ${n} of 5` : "";
    bar.classList.toggle("bare", n === 1 || n === 5);
    if (n === 5) store.set();
  }
}, { rootMargin: "0px 0px -94% 0px" });
sections.forEach((s) => watchBar.observe(s));

// ---------- the real night sky, and a globe floating in it ----------
let STARS = [];
const unit3 = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function gmst(ms) {
  const d = ms / 864e5 + 2440587.5 - 2451545.0;
  return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
}
// Stars as seen looking past the Earth from above (lon, lat), at sidereal angle g.
function drawSky(canvas, lon, lat, g) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#fff";
  const f = unit3(lon, lat).map((x) => -x);
  let up = [-f[2] * f[0], -f[2] * f[1], 1 - f[2] * f[2]];
  const n = Math.hypot(...up) || 1; up = up.map((x) => x / n);
  const right = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  const F = 0.9 * Math.max(w, h);
  for (const [ra, dec, mag] of STARS) {
    if (mag > 5.2) break;                       // brightest first: stop at what the eye sees easily
    const s = unit3(ra - g, dec), depth = dot3(s, f);
    if (depth <= 0.05) continue;
    const x = w / 2 + F * dot3(s, right) / depth, y = h / 2 - F * dot3(s, up) / depth;
    if (x < 0 || y < 0 || x > w || y > h) continue;
    ctx.globalAlpha = Math.min(1, Math.max(0.18, (6.6 - mag) / 5.5));
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, (6.2 - mag) * 0.3), 0, 7); ctx.fill();
  }
}
function makeGlobe(box, { center, zoom, date }) {
  const sky = box.querySelector(".sky"), g = gmst(date);
  const map = new maplibregl.Map({
    container: box.querySelector(".map"), center, zoom, interactive: false, attributionControl: false,
    style: {
      version: 8, projection: { type: "globe" },
      sources: { earth: { type: "raster", tileSize: 256, maxzoom: 8,
        tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"] } },
      layers: [{ id: "earth", type: "raster", source: "earth", paint: { "raster-fade-duration": 300 } }],
      sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
    },
  });
  map.on("style.load", () => map.setProjection({ type: "globe" }));
  const paint = () => { const c = map.getCenter(); drawSky(sky, c.lng, c.lat, g); };
  map.on("move", paint); map.on("resize", paint); map.on("load", paint);
  map.facing = (lon, lat) => { const c = map.getCenter(); return dot3(unit3(lon, lat), unit3(c.lng, c.lat)) > 0.12; };
  return map;
}
const hasGL = typeof maplibregl !== "undefined";
// keep chart labels readable when an SVG is drawn smaller than its viewBox (phones)
const fitText = (box) => box.style.setProperty("--u", Math.min(2, box.viewBox.baseVal.width / (box.clientWidth || 760)).toFixed(3));

// ---------- stop 1: welcome ----------
function welcome(ref) {
  const ys = ref.weekday, lo = Math.min(...ys), hi = Math.max(...ys);
  $("pen").setAttribute("d", ys.map((y, i) =>
    `${i ? "L" : "M"}${(i * 1000 / 23).toFixed(1)} ${(96 - (y - lo) / (hi - lo) * 92).toFixed(1)}`).join(""));
  document.querySelector(".trace").classList.add("drawn");
  if (!hasGL) return;
  const box = document.querySelector(".orbit");
  const map = makeGlobe(box, { center: [10, 18], zoom: innerWidth < 720 ? 1.15 : 2.15, date: Date.now() });
  if (REDUCED) return;
  // turn slowly while the welcome is on screen, and stop when it is not
  let on = true, last = null, lon = 10;
  new IntersectionObserver((e) => { on = e[0].isIntersecting; if (on) { last = null; requestAnimationFrame(spin); } })
    .observe($("welcome"));
  function spin(t) {
    if (!on) return;
    if (last !== null) lon -= (t - last) / 1000 * 1.2;
    last = t; map.setCenter([lon, 18]);
    requestAnimationFrame(spin);
  }
  map.on("load", () => requestAnimationFrame(spin));
}

// ---------- stop 2: one day under Brussels ----------
function oneDay(ref) {
  const wed = ref.weekday.map((v) => 10 ** v), sun = ref.sunday.map((v) => 10 ** v);
  const minH = wed.indexOf(Math.min(...wed)), peakH = wed.indexOf(Math.max(...wed));
  const sunPeak = sun.indexOf(Math.max(...sun));
  // the copy is written from the numbers, so it can never disagree with the line
  $("s-still").dataset.hour = minH; $("s-wake").dataset.hour = peakH;
  $("t-still-k").textContent = `${hourLabel(minH)[0].toUpperCase()}${hourLabel(minH).slice(1)}. Almost still.`;
  $("t-still").textContent = `The ground is shaking at only ${pct(wed[minH])} of the day’s usual level.`;
  $("t-wake").textContent = `By ${hourLabel(peakH)} the ground shakes ${(wed[peakH] / wed[minH]).toFixed(1)} times ` +
    `harder than in the small hours. That is the commute: cars, trams, trains and people on foot.`;
  $("t-sun").textContent = `The dotted line is an average Sunday at the same seismometer: no commute, just a slow ` +
    `rise to a peak in the afternoon, around ${hourLabel(sunPeak)}, and that difference in shape is all the computer gets.`;

  const W = 760, L = 8, R = 690, T = 26, B = 312;
  const all = [...wed, ...sun], LO = Math.log10(Math.min(...all) * 0.8), HI = Math.log10(Math.max(...all) * 1.15);
  const x = (h) => L + h * (R - L) / 23;
  const y = (v) => B - (Math.log10(v) - LO) / (HI - LO) * (B - T);
  const box = $("daysvg");
  const add = (tag, attrs, text) => { const e = svg(tag, attrs); if (text) e.textContent = text; box.append(e); return e; };
  for (let h = 0; h <= 23; h++) add("line", { class: h % 6 ? "h" : "h h6", x1: x(h), x2: x(h), y1: T - 10, y2: B });
  for (const [v, t] of [[2, "2×"], [1, "1×"], [0.5, "½×"], [0.25, "¼×"]]) {
    if (Math.log10(v) < LO || Math.log10(v) > HI) continue;
    add("line", { class: v === 1 ? "lvl lvl1" : "lvl", x1: L, x2: R, y1: y(v), y2: y(v) });
    add("text", { class: "ax", x: R + 8, y: y(v) + 4 }, t);
  }
  for (const h of [0, 6, 12, 18]) add("text", { class: "ax", x: x(h) + 4, y: B + 22 }, hourLabel(h));
  const path = (arr) => arr.map((v, h) => `${h ? "L" : "M"}${x(h).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  add("path", { class: "sun", d: path(sun) });
  const line = add("path", { class: "wed", d: "" });
  const arm = add("line", { class: "arm", y1: T - 10 });
  const nib = add("line", { class: "nib" });
  const notes = [[minH, "almost still", 6, -40, "middle"], [peakH, "the commute", -14, 6, "end"]]
    .map(([h, t, dx, dy, anchor]) => [h, add("text", { class: "note", x: x(h) + dx, y: y(wed[h]) + dy, "text-anchor": anchor }, t)]);
  const sunNote = add("text", { class: "note sunnote", x: x(sunPeak) - 30, y: y(sun[sunPeak]) - 14 }, "Sunday");
  const paper = $("paper");

  function pen(h, showSun) {
    h = Math.max(0, Math.min(23, h));
    const i = Math.floor(h), f = h - i, j = Math.min(23, i + 1);
    const v = 10 ** (Math.log10(wed[i]) * (1 - f) + Math.log10(wed[j]) * f);
    const px = x(h).toFixed(1), py = y(v).toFixed(1);
    line.setAttribute("d", `${path(wed.slice(0, i + 1))}L${px} ${py}`);
    for (const [k, val] of [["x1", px], ["x2", px], ["y2", py]]) arm.setAttribute(k, val);
    nib.setAttribute("x1", x(h) - 5); nib.setAttribute("x2", x(h) + 5); nib.setAttribute("y1", py); nib.setAttribute("y2", py);
    const hr = Math.round(h);
    $("hour").textContent = hourLabel(hr);
    $("val").replaceChildren(el("b", {}, `${wed[hr].toFixed(2)}×`), " the day’s usual shaking, on an average Wednesday");
    for (const [nh, e] of notes) e.classList.toggle("on", h >= nh);
    paper.classList.toggle("with-sun", !!showSun);
  }
  // scroll moves the pen between the hours named by the steps
  const steps = [...document.querySelectorAll(".step")];
  let dragging = false;
  function onScroll() {
    if (dragging) return;
    const mid = innerHeight * 0.6;
    let h = 0, sunOn = false;
    steps.forEach((s, k) => {
      const r = s.getBoundingClientRect();
      const h0 = +s.dataset.hour, h1 = k + 1 < steps.length ? +steps[k + 1].dataset.hour : h0;
      if (r.top <= mid) { h = h0 + (h1 - h0) * Math.min(1, Math.max(0, (mid - r.top) / r.height)); sunOn = s.hasAttribute("data-sun"); }
    });
    pen(h, sunOn);
  }
  addEventListener("resize", () => fitText(box)); fitText(box);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const hourAt = (e) => { const r = box.getBoundingClientRect(); return ((e.clientX - r.left) / r.width * W - L) / (R - L) * 23; };
  paper.addEventListener("pointerdown", (e) => { dragging = true; paper.setPointerCapture(e.pointerId); pen(hourAt(e), paper.classList.contains("with-sun")); });
  paper.addEventListener("pointermove", (e) => { if (dragging) pen(hourAt(e), paper.classList.contains("with-sun")); });
  const stop = () => { dragging = false; };
  paper.addEventListener("pointerup", stop); paper.addEventListener("pointercancel", stop);
}

// ---------- stop 3: the quiet of 2020 ----------
const QUIET = -15;            // "quiet" = at least 15% below the same weekday's recent normal
function quietRows(hist) {
  const t0 = Date.parse(hist.start + "T00:00:00Z");
  const a = Date.UTC(2020, 1, 10), b = Date.UTC(2020, 4, 1);
  const i0 = Math.round((a - t0) / 864e5), n = Math.round((b - a) / 864e5);
  const dates = Array.from({ length: n }, (_, k) => new Date(a + k * 864e5).toISOString().slice(0, 10));
  const rows = [];
  for (const s of hist.stations) {
    if (s.published_weekend_acc === null || s.published_weekend_acc < 80) continue;   // a readable weekly rhythm
    const v = [];
    for (let k = 0; k < n; k++) v.push(median(s.values.slice(i0 + k - 1, i0 + k + 2)));   // three-day median
    // the day it went quiet: first day from 1 March whose next ten days have a median 15% or more below normal
    let onset = null;
    for (let k = 0; k < n && onset === null; k++) {
      if (dates[k] < "2020-03-01") continue;
      const m = median(v.slice(k, k + 10));
      if (m !== null && m <= QUIET) onset = k;
    }
    rows.push({ city: cleanCity(s.city), lat: s.lat, lon: s.lon, v, onset });
  }
  rows.sort((p, q) => (p.onset === null) - (q.onset === null) || (p.onset ?? 0) - (q.onset ?? 0));
  return { dates, rows };
}

function quiet(hist) {
  const { dates, rows } = quietRows(hist), N = dates.length;
  const drum = $("drumsvg");
  const mk = (tag, attrs, parent = drum) => { const e = svg(tag, attrs); parent.append(e); return e; };
  let geo = [], X = null, stylus = null, cur = 0;
  function layout() {
    drum.replaceChildren();
    const W = drum.clientWidth, H = drum.clientHeight;
    if (!W || !H) return;
    const NAMEW = W < 500 ? 92 : 150, X0 = NAMEW, X1 = W - 4, TOP = 18;
    const rowH = (H - TOP) / rows.length;
    X = (i) => X0 + i * (X1 - X0) / (N - 1);
    const amp = rowH * 1.1 / 60;      // 60% quieter = a little more than one row, so the traces overlap like a drum record
    dates.forEach((d, i) => {
      const dt = new Date(d + "T00:00:00Z");
      if (dt.getUTCDay() === 1) mk("line", { class: "wk", x1: X(i), x2: X(i), y1: TOP - 4, y2: H });
      if (dt.getUTCDate() === 1 || i === 0) {
        const t = mk("text", { class: "mo", x: X(i) + 3, y: TOP - 6 }); t.textContent = MONTHS[dt.getUTCMonth()];
      }
    });
    geo = rows.map((r, k) => {
      const yb = TOP + rowH * (k + 0.5), g = mk("g", {});
      const name = mk("text", { class: "name", x: NAMEW - 10, y: yb + 4, "text-anchor": "end" }, g);
      name.textContent = r.city;
      mk("line", { class: "base", x1: X0, x2: X1, y1: yb, y2: yb }, g);
      const fl = mk("path", { class: "fl" }, g), tr = mk("path", { class: "tr" }, g), ql = mk("path", { class: "ql" }, g);
      return { r, name, fl, tr, ql, yb, yv: (v) => yb - Math.max(-70, Math.min(45, v)) * amp };
    });
    stylus = mk("line", { class: "stylus", y1: TOP - 4, y2: H });
  }

  let map = null, labels = [];
  function placeLabels(i) {
    if (!map) return;
    // quietest cities first; drop any label that would sit on one already placed
    const order = rows.map((_, k) => k).sort((p, q) => (rows[p].v[i] ?? 0) - (rows[q].v[i] ?? 0));
    const boxes = [];
    for (const k of order) {
      const r = rows[k], e = labels[k];
      if (!map.facing(r.lon, r.lat)) { e.style.display = "none"; continue; }
      const p = map.project([r.lon, r.lat]);
      const w = r.city.length * 7 + 16, bx = [p.x, p.y - 8, p.x + w, p.y + 8];
      if (boxes.some((o) => bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1])) { e.style.display = "none"; continue; }
      boxes.push(bx);
      e.style.display = ""; e.style.left = `${p.x}px`; e.style.top = `${p.y}px`;
      e.classList.toggle("q", r.v[i] !== null && r.v[i] <= QUIET);
    }
  }

  function draw(i) {
    cur = i;
    if (!X) return;
    const f1 = (n) => n.toFixed(1);
    let quietN = 0, have = 0, latest = null;
    for (const g of geo) {
      let d = "", fill = "", q = "", pen = false, inQ = false, lastQ = 0;
      for (let k = 0; k <= i; k++) {
        const v = g.r.v[k];
        if (v === null) { pen = false; if (inQ) { fill += `L${f1(X(lastQ))} ${g.yb}Z`; inQ = false; } continue; }
        const px = f1(X(k)), py = f1(g.yv(v));
        d += `${pen ? "L" : "M"}${px} ${py}`; pen = true;
        if (v <= QUIET) {
          q += `${inQ ? "L" : "M"}${px} ${py}`;
          fill += `${inQ ? "" : `M${px} ${g.yb}`}L${px} ${py}`;
          inQ = true; lastQ = k;
        } else if (inQ) { fill += `L${f1(X(lastQ))} ${g.yb}Z`; inQ = false; }
      }
      if (inQ) fill += `L${f1(X(lastQ))} ${g.yb}Z`;
      g.tr.setAttribute("d", d); g.ql.setAttribute("d", q); g.fl.setAttribute("d", fill);
      const v = g.r.v[i];
      if (v !== null) { have++; if (v <= QUIET) quietN++; }
      g.name.classList.toggle("q", v !== null && v <= QUIET);
      if (g.r.onset !== null && g.r.onset <= i && (!latest || g.r.onset >= latest.onset)) latest = g.r;
    }
    stylus.setAttribute("x1", X(i)); stylus.setAttribute("x2", X(i));
    const dt = new Date(dates[i] + "T00:00:00Z");
    $("qdate").textContent = `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} 2020`;
    $("qdow").textContent = DOW_SUN[dt.getUTCDay()];
    const c = $("qcount");
    c.replaceChildren(el("b", {}, String(quietN)), ` of ${have} cities shaking at least 15% less than usual.`);
    if (latest) {
      const od = new Date(dates[latest.onset] + "T00:00:00Z");
      c.append(` Latest to go quiet: ${latest.city}, ${od.getUTCDate()} ${MONTHS[od.getUTCMonth()]}.`);
    }
    if (map) {
      // the camera drifts west with the quiet: from over Asia to over the Americas
      map.jumpTo({ center: [95 - 175 * Math.min(1, (i / (N - 1)) * 1.25), 18] });
      placeLabels(i);
    }
  }
  const run = $("run");
  function onScroll() {
    const r = run.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const t = Math.max(0, Math.min(1, -r.top / (run.offsetHeight - innerHeight)));
    draw(Math.round(t * (N - 1)));
  }
  layout(); draw(0);
  addEventListener("resize", () => { layout(); draw(cur); });
  addEventListener("scroll", onScroll, { passive: true });
  // build the globe only when the section comes near, so the welcome loads fast
  if (hasGL) {
    const near = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting || map) return;
      near.disconnect();
      map = makeGlobe($("qspace"), { center: [95, 18], zoom: innerWidth < 800 ? 0.95 : 1.45, date: Date.UTC(2020, 2, 23) });
      labels = rows.map((r) => { const e = el("span", { class: "city" }, r.city); $("labels").append(e); return e; });
      map.on("move", () => placeLabels(cur));
      map.on("load", () => draw(cur));
    }, { rootMargin: "100% 0px" });
    near.observe(run);
  }
  onScroll();
}

// ---------- stop 4: can a computer read it? ----------
function learn(stations, game) {
  const scored = stations.filter((s) => s.weekend_bal_acc !== null);
  const med = median(scored.map((s) => s.weekend_bal_acc));
  $("learn-stat").textContent = `We trained one model per city on the published 2019–20 recordings and tested ` +
    `each on whole weeks it had never seen. Across ${scored.length} cities, the typical model told a weekday from ` +
    `a weekend ${pct(med)} of the time (a coin flip gets 50%). Now you try, on a real day the model never trained on.`;
  // real days only, holidays left out so the answer is clear; half weekdays, half weekends
  const pool = [game.days.filter((d) => !d.holiday && d.dow < 5), game.days.filter((d) => !d.holiday && d.dow >= 5)];
  const box = $("qsvg"), btns = [...document.querySelectorAll("#q-actions .btn")];
  let you = 0, model = 0, rounds = 0, day = null;
  const sure = (p) => p > 0.99 ? "more than 99% sure" : `${pct(p)} sure`;
  function deal() {
    const set = pool[Math.random() < 0.5 ? 0 : 1];
    day = set[Math.floor(Math.random() * set.length)];
    const dt = new Date(day.date + "T00:00:00Z");
    $("q-city").textContent = `${day.city}, a day in ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
    const W = 760, L = 8, R = 752, T = 16, B = 196;
    const lo = Math.min(...day.shape) - 0.05, hi = Math.max(...day.shape) + 0.05;
    const x = (h) => L + h * (R - L) / 23, y = (v) => B - (v - lo) / (hi - lo) * (B - T);
    box.replaceChildren();
    for (let h = 0; h <= 23; h++) box.append(svg("line", { class: h % 6 ? "h" : "h h6", x1: x(h), x2: x(h), y1: T - 6, y2: B }));
    for (const h of [0, 6, 12, 18]) { const t = svg("text", { class: "ax", x: x(h) + 4, y: B + 22 }); t.textContent = hourLabel(h); box.append(t); }
    box.append(svg("path", { class: "wed drawn", pathLength: 1,
      d: day.shape.map((v, h) => `${h ? "L" : "M"}${x(h).toFixed(1)} ${y(v).toFixed(1)}`).join("") }));
    btns.forEach((b) => { b.disabled = false; b.classList.remove("truth", "miss"); });
    $("q-reveal").textContent = ""; $("q-next").hidden = true;
  }
  function answer(ans) {
    const truth = day.dow >= 5 ? 1 : 0, call = day.p_weekend >= 0.5 ? 1 : 0;
    rounds++; if (ans === truth) you++; if (call === truth) model++;
    btns.forEach((b) => { b.disabled = true; const a = +b.dataset.ans; if (a === truth) b.classList.add("truth"); else if (a === ans) b.classList.add("miss"); });
    const said = call ? "the weekend" : "a weekday";
    $("q-reveal").textContent = `It was a ${DAY_NAMES[day.dow]}. ${ans === truth ? "You read it right." : "Not this time."} ` +
      `The model said ${said} (${sure(call ? day.p_weekend : 1 - day.p_weekend)})` +
      `${call === truth ? "." : ", and got it wrong."}`;
    $("q-score").textContent = `You ${you}/${rounds}, model ${model}/${rounds}`;
    $("q-next").hidden = false; $("q-next").focus();
  }
  addEventListener("resize", () => fitText(box)); fitText(box);
  btns.forEach((b) => b.addEventListener("click", () => answer(+b.dataset.ans)));
  $("q-next").addEventListener("click", deal);
  deal();
}

// ---------- stop 5: yours ----------
function yours(hist, stations) {
  const sky = $("yours-sky"), g = gmst(Date.now());
  const paint = () => drawSky(sky, -40, 30, g);
  paint(); addEventListener("resize", paint);
  $("yours-lede").textContent = `Every day since January 2019, for ${hist.stations.length} cities. ` +
    "Pick a date, find a holiday, open any city’s year.";
  const n = stations.filter((s) => s.weekend_bal_acc !== null).length;
  $("door-research").textContent = `${n} cities from the 2020 study: how well can a seismometer tell a weekday from a weekend?`;
}

// ---------- load the data, then build each stop ----------
const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
get("stars.json").then((s) => { STARS = s.stars; }).catch(() => {}).finally(() => {
  get("game.json").then((game) => {
    const ref = game.reference["BE.UCC"];
    welcome(ref); oneDay(ref);
    get("stations_2020.json").then((st) => {
      learn(st, game);
      get("history.json").then((hist) => { quiet(hist); yours(hist, st); });
    });
  }).catch(() => { $("val").textContent = "The data could not load. Reload the page to try again."; });
});
