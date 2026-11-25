// The talk's framing clips as 3D scenes in the same city as C1:
//   S00 Questions  (45 s) the morning commute; the questions appear one by one
//   S01 Christmas  (20 s) the same city on Christmas morning, and its real day of shaking
//   S02 Promises   (30 s) paper signs rise on the plaza: five promises and the dare
//   S13 Scorecard  (22 s) the same signs, stamped with the real results
//   S14 Close      (32 s) out of the vault, up over the city at dusk; the title
// The city is an ILLUSTRATION; how busy it is comes from the real Brussels hourly rhythm.
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame } from "remotion";
import { C, DISPLAY, H, W } from "../theme";
import { busyOn, cityDay, mistakes, pct as pctText, results } from "../data";
import { Caption, fade, IllustrationTag, lerp, ramp, Source, Stage, useSec } from "../lib";
import { DayAxes, DayTrace } from "../DayChart";
import { Shot } from "../three/kit";
import { CityWorld, PaperSign, SignFace } from "../three/World";

/** A paper card whose text types itself out (Newsreader). */
const QCard: React.FC<{ text: string; at: number; until?: number; x?: number; y: number; size: number; italic?: boolean; color?: string; width?: number; center?: boolean }> = ({
  text,
  at,
  until,
  x = 120,
  y,
  size,
  italic = false,
  color = C.ink,
  width = 1500,
  center = false,
}) => {
  const t = useSec();
  const n = Math.round(ramp(t, at, at + Math.max(0.8, text.length * 0.045), "linear") * text.length);
  const o = fade(t, at, until, 0.5);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: center ? W / 2 : x,
        top: y,
        transform: center ? "translateX(-50%)" : undefined,
        maxWidth: width,
        padding: "22px 36px 28px",
        background: "rgba(250,249,244,0.93)",
        boxShadow: "0 12px 44px rgba(22,27,33,0.14)",
        borderRadius: 6,
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 1.1,
        fontStyle: italic ? "italic" : "normal",
        color,
        opacity: o,
        textAlign: center ? "center" : "left",
      }}
    >
      <span>{text.slice(0, n)}</span>
      <span style={{ opacity: 0 }}>{text.slice(n)}</span>
    </div>
  );
};

/** A strip card at the bottom with a real day of shaking drawing itself. */
const TraceStrip: React.FC<{ which: "wednesday" | "christmas"; at: number; draw: [number, number]; until?: number }> = ({ which, at, draw, until }) => {
  const t = useSec();
  const b = { x0: 220, x1: 1700, y0: 800, y1: 950 };
  const o = fade(t, at, until);
  if (o <= 0) return null;
  return (
    <>
      <div style={{ position: "absolute", left: b.x0 - 60, top: b.y0 - 40, width: b.x1 - b.x0 + 120, height: b.y1 - b.y0 + 110, background: "rgba(250,249,244,0.94)", borderRadius: 8, boxShadow: "0 10px 40px rgba(22,27,33,0.12)", opacity: o }} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: o }}>
        <DayAxes b={b} typicalLine={false} size={22} opacity={0.5} />
        <DayTrace which={which} b={b} progress={ramp(t, draw[0], draw[1], "inout")} width={3.5} color={C.ink} />
      </svg>
    </>
  );
};

// ── S00 Questions ─────────────────────────────────────────────────────────────────────────
const S00_SHOTS: Shot[] = [
  { t: 0, pos: [-38, 2.1, 2.7], look: [0, 1.3, 5.2], fov: 44 }, // on the pavement, the morning rush
  { t: 12, pos: [-16, 2.4, 2.8], look: [10, 1.4, 5.6], fov: 44 },
  { t: 22, pos: [-4, 10, 28], look: [6, 1, 6], fov: 40 }, // up over the plaza
  { t: 33, pos: [32, 32, 74], look: [0, 0, 0], fov: 34 }, // the whole city
  { t: 45, pos: [52, 46, 92], look: [0, -2, 0], fov: 32 },
];

export const S00Questions: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const minute = 8 * 60 + 20 + t * 0.6;
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={minute} busy={busyOn("wednesday", minute)} shots={S00_SHOTS} />
      </ThreeCanvas>
      <QCard text="How did you get here today?" at={0.5} until={14} y={84} size={84} />
      <Caption text="By car? By bus? On foot?" at={3} until={7} y={232} size={44} />
      <Caption text="Every one of you just shook the ground. A few tens of nanometres, but it shook." at={7.5} until={14} y={232} size={42} width={1500} />
      <QCard text="What day is it?" at={14.5} until={29} y={84} size={84} />
      <QCard text="How do you know?" at={20} until={29} x={760} y={84} size={84} italic color={C.city} />
      <QCard text="Can a seismometer tell what day of the week it is?" at={29.5} y={330} size={96} width={1500} center />
      <IllustrationTag />
    </Stage>
  );
};

// ── S01 Christmas ─────────────────────────────────────────────────────────────────────────
const S01_SHOTS: Shot[] = [
  { t: 0, pos: [44, 24, 62], look: [0, 0, 12], fov: 34 },
  { t: 20, pos: [-14, 22, 68], look: [0, 0, 12], fov: 34 },
];

/** A Christmas tree for the plaza (it only appears once the date is revealed). */
const XmasTree: React.FC<{ grow: number; t: number }> = ({ grow, t }) => {
  if (grow <= 0) return null;
  return (
    <group position={[0, 0, 22]} scale={grow}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 1.2, 8]} />
        <meshStandardMaterial color="#7a5c40" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 2 + i * 1.5, 0]} castShadow>
          <coneGeometry args={[2.6 - i * 0.7, 2.4, 9]} />
          <meshStandardMaterial color="#5f7d55" flatShading roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 6.6, 0]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#f5c26b" emissive="#f5a63c" emissiveIntensity={0.8 + 0.3 * Math.sin(t * 4)} />
      </mesh>
      {Array.from({ length: 14 }, (_, k) => {
        const a = k * 2.4;
        const h = 1.4 + (k % 7) * 0.65;
        const r = 2.3 - h * 0.28;
        return (
          <mesh key={k} position={[Math.cos(a) * r, h, Math.sin(a) * r]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={k % 2 ? "#a7480c" : "#f5993c"} emissive={k % 2 ? "#a7480c" : "#f5993c"} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};

export const S01Christmas: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const minute = 10 * 60 + t * 3;
  const reveal = ramp(t, 12.5, 14.5);
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={minute} busy={busyOn("christmas", minute)} shots={S01_SHOTS}>
          <XmasTree grow={reveal} t={t} />
        </CityWorld>
      </ThreeCanvas>
      <Caption text="Weekday or weekend?" at={0.4} until={12.5} y={84} serif size={96} />
      <Caption text="One day of shaking, recorded underground in Brussels" at={1.5} until={12.5} y={240} size={38} />
      <TraceStrip which="christmas" at={1} draw={[1.5, 11]} />
      <Caption text="Wednesday, 25 December 2019" at={13} y={84} serif size={84} width={1500} />
      <Caption text="Our model said: Sunday" at={16} y={240} size={52} />
      <Source text={`Real data: ${cityDay.station}, Lecocq et al. (2020). The street follows that day's real rhythm; the city is an illustration.`} at={1} />
    </Stage>
  );
};

// ── the signs on the plaza (S02, S13) ─────────────────────────────────────────────────────
const ARC = { cx: 0, cz: 37, r: 17 };
const signAt = (i: number, n: number) => {
  const a = lerp(-0.86, 0.86, i / (n - 1));
  const x = ARC.cx + ARC.r * Math.sin(a);
  const z = ARC.cz - ARC.r * Math.cos(a);
  // each sign turns to face where the camera ends up
  return { pos: [x, 0, z] as [number, number, number], rotY: Math.atan2(0 - x, 45 - z) };
};
const SIGN_LOOK = (i: number, n: number): [number, number, number] => {
  const s = signAt(i, n);
  return [s.pos[0], 2.6, s.pos[2]];
};

const PROMISES: SignFace[] = [
  { kicker: "01", body: "A model that reads the day from the ground" },
  { kicker: "02", body: "Test whether the shape of a day beats how loud it is" },
  { kicker: "03", body: "Let its mistakes find unusual days" },
  { kicker: "04", body: "Show it holidays it has never seen" },
  { kicker: "05", body: "Move it to another city" },
  { kicker: "The dare", kickerItalic: true, body: "Subtract the people, and see the small earthquakes underneath", dashed: true },
];

const s02Shots = (): Shot[] => {
  const shots: Shot[] = [{ t: 0, pos: [0, 9, 52], look: [0, 2, 22], fov: 36 }];
  for (let i = 0; i < 6; i++) {
    const at = 4 + i * 2.2 + (i === 5 ? 2 : 0);
    shots.push({ t: at + 0.9, pos: [0, 4.4, ARC.cz + 2], look: SIGN_LOOK(i, 6), fov: 40 });
  }
  shots.push({ t: 23, pos: [0, 5, 46], look: [0, 2.7, 22], fov: 48 });
  shots.push({ t: 30, pos: [0, 4.9, 45.4], look: [0, 2.7, 22], fov: 48 });
  return shots;
};
const S02_SHOTS = s02Shots();

export const S02Promises: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const minute = 15 * 60 + 20;
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={minute} busy={busyOn("wednesday", minute)} shots={S02_SHOTS} plazaTrees={false}>
          {PROMISES.map((f, i) => {
            const s = signAt(i, 6);
            const at = 4 + i * 2.2 + (i === 5 ? 2 : 0);
            return <PaperSign key={i} face={f} position={s.pos} rotY={s.rotY} w={5} h={3.4} rise={ramp(t, at, at + 1.2, "out")} />;
          })}
        </CityWorld>
      </ThreeCanvas>
      <Caption text="Last time, we promised" at={0.3} until={22} y={84} serif size={72} />
      <Caption text="Can a seismometer tell what day of the week it is?" at={1.2} until={22} y={210} size={38} />
      <Caption text="Today: all of it, including the part that didn't work." at={23} y={84} serif size={56} />
      <Source text="From our proposal talk. The city is an illustration." at={1} />
    </Stage>
  );
};

// ── S13 Scorecard ─────────────────────────────────────────────────────────────────────────
const SCORE: SignFace[] = [
  { body: "Read the day from the ground", result: pctText(results.weekend_median), resultNote: "weekday or weekend", tick: "yes" },
  { body: "Shape beats loudness", result: `+${Math.round(results.shape_vs_level.median_gain_dow * 100)} points`, resultNote: "on the exact day", tick: "yes" },
  { body: "Mistakes find holidays", result: `${mistakes.confusion_wins} of ${mistakes.n_stations}`, resultNote: "cities beat the usual alarm", tick: "yes" },
  { body: "Holidays it never saw", result: pctText(mistakes.holidays_called_weekend), resultNote: "called weekend", tick: "yes" },
  { body: "Another city", result: pctText(results.unseen_city_pooled_weekend), resultNote: "on cities it never saw", tick: "yes" },
  { body: "The dare: subtract the people", result: "not yet", tick: "open", dashed: true },
];
const S13_SHOTS: Shot[] = [
  { t: 0, pos: [0, 5.2, 47], look: [0, 2.7, 22], fov: 48 },
  { t: 22, pos: [0, 4.9, 45.4], look: [0, 2.7, 22], fov: 48 },
];

export const S13Scorecard: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const minute = 16 * 60 + 15;
  const step = 3.2;
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={minute} busy={busyOn("wednesday", minute)} shots={S13_SHOTS} plazaTrees={false}>
          {SCORE.map((f, i) => {
            const s = signAt(i, 6);
            return <PaperSign key={i} face={f} position={s.pos} rotY={s.rotY} w={5} h={3.4} rise={ramp(t, 0.2 + i * 0.15, 1.2 + i * 0.15)} stamp={ramp(t, 1 + i * step, 1.5 + i * step)} />;
          })}
        </CityWorld>
      </ThreeCanvas>
      <Caption text="The scorecard" at={0.3} y={84} serif size={72} />
      <Source text="Results 1 to 8 and 19, docs/04-results.md. The city is an illustration." at={1} />
    </Stage>
  );
};

// ── S14 Close ─────────────────────────────────────────────────────────────────────────────
const S14_SHOTS: Shot[] = [
  { t: 0, pos: [5.4, -8.7, 18.6], look: [4.1, -9.4, 11.6], fov: 34 }, // the seismometer, again
  { t: 7, pos: [8, 3, 42], look: [0, -5, 8], fov: 36 }, // up out of the ground
  { t: 17, pos: [34, 38, 92], look: [0, -2, 0], fov: 34 }, // over the city
  { t: 32, pos: [62, 62, 128], look: [0, 0, 0], fov: 32 },
];

export const S14Close: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const minute = 16 * 60 + 40 + t * 3.5; // dusk into evening: the windows come on
  const title = ramp(t, 24, 25.5);
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={minute} busy={busyOn("wednesday", minute)} open={1} ripples={0.6} shake={0.08} shots={S14_SHOTS} />
      </ThreeCanvas>
      <Caption text="Still useless?" at={0.3} until={23.5} y={84} serif size={96} />
      <Caption text="Already buried under many of the world's cities. Decades of recordings, free." at={7} until={23.5} y={240} size={38} width={1500} />
      <Caption text="It hears a neighbourhood's vibration, not people: no phones, no cameras." at={10.5} until={23.5} y={330} size={38} width={1500} />
      <TraceStrip which="wednesday" at={5} draw={[5.5, 14]} until={23.5} />
      <Caption
        text="Everyone measures how loud the ground is. We taught a model what the ground normally sounds like, and its mistakes told us when something happened."
        at={15.5}
        until={23.5}
        y={430}
        size={40}
        width={1500}
        serif
      />
      {/* the title, over the evening city */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(245,241,235,0) 20%, rgba(245,241,235,0.86) 52%, rgba(245,241,235,0.95))", opacity: title }} />
      <div style={{ position: "absolute", left: 0, width: W, top: 470, textAlign: "center", fontFamily: DISPLAY, fontSize: 160, color: C.ink, opacity: title }}>GroundTruth</div>
      <div style={{ position: "absolute", left: 0, width: W, top: 690, textAlign: "center", fontSize: 40, color: C.ink, opacity: ramp(t, 25, 26) }}>Aadit Chandra, Shraddha Pradeep, Aradhya Gupta</div>
      <div style={{ position: "absolute", left: 0, width: W, top: 750, textAlign: "center", fontSize: 36, color: C.graphite, opacity: ramp(t, 25.6, 26.6) }}>Foundations of Data Science, BITS Pilani</div>
      <div style={{ position: "absolute", left: 0, width: W, top: 840, textAlign: "center", fontSize: 40, color: C.sea, opacity: ramp(t, 26.4, 27.4) }}>Running live tonight: groundtruth-seismic.vercel.app</div>
      <div style={{ position: "absolute", left: 0, width: W, top: 920, textAlign: "center", fontSize: 40, color: C.ink, opacity: ramp(t, 28, 29) }}>Thank you. Questions?</div>
      <Source text={`Real data: ${cityDay.station}, Brussels, Wednesday 15 January 2020. The city is an illustration.`} at={5} until={23.5} />
    </Stage>
  );
};
