"""Record every scene of the demo video at 1920x1080 from the live site.

Each scene's length, captions and caption times come from video/captions.json.
Site scenes drive the real pages (the tour, the globe, Today, the game) and burn
their captions into the frame; card scenes play video/cards.html.

How the capture stays smooth: Chrome's screencast only delivers ~15 frames a
second at 1080p, so pages run at 1/SLOW speed (JS clocks, timers, animation
frames and CSS animations), frames are captured in real time and then re-timed
by 1/SLOW. The same trick as the Ghost Fleet video (github.com/aaaditt/ghost-fleet).

Usage: python video/record_scenes.py [--only welcome,day] [--url https://groundtruth-seismic.vercel.app/]
Needs: Playwright for Python with Chromium, and ffmpeg on PATH.
Writes video/build/scenes/<scene>.mp4 (git-ignored).
"""

import argparse
import asyncio
import base64
import json
import subprocess
import time
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BUILD = HERE / "build"
FRAMES = BUILD / "frames"
SCENES = BUILD / "scenes"
W, H = 1920, 1080
SLOW = 3
SPEC = json.loads((HERE / "captions.json").read_text(encoding="utf-8"))
BY_ID = {s["id"]: s for s in SPEC["scenes"]}
# Brussels' real average Wednesday (log10 hourly shaking), drawn on the title card
BRUSSELS = json.loads((ROOT / "site" / "data" / "game.json").read_text(encoding="utf-8"))["reference"]["BE.UCC"]["weekday"]


# ── Overlays injected into the live site (captions built with textContent only) ──
OVERLAY_JS = r"""
() => {
  const css = document.createElement('style');
  css.textContent = `
    #vx-cap { position: fixed; left: 56px; bottom: 64px; z-index: 99999; max-width: 980px; pointer-events: none;
      padding: 20px 30px 20px 26px; background: rgba(21,24,28,.92); color: #f1f3ef;
      border: 1px solid rgba(255,255,255,.14); border-left: 6px solid #86b1e8;
      font: 500 32px/1.3 "Libre Franklin", Arial, sans-serif; box-shadow: 0 14px 40px rgba(0,0,0,.35);
      opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .9s cubic-bezier(.2,.7,.2,1); }
    #vx-cap.in { opacity: 1; transform: none; }
    #vx-cap small { display: block; margin-top: 6px; font-size: 22px; font-weight: 400; color: #b3bcc2; }
    #vx-cursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%;
      border: 2.5px solid #15181c; background: rgba(241,243,239,.55); z-index: 99998; pointer-events: none; opacity: 0;
      transition: transform 1.1s cubic-bezier(.45,.05,.25,1), opacity .5s ease; }
    #vx-cursor.press { animation: vxpress .45s ease; }
    @keyframes vxpress { 50% { box-shadow: 0 0 0 14px rgba(31,78,158,.3); } }
    html { scroll-behavior: auto !important; }
  `;
  document.head.appendChild(css);
  for (const id of ['vx-cap', 'vx-cursor']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  window.vx = {
    caption(main, small) {
      const c = document.getElementById('vx-cap');
      const fill = () => {
        c.textContent = main || '';
        if (small) { const s = document.createElement('small'); s.textContent = small; c.appendChild(s); }
        if (main) c.classList.add('in');
      };
      if (c.classList.contains('in')) { c.classList.remove('in'); setTimeout(fill, 450); } else fill();
    },
    scrollTo(y, seconds) {                 // eased window scroll; the slowed clock makes it smooth on video
      const from = scrollY, t0 = performance.now(), ms = seconds * 1000;
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        scrollTo(0, from + (y - from) * ease(k));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    },
    cursorTo(sel) {
      const r = document.querySelector(sel).getBoundingClientRect(), c = document.getElementById('vx-cursor');
      c.style.opacity = 1; c.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
    },
    press() { const c = document.getElementById('vx-cursor'); c.classList.remove('press'); void c.offsetWidth; c.classList.add('press'); },
    hideCursor() { document.getElementById('vx-cursor').style.opacity = 0; },
  };
}
"""

SLOW_TIME_JS = """
(() => {
  if (window.__vxSlow) return;
  window.__vxSlow = true;
  const S = %d;
  const pn = performance.now.bind(performance), p0 = pn();
  const dn = Date.now, d0 = dn();
  performance.now = () => p0 + (pn() - p0) / S;
  Date.now = () => d0 + (dn() - d0) / S;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(performance.now()));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) * S, ...a);
  window.setInterval = (f, ms, ...a) => si(f, (ms || 0) * S, ...a);
})();
""" % SLOW


async def slow_page(browser):
    """A fresh 1920x1080 light-theme page whose clocks, timers, rAF and CSS animations run at 1/SLOW speed."""
    ctx = await browser.new_context(viewport={"width": W, "height": H}, color_scheme="light")
    page = await ctx.new_page()
    await page.add_init_script(SLOW_TIME_JS)
    cdp = await ctx.new_cdp_session(page)
    await cdp.send("Animation.enable")
    await cdp.send("Animation.setPlaybackRate", {"playbackRate": 1 / SLOW})
    return page, cdp


class Recorder:
    """Screencast frames with their capture timestamps, written to disk as they arrive."""

    def __init__(self, cdp):
        self.cdp, self.frames, self.t0, self.stopped = cdp, [], None, False
        self.raw = FRAMES / "_raw"
        self.raw.mkdir(parents=True, exist_ok=True)
        for f in self.raw.glob("*.jpg"):
            f.unlink()

    async def start(self):
        self.cdp.on("Page.screencastFrame", self._on_frame)
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H,
                                                     "everyNthFrame": 1})
        await asyncio.sleep(0.4)
        self.t0 = time.time()

    def _on_frame(self, ev):
        path = self.raw / f"r{len(self.frames):06d}.jpg"
        path.write_bytes(base64.b64decode(ev["data"]))
        self.frames.append((ev["metadata"]["timestamp"], path))
        if not self.stopped:
            asyncio.ensure_future(self._ack(ev["sessionId"]))

    async def _ack(self, session_id):
        try:
            await self.cdp.send("Page.screencastFrameAck", {"sessionId": session_id})
        except Exception:
            pass                                   # the page may already be closed

    async def at(self, seconds):
        """Wait until `seconds` of VIDEO time have passed since the scene started."""
        delay = self.t0 + seconds * SLOW - time.time()
        if delay > 0:
            await asyncio.sleep(delay)

    async def stop(self, sid, total):
        await self.at(total + 0.1)
        self.stopped = True
        await self.cdp.send("Page.stopScreencast")
        self.cdp.remove_listener("Page.screencastFrame", self._on_frame)
        write_video(sid, self.frames, self.t0, total)


def write_video(sid, frames, t0, total):
    """Frames at their real timestamps -> a constant 30 fps H.264 clip of exactly `total` seconds."""
    out_dir = FRAMES / sid
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("*.jpg"):
        f.unlink()
    frames = [((ts - t0) / SLOW + t0, p) for ts, p in frames]          # wall clock -> video time
    before = [f for f in frames if f[0] <= t0]
    kept = ([before[-1]] if before else []) + [f for f in frames if t0 < f[0] <= t0 + total]
    if not kept:
        raise SystemExit(f"{sid}: no frames captured")
    lines = []
    for n, (ts, p) in enumerate(kept):
        name = f"f{n:05d}.jpg"
        (out_dir / name).write_bytes(p.read_bytes())
        start = max(ts - t0, 0.0)
        end = (kept[n + 1][0] - t0) if n + 1 < len(kept) else total
        lines.append(f"file '{name}'\nduration {max(end - start, 0.001):.4f}")
    lines.append(f"file 'f{len(kept) - 1:05d}.jpg'")
    (out_dir / "list.txt").write_text("\n".join(lines), encoding="utf-8")
    SCENES.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(out_dir / "list.txt"),
                    "-vf", f"fps=30,scale={W}:{H}:flags=lanczos,format=yuv420p", "-t", f"{total:.3f}",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "14", str(SCENES / f"{sid}.mp4")], check=True)
    print(f"  {sid:<8} {total:5.1f}s  {len(kept)} frames")


async def captions(page, rec, sid, actions):
    """Run the scene: captions from captions.json and `actions` [(t, coroutine factory)], in time order."""
    events = [(t, "cap", (main, small[0] if small else None)) for t, main, *small in BY_ID[sid]["captions"]]
    events += [(t, "do", fn) for t, fn in actions]
    for t, kind, x in sorted(events, key=lambda e: e[0]):
        await rec.at(t)
        if kind == "cap":
            await page.evaluate("([m, s]) => vx.caption(m, s)", list(x))
        else:
            await x()
    await rec.at(BY_ID[sid]["length"] - 1.2)
    await page.evaluate("vx.caption('')")


# ── Scene scripts ──────────────────────────────────────────────────────

def js(page, code, arg=None):
    return lambda: page.evaluate(code, arg)


async def tour_scenes(page, cdp, only):
    """The four tour scenes run in one continuous page, like a visitor scrolling."""
    y = lambda expr: page.evaluate(expr)
    if "welcome" in only:
        await page.evaluate("document.getElementById('vx-cap').style.bottom = '210px'")   # keep the pen line visible
        rec = Recorder(cdp); await rec.start()
        await captions(page, rec, "welcome", [
            (5.0, js(page, "() => { const t = document.querySelector('.trace'); t.classList.remove('drawn'); void t.offsetWidth; t.classList.add('drawn'); }")),
        ])
        await rec.stop("welcome", BY_ID["welcome"]["length"])
    if "day" in only:
        await page.evaluate("document.getElementById('vx-cap').style.bottom = ''")
        top = await y("document.getElementById('day').offsetTop")
        wake = await y("(() => { const e = document.getElementById('s-wake'); return e.getBoundingClientRect().top + scrollY - innerHeight * 0.5; })()")
        sun = await y("(() => { const e = document.querySelector('[data-sun]'); return e.getBoundingClientRect().top + scrollY - innerHeight * 0.45; })()")
        rec = Recorder(cdp); await rec.start()
        await captions(page, rec, "day", [
            (0.2, js(page, "y => vx.scrollTo(y, 1.6)", top)),
            (2.6, js(page, "y => vx.scrollTo(y, 6)", wake)),
            (9.5, js(page, "y => vx.scrollTo(y, 4)", sun)),
        ])
        await rec.stop("day", BY_ID["day"]["length"])
    if "quiet" in only:
        a = await y("document.getElementById('run').offsetTop")
        b = await y("(() => { const r = document.getElementById('run'); return r.offsetTop + r.offsetHeight - innerHeight; })()")
        await page.evaluate(f"scrollTo(0, {a} - 4)")       # arrive at the drum, let the globe build
        await page.wait_for_timeout(4000 * SLOW)
        rec = Recorder(cdp); await rec.start()
        await captions(page, rec, "quiet", [(0.6, js(page, "y => vx.scrollTo(y, 14)", b))])
        await rec.stop("quiet", BY_ID["quiet"]["length"])
    if "learn" in only:
        top = await y("document.getElementById('learn').offsetTop")
        # bring the quiz's answer buttons up to mid-screen, without scrolling into the next stop
        quiz = await y("(() => { const b = document.getElementById('q-actions'), l = document.getElementById('learn');"
                       " const want = b.getBoundingClientRect().top + scrollY - innerHeight * 0.45;"
                       " return Math.min(want, l.offsetTop + l.offsetHeight - innerHeight); })()")
        rec = Recorder(cdp); await rec.start()
        await captions(page, rec, "learn", [
            (0.1, js(page, "y => vx.scrollTo(y, 1.8)", top)),
            (5.6, js(page, "y => vx.scrollTo(y, 1.6)", quiz)),
            (7.6, js(page, "() => vx.cursorTo('#q-actions .btn')")),
            (9.0, js(page, "() => { vx.press(); document.querySelector('#q-actions .btn').click(); }")),
            (10.2, js(page, "() => vx.hideCursor()")),
        ])
        await rec.stop("learn", BY_ID["learn"]["length"])


async def globe_scene(page, cdp):
    await page.wait_for_function("() => typeof map !== 'undefined' && map && map.loaded()", timeout=60000 * SLOW)
    k = await page.evaluate("H.stations.findIndex(s => JSON.stringify(s).includes('BE.UCC'))")
    if k < 0:
        raise SystemExit("globe: Brussels (BE.UCC) not found in history.json")
    # warm the tiles at Brussels, so the fly-in never shows unloaded imagery
    await page.evaluate("map.jumpTo({center: [4.36, 50.8], zoom: 7})")
    await page.wait_for_function("map.loaded() && map.areTilesLoaded()", timeout=60000 * SLOW)
    await page.evaluate("map.jumpTo({center: HOME.center, zoom: homeZoom()})")
    await page.wait_for_function("map.loaded() && map.areTilesLoaded()", timeout=60000 * SLOW)
    await page.evaluate("setDate(indexOf('2020-02-24'))")
    await page.wait_for_timeout(2500 * SLOW)
    rec = Recorder(cdp); await rec.start()
    await captions(page, rec, "globe", [
        (4.6, js(page, "() => vx.cursorTo('#play')")),
        (5.8, js(page, "() => { vx.press(); play(); }")),
        (11.0, js(page, "() => { play(); vx.hideCursor(); }")),        # pause in late March / early April
        (13.0, js(page, "k => select(k, true)", k)),
    ])
    await rec.stop("globe", BY_ID["globe"]["length"])


async def today_scene(page, cdp):
    await page.wait_for_selector("#rows .row")
    rows = await page.evaluate("document.querySelector('#rows').getBoundingClientRect().top + scrollY - 80")
    board = await page.evaluate("document.getElementById('predictions').getBoundingClientRect().top + scrollY - 70")
    rec = Recorder(cdp); await rec.start()
    await captions(page, rec, "today", [
        (1.6, js(page, "y => vx.scrollTo(y, 4.5)", rows)),
        (7.0, js(page, "y => vx.scrollTo(y, 3)", board)),
    ])
    await rec.stop("today", BY_ID["today"]["length"])


async def game_scene(page, cdp):
    await page.wait_for_selector("#g-choices button")
    # start with the chart at the top, so the answer and the reveal sit above the caption
    await page.evaluate("scrollTo(0, document.getElementById('g-city').getBoundingClientRect().top + scrollY - 24)")
    rec = Recorder(cdp); await rec.start()
    await captions(page, rec, "game", [
        (3.0, js(page, "() => vx.cursorTo('#g-choices button:nth-child(3)')")),
        (4.4, js(page, "() => { vx.press(); document.querySelector('#g-choices button:nth-child(3)').click(); }")),
        (5.4, js(page, "() => vx.hideCursor()")),
    ])
    await rec.stop("game", BY_ID["game"]["length"])


async def open_site(browser, url):
    page, cdp = await slow_page(browser)
    await page.goto(url, wait_until="networkidle", timeout=120000)
    await page.evaluate("document.fonts.ready")
    await page.evaluate(OVERLAY_JS)
    await page.wait_for_timeout(1500 * SLOW)
    return page, cdp


async def record_card(browser, sid):
    page, cdp = await slow_page(browser)
    await page.goto((HERE / "cards.html").as_uri(), wait_until="networkidle")
    await page.evaluate("document.fonts.ready")
    rec = Recorder(cdp); await rec.start()
    await page.evaluate("([c, curve]) => play(c, curve)", [sid, BRUSSELS])
    await rec.stop(sid, BY_ID[sid]["length"])
    await page.context.close()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--url", default="https://groundtruth-seismic.vercel.app/")
    args = parser.parse_args()
    url = args.url.rstrip("/") + "/"
    order = [s["id"] for s in SPEC["scenes"]]
    only = [s for s in args.only.split(",") if s] or order
    async with async_playwright() as pw:
        # The globes are WebGL: use the GPU through ANGLE/D3D11 (SwiftShader is far too slow at 1080p).
        browser = await pw.chromium.launch(args=["--force-device-scale-factor=1", "--hide-scrollbars", "--use-angle=d3d11",
                                                 "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"])
        for sid in [s for s in order if s in only and BY_ID[s]["kind"] == "card"]:
            await record_card(browser, sid)
        tour = [s for s in ("welcome", "day", "quiet", "learn") if s in only]
        if tour:
            page, cdp = await open_site(browser, url + "index.html")
            if tour[0] != "welcome":                     # resuming mid-tour: start where the visitor would be
                await page.evaluate(f"document.getElementById('{ {'day': 'welcome', 'quiet': 'day', 'learn': 'quiet'}[tour[0]] }').scrollIntoView()")
            await tour_scenes(page, cdp, tour)
            await page.context.close()
        for sid, path, fn in [("globe", "globe.html#2020-02-24", globe_scene), ("today", "today.html", today_scene),
                              ("game", "game.html", game_scene)]:
            if sid in only:
                page, cdp = await open_site(browser, url + path)
                await fn(page, cdp)
                await page.context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
