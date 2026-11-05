// Ask the ground (globe.html#ask/<station>/<date>): pick any city and day from 2019 to 2026,
// watch that day's shaking draw as a line, and see which weekday the model thinks it was.
// Every guess comes from data/ask/<station>.json, written by src/ask.py: each day was
// guessed by a model that never trained on that day's week (docs/04, Result 16).
// Uses globe.js's globals (H, map, setDate, dateOf, indexOf) and common.js helpers.
// Text goes in with textContent only.
"use strict";

// opens on an ordinary day the model reads right; Christmas, 12 days later, is the first suggestion
const ASK_DEFAULT = ["BE.UCC..HHZ", "2019-12-13"];
const ASK_FILES = new Map();             // station id -> parsed file, with a day-index lookup
const A = { sid: null, i: null, year: null, f: null, drawing: 0 };
const $a = (id) => document.getElementById(id);
const DOW_LONG = DAY_NAMES;              // Monday first, as in the data
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sound = (name, ...args) => { if (window.GTSound) window.GTSound[name](...args); };

function loadAsk(sid) {
  if (ASK_FILES.has(sid)) return Promise.resolve(ASK_FILES.get(sid));
  return fetch(`data/ask/${encodeURIComponent(sid)}.json`).then((r) => {
    if (!r.ok) throw new Error(`no Ask data for ${sid}`);
    return r.json();
  }).then((f) => {
    f.byDay = new Map(f.days.map((d) => [d[0], d]));
    f.t0 = Date.parse(f.start + "T00:00:00Z");
    ASK_FILES.set(sid, f);
    return f;
  });
}
const rowOf = (f, i) => f.byDay.get(i) || null;            // [i, shape, probs, period, holiday, fold, level]
const dateOfI = (f, i) => new Date(f.t0 + i * 864e5).toISOString().slice(0, 10);
const iOfDate = (f, s) => Math.round((Date.parse(s + "T00:00:00Z") - f.t0) / 864e5);
const dowOf = (f, i) => (new Date(f.t0 + i * 864e5).getUTCDay() + 6) % 7;
function weekendOn(f, i) {
  const d = dateOfI(f, i);
  let days = f.weekend[0][1];
  for (const [since, ds] of f.weekend) if (d >= since) days = ds;
  return days;
}
const longDate = (f, i) => new Date(f.t0 + i * 864e5).toLocaleDateString("en-GB",
  { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// ---------- opening and closing ----------
let spaceHome = null;
function openAsk(sid, dateStr, opts = {}) {
  const st = H.stations.find((s) => s.id === sid);
  if (!st) { [sid, dateStr] = ASK_DEFAULT; }
  const box = $a("ask");
  const opening = box.hidden;
  if (opening) {
    box.hidden = false;
    document.body.classList.add("asking");
    const space = $a("space");
    spaceHome = spaceHome || { parent: space.parentNode, next: space.nextSibling };
    $a("ask-globe").append(space);
    map.resize();
    for (const a of document.querySelectorAll('.bar nav a')) {
      if (a.getAttribute("href") === "globe.html#ask") a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    scrollTo(0, 0);
  }
  return loadAsk(sid).then((f) => {
    let i = iOfDate(f, dateStr || "");
    if (Number.isNaN(i) || i < 0 || i >= (Date.parse(f.end_exclusive + "T00:00:00Z") - f.t0) / 864e5) {
      i = iOfDate(f, sid === ASK_DEFAULT[0] ? ASK_DEFAULT[1] : pickDay(f, "random"));
    }
    const newCity = A.sid !== sid;
    A.sid = sid; A.f = f;
    if (newCity) fillHonest(f);
    ask(i, { fly: newCity || opening, ...opts });
  }).catch(() => {
    if (sid !== ASK_DEFAULT[0]) return openAsk(...ASK_DEFAULT);
    $a("ask-ans").replaceChildren(el("p", { class: "ask-truth" }, "The Ask data could not load. Reload the page to try again."));
  });
}

function closeAsk() {
  const box = $a("ask");
  if (box.hidden) return;
  box.hidden = true;
  document.body.classList.remove("asking");
  if (spaceHome) spaceHome.parent.insertBefore($a("space"), spaceHome.next);
  map.resize();
  for (const a of document.querySelectorAll('.bar nav a')) {
    if (a.getAttribute("href") === "globe.html") a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (location.hash.startsWith("#ask")) history.replaceState(null, "", location.pathname);   // hand the address back
  const k = H.stations.findIndex((s) => s.id === A.sid);
  if (k >= 0) select(k, false); else writeHash();
  sound("whoosh", 0.7, -0.3);
}

// ---------- asking about one day ----------
function ask(i, { fly = false } = {}) {
  const f = A.f, st = H.stations.find((s) => s.id === A.sid);
  A.i = i;
  const ds = dateOfI(f, i);
  $a("ask-city").value = A.sid;
  $a("ask-date-btn").textContent = new Date(f.t0 + i * 864e5).toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  sizeSelect();
  // keep the globe's own date in step (its dots recolour), then own the address
  const gi = indexOf(ds);
  if (!Number.isNaN(gi) && gi >= 0 && gi <= H.n) setDate(gi, { keepCalendar: true });
  history.replaceState(null, "", `#ask/${A.sid}/${ds}`);
  const k = H.stations.findIndex((s) => s.id === A.sid);
  if (k >= 0 && sel !== k) { sel = k; refreshMap(); }
  if (fly && st) {
    map.flyTo({ center: [st.lon, st.lat], zoom: innerWidth < 800 ? 1.25 : 1.75, speed: 0.8, curve: 1.5, essential: true });
    sound("whoosh", 1, st.lon > map.getCenter().lng ? 0.5 : -0.5);
  }
  const y = Number(ds.slice(0, 4));
  if (y !== A.year || fly) drawYear(f, y);
  for (const r of document.querySelectorAll("#ask-cal rect.d")) r.classList.toggle("sel", +r.dataset.i === i);
  drawDay(f, i);
}

function pickDay(f, kind) {
  const scored = f.days.filter((d) => d[2]);
  if (kind === "random" || !scored.length) return dateOfI(f, (scored.length ? scored : f.days)[Math.floor(Math.random() * (scored.length || f.days.length))][0]);
  return null;
}

// suggestions from this city's own record: a Christmas, two of its holidays, a lockdown Monday
function fillTry(f) {
  const out = [];
  const scored = f.days.filter((d) => d[2]);
  const isWeekday = (d) => !weekendOn(f, d[0]).includes(dowOf(f, d[0]));
  const xmas = scored.filter((d) => dateOfI(f, d[0]).slice(5) === "12-25" && isWeekday(d))[0];
  if (xmas) out.push([`Christmas Day ${dateOfI(f, xmas[0]).slice(0, 4)}`, xmas[0]]);
  const seen = new Set(["Christmas Day"]);
  for (const d of [...scored].reverse()) {
    if (out.length >= 3) break;
    if (d[3] === "holiday" && d[4] && !seen.has(d[4]) && isWeekday(d)) { seen.add(d[4]); out.push([`${d[4]} ${dateOfI(f, d[0]).slice(0, 4)}`, d[0]]); }
  }
  const lock = scored.find((d) => dateOfI(f, d[0]) >= "2020-04-01" && d[3] === "lockdown" && dowOf(f, d[0]) === 0);
  if (lock) out.push(["A lockdown Monday", lock[0]]);
  $a("ask-try").replaceChildren(...out.map(([label, i]) => {
    const b = el("button", { class: "chip", type: "button" }, label);
    b.addEventListener("click", () => ask(i));
    return b;
  }));
}

function fillHonest(f) {
  const s = f.scores, n = s.n_scored_baseline;
  const pc = (x) => `${Math.round(x * 100)}%`;
  const parts = [`The model only sees one day’s 24-hour shape and how loud that day was against the 8 weeks before it. ` +
    `It is never told the date, and it never trained on the week it is guessing.`];
  if (n && s.dow_acc !== null) {
    parts.push(` Across ${n.toLocaleString("en-GB")} ordinary days in ${f.city}, it named the exact weekday ${pc(s.dow_acc)} of ` +
      `the time (chance is 14%) and told a weekday from a weekend ${pc(s.weekend_bal_acc)} of the time.`);
  }
  if (f.country === "AE") parts.push(" The UAE moved its weekend from Friday–Saturday to Saturday–Sunday in January 2022; answers use the weekend in force on each date.");
  parts.push(` The record runs to 30 September 2026; newer days are on `);
  const p = $a("ask-honest");
  p.replaceChildren(parts.join(""), el("a", { href: "today.html" }, "Today"), ".");
  fillTry(f);
}

// ---------- the year: one column per week, Monday at the top ----------
const levelBin = (v) => v === null ? -1 : v <= -3 ? 0 : v <= -1.5 ? 1 : v <= -0.5 ? 2 : v < 0.5 ? 3 : v < 1.5 ? 4 : v < 3 ? 5 : 6;
const LEVEL_VARS = ["--div-n3", "--div-n2", "--div-n1", "--div-0", "--div-p1", "--div-p2", "--div-p3"];
// colour: the day's level minus the median level of the days within four weeks either side,
// so slow seasonal drift drops out and the weekly rhythm (the weekends) shows
function localLevels(f, i0, i1) {
  const out = new Map();
  for (let i = i0; i < i1; i++) {
    const r = rowOf(f, i);
    if (!r || r[6] === null) continue;
    const near = [];
    for (let k = i - 28; k <= i + 28; k++) { const q = rowOf(f, k); if (q && q[6] !== null) near.push(q[6]); }
    near.sort((p, q) => p - q);
    out.set(i, r[6] - near[near.length >> 1]);
  }
  return out;
}
function drawYear(f, year) {
  A.year = year;
  const city = f.city;
  $a("ask-yt").textContent = `${city}, every day of ${year}`;
  const ys = $a("ask-years");
  const last = Number(f.end_exclusive.slice(0, 4)) - (f.end_exclusive.slice(5) === "01-01" ? 1 : 0);
  ys.replaceChildren();
  for (let y = Number(f.start.slice(0, 4)); y <= last; y++) {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(y === year) }, String(y));
    b.addEventListener("click", () => {
      const want = `${y}${dateOfI(f, A.i).slice(4)}`;
      let i = iOfDate(f, want);
      if (!rowOf(f, i) || !rowOf(f, i)[2]) {          // nearest scored day in that year
        const inYear = f.days.filter((d) => d[2] && dateOfI(f, d[0]).startsWith(String(y)));
        if (inYear.length) i = inYear.reduce((a, d) => Math.abs(d[0] - i) < Math.abs(a[0] - i) ? d : a)[0];
      }
      ask(i);
    });
    ys.append(b);
  }
  const cal = $a("ask-cal");
  cal.replaceChildren();
  const tall = innerWidth < 700;                      // phones: one ROW per week, weekdays across
  A.tall = tall;
  const cell = tall ? 34 : 15, gap = tall ? 5 : 3, pitch = cell + gap, left = tall ? 46 : 34, top = tall ? 26 : 20;
  const jan1 = iOfDate(f, `${year}-01-01`), offset = dowOf(f, jan1);
  const nDays = iOfDate(f, `${year + 1}-01-01`) - jan1;
  const weeks = Math.ceil((nDays + offset) / 7);
  const W = tall ? left + 7 * pitch : left + weeks * pitch, Hh = tall ? top + weeks * pitch : top + 7 * pitch;
  cal.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  cal.setAttribute("aria-label", `${city}, ${year}: one square per day, coloured by how loud the day was`);
  cal.style.minWidth = tall ? "" : `${Math.round(W * 0.72)}px`;
  cal.style.maxWidth = tall ? "340px" : "";
  const heads = tall ? [[0, "M"], [1, "T"], [2, "W"], [3, "T"], [4, "F"], [5, "S"], [6, "S"]] : [[0, "Mon"], [3, "Thu"], [6, "Sun"]];
  for (const [k, t] of heads) {
    const e = tall ? svg("text", { x: left + k * pitch + cell / 2, y: top - 8, class: "dl", "text-anchor": "middle" })
      : svg("text", { x: 0, y: top + k * pitch + cell - 3, class: "dl" });
    e.textContent = t; cal.append(e);
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const end = (Date.parse(f.end_exclusive + "T00:00:00Z") - f.t0) / 864e5;
  const rel = localLevels(f, jan1, jan1 + nDays);
  for (let n = 0; n < nDays; n++) {
    const i = jan1 + n, slot = n + offset, wk = Math.floor(slot / 7), dw = slot % 7;
    const x = tall ? left + dw * pitch : left + wk * pitch, y = tall ? top + wk * pitch : top + dw * pitch;
    const d = dateOfI(f, i);
    if (d.slice(8) === "01") {
      const t = tall ? svg("text", { x: 0, y: y + cell - 10, class: "ml" }) : svg("text", { x, y: top - 6, class: "ml" });
      t.textContent = months[Number(d.slice(5, 7)) - 1]; cal.append(t);
    }
    if (i >= end) continue;
    const r = rowOf(f, i);
    const rect = svg("rect", { x, y, width: cell, height: cell, rx: tall ? 4 : 2, class: r ? "d" : "d none", "data-i": i,
      tabindex: "0", role: "button", "aria-label": `${longDate(f, i)}${r && r[4] ? `, ${r[4]}` : ""}` });
    if (r) {
      const b = levelBin(rel.has(i) ? rel.get(i) : null);
      rect.setAttribute("style", b < 0 ? "fill: var(--div-0); opacity: .35" : `fill: var(${LEVEL_VARS[b]})`);
    }
    if (!reduceMotion) rect.style.animationDelay = `${wk * 9}ms`;
    rect.addEventListener("click", () => ask(i));
    rect.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ask(i); } });
    cal.append(rect);
    if (r && r[4]) cal.append(svg("circle", { cx: x + cell / 2, cy: y + cell / 2, r: tall ? 3.5 : 2, class: "hol" }));
  }
}

// ---------- the day: the pen line, then the answer ----------
function drawDay(f, i) {
  const box = $a("ask-svg"), ans = $a("ask-ans"), r = rowOf(f, i), token = ++A.drawing;
  box.replaceChildren();
  ans.replaceChildren();
  const real = dowOf(f, i);
  if (!r) {
    $a("ask-legend").textContent = "";
    ans.append(el("p", { class: "ask-says" }, "No recording that day."),
      el("p", { class: "ask-truth" }, `The seismometer under ${f.city} has no usable data for ${longDate(f, i)}: it was offline, ` +
        "or recorded fewer than 20 hours. Pick another square."));
    return;
  }
  const [, shape, probs, period, holiday] = r;
  const guess = probs ? probs.indexOf(Math.max(...probs)) : null;
  // comparison lines: a usual day of the real weekday, and of the guessed one (or a Sunday)
  const other = guess !== null && guess !== real ? guess : (real === 6 ? 2 : 6);
  const ghosts = [[real, "ghost-weekday"], [other, "ghost-weekend"]];
  // phones get a narrower drawing, so the line is taller and the labels readable
  const narrow = innerWidth < 1000, W = narrow ? 600 : 1200, L = 6, R = W - (narrow ? 128 : 104), T = 18, B = 228;
  box.setAttribute("viewBox", `0 0 ${W} 270`);
  const all = [...shape, ...f.usual[real], ...f.usual[other]];
  const lo = Math.min(...all) - 0.04, hi = Math.max(...all) + 0.04;
  const x = (h) => L + h * (R - L) / 23, y = (v) => B - (v - lo) / (hi - lo) * (B - T);
  paperGrid(box, { x0: L, x1: R, y0: T, y1: B, cols: 23, rows: 4 });
  for (const h of [0, 6, 12, 18]) {
    const t = svg("text", { x: x(h) + 4, y: B + 22, class: "ax" }); t.textContent = hourLabel12(h); box.append(t);
  }
  for (const [dw, cls] of ghosts) {
    box.append(svg("path", { class: cls, d: smoothPath(f.usual[dw].map((v, h) => [x(h), y(v)])) }));
    const t = svg("text", { x: R + 10, y: y(f.usual[dw][23]) + 4, class: "gl " + cls }); t.textContent = `usual ${SHORT[dw]}`;
    box.append(t);
  }
  const pen = svg("path", { class: "pen-glow", d: smoothPath(shape.map((v, h) => [x(h), y(v)])), pathLength: 1 });
  box.append(pen);
  const end = svg("text", { x: R + 10, y: y(shape[23]) + 4, class: "gl me" }); end.textContent = "this day"; box.append(end);
  spreadLabels(box);
  $a("ask-legend").textContent = `${longDate(f, i)} under ${f.city}, midnight to midnight, local time. ` +
    `Dashed: a usual ${DOW_LONG[real]} at this seismometer. Dotted: a usual ${DOW_LONG[other]}.`;
  const ms = reduceMotion ? 0 : 1500;
  if (ms) {
    pen.classList.add("drawing");
    pen.style.animationDuration = `${ms}ms`;
    sound("scratch", ms);
  }
  setTimeout(() => { if (token === A.drawing) answer(f, i, r, guess, real); }, ms + 150);
}
function hourLabel12(h) { return h === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h} a.m.` : `${h - 12} p.m.`; }
// keep the right-hand labels from sitting on top of each other
function spreadLabels(box) {
  const labels = [...box.querySelectorAll("text.gl")].sort((a, b) => +a.getAttribute("y") - +b.getAttribute("y"));
  for (let k = 1; k < labels.length; k++) {
    const prev = +labels[k - 1].getAttribute("y"), cur = +labels[k].getAttribute("y");
    if (cur - prev < 20) labels[k].setAttribute("y", prev + 20);
  }
}

function answer(f, i, r, guess, real) {
  const [, , probs, period, holiday] = r;
  const ans = $a("ask-ans");
  if (!probs) {
    ans.append(el("p", { class: "ask-says" }, "No guess for this day."),
      el("p", { class: "ask-truth" }, `It was a ${DOW_LONG[real]}${holiday ? `: ${holiday}` : ""}. There were too few ordinary ` +
        "days in the 8 weeks before it to judge how loud it was, so the model was not asked."));
    return;
  }
  const we = weekendOn(f, i);
  const pWeekend = we.reduce((a, d) => a + probs[d], 0);
  const realIsWeekend = we.includes(real), guessIsWeekend = we.includes(guess);
  const says = el("p", { class: "ask-says" }, "It reads like a ", el("em", {}, DOW_LONG[guess]), ".");
  let verdict;
  if (guess === real) verdict = "The model got the exact day.";
  else if (holiday && !realIsWeekend && guessIsWeekend) verdict = "The city took the day off, and the ground shows it.";
  else if (guessIsWeekend === realIsWeekend) verdict = `Not the exact day, but the right kind: a ${realIsWeekend ? "weekend" : "working"} day.`;
  else verdict = "The model got this one wrong.";
  const truth = el("p", { class: "ask-truth" }, el("b", {}, `It was a ${DOW_LONG[real]}${holiday ? `: ${holiday}` : ""}.`), ` ${verdict}`);
  const bars = el("div", { class: "ask-bars", role: "img",
    "aria-label": `The model's confidence for each weekday: ${probs.map((p, k) => `${DOW_LONG[k]} ${p}%`).join(", ")}` });
  probs.forEach((p, k) => {
    const col = el("div", { class: `wd${k === guess ? " guess" : ""}${k === real ? " real" : ""}` });
    const fill = el("span", { class: "fill" });
    fill.style.height = `${Math.max(2, p)}%`;
    col.append(el("span", { class: "pct" }, `${p}%`), el("span", { class: "col" }, fill), el("span", { class: "lab" }, SHORT[k]));
    bars.append(col);
  });
  const extra = [];
  const second = probs.map((p, k) => [p, k]).filter(([, k]) => k !== guess).sort((p, q) => q[0] - p[0])[0];
  extra.push(`The model put ${probs[guess]}% on ${DOW_LONG[guess]}` + (second[0] >= 5 ? ` and ${second[0]}% on ${DOW_LONG[second[1]]}` : "") + ".");
  if (guessIsWeekend && !realIsWeekend) extra.push(` In all, ${pWeekend}% on the weekend days: to the ground, this was a day off.`);
  else if (!guessIsWeekend && realIsWeekend) extra.push(` Only ${pWeekend}% on the weekend days: to the ground, this looked like a working day.`);
  if (period === "lockdown") extra.push(" This day is in the spring 2020 lockdown window, which the model never trained on.");
  else if (period === "festive") extra.push(" Between 21 December and 6 January the model never trains, because cities run on holiday rhythms.");
  ans.append(says, truth, bars, el("p", { class: "ask-why" }, extra.join("")));
  sound("chime");
}

// ---------- the controls ----------
function sizeSelect() {
  const s = $a("ask-city"), c = sizeSelect.c || (sizeSelect.c = document.createElement("canvas").getContext("2d"));
  const cs = getComputedStyle(s);
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  s.style.width = `${Math.ceil(c.measureText(s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : "").width + 40)}px`;
}

function initAsk() {
  const sel = $a("ask-city");
  H.stations.map((s) => [s.city, s.id]).sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([c, id]) => sel.append(el("option", { value: id }, c)));
  sel.addEventListener("change", () => openAsk(sel.value, A.f ? dateOfI(A.f, A.i) : ""));
  // the date: a small panel under the date with day, month and year (anchored, keyboard-friendly)
  const pop = $a("datepop"), dbtn = $a("ask-date-btn"), dd = $a("dp-day"), dm = $a("dp-month"), dy = $a("dp-year");
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];
  for (let d = 1; d <= 31; d++) dd.append(el("option", { value: String(d) }, String(d)));
  MONTHS_LONG.forEach((m, k) => dm.append(el("option", { value: String(k + 1) }, m)));
  const lastDay = new Date(Date.parse(H.end_exclusive + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
  for (let y = Number(H.start.slice(0, 4)); y <= Number(lastDay.slice(0, 4)); y++) dy.append(el("option", { value: String(y) }, String(y)));
  const openPop = (open) => {
    pop.hidden = !open;
    dbtn.setAttribute("aria-expanded", String(open));
    if (open && A.f) {
      const ds = dateOfI(A.f, A.i);
      dy.value = String(Number(ds.slice(0, 4))); dm.value = String(Number(ds.slice(5, 7))); dd.value = String(Number(ds.slice(8)));
      dd.focus();
    }
  };
  dbtn.addEventListener("click", (e) => { e.stopPropagation(); openPop(pop.hidden); });
  $a("dp-go").addEventListener("click", () => {
    const y = Number(dy.value), m = Number(dm.value);
    const d = Math.min(Number(dd.value), new Date(Date.UTC(y, m, 0)).getUTCDate());   // 31 June becomes 30 June
    let ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (ds > lastDay) ds = lastDay;
    if (ds < H.start) ds = H.start;
    openPop(false);
    if (A.f) ask(iOfDate(A.f, ds));
    dbtn.focus();
  });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); openPop(false); dbtn.focus(); } });
  document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest(".datewrap")) openPop(false); });
  $a("ask-close").addEventListener("click", closeAsk);
  $a("ask-random").addEventListener("click", () => { if (A.f) ask(iOfDate(A.f, pickDay(A.f, "random"))); });
  addEventListener("keydown", (e) => {
    if ($a("ask").hidden || e.target.closest("input, select, .datepop")) return;
    if (e.key === "Escape") closeAsk();
    if (A.f && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const next = A.i + (e.key === "ArrowLeft" ? -1 : 1);
      const end = (Date.parse(A.f.end_exclusive + "T00:00:00Z") - A.f.t0) / 864e5;
      if (next >= 0 && next < end) ask(next);              // the record runs 2019-01-01 to 2026-09-30
    }
  });
  addEventListener("resize", () => {
    sizeSelect();
    // phones and wider screens lay the year out differently: redraw when that changes
    if (A.f && A.year !== null && (innerWidth < 700) !== A.tall) { drawYear(A.f, A.year); ask(A.i); }
  });
  if (document.fonts) document.fonts.ready.then(sizeSelect);
  const route = () => {
    const m = /^#ask(?:\/([^/]+)\/(\d{4}-\d{2}-\d{2}))?$/.exec(decodeURIComponent(location.hash));
    if (m) { openAsk(m[1] || ASK_DEFAULT[0], m[2] || (m[1] ? "" : ASK_DEFAULT[1])); return; }
    if (!$a("ask").hidden) {                      // the address left Ask (Back button, a globe link)
      const g = /^#(\d{4}-\d{2}-\d{2})(?:\/(.+))?$/.exec(decodeURIComponent(location.hash));
      closeAsk();
      if (g) {
        const i = indexOf(g[1]), k = g[2] ? H.stations.findIndex((s) => s.id === g[2]) : -1;
        if (!Number.isNaN(i) && i >= 0 && i <= H.n) setDate(i);
        if (k >= 0) select(k, true);
      }
    }
  };
  addEventListener("hashchange", route);
  route();
}
document.addEventListener("globe:ready", initAsk);
