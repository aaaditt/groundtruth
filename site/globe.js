// Time-travel globe: seven years of daily history per seismometer (site/data/history.json,
// written by src/history.py). All text is set with textContent (see common.js).
"use strict";

// Colour bins for "% vs the same weekday over the previous 8 weeks".
// Blue = quieter, grey = about normal, red = louder. Colours live in style.css.
const BINS = [
  { lo: -Infinity, hi: -30, v: "--div-n3", label: "30%+ quieter" },
  { lo: -30, hi: -15, v: "--div-n2", label: "15–30% quieter" },
  { lo: -15, hi: -5, v: "--div-n1", label: "5–15% quieter" },
  { lo: -5, hi: 5, v: "--div-0", label: "about normal (±5%)" },
  { lo: 5, hi: 15, v: "--div-p1", label: "5–15% louder" },
  { lo: 15, hi: 30, v: "--div-p2", label: "15–30% louder" },
  { lo: 30, hi: Infinity, v: "--div-p3", label: "30%+ louder" },
];
function binOf(v) {
  if (v === null || v === undefined) return -1;
  if (v <= -30) return 0;
  if (v <= -15) return 1;
  if (v <= -5) return 2;
  if (v < 5) return 3;
  if (v < 15) return 4;
  if (v < 30) return 5;
  return 6;
}

// Well-known dates to jump to. They are only dates: what each city did is in the data.
const JUMPS = [
  ["2020-03-23", "March 2020 lockdowns"],
  ["2020-12-25", "Christmas Day 2020"],
  ["2024-04-01", "Easter Monday 2024"],
  ["2024-11-28", "US Thanksgiving 2024"],
  ["2025-01-01", "New Year's Day 2025"],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 864e5;
const HOME = { center: [-40, 15] };   // the Atlantic: the Americas, Europe and Africa in view
const homeZoom = () => (window.innerWidth < 700 ? 0.9 : 1.9);

let H = null;          // history.json
let T0 = 0;            // UTC ms of day 0
let cur = 0;           // selected day index
let sel = -1;          // selected station index
let calYear = null;    // year shown in the calendar
let calCells = [];     // [dayIndex, rect] for quick re-highlighting
let timer = null;
let map = null;

const dateOf = (i) => new Date(T0 + i * DAY_MS).toISOString().slice(0, 10);
const indexOf = (s) => Math.round((Date.parse(s + "T00:00:00Z") - T0) / DAY_MS);
const weekdayOf = (i) => DAY_NAMES[(new Date(T0 + i * DAY_MS).getUTCDay() + 6) % 7];
const weak = (s) => s.published_weekend_acc === null || s.published_weekend_acc < 80;
const holidayOf = (s, i) => s.holidays[String(i)] || "";
const renamed = (s) => s.paper_city && s.paper_city !== s.city;

// Where the sensor really is: the dot is the seismometer, which can be tens of km from
// the city the 2020 paper named (labels: groundtruth/places.py, distances: GeoNames).
function whereLines(s) {
  const out = [];
  if (s.near_km !== null && s.near_km !== undefined && s.near_km >= 1) {
    out.push(`Sensor ${Math.round(s.near_km)} km from ${s.near}`);
  }
  if (renamed(s)) out.push(`Listed as “${s.paper_city}” in Lecocq et al. 2020`);
  return out;
}

function describe(v, i) {
  const wd = weekdayOf(i);
  if (v === null || v === undefined) return "No usable data";
  if (Math.abs(v) < 5) return `About normal for a ${wd}`;
  return `${Math.abs(v)}% ${v < 0 ? "quieter" : "louder"} than a usual ${wd}`;
}

// ---------- map ----------
function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
const styleUrl = () => `https://tiles.openfreemap.org/styles/${isDark() ? "dark" : "positron"}`;

function features() {
  return {
    type: "FeatureCollection",
    features: H.stations.map((s, k) => {
      const v = s.values[cur];
      return {
        type: "Feature", id: k,
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: { k, city: s.city, bin: binOf(v), weak: weak(s) ? 1 : 0 },
      };
    }),
  };
}

function addLayers() {
  const colors = BINS.map((b) => cssVar(b.v));
  const ring = cssVar("--ring");
  const muted = cssVar("--text-muted");
  const ink = cssVar("--text-primary");
  map.addSource("st", { type: "geojson", data: features() });
  const radius = ["interpolate", ["linear"], ["zoom"], 1, 6, 5, 9, 10, 12];
  map.addLayer({
    id: "st", type: "circle", source: "st",
    paint: {
      "circle-radius": radius,
      "circle-color": ["match", ["get", "bin"], ...colors.flatMap((c, i) => [i, c]), "rgba(0,0,0,0)"],
      "circle-stroke-width": 2,
      "circle-stroke-color": ["case", ["==", ["get", "bin"], -1], muted, ring],
      "circle-opacity": ["case", ["==", ["get", "weak"], 1], 0.4, 1],
      "circle-stroke-opacity": ["case", ["==", ["get", "weak"], 1], 0.6, 1],
    },
  });
  map.addLayer({
    id: "sel", type: "circle", source: "st", filter: ["==", ["get", "k"], sel],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 11, 5, 14, 10, 17],
      "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2.5, "circle-stroke-color": ink,
    },
  });
  map.addLayer({
    id: "names", type: "symbol", source: "st", minzoom: 3, maxzoom: 6,
    layout: { "text-field": ["get", "city"], "text-font": ["Noto Sans Regular"],
      "text-size": 13, "text-offset": [0, 1.3], "text-anchor": "top" },
    paint: { "text-color": ink, "text-halo-color": ring, "text-halo-width": 1.5 },
  });
}

function initMap() {
  map = new maplibregl.Map({
    container: "globe", style: styleUrl(), center: HOME.center, zoom: homeZoom(),
    attributionControl: { compact: true },
    cooperativeGestures: window.innerWidth < 700,   // let phones scroll the page past the globe
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.on("style.load", () => { map.setProjection({ type: "globe" }); addLayers(); });
  map.on("mousemove", "st", (e) => {
    map.getCanvas().style.cursor = "pointer";
    const s = H.stations[e.features[0].properties.k];
    const lines = [s.city, ...whereLines(s), fmtLongDate(dateOf(cur)), describe(s.values[cur], cur)];
    const h = holidayOf(s, cur);
    if (h) lines.push(`Public holiday: ${h}`);
    if (weak(s)) lines.push("Weak weekly signal at this station");
    showTip(e.originalEvent, lines);
  });
  map.on("mouseleave", "st", () => { map.getCanvas().style.cursor = ""; hideTip(); });
  map.on("click", "st", (e) => { hideTip(); select(e.features[0].properties.k, true); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => map.setStyle(styleUrl()));
}

function refreshMap() {
  if (!map || !map.getSource("st")) return;
  map.getSource("st").setData(features());
  map.setFilter("sel", ["==", ["get", "k"], sel]);
}

// ---------- date controls ----------
function setDate(i, opts = {}) {
  cur = Math.max(0, Math.min(H.n, i));
  document.getElementById("slider").value = cur;
  document.getElementById("when").textContent = fmtDate(dateOf(cur)) + " " + dateOf(cur).slice(0, 4);
  refreshMap();
  summary();
  if (sel >= 0) detail(opts.keepCalendar); else ranking();
  writeHash();
}

function summary() {
  const strong = H.stations.filter((s) => !weak(s));
  const withData = strong.filter((s) => s.values[cur] !== null);
  const quiet = withData.filter((s) => s.values[cur] <= -15).length;
  const loud = withData.filter((s) => s.values[cur] >= 15).length;
  const hols = H.stations.filter((s) => holidayOf(s, cur)).map((s) => `${s.city} (${holidayOf(s, cur)})`);
  const p = document.getElementById("summary");
  p.replaceChildren(
    "Of the ", el("b", {}, String(withData.length)), " clearly-measured cities with data, ",
    el("b", {}, String(quiet)), " were 15%+ quieter than usual and ",
    el("b", {}, String(loud)), " were 15%+ louder.",
    hols.length > 5 ? ` Public holiday in ${hols.length} of the ${H.stations.length} places.`
      : hols.length ? ` Public holiday in: ${hols.join(", ")}.` : "");
}

function play() {
  const b = document.getElementById("play");
  if (timer) { clearInterval(timer); timer = null; b.textContent = "Play"; b.setAttribute("aria-label", "Play"); return; }
  if (cur >= H.n) setDate(0);
  b.textContent = "Pause"; b.setAttribute("aria-label", "Pause");
  timer = setInterval(() => {
    if (cur >= H.n) { play(); return; }
    setDate(cur + 1, { keepCalendar: true });
  }, 140);
}

// ---------- city panel ----------
function select(k, fly) {
  sel = k;
  const s = H.stations[k];
  document.getElementById("fly").value = String(k);
  calYear = Number(dateOf(cur).slice(0, 4));
  refreshMap();
  detail(false);
  writeHash();
  if (fly) map.flyTo({ center: [s.lon, s.lat], zoom: 7, speed: 1.4, essential: true });
}

function detail(keepCalendar) {
  const s = H.stations[sel];
  const box = document.getElementById("detail");
  const v = s.values[cur];
  const y = Number(dateOf(cur).slice(0, 4));
  if (keepCalendar && y === calYear && box.querySelector(".cal")) {
    box.querySelector(".value").replaceWith(valueLine(s, v));
    highlight();
    return;
  }
  calYear = y;
  const acc = s.published_weekend_acc === null
    ? "No published score (station not in the 2020 study)."
    : `Published weekday-vs-weekend accuracy: ${s.published_weekend_acc}%.`;
  const kids = [
    el("h2", {}, s.city),
    el("p", { class: "sub" }, `${s.site || s.id} · ${s.country} · ${s.id}`),
    ...whereLines(s).map((t) => el("p", { class: "sub where" }, t)),
    valueLine(s, v),
    el("p", { class: "note" }, acc + (weak(s) ? " The weekly rhythm is hard to read here, so treat colours with care." : "")),
    yearButtons(),
    calendar(s, calYear),
    el("p", { class: "note" }, "One square per day; dot = public holiday; outline = no data. Click a day to jump to it."),
    backButton(),
  ];
  box.replaceChildren(...kids);
  highlight();
}

function valueLine(s, v) {
  const p = el("p", { class: "value" });
  const h = holidayOf(s, cur);
  if (v === null) p.append(el("strong", {}, "No data"), ` on ${fmtLongDate(dateOf(cur))}`);
  else {
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    p.append(el("strong", {}, `${sign}${Math.abs(v)}%`), ` ${describe(v, cur).replace(/^\d+% /, "")}`);
  }
  if (h) p.append(el("br"), el("span", { class: "badge" }, h));
  return p;
}

function yearButtons() {
  const wrap = el("div", { class: "years", role: "group", "aria-label": "Year" });
  const first = Number(H.start.slice(0, 4)), last = Number(dateOf(H.n).slice(0, 4));
  for (let y = first; y <= last; y++) {
    const b = el("button", { class: "chip", "aria-pressed": String(y === calYear) }, String(y));
    b.addEventListener("click", () => {
      // keep the same day of the year where possible
      const d = dateOf(cur);
      let i = indexOf(`${y}${d.slice(4)}`);
      if (Number.isNaN(i)) i = indexOf(`${y}-01-01`);
      setDate(i);
    });
    wrap.append(b);
  }
  return wrap;
}

function calendar(s, year) {
  const cell = 11, gap = 2, pitch = cell + gap, mw = 7 * pitch, mh = 6 * pitch + 14;
  const cols = 3, padX = 16, padY = 8;
  const W = cols * mw + (cols - 1) * padX, Hh = 4 * mh + 3 * padY;
  const g = svg("svg", { class: "cal", viewBox: `0 0 ${W} ${Hh}`, width: "100%", role: "img",
    "aria-label": `${s.city}, ${year}: one square per day` });
  calCells = [];
  for (let m = 0; m < 12; m++) {
    const ox = (m % cols) * (mw + padX), oy = Math.floor(m / cols) * (mh + padY);
    const t = svg("text", { x: ox, y: oy + 10 }); t.textContent = MONTHS[m]; g.append(t);
    const firstDow = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const slot = firstDow + d - 1;
      const x = ox + (slot % 7) * pitch, y = oy + 14 + Math.floor(slot / 7) * pitch;
      const i = indexOf(`${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      if (i < 0 || i > H.n) continue;
      const v = s.values[i], b = binOf(v);
      const r = svg("rect", { x, y, width: cell, height: cell, rx: 2,
        class: b < 0 ? "day missing" : "day" });
      if (b >= 0) r.setAttribute("style", `fill: var(${BINS[b].v})`);
      const h = holidayOf(s, i);
      const lines = [fmtLongDate(dateOf(i)), describe(v, i)];
      if (h) lines.push(`Public holiday: ${h}`);
      hover(r, lines);
      r.addEventListener("click", () => setDate(i, { keepCalendar: true }));
      r.addEventListener("keydown", (e) => { if (e.key === "Enter") setDate(i, { keepCalendar: true }); });
      g.append(r);
      if (h) g.append(svg("circle", { class: "hol", cx: x + cell / 2, cy: y + cell / 2, r: 1.8 }));
      calCells.push([i, r]);
    }
  }
  return g;
}

function highlight() {
  for (const [i, r] of calCells) r.classList.toggle("sel", i === cur);
}

function backButton() {
  const b = el("button", { class: "chip", style: "margin-top:8px" }, "← Back to the whole globe");
  b.addEventListener("click", () => {
    sel = -1;
    document.getElementById("fly").value = "";
    refreshMap(); ranking(); writeHash();
    map.flyTo({ center: HOME.center, zoom: homeZoom(), speed: 1.4 });
  });
  return b;
}

// With no city selected, the panel lists the day's quietest and loudest cities.
function ranking() {
  const box = document.getElementById("detail");
  const rows = H.stations.map((s, k) => [s, k]).filter(([s]) => !weak(s) && s.values[cur] !== null)
    .sort((a, b) => a[0].values[cur] - b[0].values[cur]);
  const item = ([s, k]) => {
    const v = s.values[cur], b = binOf(v);
    const li = el("li", {}, el("span", { class: "sw", style: `background: var(${BINS[b].v})` }), " ");
    const a = el("a", { href: "#" }, s.city);
    a.addEventListener("click", (e) => { e.preventDefault(); select(k, true); });
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    li.append(a, ` ${sign}${Math.abs(v)}%`);
    const h = holidayOf(s, cur);
    if (h) li.append(el("span", { class: "note" }, ` · ${h}`));
    return li;
  };
  const quiet = rows.filter(([s]) => s.values[cur] <= -5).slice(0, 6);
  const loud = rows.filter(([s]) => s.values[cur] >= 5).reverse().slice(0, 6);
  const list = (r) => (r.length ? el("ul", { class: "rank" }, ...r.map(item)) : el("p", { class: "note" }, "None."));
  box.replaceChildren(
    el("h2", { style: "margin-top:14px;font-size:17px" }, `${weekdayOf(cur)}, ${fmtLongDate(dateOf(cur))}`),
    el("p", { class: "note" }, "Clearly-measured cities, vs the same weekday over the previous 8 weeks."),
    el("p", { class: "chart-title" }, "Quieter than usual (most first)"),
    list(quiet),
    el("p", { class: "chart-title" }, "Louder than usual"),
    list(loud),
    el("p", { class: "note" }, "Click a city, or a dot on the globe, to see its whole year."));
}

// ---------- legend, links, start ----------
function legend() {
  const lg = document.getElementById("legend");
  const items = BINS.map((b) => el("span", { class: "lg" },
    el("span", { class: "sw", style: `background: var(${b.v})` }), b.label));
  items.push(el("span", { class: "lg" }, el("span", { class: "sw-hollow" }), "no data"));
  items.push(el("span", { class: "lg" }, el("span", { class: "sw", style: "background: var(--div-0); opacity:.4" }), "faded = weak weekly signal"));
  lg.replaceChildren(...items);
}

function writeHash() {
  const h = `#${dateOf(cur)}${sel >= 0 ? "/" + H.stations[sel].id : ""}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

function readHash() {
  const m = /^#(\d{4}-\d{2}-\d{2})(?:\/(.+))?$/.exec(decodeURIComponent(location.hash));
  if (!m) return null;
  const i = indexOf(m[1]);
  const k = m[2] ? H.stations.findIndex((s) => s.id === m[2]) : -1;
  return { i: Number.isNaN(i) ? null : i, k };
}

async function main() {
  H = await (await fetch("data/history.json")).json();
  T0 = Date.parse(H.start + "T00:00:00Z");
  H.n = H.stations[0].values.length - 1;
  const slider = document.getElementById("slider");
  slider.max = H.n;
  slider.addEventListener("input", () => setDate(Number(slider.value), { keepCalendar: true }));
  document.getElementById("back").addEventListener("click", () => setDate(cur - 1, { keepCalendar: true }));
  document.getElementById("fwd").addEventListener("click", () => setDate(cur + 1, { keepCalendar: true }));
  document.getElementById("wk-back").addEventListener("click", () => setDate(cur - 7, { keepCalendar: true }));
  document.getElementById("wk-fwd").addEventListener("click", () => setDate(cur + 7, { keepCalendar: true }));
  document.getElementById("play").addEventListener("click", play);

  const chips = document.getElementById("chips");
  for (const [d, label] of JUMPS) {
    const b = el("button", { class: "chip" }, label);
    b.addEventListener("click", () => setDate(indexOf(d)));
    chips.append(b);
  }
  const fly = document.getElementById("fly");
  fly.append(el("option", { value: "" }, "Choose a city…"));
  H.stations.map((s, k) => [renamed(s) ? `${s.city} — listed as ${s.paper_city}` : s.city, k])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([c, k]) => fly.append(el("option", { value: String(k) }, c)));
  fly.addEventListener("change", () => { if (fly.value !== "") select(Number(fly.value), true); });

  legend();
  initMap();
  const h = readHash();
  setDate(h && h.i !== null ? h.i : H.n);
  if (h && h.k >= 0) map.once("load", () => select(h.k, true));
}

main().catch((e) => {
  document.getElementById("summary").textContent = "Could not load the history data: " + e.message;
});
