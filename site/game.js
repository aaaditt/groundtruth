// "Guess the day": real days from data/game.json (src/export_site_research.py).
"use strict";

let data, deck = [], cur = null, answered = false;
const score = { you: 0, model: 0, n: 0 };
const $ = (id) => document.getElementById(id);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function chart(day) {
  const W = 640, H = 260, L = 58, R = 92, top = 14, base = 222;
  const ref = data.reference[day.station] || {};
  const showRef = $("g-hints").checked;
  const series = [day.shape, ...(showRef ? [ref.weekday, ref.sunday].filter(Boolean) : [])];
  const all = series.flat();
  const lo = Math.min(...all) - 0.05, hi = Math.max(...all) + 0.05;
  const xs = (h) => L + h * (W - L - R) / 23, ys = (v) => base - (v - lo) / (hi - lo) * (base - top);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img",
    "aria-label": `24-hour vibration profile of the mystery day in ${day.city}` });
  for (const h of [0, 6, 12, 18, 23]) {
    s.append(svg("line", { x1: xs(h), x2: xs(h), y1: top, y2: base, class: "gridline" }));
    const t = svg("text", { x: xs(h), y: base + 16, "text-anchor": "middle" });
    t.textContent = `${String(h).padStart(2, "0")}:00`; s.append(t);
  }
  s.append(svg("line", { x1: L, x2: W - R, y1: base, y2: base, class: "axis" }));
  const yl = svg("text", { x: L - 6, y: top + 4, "text-anchor": "end" }); yl.textContent = "busier"; s.append(yl);
  const yq = svg("text", { x: L - 6, y: base, "text-anchor": "end" }); yq.textContent = "quieter"; s.append(yq);
  const labels = [];
  const line = (vals, attrs, label, bold) => {
    s.append(svg("path", { d: vals.map((v, h) => `${h ? "L" : "M"}${xs(h)},${ys(v)}`).join(" "), fill: "none",
      "stroke-linejoin": "round", ...attrs }));
    labels.push({ y: ys(vals[23]) + 4, label, bold });
  };
  if (showRef && ref.weekday) line(ref.weekday, { stroke: "var(--text-muted)", "stroke-width": 1.5 }, "avg. Wed");
  if (showRef && ref.sunday) line(ref.sunday, { stroke: "var(--text-muted)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }, "avg. Sun");
  line(day.shape, { stroke: "var(--series-1)", "stroke-width": 3 }, "this day", true);
  // end labels: push apart so none overlap (at least 14 px between baselines)
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 14);
  for (const l of labels) {
    const t = svg("text", { x: W - R + 6, y: l.y, ...(l.bold ? { "font-weight": "700", style: "fill:var(--text-primary)" } : {}) });
    t.textContent = l.label; s.append(t);
  }
  // hover: hour-by-hour readout
  day.shape.forEach((v, h) => {
    const hit = svg("rect", { x: xs(h) - (W - L - R) / 46, y: top, width: (W - L - R) / 23, height: base - top, fill: "transparent" });
    hover(hit, [`${String(h).padStart(2, "0")}:00 local time`,
      `this day: ${v >= 0 ? "+" : ""}${v.toFixed(2)} (log10, vs the day's own mean)`]);
    s.append(hit);
  });
  $("g-chart").replaceChildren(s);
}

function deal() {
  const holOnly = $("g-holidays").checked;
  if (!deck.length || deck.holOnly !== holOnly) {
    deck = shuffle(data.days.filter((d) => !holOnly || d.holiday));
    deck.holOnly = holOnly;
  }
  cur = deck.pop();
  answered = false;
  $("g-city").textContent = cur.city;
  const d = new Date(cur.date + "T12:00:00Z");
  $("g-when").textContent = `A day in ${d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} · ${cur.station}`;
  $("g-reveal").replaceChildren();
  for (const b of $("g-choices").children) { b.disabled = false; b.className = "btn"; }
  $("g-next").disabled = true;
  chart(cur);
}

function guess(k) {
  if (answered) return;
  answered = true;
  const truth = cur.dow, model = cur.pred_dow;
  score.n++; if (k === truth) score.you++; if (model === truth) score.model++;
  $("s-you").textContent = `${score.you}/${score.n}`;
  $("s-model").textContent = `${score.model}/${score.n}`;
  [...$("g-choices").children].forEach((b, i) => {
    b.disabled = true;
    if (i === truth) b.className = "btn truth";
    else if (i === k) b.className = "btn miss";
  });
  const mark = (ok) => (ok ? "✓" : "✗");
  const lines = [
    el("p", { class: "hero" }, "It was a ", el("strong", {}, DAY_NAMES[truth]), `, ${fmtLongDate(cur.date)}.`),
    el("p", {}, `${mark(k === truth)} You said ${DAY_NAMES[k]}. ${mark(model === truth)} The model said ${DAY_NAMES[model]}` +
      ` (it gave the true day ${pct(cur.p_true_dow)}; weekend ${pct(cur.p_weekend)}).`),
  ];
  if (cur.holiday) lines.push(el("p", { class: "note" }, `★ ${cur.holiday} — a public holiday. ` +
    (cur.p_weekend > .5 ? "The ground went quiet like a weekend, and the model noticed, though it had never been told about holidays."
      : "This one didn't sound like a weekend: many people still went to work.")));
  $("g-reveal").replaceChildren(...lines);
  $("g-next").disabled = false;
  $("g-next").focus();
}

async function main() {
  data = await (await fetch("data/game.json")).json();
  $("g-choices").replaceChildren(...SHORT.map((d, i) => {
    const b = el("button", { class: "btn", type: "button", "aria-label": DAY_NAMES[i] }, d);
    b.addEventListener("click", () => guess(i));
    return b;
  }));
  $("g-legend").replaceChildren(el("span", { class: "lg" }, "Hover the chart for hour-by-hour values. Times are local."));
  $("g-next").addEventListener("click", deal);
  $("g-hints").addEventListener("change", () => cur && chart(cur));
  $("g-holidays").addEventListener("change", deal);
  document.addEventListener("keydown", (e) => {
    const k = "1234567".indexOf(e.key);
    if (k >= 0 && !answered) guess(k);
    else if ((e.key === "Enter" || e.key === "n") && answered) deal();
  });
  deal();
}
main();
