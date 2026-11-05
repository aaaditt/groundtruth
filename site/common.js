// Shared helpers for every City Pulse page. All page text is set with textContent
// (never innerHTML with data), so nothing in the data can inject markup.
"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const tip = document.getElementById("tip");

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}
function svg(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
const pct = (x) => `${Math.round(x * 100)}%`;
const fmtDate = (s) => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB",
  { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtLongDate = (s) => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB",
  { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function showTip(evt, lines) {
  tip.replaceChildren(...lines.map((l, i) => el(i ? "div" : "b", {}, l)));
  tip.style.display = "block";
  const x = Math.min(evt.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.min(evt.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
const hideTip = () => { tip.style.display = "none"; };
function hover(node, lines) {
  node.addEventListener("mousemove", (e) => showTip(e, lines));
  node.addEventListener("mouseleave", hideTip);
  node.addEventListener("focus", () => { const r = node.getBoundingClientRect();
    showTip({ clientX: r.right, clientY: r.top }, lines); });
  node.addEventListener("blur", hideTip);
  node.setAttribute("tabindex", "0");
}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- millimetre chart paper and the pen line (every chart uses these) ----------
// paperGrid draws chart paper behind a chart, aligned to its own axes: `cols` major
// divisions across (24 for a day = one per hour), each split into 5 fine steps (12 minutes),
// with the firmest line every `major` divisions (6 hours). `rows` major divisions up.
function paperGrid(box, { x0, x1, y0, y1, cols = 24, rows = 4, major = 6, fine = 5 }) {
  const g = svg("g", { class: "mm", "aria-hidden": "true" });
  const lines = (cls, n, along) => {
    let d = "";
    for (let k = 0; k <= n; k++) {
      if (along === "x") { const x = (x0 + (x1 - x0) * k / n).toFixed(2); d += `M${x} ${y0}V${y1}`; }
      else { const y = (y0 + (y1 - y0) * k / n).toFixed(2); d += `M${x0} ${y}H${x1}`; }
    }
    g.append(svg("path", { class: cls, d, fill: "none" }));
  };
  lines("mm1", cols * fine, "x"); lines("mm1", rows * fine, "y");
  lines("mm2", cols, "x"); lines("mm2", rows, "y");
  let d3 = "";
  for (let k = 0; k <= cols; k += major) { const x = (x0 + (x1 - x0) * k / cols).toFixed(2); d3 += `M${x} ${y0}V${y1}`; }
  g.append(svg("path", { class: "mm3", d: d3, fill: "none" }));
  box.prepend(g);
  return g;
}
// A smooth line through every point (Catmull-Rom as cubic Béziers): the curve passes
// exactly through each real hourly value, so no number changes, it just reads like ink.
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
