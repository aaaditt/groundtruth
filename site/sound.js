// GroundTruth's sound, made live in the browser with the Web Audio API: no audio files.
//   ambient   a slow, low drone that breathes over minutes, a faint wind, distant star-bells
//   whoosh    filtered air, for the Earth turning or zooming and for changing page
//   tick      a light tap for buttons and calendar squares
//   scratch   a soft pen texture while a line draws
//   chime     two quiet notes when an answer appears
// Browsers allow sound only after the visitor clicks or presses a key, so nothing plays
// before that. The "Sound" switch in the bar turns it all off, and the choice is remembered.
// Nothing is said only by sound: every sound goes with something on screen.
"use strict";
(() => {
  const KEY = "gt-sound";
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } };
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AC = window.AudioContext || window.webkitAudioContext;
  let enabled = read() !== "off";          // on unless the visitor turned it off
  let ctx = null, master = null, fx = null, amb = null, verb = null, noise = null, sparkleTimer = null;

  const now = () => ctx.currentTime;
  const ready = () => enabled && ctx && ctx.state === "running";

  // a few seconds of white noise, reused by every airy sound
  function noiseBuffer(seconds = 3) {
    const b = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return b;
  }
  // a generated hall: stereo noise with an exponential tail
  function impulse(seconds = 4.5, decay = 3.2) {
    const n = ctx.sampleRate * seconds, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  function build() {
    ctx = new AC();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = 0.005; limiter.release.value = 0.3;
    limiter.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(limiter);
    verb = ctx.createConvolver(); verb.buffer = impulse();
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(master);
    fx = ctx.createGain(); fx.gain.value = 0.9; fx.connect(master);
    const fxSend = ctx.createGain(); fxSend.gain.value = 0.28; fx.connect(fxSend); fxSend.connect(verb);
    amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
    const ambSend = ctx.createGain(); ambSend.gain.value = 0.7; amb.connect(ambSend); ambSend.connect(verb);
    noise = noiseBuffer();
    drone();
  }

  // ---------- the ambient bed ----------
  function drone() {
    // an open chord on D (D2 A2 D3 E3 A3): calm, no major/minor pull
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 520; tone.Q.value = 0.4;
    tone.connect(amb);
    const sweep = ctx.createOscillator(), sweepAmt = ctx.createGain();
    sweep.frequency.value = 0.021; sweepAmt.gain.value = 260; sweep.connect(sweepAmt); sweepAmt.connect(tone.frequency); sweep.start();
    [73.42, 110, 146.83, 164.81, 220].forEach((f, k) => {
      const v = ctx.createGain(); v.gain.value = [0.16, 0.11, 0.08, 0.05, 0.035][k]; v.connect(tone);
      // each voice breathes on its own slow cycle
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 0.03 + k * 0.017; depth.gain.value = v.gain.value * 0.8;
      lfo.connect(depth); depth.connect(v.gain); lfo.start();
      for (const [type, det] of [["sine", -4], ["triangle", 5]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = type === "sine" ? 0.7 : 0.25;
        o.connect(g); g.connect(v); o.start();
      }
    });
    // a faint wind: noise through a slowly moving band
    const air = ctx.createBufferSource(); air.buffer = noise; air.loop = true;
    const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 380; band.Q.value = 0.9;
    const airG = ctx.createGain(); airG.gain.value = 0.018;
    const wob = ctx.createOscillator(), wobAmt = ctx.createGain();
    wob.frequency.value = 0.047; wobAmt.gain.value = 160; wob.connect(wobAmt); wobAmt.connect(band.frequency); wob.start();
    air.connect(band); band.connect(airG); airG.connect(amb); air.start();
  }
  // now and then, a distant bell high above the drone
  function sparkle() {
    clearTimeout(sparkleTimer);
    sparkleTimer = setTimeout(() => {
      if (ready() && !document.hidden) bell([587.33, 880, 1174.66, 1318.51][Math.floor(Math.random() * 4)], 0.022, 5, amb);
      sparkle();
    }, (REDUCED ? 26000 : 11000) + Math.random() * 12000);
  }
  function bell(freq, level, decay, dest) {
    const t = now(), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(dest);
    for (const [mult, amp] of [[1, 1], [2.01, 0.28], [3.98, 0.08]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = freq * mult; og.gain.value = amp; o.connect(og); og.connect(g);
      o.start(t); o.stop(t + decay + 0.1);
    }
  }

  // ---------- one-shot sounds ----------
  function whoosh(strength = 1, pan = 0) {
    if (!ready()) return;
    const t = now(), dur = 1.15;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.85;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.42);
    bp.frequency.exponentialRampToValueAtTime(420, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * strength, t + dur * 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(REDUCED ? 0 : -pan, t); p.pan.linearRampToValueAtTime(REDUCED ? 0 : pan, t + dur);
      g.connect(p); out = p;
    }
    src.connect(bp); bp.connect(g); out.connect(fx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    // a soft low swell under the air, so it feels like movement, not hiss
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(48, t + dur);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09 * strength, t + 0.3);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(fx); o.start(t); o.stop(t + dur + 0.05);
  }
  function tick() {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(1650, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(fx); o.start(t); o.stop(t + 0.09);
  }
  function scratch(ms = 1600) {
    if (!ready()) return;
    const t = now(), dur = ms / 1000;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4200; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    // a nib on paper is never steady: small random swells along the stroke
    for (let k = 0; k <= 24; k++) g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.02, t + dur * k / 24 * 0.96);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(fx);
    src.start(t, Math.random()); src.stop(t + dur + 0.15);
  }
  function chime() {
    if (!ready()) return;
    bell(880, 0.07, 2.6, fx);
    setTimeout(() => { if (ready()) bell(1318.51, 0.055, 3.2, fx); }, 190);
  }

  // ---------- on, off, and the browser's rules ----------
  function fadeIn() {
    if (!ctx) return;
    const t = now();
    master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(enabled && !document.hidden ? 0.6 : 0, t, 0.25);
    amb.gain.cancelScheduledValues(t); amb.gain.setTargetAtTime(enabled && !document.hidden ? 0.5 : 0, t, 1.8);
  }
  function unlock() {
    if (!AC) return;
    try {
      if (!ctx) build();
      if (ctx.state !== "running") ctx.resume().then(fadeIn).catch(() => {});
      fadeIn();
      if (enabled) sparkle();
    } catch (e) { /* audio unavailable: the site works the same without it */ }
  }
  function paint() {
    for (const b of document.querySelectorAll(".sound")) {
      b.setAttribute("aria-pressed", String(enabled));
      b.title = enabled ? "Sound is on. Click to turn it off." : "Sound is off. Click to turn it on.";
    }
  }
  function toggle() {
    enabled = !enabled;
    save(enabled ? "on" : "off");
    paint();
    if (enabled) unlock(); else if (ctx) fadeIn();
  }

  const first = () => { unlock(); removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true); };
  addEventListener("pointerdown", first, true);
  addEventListener("keydown", first, true);
  document.addEventListener("visibilitychange", () => { if (ctx) fadeIn(); });

  document.addEventListener("click", (e) => {
    const sw = e.target.closest(".sound");
    if (sw) { e.preventDefault(); toggle(); return; }
    const a = e.target.closest("a[href]");
    if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey &&
        (!a.target || a.target === "_self") && !a.hasAttribute("download")) {
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin) {
        const samePage = url.pathname === location.pathname;
        if (samePage) { whoosh(0.6); return; }            // a jump within the page
        if (ready()) {                                     // a new page: whoosh, then go
          e.preventDefault(); whoosh(0.8, 0.4);
          setTimeout(() => { location.href = url.href; }, 170);
        }
        return;
      }
    }
    if (e.target.closest("button, .btn, .chip, [role=button], select, rect.day")) tick();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint); else paint();

  window.GTSound = { on: () => enabled, toggle, whoosh, tick, scratch, chime,
    ambient: (on) => { if (amb && ctx) amb.gain.setTargetAtTime(on && enabled ? 0.5 : 0, now(), 1.2); } };
})();
