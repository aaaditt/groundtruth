// build_pptx.cjs -- the story talk (docs/21) as PowerPoint, built from the SAME slides file
// as the live deck (site/talk/slides.json), so the two cannot drift apart.
//
//   node presentation/story/build_pptx.cjs      (after python src/talk_build.py)
//
// It serves site/ on a local port, photographs every slide of the live deck with headless
// Chrome (site/talk/?shot=N: the slide alone at 1920 x 1080), then writes two files in
// presentation/ (not committed; rebuilt):
//
//   GroundTruth-story.pptx             PPT + video: still slides as pictures, clips embedded
//                                      (click to play), live slides as their fallback clip
//                                      with the live link. Present from this when offline.
//                                      A clip with stops (site/talk/media/cues.json) is cut
//                                      into one slide per segment, so each click plays to
//                                      the next stop and the presenter sets the pace.
//   GroundTruth-story-submission.pptx  pictures only (a clip is its stops' frames), small
//                                      enough to submit or import into Canva.
// A block diagram that builds in steps becomes one slide per step.
// The speaker's lines go into the notes of every slide.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFile } = require("child_process");
const { createRequire } = require("module");

const REPO = path.resolve(__dirname, "..", "..");
const SITE = path.join(REPO, "site");
const TALK = path.join(SITE, "talk");
const SHOTS = path.join(__dirname, "shots");
const SEGS = path.join(__dirname, "segments");     // clips cut at their stops (not committed)
const LIVE_SITE = "https://groundtruth-seismic.vercel.app";
// pptxgenjs and jszip are already installed for the clips' deck (presentation/video/)
const need = createRequire(path.join(REPO, "presentation", "video", "package.json"));
const pptxgen = need("pptxgenjs");
const JSZip = need("jszip");

const CHROME = [process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && fs.existsSync(p));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

function serve() {                               // a tiny static server for site/
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html");
      const file = path.join(SITE, rel);
      if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// async on purpose: this same process is the web server Chrome loads the slide from, so a
// synchronous call would block the server and Chrome would wait for ever
function ffmpeg(args) {
  return new Promise((resolve, reject) => execFile("ffmpeg", ["-v", "error", "-y", ...args], (e) => (e ? reject(e) : resolve())));
}

// a clip with stops -> [{video, cover, still}] one per segment: segment k runs from stop k-1
// (or the start) to stop k; after a final stop nothing is left to play
async function segments(clip, stops) {
  const src = media(`${clip}.mp4`), out = [];
  const bounds = [0, ...stops.map((q) => q.at)];
  if (!stops.length || !stops[stops.length - 1].final) bounds.push(null);
  for (let k = 0; k < bounds.length - 1; k++) {
    const a = bounds[k], b = bounds[k + 1], base = path.join(SEGS, `${clip}-${k}`);
    await ffmpeg(["-i", src, "-ss", String(a), ...(b == null ? [] : ["-to", String(b)]), "-an", "-c:v", "libx264", "-crf", "30",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${base}.mp4`]);
    await ffmpeg(["-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "3", `${base}-first.jpg`]);
    await ffmpeg(["-sseof", "-0.1", "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "3", `${base}-last.jpg`]);
    out.push({ video: `${base}.mp4`, cover: `${base}-first.jpg`, still: `${base}-last.jpg` });
  }
  return out;
}

function shoot(port, n, then, file, step = null) {
  return new Promise((resolve, reject) => {
    execFile(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      "--window-size=1920,1080", "--virtual-time-budget=6000", `--screenshot=${file}`,
      `http://127.0.0.1:${port}/talk/?shot=${n}${then ? "&then=1" : ""}${step == null ? "" : `&step=${step}`}`], { timeout: 120000 }, () => {
      if (fs.existsSync(file)) resolve(); else reject(new Error(`no screenshot for slide ${n}`));
    });
  });
}

async function dropFolderEntries(file) {          // as in presentation/video/deck.cjs
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const out = new JSZip();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    out.file(name, await entry.async("nodebuffer"), { createFolders: false, compression: name.endsWith(".mp4") ? "STORE" : "DEFLATE" });
  }
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer" }));
}

const FULL = { x: 0, y: 0, w: 10, h: 5.625 };
const media = (name) => path.join(TALK, "media", name);
const b64 = (file) => "image/" + (file.endsWith(".png") ? "png" : "jpeg") + ";base64," + fs.readFileSync(file).toString("base64");

function liveUrl(src) { return LIVE_SITE + "/" + src.replace(/^\.\.\//, "").replace(/[?&]embed=1/, "").replace("?&", "?"); }

async function build(beats, shots, withVideo, segs) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "GroundTruth: what the ground knows about the week";
  pres.author = "Aadit Chandra, Shraddha Pradeep, Aradhya Gupta";
  pres.subject = "Foundations of Data Science, BITS Pilani: final presentation (story version, docs/21)";
  pres.theme = { headFontFace: "Newsreader", bodyFontFace: "IBM Plex Sans" };
  pres.defineSlideMaster({ title: "Paper", background: { color: "F5F1EB" } });

  // speaker notes: who, the practice cues (what is on screen, what each press does), the words
  const notes = (b) => [`${b.speaker.toUpperCase()}: ${b.title}${b.seconds ? ` (about ${b.seconds} s)` : ""}`,
    ...(b.screen ? [`ON SCREEN: ${b.screen}`] : []), ...(b.presses || []).map((t, k) => `PRESS ${k + 1}: ${t}`),
    "", ...(b.say ? ["TALK WHILE IT PLAYS (press when you finish each part):",
      ...b.say.map((t, k) => `${k + 1}. ${t}`)] : [b.notes])].join("\n");
  const add = (b, fill) => { const s = pres.addSlide({ masterName: "Paper" }); fill(s); s.addNotes(notes(b)); return s; };
  const clip = (s, name, label) => {
    const video = media(`${name}.mp4`), cover = media(`${name}.jpg`);
    if (withVideo) s.addMedia({ type: "video", path: video, ...FULL, cover: b64(cover), objectName: label });
    else s.addImage({ path: cover, ...FULL, altText: label, objectName: label });
  };
  let n = 0;
  for (const [i, b] of beats.entries()) {
    // a block diagram that builds: one picture per step, so each click adds the next boxes
    if (b.kind === "static" && b.static.steps) for (let k = 0; k <= b.static.steps; k++)
      add(b, (s) => s.addImage({ path: shots[`${i}-s${k}`], ...FULL, altText: b.title }));
    else if (b.kind === "static") add(b, (s) => s.addImage({ path: shots[i], ...FULL, altText: b.title }));
    if (b.kind === "video" && segs[b.video.clip]) {
      for (const g of segs[b.video.clip]) add(b, (s) => withVideo
        ? s.addMedia({ type: "video", path: g.video, ...FULL, cover: b64(g.cover), objectName: b.title })
        : s.addImage({ path: g.still, ...FULL, altText: b.title, objectName: b.title }));
      if (b.video.then) add(b, (s) => s.addImage({ path: shots[`${i}-then`], ...FULL, altText: b.title }));
    } else if (b.kind === "video") {
      add(b, (s) => clip(s, b.video.clip, b.title));
      if (b.video.then) add(b, (s) => s.addImage({ path: shots[`${i}-then`], ...FULL, altText: b.title }));
    }
    if (b.kind === "live") {
      const fb = b.live.fallback;
      add(b, (s) => {
        if (fb.clip) clip(s, fb.clip, b.title);
        else s.addImage({ path: media(`${fb.still}.png`), x: 0.6, y: 0.5, w: 8.8, h: 4.4, sizing: { type: "contain", w: 8.8, h: 4.4 }, altText: b.title });
        const url = liveUrl(b.live.src);
        s.addText([{ text: `Live: ${url}`, options: { hyperlink: { url } } }],
          { x: 0.3, y: 5.15, w: 9.4, h: 0.35, fontFace: "IBM Plex Mono", fontSize: 10, color: "59616F", fill: { color: "F5F1EB" } });
      });
    }
    n++;
  }
  const name = withVideo ? "GroundTruth-story.pptx" : "GroundTruth-story-submission.pptx";
  const file = path.join(REPO, "presentation", name);
  await pres.writeFile({ fileName: file });
  await dropFolderEntries(file);
  console.log(`wrote presentation/${name} (${pres.slides.length} slides, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  if (!CHROME) throw new Error("Chrome not found: set CHROME to its path");
  const beats = JSON.parse(fs.readFileSync(path.join(TALK, "slides.json"), "utf8")).beats;
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const shots = {};
  for (const [i, b] of beats.entries()) {
    const base = path.join(SHOTS, `${String(i + 1).padStart(2, "0")}-${b.id}`);
    if (b.kind === "static" && b.static.steps) {
      for (let k = 0; k <= b.static.steps; k++) { await shoot(port, i + 1, false, `${base}-s${k}.png`, k); shots[`${i}-s${k}`] = `${base}-s${k}.png`; }
    } else if (b.kind === "static") { await shoot(port, i + 1, false, `${base}.png`); shots[i] = `${base}.png`; }
    if (b.kind === "video" && b.video.then) { await shoot(port, i + 1, true, `${base}-then.png`); shots[`${i}-then`] = `${base}-then.png`; }
  }
  srv.close();
  console.log(`photographed ${Object.keys(shots).length} slides into presentation/story/shots/`);
  const cuesFile = path.join(TALK, "media", "cues.json");
  const cues = fs.existsSync(cuesFile) ? JSON.parse(fs.readFileSync(cuesFile, "utf8")) : {};
  fs.mkdirSync(SEGS, { recursive: true });
  const segs = {};
  for (const [clip, stops] of Object.entries(cues)) segs[clip] = await segments(clip, stops);
  console.log(`cut ${Object.values(segs).flat().length} segments at the stops into presentation/story/segments/`);
  await build(beats, shots, true, segs);
  await build(beats, shots, false, segs);
}

main().catch((e) => { console.error(e); process.exit(1); });
