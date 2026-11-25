// deck.cjs -- build the final-talk PowerPoint from the rendered clips and the script.
//
//   node deck.cjs          (after bash render.sh and python ../clips.py)
//
// Writes two files in presentation/:
//   GroundTruth-final.pptx        one clip per slide, full screen, plays on click, the
//                                 speaker's lines in the notes. Use this to PRESENT.
//   GroundTruth-final-canva.pptx  the same slides with the clip's last frame as a picture
//                                 instead of the video (small file). Use this to IMPORT
//                                 into Canva, then drop the MP4s from out/ onto the slides.
// The speaker notes are read from docs/18-final-presentation-script.md, so the deck and
// the script cannot drift apart.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "out");
const SCRIPT = fs.readFileSync(path.join(REPO, "docs", "18-final-presentation-script.md"), "utf8");

// slide number in docs/18 -> clip and section. Who speaks is read from the [Name] tags.
const SLIDES = [
  { n: 0, clip: "S00-questions", section: "Opening: the question" },
  { n: 1, clip: "S01-christmas" },
  { n: 2, clip: "S02-promises" },
  { n: 3, clip: "C1-city", section: "How it works" },
  { n: 4, clip: "C3-globe" },
  { n: 5, clip: "C2-sea" },
  { n: 6, clip: "S05-features" },
  { n: 7, clip: "C4-forest" },
  { n: 8, clip: "S06-weeks" },
  { n: 9, clip: "S07-results", section: "The promises, kept" },
  { n: 10, clip: "S08-mistakes" },
  { n: 11, clip: "S09-lockdown" },
  { n: 12, clip: "S10-weekends" },
  { n: 13, clip: "C5-quake", section: "What didn't work" },
  { n: 14, clip: "S12-limits" },
  { n: 15, clip: "S13-scorecard", section: "Close" },
  { n: 16, clip: "S14-close" },
  { n: null, clip: "S11-live", section: "Backup for Q&A" },
];

/** The spoken lines (and stage directions) of one slide in docs/18, as plain text, and
 * the speakers in the order they first speak. */
function notesFor(n) {
  if (n === null)
    return { title: "Running live (backup)", who: [], text: "Backup for Q&A: the live website, groundtruth-seismic.vercel.app. Show only if asked." };
  const re = new RegExp(`^### ${n} · (.+)$`, "m");
  const m = SCRIPT.match(re);
  if (!m) throw new Error(`docs/18 has no slide ${n}`);
  const start = m.index + m[0].length;
  const rest = SCRIPT.slice(start);
  const end = rest.search(/^(### |## |# |---)/m);
  const body = end === -1 ? rest : rest.slice(0, end);
  const title = m[1].replace(/\s+—.*$/, "").replace(/`.*?`/g, "").trim();
  const who = [...new Set([...body.matchAll(/\*\*\[(\w+)\]\*\*/g)].map((x) => x[1]))];
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^>\s?/, ""))
    .map((l) => l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`▶[^`]*`/g, "[click]").replace(/`/g, ""))
    .filter((l, i, a) => !(l.trim() === "" && (a[i - 1] ?? "").trim() === ""));
  // bold that spans two lines leaves stray ** behind; notes are plain text
  return { title, who, text: lines.join("\n").replace(/\*\*/g, "").trim() };
}

/** Cloud services (Canva, OneDrive) can refuse a .pptx whose ZIP lists folders as
 * entries. pptxgenjs writes them, so rewrite the file without them. */
async function dropFolderEntries(file) {
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const out = new JSZip();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const data = await entry.async("nodebuffer");
    out.file(name, data, { createFolders: false, compression: name.endsWith(".mp4") ? "STORE" : "DEFLATE" });
  }
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer" }));
}

function poster(clip) {
  const file = path.join(OUT, "posters", `${clip}.png`);
  if (!fs.existsSync(file)) throw new Error(`missing poster ${file}: run the poster step in README`);
  return file;
}

async function build(withVideo) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in, same shape as the 1920x1080 clips
  pres.title = "GroundTruth: the ground knows what day it is";
  pres.author = "Aadit Chandra, Shraddha Pradeep, Aradhya Gupta";
  pres.subject = "Foundations of Data Science, BITS Pilani: final presentation";
  pres.theme = { headFontFace: "Newsreader", bodyFontFace: "IBM Plex Sans" };
  pres.defineSlideMaster({ title: "Clip", background: { color: "F5F1EB" } }); // the clips' paper colour

  let sectionTitle = "";
  for (const s of SLIDES) {
    if (s.section) {
      sectionTitle = s.section;
      pres.addSection({ title: sectionTitle });
    }
    const slide = pres.addSlide({ masterName: "Clip", sectionTitle });
    const notes = notesFor(s.n);
    const label = `${notes.title} (${s.clip})`;
    const video = path.join(OUT, `${s.clip}.mp4`);
    const cover = poster(s.clip);
    if (withVideo) {
      if (!fs.existsSync(video)) throw new Error(`missing ${video}: run bash render.sh`);
      slide.addMedia({
        type: "video",
        path: video,
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
        cover: "image/png;base64," + fs.readFileSync(cover).toString("base64"),
        objectName: label,
      });
    } else {
      slide.addImage({ path: cover, x: 0, y: 0, w: 10, h: 5.625, altText: label, objectName: label });
    }
    const who = notes.who.length ? notes.who.map((w) => w.toUpperCase()).join(" → ") : "ANYONE";
    slide.addNotes(`${who}: ${notes.title}\n\n${notes.text}`);
  }
  const name = withVideo ? "GroundTruth-final.pptx" : "GroundTruth-final-canva.pptx";
  const file = path.join(REPO, "presentation", name);
  await pres.writeFile({ fileName: file });
  await dropFolderEntries(file);
  const mb = fs.statSync(file).size / 1e6;
  console.log(`wrote presentation/${name} (${SLIDES.length} slides, ${mb.toFixed(1)} MB)`);
}

(async () => {
  await build(true);
  await build(false);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
