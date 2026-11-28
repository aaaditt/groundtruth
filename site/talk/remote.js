// The link between the deck and the presenter windows (docs/21, "Presenting online").
//
// The deck (talk/?room=CODE) is the one page the audience sees: it plays the clips and it
// alone decides where the talk is. Presenter windows (talk/?presenter&room=CODE) can be on
// any laptop or phone. They send presses ("next, from slide 7.2") and the deck answers
// with where it is now, so every presenter window shows the same slide, script and clock.
//
// Two roads, used together:
//   BroadcastChannel  windows on the same computer (always on; no internet needed)
//   Supabase Realtime "Broadcast", a chat room for browsers: everyone in channel
//                     talk:CODE hears every message. Nothing is stored, no database table.
//                     Only on when the URL has ?room=CODE and remote-config.json is filled in.
// A message can arrive by both roads, so each one carries an id and repeats are dropped.
// The room code is the only lock: it lives in the URL, never in this repository.
"use strict";

const Link = (() => {
  const params = new URLSearchParams(location.search);
  const room = (params.get("room") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  const local = "BroadcastChannel" in window ? new BroadcastChannel("groundtruth-talk") : null;
  const seen = new Set();             // ids of messages already handled
  const listeners = [];
  let remote = null, status = room ? "connecting" : "local";
  const statusListeners = [];

  const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  function setStatus(s) { status = s; statusListeners.forEach((f) => f(s)); }

  function deliver(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.id) {
      if (seen.has(msg.id)) return;
      seen.add(msg.id);
      if (seen.size > 500) seen.delete(seen.values().next().value);   // keep the memory small
    }
    listeners.forEach((f) => f(msg));
  }
  if (local) local.onmessage = (e) => deliver(e.data);

  // Join the Supabase room. Needs vendor/supabase-*.js (the global `supabase`) and the
  // project's address and publishable key in remote-config.json.
  async function connect() {
    if (!room) return;
    let cfg = {};
    try { cfg = await (await fetch("remote-config.json", { cache: "no-cache" })).json(); } catch (e) { /* no file */ }
    if (!cfg.url || !cfg.key || !window.supabase) { setStatus("off"); return; }
    const client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
    remote = client.channel(`talk:${room}`, { config: { broadcast: { self: false } } });
    remote.on("broadcast", { event: "deck" }, ({ payload }) => deliver(payload));
    remote.subscribe((s) => {
      // SUBSCRIBED = in the room. The library rejoins by itself after a drop.
      setStatus(s === "SUBSCRIBED" ? "online" : s === "CLOSED" ? "off" : "connecting");
    });
  }

  return {
    room,
    get status() { return status; },
    onStatus(f) { statusListeners.push(f); f(status); },
    on(f) { listeners.push(f); },
    send(msg) {
      msg = { ...msg, id: newId() };
      seen.add(msg.id);               // never react to our own message coming back
      if (local) local.postMessage(msg);
      if (remote) remote.send({ type: "broadcast", event: "deck", payload: msg }).catch(() => {});
    },
    connect,
    makeRoom() {                      // a fresh code: 12 letters and digits, hard to guess
      const a = new Uint8Array(12);
      crypto.getRandomValues(a);
      return [...a].map((x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
    },
  };
})();
