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
