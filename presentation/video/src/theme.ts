// The look of every clip: the same identity as our proposal deck ("SeismicSignal", made in
// Canva), so the two talks look like one series. Light paper, Newsreader for headings and
// big numbers (italic for emphasis, as in the proposal), IBM Plex Sans for everything you
// read, IBM Plex Mono for the small source / data captions.
// Colour carries meaning, and every coloured line is also labelled in words:
//   city = burnt orange: people, traffic, the human band (the proposal's accent)
//   sea  = deep blue: the ocean, nature
//   glow = the seismometer pen (dark ink, so the real recording reads as "the record")
import { continueRender, delayRender, staticFile } from "remotion";

// The fonts are files in public/fonts/ (SIL Open Font License), so rendering never needs
// the internet. Each is a variable font: one file covers every weight.
const FONTS: [string, string, string, string][] = [
  ["Newsreader", "Newsreader.woff2", "normal", "200 800"],
  ["Newsreader", "Newsreader-Italic.woff2", "italic", "200 800"],
  ["IBM Plex Sans", "IBMPlexSans.woff2", "normal", "100 700"],
  ["IBM Plex Mono", "IBMPlexMono-Regular.woff2", "normal", "400"],
];
/** Resolves when every font is ready (3D text drawn on canvases waits for this). */
export let fontsReady: Promise<void> = Promise.resolve();
export const fontState = { done: false };
if (typeof document !== "undefined") {
  const handle = delayRender("loading the talk's fonts");
  fontsReady = Promise.all(
    FONTS.map(([family, file, style, weight]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { style, weight });
      return face.load().then((f) => document.fonts.add(f));
    }),
  ).then(() => {
    fontState.done = true;
    continueRender(handle);
  });
}

export const DISPLAY = '"Newsreader", Georgia, serif';
export const TEXT = '"IBM Plex Sans", Arial, sans-serif';
export const MONO = '"IBM Plex Mono", "Courier New", monospace';

export const C = {
  paper: "#f5f1eb", // background: warm paper (the proposal's slide colour)
  panel: "#ece7da", // a slightly darker card
  rule: "#d9d3c4", // hairlines and axes
  ink: "#161b21", // main text
  graphite: "#59616f", // secondary text
  glow: "#2e5c95", // the pen / the real recording on 2D charts
  city: "#a7480c", // people (burnt orange)
  cityLight: "#f5993c",
  sea: "#2e5c95", // the ocean
  loud: "#b3261e", // flagged / unusual
  good: "#3f7d4e", // correct
};

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const MARGIN = 120;
