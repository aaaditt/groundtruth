// Research page: the 158-station map (data/stations_2020.json) and the band test (data/bands.json).
"use strict";

// Ordinal blue ramp, light -> dark (lightest step still clears 2:1 on the light surface).
const BINS = [
  { lo: 0, hi: .6, color: "#86b6ef", label: "under 60%" },
  { lo: .6, hi: .8, color: "#5598e7", label: "60–80%" },
  { lo: .8, hi: .9, color: "#2a78d6", label: "80–90%" },
  { lo: .9, hi: 1, color: "#1c5cab", label: "90–99%" },
  { lo: 1, hi: 1.01, color: "#0d366b", label: "100%" },
];
const binOf = (v) => BINS.find((b) => v >= b.lo && v < b.hi) || BINS[BINS.length - 1];
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };

function tiles(st) {
  const m = st.filter((s) => s.weekend_bal_acc !== null);
  const acc = m.map((s) => s.weekend_bal_acc);
  const items = [[String(m.length), "cities with a model"], [pct(median(acc)), "median weekday vs weekend"],
    [String(acc.filter((a) => a >= .9).length), "cities at 90% or better"],
    [pct(median(m.map((s) => s.dow_acc))), "median exact day (chance 14%)"]];
  document.getElementById("tiles").replaceChildren(...items.map(([v, l]) =>
    el("div", { class: "tile" }, el("div", { class: "big" }, v), el("div", { class: "small" }, l))));
}

function drawMap(st) {
  if (typeof L === "undefined") return;
  const map = L.map("rmap", { scrollWheelZoom: false, worldCopyJump: true }).setView([25, 10], 2);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 8,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  // draw the best last, so strong stations sit on top in dense regions
  const sorted = [...st].sort((a, b) => (a.weekend_bal_acc ?? -1) - (b.weekend_bal_acc ?? -1));
  for (const s of sorted) {
    const has = s.weekend_bal_acc !== null;
    const mk = L.circleMarker([s.lat, s.lon], { radius: 6, weight: 1.5, color: "#ffffff",
      fillColor: has ? binOf(s.weekend_bal_acc).color : "#9a998f", fillOpacity: has ? 1 : .7 }).addTo(map);
    const pop = el("div", {}, el("b", {}, `${s.city}, ${s.country}`), el("br"), s.code, el("br"),
      has ? `Weekday vs weekend ${pct(s.weekend_bal_acc)} · exact day ${pct(s.dow_acc)}` : `Too few normal days for a model (${s.days} days)`);
    mk.bindPopup(pop);
    mk.on("mouseover", () => mk.openPopup());
  }
  const lg = BINS.map((b) => el("span", { class: "lg" }, el("span", { class: "sw", style: `background:${b.color}` }), b.label));
  lg.push(el("span", { class: "lg" }, el("span", { class: "sw", style: "background:#9a998f" }), "no model"));
  document.getElementById("rlegend").replaceChildren(...lg);
}

function bandChart(rows, col, title, chance) {
  const bands = [...new Set(rows.map((r) => r.band))];
  const W = 420, H = 230, L = 40, R = 12, top = 26, base = 190;
  const ymin = col === "dow_acc" ? 0 : .4, ymax = 1;
  const xs = (i) => L + i * (W - L - R) / (bands.length - 1), ys = (v) => base - (v - ymin) / (ymax - ymin) * (base - top);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": title });
  const t = svg("text", { x: L, y: 14, style: "fill:var(--text-primary);font-size:13px;font-weight:600" });
  t.textContent = title; s.append(t);
  for (let v = ymin; v <= ymax + 1e-9; v += .2) {
    s.append(svg("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: "gridline" }));
    const lab = svg("text", { x: L - 5, y: ys(v) + 4, "text-anchor": "end" }); lab.textContent = pct(v); s.append(lab);
  }
  s.append(svg("line", { x1: L, x2: W - R, y1: ys(chance), y2: ys(chance), stroke: "var(--status-critical)",
    "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
  const cl = svg("text", { x: W - R, y: ys(chance) - 5, "text-anchor": "end" }); cl.textContent = "chance"; s.append(cl);
  const cities = [...new Set(rows.map((r) => r.city))];
  for (const c of cities) {
    const v = bands.map((b) => rows.find((r) => r.city === c && r.band === b)[col]);
    s.append(svg("path", { d: v.map((y, i) => `${i ? "L" : "M"}${xs(i)},${ys(y)}`).join(" "), fill: "none",
      stroke: "var(--text-muted)", "stroke-width": 1, opacity: .7 }));
    v.forEach((y, i) => { const dot = svg("circle", { cx: xs(i), cy: ys(y), r: 6, fill: "transparent" });
      hover(dot, [c, `${bands[i]}: ${pct(y)}`]); s.append(dot); });
  }
  const med = bands.map((b) => median(rows.filter((r) => r.band === b).map((r) => r[col])));
  s.append(svg("path", { d: med.map((y, i) => `${i ? "L" : "M"}${xs(i)},${ys(y)}`).join(" "), fill: "none",
    stroke: "var(--series-1)", "stroke-width": 3 }));
  med.forEach((y, i) => {
    s.append(svg("circle", { cx: xs(i), cy: ys(y), r: 5, fill: "var(--series-1)", stroke: "var(--surface-1)", "stroke-width": 2 }));
    const lab = svg("text", { x: xs(i), y: base + 16, "text-anchor": "middle" }); lab.textContent = bands[i].replace(" Hz", ""); s.append(lab);
  });
  const hz = svg("text", { x: (L + W - R) / 2, y: base + 32, "text-anchor": "middle" }); hz.textContent = "frequency band (Hz)"; s.append(hz);
  return el("div", {}, s);
}

async function main() {
  const [st, bands] = await Promise.all(["data/stations_2020.json", "data/bands.json"]
    .map((u) => fetch(u).then((r) => r.json())));
  tiles(st);
  drawMap(st);
  document.getElementById("bands").replaceChildren(
    bandChart(bands, "weekend_bal_acc", "Weekday vs weekend", .5),
    bandChart(bands, "dow_acc", "Exact day of the week", 1 / 7));
}
main();
