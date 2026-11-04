// Today: the newest day under each city. Reads data/pulse.json (written daily by
// src/pulse.py). One row per city, east to west. All text goes in with textContent
// (helpers in common.js), never innerHTML.
"use strict";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const longDay = (iso) => { const d = new Date(iso + "T00:00:00Z");
  return `${DAY_NAMES[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const shortDay = (iso) => { const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`; };

// The seven weekday letters: darkness = the model's probability, underline = the real day.
function letters(day, city) {
  const box = el("p", { class: "letters", "aria-label": `Model's probability for each weekday in ${city}` });
  const top = Math.max(...day.probs);
  "MTWTFSS".split("").forEach((ch, k) => {
    const cls = [k === day.dow ? "real" : "", k === day.pred_dow ? "pick" : ""].join(" ").trim();
    const sp = el("span", cls ? { class: cls } : {}, ch);
    sp.style.opacity = (0.16 + 0.84 * day.probs[k] / top).toFixed(2);
    hover(sp, [DAY_NAMES[k], `Model's probability: ${pct(day.probs[k])}`, k === day.dow ? "This was the real day" : ""].filter(Boolean));
    box.append(sp);
  });
  box.append(el("span", { class: "pct" }, `${pct(day.probs[day.pred_dow])} on ${DAY_NAMES[day.pred_dow]}`));
  return box;
}

// The recent record: how unusual each day was, with the threshold and flagged days in red.
function record(st) {
  const days = st.days, n = days.length, thr = st.thresholds.anomaly;
  const W = 330, H = 64, step = n > 1 ? (W - 8) / (n - 1) : 0;
  const x = (i) => 4 + i * step;
  const top = Math.max(thr * 1.25, ...days.map((q) => Math.min(q.anomaly, thr * 2)));
  const y = (v) => H - 4 - Math.min(v, top) / top * (H - 10);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img",
    "aria-label": `How unusual each of the last ${n} days was in ${st.city}` });
  days.forEach((q, i) => { if (q.is_weekend)
    s.append(svg("rect", { class: "we", x: x(i) - step / 2, y: 0, width: step, height: H })); });
  s.append(svg("line", { class: "thr", x1: 0, x2: W, y1: y(thr), y2: y(thr), "vector-effect": "non-scaling-stroke" }));
  s.append(svg("path", { class: "tr", "vector-effect": "non-scaling-stroke",
    d: days.map((q, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(q.anomaly).toFixed(1)}`).join("") }));
  const flagged = days.filter((q) => q.anomaly_flag || q.confusion_flag);
  days.forEach((q, i) => {
    if (q.anomaly_flag || q.confusion_flag)
      s.append(svg("line", { class: "fl", x1: x(i), x2: x(i), y1: 0, y2: 8, "vector-effect": "non-scaling-stroke" }));
    const hit = svg("rect", { x: x(i) - step / 2, y: 0, width: Math.max(step, 4), height: H, fill: "transparent" });
    hover(hit, [longDay(q.date), q.summary, q.holiday ? `Holiday: ${q.holiday}` : "",
      (q.anomaly_flag || q.confusion_flag) ? "Broke the city's rhythm" : ""].filter(Boolean));
    s.append(hit);
  });
  const hol = flagged.find((q) => q.holiday);
  const cap = el("p", { class: "cap" }, el("span", {}, `${shortDay(days[0].date)} to ${shortDay(days[n - 1].date)}`),
    el("span", {}, flagged.length
      ? `${flagged.length} day${flagged.length > 1 ? "s" : ""} broke the rhythm${hol ? `, including ${hol.holiday}` : ""}`
      : "No day broke the rhythm"));
  return el("div", { class: "rec" }, s, cap);
}

function liveRow(st) {
  const d = st.days[st.days.length - 1];
  const li = el("li", { class: "row", id: st.id });
  li.append(el("div", {}, el("p", { class: "city" }, st.city), el("p", { class: "when" }, longDay(d.date))));
  const say = el("p", { class: "say" }, d.pred_dow === d.dow
    ? `Looked like a ${DAY_NAMES[d.pred_dow]}, and it was.`
    : `Looked like a ${DAY_NAMES[d.pred_dow]}. It was a ${DAY_NAMES[d.dow]}.`);
  if (d.holiday) say.append(" ", el("i", {}, d.holiday));
  const mid = el("div", {}, say, letters(d, st.city));
  const tr = st.track_record, m = st.model;
  mid.append(el("p", { class: "track" }, `Weekday or weekend, on ${tr ? tr.normal_days : 0} ordinary days since training: `,
    el("b", {}, tr ? pct(tr.weekend_bal_acc) : "not graded yet"),
    ` right, balanced so the rarer weekends count equally (${pct(m.weekend_bal_acc)} in training; a coin flip gets 50%).`));
  if (st.notes.includes("CONTROL"))
    mid.append(el("p", { class: "note" }, "A control: a remote town, here to show what a weak rhythm looks like."));
  if (st.notes.includes("LOCATION"))
    mid.append(el("p", { class: "note" }, "The sensor sits in the Hajar mountains near Kalba, about 90 km east of Sharjah city; “Sharjah” is the operator's site name."));
  li.append(mid, record(st));
  // the last two weeks as a table, for screen readers and anyone who wants the numbers
  const rows = st.days.slice(-14).reverse().map((x) => el("tr", {},
    el("td", {}, shortDay(x.date)), el("td", {}, DAY_NAMES[x.pred_dow]), el("td", {}, pct(x.p_weekend)),
    el("td", {}, x.anomaly.toFixed(2)), el("td", {}, (x.anomaly_flag || x.confusion_flag) ? "broke the rhythm" : ""),
    el("td", {}, x.holiday || "")));
  li.append(el("details", {}, el("summary", {}, "The last 14 days as a table"),
    el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {},
      ...["Day", "Looked like", "Chance of weekend", "Unusualness", "", "Holiday"].map((h) => el("th", {}, h)))),
    el("tbody", {}, ...rows)))));
  return li;
}

function quietRow(st) {
  return el("li", { class: "row", id: st.id },
    el("div", {}, el("p", { class: "city" }, st.city), el("p", { class: "when" }, "No reading")),
    el("p", { class: "off" }, st.status === "offline"
      ? "This station has stopped sending data. We show nothing rather than an estimate."
      : (st.error || "Not connected yet: its data need a different download route.")));
}

const PRED_TEXT = { weekend: "looks like a weekend", workday: "looks like a working day", unusual: "breaks the rhythm" };
const STATUS = { correct: ["ok", "correct"], wrong: ["unusual", "wrong"], pending: ["nodata", "waiting for data"],
  "no data": ["nodata", "no data"] };

function predictionsBoard(preds) {
  const graded = preds.filter((p) => p.status === "correct" || p.status === "wrong");
  const right = graded.filter((p) => p.status === "correct").length;
  const head = el("p", { class: "hero" }, graded.length
    ? `${right} of ${graded.length} graded predictions right so far, ${preds.length - graded.length} still to come.`
    : `${preds.length} predictions waiting for their day.`);
  const rows = preds.map((p) => {
    const [kind, label] = STATUS[p.status] || ["nodata", p.status];
    const tr = el("tr", {}, el("td", {}, shortDay(p.date)), el("td", {}, p.city || p.station),
      el("td", {}, p.event), el("td", {}, PRED_TEXT[p.prediction] || p.prediction),
      el("td", {}, el("span", { class: `badge ${kind}` }, el("span", { class: "dot", "aria-hidden": "true" }), label)));
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
    document.getElementById("meta").textContent = "Could not load today's data. Reload the page to try again.";
    return;
  }
  const g = new Date(data.generated_utc);
  const hhmm = `${String(g.getUTCHours()).padStart(2, "0")}:${String(g.getUTCMinutes()).padStart(2, "0")}`;
  document.getElementById("meta").textContent =
    `Updated ${g.getUTCDate()} ${MONTHS[g.getUTCMonth()]} ${g.getUTCFullYear()} at ${hhmm} UTC. ` +
    `Model ${data.model_version}, trained ${shortDay(data.train_window[0])} ${data.train_window[0].slice(0, 4)} ` +
    `to ${shortDay(data.train_window[1])} ${data.train_window[1].slice(0, 4)}; it has never seen these days.`;
  const live = data.stations.filter((s) => s.status === "live" && s.days.length).sort((a, b) => b.lon - a.lon);
  const rest = data.stations.filter((s) => !(s.status === "live" && s.days.length));
  document.getElementById("rows").append(...live.map(liveRow), ...rest.map(quietRow));
  document.getElementById("after").append(
    el("p", {}, "The line on the right is each city's recent record: how far each day was from its normal rhythm. ",
      "Red marks are days the model flagged: further from normal than the dashed line, or so unlike any weekday ",
      "that it could not place them. Shaded columns are weekends. One red mark means little; a cluster means something."));
  if (data.predictions) predictionsBoard(data.predictions);
}
main();
