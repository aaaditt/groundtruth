// Shared pieces: timing helpers, the stage, text, the pen line, and the caption card
// used over 3D scenes (so text stays readable whatever the sky is doing).
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DISPLAY, MARGIN, MONO, TEXT } from "./theme";

// Two clocks. The STORY clock moves the camera, the captions and the charts; the BACKGROUND
// clock moves cars, trains, people, ripples and waves. In a normal clip they are the same.
// In a "hold" clip (cues.json: the deck waits there for the presenter) the story clock is
// stopped at the cue while the background keeps running, so the city stays alive.
const HoldCtx = React.createContext<number | null>(null);
/** The background starts this many seconds before the cue, so the deck can loop it seamlessly. */
export const HOLD_LEAD = 1;

/** Render `children` frozen at story second `at`, with the background still moving. */
export const HoldAt: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => (
  <HoldCtx.Provider value={at}>{children}</HoldCtx.Provider>
);

/** Seconds on the story clock (camera, captions, charts). */
export const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hold = React.useContext(HoldCtx);
  return hold === null ? frame / fps : hold;
};

/** Seconds on the background clock (cars, people, trains, ripples, waves). */
export const useAmbient = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hold = React.useContext(HoldCtx);
  return hold === null ? frame / fps : hold - HOLD_LEAD + frame / fps;
};

const OUT = Easing.bezier(0.16, 1, 0.3, 1); // arrives with momentum, settles
const INOUT = Easing.bezier(0.45, 0, 0.55, 1);

/** 0 -> 1 between seconds a and b (eased, clamped). */
export const ramp = (t: number, a: number, b: number, ease: "out" | "inout" | "linear" = "out") =>
  interpolate(t, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease === "out" ? OUT : ease === "inout" ? INOUT : Easing.linear,
  });

export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Fade in at `at`, optionally out at `until`. */
export const fade = (t: number, at: number, until?: number, dur = 0.8) =>
  ramp(t, at, at + dur) * (until === undefined ? 1 : 1 - ramp(t, until, until + dur, "inout"));

export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily: TEXT, color: C.ink }}>
    {children}
  </AbsoluteFill>
);

/** The slide's headline: Newsreader, top left. One reveal, then it stays. */
export const Headline: React.FC<{ text: string; at?: number; until?: number; size?: number }> = ({
  text,
  at = 0.3,
  until,
  size = 76,
}) => {
  const t = useSec();
  const o = fade(t, at, until);
  return (
    <div
      style={{
        position: "absolute",
        left: MARGIN,
        top: 84,
        maxWidth: 1500,
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: "-0.01em",
        opacity: o,
        transform: `translateY(${(1 - ramp(t, at, at + 1)) * 18}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** A line of explanation (IBM Plex Sans, 44px: legible from the back row). */
export const Note: React.FC<{
  text: string;
  at: number;
  until?: number;
  x?: number;
  y: number;
  size?: number;
  color?: string;
  weight?: number;
  align?: "left" | "right" | "center";
  width?: number;
}> = ({ text, at, until, x = MARGIN, y, size = 44, color = C.graphite, weight = 400, align = "left", width = 1400 }) => {
  const t = useSec();
  const o = fade(t, at, until);
  const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: y,
        width,
        textAlign: align,
        fontSize: size,
        lineHeight: 1.25,
        fontWeight: weight,
        color,
        opacity: o,
        transform: `translateY(${(1 - ramp(t, at, at + 0.9)) * 10}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** A big number in Newsreader that counts up to its real value. */
export const BigNumber: React.FC<{
  value: number;
  at: number;
  x: number;
  y: number;
  size?: number;
  color?: string;
  suffix?: string;
  decimals?: number;
  align?: "left" | "right" | "center";
}> = ({ value, at, x, y, size = 180, color = C.ink, suffix = "%", decimals = 0, align = "left" }) => {
  const t = useSec();
  const f = ramp(t, at, at + 1.6);
  const shown = (value * f).toFixed(decimals);
  const w = 900;
  const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: y,
        width: w,
        textAlign: align,
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 1,
        color,
        opacity: ramp(t, at, at + 0.5),
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {shown}
      {suffix}
    </div>
  );
};

/** Small tag for drawings that are not data. */
export const IllustrationTag: React.FC<{ at?: number; until?: number }> = ({ at = 0, until }) => {
  const t = useSec();
  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 34,
        fontSize: 26,
        color: C.graphite,
        opacity: 0.85 * fade(t, at, until),
        fontStyle: "italic",
      }}
    >
      Illustration
    </div>
  );
};

/** Small source line for real data, bottom left. */
export const Source: React.FC<{ text: string; at?: number; until?: number }> = ({ text, at = 0.5, until }) => {
  const t = useSec();
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        bottom: 34,
        fontFamily: MONO,
        fontSize: 22,
        color: C.graphite,
        opacity: 0.9 * fade(t, at, until),
      }}
    >
      {text}
    </div>
  );
};

/** Smooth SVG path through points (Catmull-Rom turned into cubic Béziers). */
export const smoothPath = (pts: number[][]) => {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
};

/** Points cut at a fraction `p` of their x-extent, with the last point interpolated. */
export const cutAt = (pts: number[][], p: number) => {
  if (p >= 1) return pts;
  if (p <= 0 || pts.length < 2) return pts.slice(0, 1);
  const x0 = pts[0][0];
  const xEnd = x0 + (pts[pts.length - 1][0] - x0) * p;
  const out: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] <= xEnd) out.push(pts[i]);
    else {
      const a = pts[i - 1];
      const b = pts[i];
      const f = (xEnd - a[0]) / (b[0] - a[0]);
      out.push([xEnd, lerp(a[1], b[1], f)]);
      break;
    }
  }
  return out;
};

/** The seismometer pen: a glowing line drawn up to `progress`, with the pen tip. */
export const PenLine: React.FC<{
  pts: number[][];
  progress: number;
  color?: string;
  width?: number;
  smooth?: boolean;
  tip?: boolean;
  opacity?: number;
  dashed?: boolean;
}> = ({ pts, progress, color = C.ink, width = 4, smooth = false, tip = true, opacity = 1, dashed = false }) => {
  const shown = cutAt(pts, progress);
  const d = smooth ? smoothPath(shown) : `M${shown.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L")}`;
  const end = shown[shown.length - 1];
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={C.glow} strokeOpacity={0.1} strokeWidth={width * 4} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? `${width * 3} ${width * 3}` : undefined}
      />
      {tip && progress > 0 && progress < 1 && end ? (
        <>
          <circle cx={end[0]} cy={end[1]} r={width * 4} fill={C.city} opacity={0.18} />
          <circle cx={end[0]} cy={end[1]} r={width * 1.6} fill={C.city} />
        </>
      ) : null}
    </g>
  );
};

/** Labelled bar (horizontal) for the few comparisons the talk makes. */
export const HBar: React.FC<{
  label: string;
  value: number; // 0..1
  at: number;
  x: number;
  y: number;
  width: number;
  color: string;
  height?: number;
  valueText?: string;
  until?: number;
}> = ({ label, value, at, x, y, width, color, height = 64, valueText, until }) => {
  const t = useSec();
  const f = ramp(t, at, at + 1.6);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: fade(t, at, until, 0.5) }}>
      <div style={{ fontSize: 40, color: C.graphite, marginBottom: 12 }}>{label}</div>
      <div style={{ position: "relative", width, height }}>
        <div style={{ position: "absolute", inset: 0, background: C.panel, borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: width * value * f, background: color, borderRadius: 2 }} />
        <div
          style={{
            position: "absolute",
            left: width * value * f + 20,
            top: -4,
            fontFamily: DISPLAY,
            fontSize: height + 8,
            lineHeight: 1,
            color: C.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {valueText ?? `${Math.round(value * 100 * f)}%`}
        </div>
      </div>
    </div>
  );
};

/** A clock face showing local time (minutes after midnight). */
export const Clock: React.FC<{ minute: number; x: number; y: number; r?: number; opacity?: number }> = ({
  minute,
  x,
  y,
  r = 64,
  opacity = 1,
}) => {
  const h = (minute / 60) % 12;
  const m = minute % 60;
  const hand = (frac: number, len: number) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    return [x + Math.cos(a) * len, y + Math.sin(a) * len];
  };
  const [hx, hy] = hand(h / 12, r * 0.5);
  const [mx, my] = hand(m / 60, r * 0.78);
  const hh = Math.floor(minute / 60) % 24;
  const label = `${String(hh).padStart(2, "0")}:${String(Math.floor(m)).padStart(2, "0")}`;
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={C.paper} fillOpacity={0.6} stroke={C.ink} strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => {
        const [ax, ay] = hand(i / 12, r * 0.86);
        const [bx, by] = hand(i / 12, r * 0.98);
        return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={C.graphite} strokeWidth={2} />;
      })}
      <line x1={x} y1={y} x2={hx} y2={hy} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={x} y1={y} x2={mx} y2={my} stroke={C.city} strokeWidth={3} strokeLinecap="round" />
      <text x={x} y={y + r + 52} textAnchor="middle" fontFamily={TEXT} fontSize={40} fill={C.ink} style={{ fontVariantNumeric: "tabular-nums" }}>
        {label}
      </text>
    </g>
  );
};

/** A paper caption card for text over 3D scenes: readable on a dawn, day or night sky. */
export const Caption: React.FC<{
  text: string;
  at: number;
  until?: number;
  x?: number;
  y: number;
  size?: number;
  width?: number;
  serif?: boolean;
}> = ({ text, at, until, x = MARGIN, y, size = 42, width, serif = false }) => {
  const t = useSec();
  const o = fade(t, at, until);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: width ?? 1100,
        padding: serif ? "22px 34px 26px" : "18px 28px 20px",
        background: "rgba(250,249,244,0.92)",
        boxShadow: "0 10px 40px rgba(22,27,33,0.12)",
        borderRadius: 6,
        fontFamily: serif ? DISPLAY : TEXT,
        fontSize: size,
        lineHeight: 1.2,
        color: C.ink,
        opacity: o,
        transform: `translateY(${(1 - ramp(t, at, at + 0.9)) * 14}px)`,
      }}
    >
      {text}
    </div>
  );
};
