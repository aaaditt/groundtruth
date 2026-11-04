// City Pulse dashboard. Reads data/pulse.json (written daily by src/pulse.py) and draws
// one card per station. Plain JavaScript + SVG (helpers in common.js); the only
// library is Leaflet (map).
"use strict";

// "Which day did it look like?" -- 7 bars for one day, the true day marked.
function probChart(day, names) {
  const W = 320, H = 118, top = 16, base = 88, bw = 30, gap = (W - 7 * bw) / 8;
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img",
    "aria-label": `Model probabilities for ${fmtDate(day.date)}` });
  s.append(svg("line", { x1: 0, x2: W, y1: base, y2: base, class: "axis" }));
  day.probs.forEach((p, k) => {
    const x = gap + k * (bw + gap), h = Math.max(p * (base - top), p > 0 ? 2 : 0);
    // rounded top, square bottom (anchored to the baseline)
    const r = Math.min(4, h);
    const d = `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + bw - r} ` +
              `Q${x + bw},${base - h} ${x + bw},${base - h + r} V${base} Z`;
    s.append(svg("path", { d, fill: "var(--series-1)" }));
    if (p >= 0.1) {
      const t = svg("text", { x: x + bw / 2, y: base - h - 4, "text-anchor": "middle" });
      t.textContent = pct(p); s.append(t);
    }
    const lab = svg("text", { x: x + bw / 2, y: base + 14, "text-anchor": "middle" });
    lab.textContent = SHORT[k];
    if (k === day.dow) { lab.setAttribute("font-weight", "700"); lab.setAttribute("style", "fill:var(--text-primary)"); }
    s.append(lab);
    if (k === day.dow) {
      const a = svg("text", { x: x + bw / 2, y: base + 27, "text-anchor": "middle" });
      a.textContent = "▲ actual"; s.append(a);
    }
    const hit = svg("rect", { x: x - gap / 2, y: 0, width: bw + gap, height: H, fill: "transparent" });
    hover(hit, [names[k], `Model's probability: ${pct(p)}`, k === day.dow ? "This was the actual day" : ""].filter(Boolean));
    s.append(hit);
  });
  return s;
}

// "How unusual was each day?" -- anomaly score over time, 95% line, flagged days marked.
function timeline(days, thr) {
  const W = 320, H = 130, L = 26, R = 6, top = 10, base = 100;
  const n = days.length, xs = (i) => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const ymax = Math.max(thr * 1.4, ...days.map((d) => d.anomaly)) * 1.05;
  const ys = (v) => base - (v / ymax) * (base - top);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img",
    "aria-label": "Daily unusualness score with the threshold for unusual days" });
  for (const v of [0, Math.round(ymax / 2), Math.floor(ymax)]) {
    s.append(svg("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: v ? "gridline" : "axis" }));
    const t = svg("text", { x: L - 4, y: ys(v) + 4, "text-anchor": "end" }); t.textContent = v; s.append(t);
  }
  s.append(svg("line", { x1: L, x2: W - R, y1: ys(thr), y2: ys(thr), stroke: "var(--text-muted)",
    "stroke-dasharray": "4 3", "stroke-width": 1 }));
  s.append(svg("path", { d: days.map((d, i) => `${i ? "L" : "M"}${xs(i)},${ys(d.anomaly)}`).join(" "),
    fill: "none", stroke: "var(--series-1)", "stroke-width": 2, "stroke-linejoin": "round" }));
  days.forEach((d, i) => {
    // filled dot: the day's sound was unusual (above the line).
    // hollow ring: the sound was ordinary, but the model could not tell which day it was.
    if (d.anomaly_flag)
      s.append(svg("circle", { cx: xs(i), cy: ys(d.anomaly), r: 4.5, fill: "var(--status-critical)",
        stroke: "var(--surface-1)", "stroke-width": 2 }));
    else if (d.confusion_flag)
      s.append(svg("circle", { cx: xs(i), cy: ys(d.anomaly), r: 4, fill: "var(--surface-1)",
        stroke: "var(--status-critical)", "stroke-width": 2 }));
    if (d.holiday) {
      const h = svg("text", { x: xs(i), y: base + 12, "text-anchor": "middle" }); h.textContent = "H"; s.append(h);
    }
  });
  for (const i of [0, n - 1]) {
    if (i < 0) continue;
    const t = svg("text", { x: xs(i), y: base + 26, "text-anchor": i ? "end" : "start" });
    t.textContent = fmtDate(days[i].date); s.append(t);
  }
  days.forEach((d, i) => {
    const w = n > 1 ? (W - L - R) / (n - 1) : 40;
    const hit = svg("rect", { x: xs(i) - w / 2, y: 0, width: w, height: H, fill: "transparent" });
    hover(hit, [fmtDate(d.date), d.summary, `Unusualness ${d.anomaly.toFixed(2)} (line at ${thr.toFixed(2)})`]);
    s.append(hit);
  });
  return s;
}

function legend() {
  const item = (mark, text) => el("span", { class: "lg" }, mark, text);
  const m = (attrs, tag = "circle") => { const s = svg("svg", { width: 14, height: 10, "aria-hidden": "true" });
    s.append(svg(tag, attrs)); return s; };
  return el("div", { class: "legend" },
    item(m({ x1: 0, x2: 14, y1: 5, y2: 5, stroke: "var(--text-muted)", "stroke-dasharray": "4 3" }, "line"),
      "unusual above this (95% of normal days were below)"),
    item(m({ cx: 7, cy: 5, r: 4, fill: "var(--status-critical)" }), "unusual sound"),
    item(m({ cx: 7, cy: 5, r: 3.5, fill: "none", stroke: "var(--status-critical)", "stroke-width": 1.5 }),
      "model unsure which day it was"),
    item(el("b", {}, "H "), "public holiday"));
}

function badge(kind, text) {
  return el("span", { class: `badge ${kind}` }, el("span", { class: "dot", "aria-hidden": "true" }),
    (kind === "unusual" ? "⚠ " : kind === "ok" ? "✓ " : "– ") + text);
}

function liveCard(st, names) {
  const card = el("section", { class: "card", id: st.id });
  card.append(el("h2", {}, st.city), el("div", { class: "sub" }, `${st.id} · ${st.country}`));
  if (!st.days.length) {
    card.append(badge("nodata", "No data"), el("p", { class: "note" },
      st.error || "No complete days yet."));
    return card;
  }
  const d = st.days[st.days.length - 1];
  const unusual = d.anomaly_flag || d.confusion_flag;
  card.append(
    el("p", { class: "hero" }, `${fmtDate(d.date)} looked like a `,
      el("strong", {}, names[d.pred_dow]), ` (${pct(d.probs[d.pred_dow])})`),
    badge(unusual ? "unusual" : "ok", unusual ? "Unusual day" : "Normal rhythm"),
    el("p", { class: "note" }, d.summary),
    el("div", { class: "chart-title" }, "Which day did it look like?"),
    probChart(d, names),
    el("div", { class: "chart-title" }, `How unusual was each day? (since ${fmtDate(st.days[0].date)})`),
    timeline(st.days, st.thresholds.anomaly),
    legend());
  const tr = st.track_record, m = st.model;
  const rec = el("div", { class: "record" });
  rec.append("Weekday vs weekend on new normal days: ", el("b", {}, tr ? pct(tr.weekend_bal_acc) : "–"),
    ` (${tr ? tr.normal_days : 0} days); exact day `, el("b", {}, tr ? pct(tr.dow_acc) : "–"),
    `. In training (weeks held out): ${pct(m.weekend_bal_acc)} / ${pct(m.dow_acc)}. Chance: 50% / 14%.`);
  card.append(rec);
  // table view of the last 14 days (accessible alternative to the charts)
  const rows = st.days.slice(-14).reverse().map((x) => el("tr", {},
    el("td", {}, fmtDate(x.date)), el("td", {}, names[x.pred_dow]), el("td", {}, pct(x.p_weekend)),
    el("td", {}, x.anomaly.toFixed(2)), el("td", {}, (x.anomaly_flag || x.confusion_flag) ? "⚠ unusual" : ""),
    el("td", {}, x.holiday || "")));
  card.append(el("details", {}, el("summary", {}, "Last 14 days as a table"),
    el("table", {}, el("thead", {}, el("tr", {}, ...["Day", "Looked like", "P(weekend)", "Unusual-ness", "", "Holiday"]
      .map((h) => el("th", {}, h)))), el("tbody", {}, ...rows))));
  if (st.notes.includes("LOCATION") || st.notes.includes("CONTROL"))
    card.append(el("p", { class: "note" }, st.notes.includes("CONTROL")
      ? "Control station: a remote town, included to show what little rhythm looks like."
      : "The sensor sits ~90 km east of Sharjah city; 'Sharjah' is the operator's site name."));
  return card;
}

function offlineCard(st) {
  const card = el("section", { class: "card", id: st.id });
  card.append(el("h2", {}, st.city), el("div", { class: "sub" }, `${st.id} · ${st.country}`),
    badge("nodata", st.status === "offline" ? "Offline – no data" : "Not connected yet"),
    el("p", { class: "note" }, st.status === "offline"
      ? "This station has stopped sending data. We show nothing rather than an estimate."
      : "Data for this station needs a different download route, not built yet."));
  return card;
}

function drawMap(stations) {
  if (typeof L === "undefined") { document.getElementById("map").remove(); return; }
  const map = L.map("map", { scrollWheelZoom: false, worldCopyJump: true }).setView([20, 0], 1);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 6,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  const css = getComputedStyle(document.documentElement);
  for (const st of stations) {
    const live = st.days.length > 0, last = live ? st.days[st.days.length - 1] : null;
    const bad = last && (last.anomaly_flag || last.confusion_flag);
    const m = L.circleMarker([st.lat, st.lon], { radius: 8, weight: 2,
      color: css.getPropertyValue("--surface-1").trim() || "#fff",
      fillColor: live ? css.getPropertyValue(bad ? "--status-critical" : "--series-1").trim() : "#9a998f",
      fillOpacity: live ? 1 : 0.6 }).addTo(map);
    const pop = el("div", {}, el("b", {}, st.city), el("br"),
      live ? `Latest: ${fmtDate(last.date)}${bad ? " · unusual" : ""}` : "No data");
    m.bindPopup(pop);
    m.on("click", () => document.getElementById(st.id).scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

const PRED_TEXT = { weekend: "looks like a weekend", workday: "looks like a working day",
  unusual: "flagged as unusual" };
const STATUS = { correct: ["ok", "✓ correct"], wrong: ["unusual", "✗ wrong"],
  pending: ["nodata", "⏳ waiting for data"], "no data": ["nodata", "– no data"] };

function predictionsBoard(preds) {
  const graded = preds.filter((p) => p.status === "correct" || p.status === "wrong");
  const right = graded.filter((p) => p.status === "correct").length;
  const head = el("p", { class: "hero" }, graded.length
    ? `${right} of ${graded.length} graded predictions correct so far · ${preds.length - graded.length} still to come`
    : `${preds.length} predictions waiting for their day`);
  const rows = preds.map((p) => {
    const [kind, label] = STATUS[p.status];
    const b = el("span", { class: `badge ${kind}` }, el("span", { class: "dot", "aria-hidden": "true" }), label);
    const tr = el("tr", {}, el("td", {}, fmtDate(p.date)), el("td", {}, p.city || p.station),
      el("td", {}, p.event), el("td", {}, PRED_TEXT[p.prediction]), el("td", {}, b));
    hover(tr, [p.event, `Why: ${p.reason}`, p.observed ? `Observed: ${p.observed}` : "Not graded yet"]);
    return tr;
  });
  const table = el("table", {}, el("thead", {}, el("tr", {},
    ...["Date", "City", "Event", "Prediction", "Result"].map((h) => el("th", {}, h)))), el("tbody", {}, ...rows));
  document.getElementById("pred-body").replaceChildren(head, el("div", { class: "scroll" }, table));
}

async function main() {
  let data;
  try {
    const r = await fetch("data/pulse.json", { cache: "no-cache" });
    data = await r.json();
  } catch (e) {
    document.getElementById("meta").textContent = "Could not load today's data.";
    return;
  }
  const latest = data.stations.map((s) => s.latest).filter(Boolean).sort().pop();
  document.getElementById("meta").textContent =
    `Updated ${data.generated_utc.replace("T", " ").replace("Z", " UTC")} · newest day ${latest ? fmtDate(latest) : "–"} ` +
    `(data arrive ~2 days late) · model ${data.model_version}, trained ${data.train_window[0]} to ${data.train_window[1]}`;
  const cards = document.getElementById("cards");
  for (const st of data.stations)
    cards.append(st.status === "live" ? liveCard(st, data.dow_names) : offlineCard(st));
  drawMap(data.stations);
  if (data.predictions) predictionsBoard(data.predictions);
}
main();
