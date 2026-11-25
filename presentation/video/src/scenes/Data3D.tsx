// The data clips as 3D sculptures on a paper table (the Studio): every sphere, tile,
// marble and column is a REAL value from public/data/*.json; nothing is typed in.
//   S05 Features (60 s) 96 readings -> 24 hourly columns -> shape around the day's average
//   S06 Weeks    (36 s) a calendar of tiles; each test round lifts whole weeks
//   S07 Results  (45 s) 149 marbles drop onto two rulers (weekday/weekend, exact day)
//   S08 Mistakes (60 s) Brussels' calendar, Christmas lifts out; holiday towers; ranking
//   S12 Limits   (22 s) three columns: one season, seven years, the week around it
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { C, DISPLAY, H, W } from "../theme";
import { applied, cityDay, DAYS, folds, mistakes, pct, results } from "../data";
import { Caption, HBar, lerp, Note, ramp, Source, Stage, useSec } from "../lib";
import { rnd, Shot } from "../three/kit";
import { Column, Pin, Studio } from "../three/World";

const Canvas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
    {children}
  </ThreeCanvas>
);

/** A slab of paper the sculpture stands on. */
const Board: React.FC<{ x: [number, number]; z: [number, number]; color?: string; y?: number }> = ({ x, z, color = "#faf9f4", y = 0 }) => (
  <mesh position={[(x[0] + x[1]) / 2, y + 0.1, (z[0] + z[1]) / 2]} receiveShadow castShadow>
    <boxGeometry args={[x[1] - x[0], 0.2, z[1] - z[0]]} />
    <meshStandardMaterial color={color} roughness={0.95} />
  </mesh>
);

const Ball: React.FC<{ p: [number, number, number]; r: number; color: string; emissive?: number; opacity?: number }> = ({ p, r, color, emissive = 0, opacity = 1 }) => (
  <mesh position={p} castShadow>
    <sphereGeometry args={[r, 18, 14]} />
    <meshStandardMaterial color={color} roughness={0.45} emissive={new THREE.Color(color)} emissiveIntensity={emissive} transparent={opacity < 1} opacity={opacity} />
  </mesh>
);

// ══ S05 Features ═══════════════════════════════════════════════════════════════════════════
const day = DAYS.wednesday;
const typ = cityDay.typical_log10 as number;
const hourly = day.hourly_log10.map((v) => v - typ); // log10(x typical) of each hour's median
const samples = day.samples;
const LIN_MAX = Math.max(...samples.map((s) => s[1])) * 1.08;
const logs = samples.map((s) => Math.log10(s[1]));
const LOG_MIN = Math.min(...logs, ...hourly) - 0.05;
const LOG_MAX = Math.max(...logs, ...hourly) + 0.05;
const MEAN = hourly.reduce((a, b) => a + b, 0) / 24;
const HGT = 9; // height of the sculpture
const xH = (minute: number) => -18 + (minute / 1440) * 36;

const S05_SHOTS: Shot[] = [
  { t: 0, pos: [9, 13, 46], look: [0, 3.2, 0], fov: 36 },
  { t: 20, pos: [4, 12, 45], look: [0, 3.2, 0], fov: 36 },
  { t: 38, pos: [-6, 13, 45], look: [0, 3.2, 0], fov: 36 },
  { t: 47, pos: [8, 13, 47], look: [3, 3.2, 0], fov: 36 },
  { t: 60, pos: [10, 13.5, 48], look: [3, 3.2, 0], fov: 36 },
];

export const S05Features: React.FC = () => {
  const t = useSec();
  const m = ramp(t, 30, 34, "inout"); // linear -> log scale
  const yOf = (v: number) => lerp((v / LIN_MAX) * HGT, ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * HGT, m);
  const bars = ramp(t, 20, 23);
  const split = ramp(t, 41, 44, "inout");
  const yMean = yOf(Math.pow(10, MEAN));
  const levelZ = day.level_raw - (cityDay.usual_level_raw as number);
  const lvl = ramp(t, 47, 49);
  const S = S05_SHOTS;
  return (
    <Stage>
      <Canvas>
        <Studio t={t} shots={S}>
          <Board x={[-19, 19]} z={[-2.2, 2.2]} />
          {/* the 96 real readings */}
          {samples.map(([mi, v], i) => {
            const o = ramp(t, 1 + i * 0.04, 1.3 + i * 0.04) * (1 - 0.85 * bars);
            if (o <= 0.01) return null;
            return <Ball key={i} p={[xH(mi + 7.5), 0.2 + yOf(v), 0]} r={0.17} color={C.ink} opacity={o} />;
          })}
          {/* one number per hour, then re-based on the day's average */}
          {hourly.map((lg, h) => {
            const top = 0.2 + yOf(Math.pow(10, lg));
            const base = lerp(0.2, 0.2 + yMean, split);
            const above = lg >= MEAN;
            const color = split > 0.5 ? (above ? C.city : C.glow) : "#2c323a";
            return <Column key={h} x={xH(h * 60 + 30)} z={0} height={top - base} base={base} grow={ramp(t, 20 + h * 0.06, 21.5 + h * 0.06)} color={color} w={1.2} d={1.6} />;
          })}
          {/* the day's average: a glass sheet */}
          {split > 0 || ramp(t, 38, 39.5) > 0 ? (
            <mesh position={[0, 0.2 + yMean, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[37, 4.4]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.45 * ramp(t, 38, 39.5)} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          ) : null}
          {/* the level: one more column, next to the station's usual day */}
          {lvl > 0 ? (
            <group position={[23, 0, 0]}>
              <Board x={[-1.8, 1.8]} z={[-1.8, 1.8]} />
              <mesh position={[0, 0.2 + HGT / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[3.4, 3.4]} />
                <meshStandardMaterial color={C.graphite} transparent opacity={0.35 * lvl} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
              <Column x={0} z={0} height={HGT / 2 + levelZ * 30} base={0.2} grow={lvl} color={C.city} w={1.4} d={1.4} />
            </group>
          ) : null}
        </Studio>
      </Canvas>
      {[0, 6, 12, 18, 24].map((h) => (
        <Pin key={h} t={t} shots={S} p={[xH(h * 60), 0, 2.6]} text={`${String(h).padStart(2, "0")}:00`} at={13} size={26} color={C.graphite} dy={34} />
      ))}
      <Pin t={t} shots={S} p={[-17, 0.2 + yMean, 2.3]} text="the day's average" at={38.5} size={30} anchor="left" dy={-40} />
      <Pin t={t} shots={S} p={[23, 0.4 + HGT / 2 + 1.2, 0]} text="level: vs this station's usual day" at={48} size={28} color={C.city} />
      <Caption text="One day becomes 25 numbers" at={0.3} y={84} serif size={66} />
      <Caption text="96 real readings: Brussels, Wednesday 15 January 2020" at={1} until={8} y={200} size={36} />
      <Caption text="1. Clean: drop sensor glitches, 100 times off the usual" at={4} until={12.5} y={200} size={36} />
      <Caption text="2. Local time: Brussels' own clock" at={12.5} until={19.5} y={200} size={36} />
      <Caption text="3. One number per hour: the middle of its 4 readings" at={19.5} until={29.5} y={200} size={36} />
      <Caption text="Then a logarithm: ten times louder becomes one step up" at={29.5} until={37.5} y={200} size={36} />
      <Caption text="4. Split the day: shape (each hour minus the day's average) and level" at={38} until={50} y={200} size={36} width={1500} />
      <Caption text="Shape: when the day was busy. Level: how loud, vs this station's usual day." at={50.5} y={200} size={36} width={1500} />
      <Caption text="24 + 1 = 25 numbers per day" at={53} y={880} size={48} serif />
      <Source text="Real data: BE.UCC, Lecocq et al. (2020); method: groundtruth/features.py" at={0.5} />
    </Stage>
  );
};

// ══ S06 Weeks ══════════════════════════════════════════════════════════════════════════════
type FDay = { date: string; dow: number; week: number; fold: number };
const FDAYS = folds.days as FDay[];
const WEEKS = [...new Set(FDAYS.map((d) => d.week))].sort((a, b) => {
  const fa = FDAYS.find((d) => d.week === a)!.date;
  const fb = FDAYS.find((d) => d.week === b)!.date;
  return fa < fb ? -1 : 1;
});
const TILE = 1.55;
const tileX = (c: number) => (c - (WEEKS.length - 1) / 2) * TILE;
const tileZ = (dow: number) => (dow - 3) * TILE;
const S06_SHOTS: Shot[] = [
  { t: 0, pos: [0, 28, 27], look: [0, 0, 1], fov: 40 },
  { t: 22, pos: [-6, 23, 26], look: [0, 0, 1], fov: 40 },
  { t: 36, pos: [-8, 22, 25], look: [0, 0, 1], fov: 40 },
];

export const S06Weeks: React.FC = () => {
  const t = useSec();
  const round = Math.min(4, Math.max(0, Math.floor((t - 2) / 4)));
  const card = ramp(t, 22.5, 23.5, "inout");
  const weekdayShare = FDAYS.filter((d) => d.dow < 5).length / FDAYS.length;
  return (
    <Stage>
      <Canvas>
        <Studio t={t} shots={S06_SHOTS}>
          <Board x={[tileX(0) - 1.4, tileX(WEEKS.length - 1) + 1.4]} z={[tileZ(0) - 1.4, tileZ(6) + 1.4]} />
          {FDAYS.map((d, i) => {
            const c = WEEKS.indexOf(d.week);
            const r0 = 2 + d.fold * 4;
            const lift = t > 2 ? ramp(t, r0, r0 + 0.7, "out") * (1 - ramp(t, r0 + 3.4, r0 + 4, "inout")) : 0;
            const appear = ramp(t, 0.3 + c * 0.05, 0.8 + c * 0.05);
            if (appear <= 0) return null;
            const test = lift > 0.5;
            return (
              <mesh key={i} position={[tileX(c), 0.35 + lift * 1.4, tileZ(d.dow)]} castShadow receiveShadow scale={[1, appear, 1]}>
                <boxGeometry args={[TILE - 0.22, 0.3, TILE - 0.22]} />
                <meshStandardMaterial color={test ? C.city : "#f1ede4"} roughness={0.7} emissive={new THREE.Color(C.city)} emissiveIntensity={test ? 0.15 : 0} />
              </mesh>
            );
          })}
        </Studio>
      </Canvas>
      <div style={{ opacity: 1 - card }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
          <Pin key={d} t={t} shots={S06_SHOTS} p={[tileX(0) - 1.6, 0.3, tileZ(i)]} text={d} at={0.5} size={28} color={C.graphite} anchor="right" />
        ))}
      </div>
      <Caption text="Tested on weeks it never saw" at={0.3} until={22.5} y={84} serif size={66} />
      <Caption text={`Brussels: ${folds.n_days} ordinary days in ${folds.n_weeks} weeks. A whole week is always on one side.`} at={0.6} until={22.5} y={200} size={34} width={1500} />
      <Caption text={`Round ${round + 1} of 5: the raised orange weeks are the test; the rest train the model`} at={2} until={22.5} y={900} size={38} width={1500} />
      {/* graded fairly */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: 0.93 * card }} />
      {card > 0 ? (
        <>
          <div style={{ position: "absolute", left: 120, top: 84, fontFamily: DISPLAY, fontSize: 76, opacity: card }}>Graded fairly</div>
          <Note text="A lazy model that always says weekday:" at={23.5} x={120} y={200} width={1600} color={C.ink} />
          <HBar label="weekdays right" value={1} at={24.5} x={120} y={300} width={760} color={C.city} />
          <HBar label="weekend days right" value={0} at={25.5} x={120} y={470} width={760} color={C.glow} />
          <Note text={`Plain accuracy in Brussels: ${Math.round(weekdayShare * 100)}%. It learned nothing.`} at={27} x={1200} y={300} width={640} size={40} color={C.loud} />
          <Note text="Balanced accuracy: the average of the two" at={29} x={1200} y={450} width={640} size={40} color={C.ink} />
          <div style={{ position: "absolute", left: 1200, top: 570, fontFamily: DISPLAY, fontSize: 150, opacity: ramp(t, 30, 31) }}>50%</div>
          <div style={{ position: "absolute", left: 120, top: 760, fontFamily: DISPLAY, fontSize: 48, opacity: ramp(t, 31.5, 32.5) }}>
            balanced accuracy = ½ (weekdays right + weekend days right)
          </div>
          <Note text="Guessing gets 50%. Anything above, the model has learned." at={33} x={120} y={860} width={1700} />
        </>
      ) : null}
      <Source text="Real folds: GroupKFold(5) by week, BE.UCC ordinary days" at={0.5} until={22.5} />
    </Stage>
  );
};

// ══ S07 Results ════════════════════════════════════════════════════════════════════════════
const RX = (v: number) => -20 + v * 40;
const ROWS = [
  { key: "weekend" as const, z: -5, at: 1, chance: 0.5, median: results.weekend_median, label: "Weekday or weekend" },
  { key: "dow" as const, z: 6, at: 15, chance: 1 / 7, median: results.dow_median, label: "Exact day of the week" },
];
const ST = results.stations as { station: string; weekend: number | null; dow: number | null }[];
const CONTROLS = new Set((results.controls as { station: string }[]).map((c) => c.station));
const S07_SHOTS: Shot[] = [
  { t: 0, pos: [0, 32, 40], look: [0, 0, 0], fov: 38 },
  { t: 6, pos: [8, 17, 22], look: [5, 0, -5], fov: 40 }, // the weekend row, near its median
  { t: 15, pos: [0, 24, 36], look: [0, 0, 2], fov: 38 },
  { t: 21, pos: [-4, 17, 30], look: [-2, 0, 6], fov: 40 }, // the exact-day row
  { t: 26, pos: [2, 18, 20], look: [2, 0, -5], fov: 40 }, // the controls, near chance
  { t: 33, pos: [-4, 18, 32], look: [-2, 0, 5], fov: 40 }, // loudness vs shape
  { t: 45, pos: [0, 30, 40], look: [0, 0, 1], fov: 38 },
];

const Ruler: React.FC<{ z: number; chance: number }> = ({ z, chance }) => (
  <group>
    <Board x={[-21, 21]} z={[z - 2.2, z + 2.2]} />
    {[0, 0.25, 0.5, 0.75, 1].map((v) => (
      <mesh key={v} position={[RX(v), 0.22, z + 2.05]}>
        <boxGeometry args={[0.08, 0.04, 0.4]} />
        <meshStandardMaterial color={C.graphite} />
      </mesh>
    ))}
    {/* guessing: a thin standing line */}
    <mesh position={[RX(chance), 1.2, z]}>
      <boxGeometry args={[0.05, 2.2, 4.2]} />
      <meshStandardMaterial color={C.graphite} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  </group>
);

const Flag: React.FC<{ x: number; z: number; color: string; rise: number; h?: number }> = ({ x, z, color, rise, h = 4 }) =>
  rise <= 0 ? null : (
    <group position={[x, 0.2, z - 2.6]} scale={[1, rise, 1]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, h, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.8, h - 0.5, 0]} castShadow>
        <boxGeometry args={[1.6, 0.9, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );

export const S07Results: React.FC = () => {
  const t = useSec();
  const ctrl = ramp(t, 25, 26.5);
  const loud = ramp(t, 33, 34);
  const arrow = ramp(t, 35, 37, "inout");
  const sl = results.shape_vs_level;
  const S = S07_SHOTS;
  return (
    <Stage>
      <Canvas>
        <Studio t={t} shots={S} extent={45}>
          {ROWS.map((r) => (
            <group key={r.key}>
              {t > r.at ? <Ruler z={r.z} chance={r.chance} /> : null}
              {ST.map((s, i) => {
                const v = s[r.key];
                if (v === null || v === undefined) return null;
                const at = r.at + 0.3 + i * 0.03;
                const d = ramp(t, at, at + 0.9, "linear");
                if (d <= 0) return null;
                const fall = Math.max(0, 1 - d * 1.4);
                const bounce = d > 0.72 ? Math.abs(Math.sin((d - 0.72) * Math.PI * 3.6)) * 0.6 * (1 - d) : 0;
                const isCtrl = CONTROLS.has(s.station) && r.key === "weekend";
                const rr = isCtrl ? 0.34 + 0.16 * ctrl : 0.26;
                const zj = r.z + (rnd(i + (r.key === "dow" ? 500 : 0)) - 0.5) * 3.2;
                return (
                  <Ball
                    key={s.station}
                    p={[RX(v), 0.2 + rr + fall * fall * 14 + bounce, zj]}
                    r={rr}
                    color={isCtrl && ctrl > 0 ? C.city : "#2c323a"}
                    emissive={isCtrl ? 0.5 * ctrl : 0}
                  />
                );
              })}
              <Flag x={RX(r.median)} z={r.z} color={C.glow} rise={ramp(t, r.at + 5, r.at + 6)} />
            </group>
          ))}
          {/* promise two: loudness alone, then the shape added */}
          <Flag x={RX(sl.level_dow_median)} z={ROWS[1].z} color={C.loud} rise={loud} h={3} />
          {arrow > 0 ? (
            <mesh position={[(RX(sl.level_dow_median) + lerp(RX(sl.level_dow_median), RX(results.dow_median), arrow)) / 2, 3.2, ROWS[1].z - 2.6]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.09, 0.09, Math.max(0.01, (RX(results.dow_median) - RX(sl.level_dow_median)) * arrow), 8]} />
              <meshStandardMaterial color={C.ink} />
            </mesh>
          ) : null}
        </Studio>
      </Canvas>
      {ROWS.map((r) => (
        <React.Fragment key={r.key}>
          <Pin t={t} shots={S} p={[-21, 0.3, r.z - 2.4]} text={r.label} at={r.at} size={32} color={C.ink} anchor="left" dy={-30} />
          <Pin t={t} shots={S} p={[RX(r.chance), 2.5, r.z]} text={`guessing ${Math.round(r.chance * 1000) / 10}%`} at={r.at + 0.5} size={24} color={C.graphite} />
          <Pin t={t} shots={S} p={[RX(r.median), 4.4, r.z - 2.6]} text={pct(r.median)} at={r.at + 6} size={56} serif color={C.glow} />
          {[0, 0.5, 1].map((v) => (
            <Pin key={v} t={t} shots={S} p={[RX(v), 0.2, r.z + 2.4]} text={`${v * 100}%`} at={r.at} size={22} color={C.graphite} dy={30} />
          ))}
        </React.Fragment>
      ))}
      <Pin t={t} shots={S} p={[RX(results.shape_vs_level.level_dow_median), 3.4, ROWS[1].z - 2.6]} text={`loudness alone: ${pct(results.shape_vs_level.level_dow_median)}`} at={33.5} size={28} color={C.loud} />
      <Caption text={`${results.n_stations} seismometers, one model each`} at={0.3} until={25} y={84} serif size={60} />
      <Caption text="Controls picked in advance: a mountain near Mammoth Lakes, the Kalahari, the tip of Chile. No people, no rhythm." at={25} until={32.5} y={84} size={36} width={1500} />
      <Caption
        text={`Promise two: add the shape, +${Math.round(results.shape_vs_level.median_gain_dow * 100)} points. ${results.shape_vs_level.stations_gain_gt_2pp} of ${results.n_stations} seismometers improve.`}
        at={36}
        y={84}
        size={40}
        width={1500}
      />
      <Source text="Results 1 to 3, docs/04-results.md (scores on weeks each model never saw)" at={1} />
    </Stage>
  );
};

// ══ S08 Mistakes ═══════════════════════════════════════════════════════════════════════════
type CalDay = { date: string; dow: number; pred: number | null; confusion: number | null; period: string; holiday: string };
const CAL = (mistakes.calendar as CalDay[]).filter((d) => d.date < "2020-03-14");
const weekOf = (date: string) => Math.floor((new Date(`${date}T12:00:00Z`).getTime() - new Date("2019-10-28T12:00:00Z").getTime()) / (7 * 864e5));
const NW = Math.max(...CAL.map((d) => weekOf(d.date))) + 1;
const CT = 1.45;
const cX = (w: number) => (w - (NW - 1) / 2) * CT;
const cZ = (dow: number) => (dow - 3) * CT;
const TOP = (mistakes.calendar as CalDay[])
  .filter((d) => (d.period === "baseline" || d.period === "holiday") && d.confusion !== null)
  .sort((a, b) => b.confusion! - a.confusion!)
  .slice(0, 8);
const shortDate = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const TOWERS = { x: 70 };
const RANK = { x: 140 };
const S08_SHOTS: Shot[] = [
  { t: 0, pos: [0, 30, 27], look: [0, 0, 1], fov: 40 }, // the calendar
  { t: 6, pos: [cX(weekOf("2019-12-25")) + 3, 15, 19], look: [cX(weekOf("2019-12-25")), 1.5, cZ(2)], fov: 40 }, // Christmas
  { t: 16, pos: [cX(weekOf("2019-12-25")) + 5, 16, 20], look: [cX(weekOf("2019-12-25")), 1.5, cZ(2)], fov: 40 },
  { t: 20, pos: [TOWERS.x + 2, 10, 31], look: [TOWERS.x, 4.6, 0], fov: 40 }, // the two towers
  { t: 32, pos: [TOWERS.x - 3, 10, 30], look: [TOWERS.x, 4.6, 0], fov: 40 },
  { t: 36, pos: [RANK.x, 15, 40], look: [RANK.x, 3.2, 0], fov: 40 }, // the ranking
  { t: 60, pos: [RANK.x + 3, 14.5, 39], look: [RANK.x, 3.2, 0], fov: 40 },
];

export const S08Mistakes: React.FC = () => {
  const t = useSec();
  const S = S08_SHOTS;
  const xmasLift = ramp(t, 5, 7, "inout");
  const hol = mistakes.holidays_called_weekend;
  const ord = mistakes.ordinary_called_weekend;
  const named = mistakes.named_holidays as { name: string; n: number; called_weekend: number }[];
  return (
    <Stage>
      <Canvas>
        <Studio t={t} shots={S} extent={60}>
          {/* the calendar: blue = the model read it as a weekend; orange rim = a public holiday */}
          <Board x={[cX(0) - 1.3, cX(NW - 1) + 1.3]} z={[cZ(0) - 1.3, cZ(6) + 1.3]} />
          {CAL.map((d, i) => {
            const w = weekOf(d.date);
            const weekend = d.pred !== null && d.pred >= 5;
            const isX = d.date === "2019-12-25";
            const a = ramp(t, 0.3 + w * 0.05, 0.8 + w * 0.05);
            if (a <= 0) return null;
            const y = 0.38 + (isX ? xmasLift * 2.2 : 0);
            const color = weekend ? C.glow : d.period === "festive" ? "#ddd6c8" : "#f1ede4";
            return (
              <group key={i} position={[cX(w), y, cZ(d.dow)]} rotation={[isX ? -0.5 * xmasLift : 0, 0, 0]} scale={[1, a, 1]}>
                {d.period === "holiday" ? (
                  <mesh position={[0, -0.04, 0]} castShadow>
                    <boxGeometry args={[CT - 0.12, 0.26, CT - 0.12]} />
                    <meshStandardMaterial color={C.city} emissive={new THREE.Color(C.city)} emissiveIntensity={0.25} />
                  </mesh>
                ) : null}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[CT - (d.period === "holiday" ? 0.42 : 0.22), 0.3, CT - (d.period === "holiday" ? 0.42 : 0.22)]} />
                  <meshStandardMaterial color={color} roughness={0.7} />
                </mesh>
              </group>
            );
          })}
          {/* holidays it never saw vs ordinary weekdays: share called weekend */}
          <group position={[TOWERS.x, 0, 0]}>
            <Board x={[-6, 6]} z={[-3, 3]} />
            <Column x={-2.5} z={0} height={10 * hol} base={0.2} grow={ramp(t, 19, 21)} color={C.city} w={3} d={3} />
            <Column x={2.5} z={0} height={10 * ord} base={0.2} grow={ramp(t, 21.5, 23)} color={C.graphite} w={3} d={3} />
            <mesh position={[0, 10.2, -1.6]}>
              <boxGeometry args={[11, 0.04, 0.04]} />
              <meshStandardMaterial color={C.rule} />
            </mesh>
          </group>
          {/* ranking every day by confusion: the top 8 */}
          <group position={[RANK.x, 0, 0]}>
            <Board x={[-16, 16]} z={[-2.5, 2.5]} />
            {TOP.map((d, i) => (
              <Column
                key={d.date}
                x={-14 + i * 4}
                z={0}
                height={8 * d.confusion!}
                base={0.2}
                grow={ramp(t, 34 + i * 0.6, 35.4 + i * 0.6)}
                color={d.period === "holiday" ? C.city : C.graphite}
                w={2.4}
                d={2.4}
              />
            ))}
          </group>
        </Studio>
      </Canvas>
      {/* labels */}
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
        <Pin key={d} t={t} shots={S} p={[cX(0) - 1.5, 0.3, cZ(i)]} text={d} at={0.5} until={17.5} size={26} color={C.graphite} anchor="right" />
      ))}
      <Pin t={t} shots={S} p={[cX(weekOf("2019-12-25")), 3.6, cZ(2)]} text="Wed 25 Dec 2019: it said Sunday" at={7} until={17.5} size={40} weight={500} />
      <Pin t={t} shots={S} p={[TOWERS.x - 2.5, 0.4 + 10 * hol, 0]} text={pct(hol)} at={20.5} until={33} size={64} serif dy={-10} />
      <Pin t={t} shots={S} p={[TOWERS.x + 2.5, 0.4 + 10 * ord, 0]} text={pct(ord)} at={22.5} until={33} size={64} serif dy={-10} />
      <Pin t={t} shots={S} p={[TOWERS.x - 2.5, 0.2, 1.6]} text="weekday holidays it never saw" at={20} until={33} size={28} color={C.city} dy={46} />
      <Pin t={t} shots={S} p={[TOWERS.x + 2.5, 0.2, 1.6]} text="ordinary weekdays" at={21.5} until={33} size={28} color={C.graphite} dy={46} />
      {TOP.map((d, i) => (
        <React.Fragment key={d.date}>
          <Pin t={t} shots={S} p={[RANK.x - 14 + i * 4, 0.2, 1.4]} text={shortDate(d.date)} at={34.5 + i * 0.6} size={22} color={C.ink} dy={36} />
          {d.period === "holiday" ? <Pin t={t} shots={S} p={[RANK.x - 14 + i * 4, 0.3 + 8 * d.confusion!, 0]} text={d.holiday} at={35 + i * 0.6} size={24} color={C.city} weight={600} dy={i % 2 ? -40 : -8} /> : null}
        </React.Fragment>
      ))}
      <Caption text="Its mistakes find the holidays" at={0.3} until={17.5} y={84} serif size={64} />
      <Caption text="Brussels, every day until lockdown. Blue: read as a weekend. Orange rim: a public holiday it never trained on." at={0.8} until={17.5} y={196} size={32} width={1550} />
      <Caption text={`So did the models in ${pct(mistakes.christmas.share_called_sunday)} of cities`} at={10} until={17.5} y={880} size={40} />
      <Caption text="Holidays it never saw: share read as a weekend" at={18} until={33} y={84} serif size={56} width={1500} />
      <Caption text={`${mistakes.n_holidays} weekday public holidays in ${mistakes.n_stations} cities`} at={18.5} until={33} y={190} size={32} />
      <Caption
        text={named.map((h) => `${h.name}: ${pct(h.called_weekend)}`).join("   ·   ") + "   (most American offices stay open on Veterans Day)"}
        at={24.5}
        until={33}
        y={880}
        size={32}
        width={1600}
      />
      <Caption text="Confusion = 1 − P(the real day). Brussels' most surprising days:" at={33.5} y={84} size={40} width={1500} />
      <Caption text={`Better than a standard “unusual day” alarm in ${mistakes.confusion_wins} of ${mistakes.n_stations} cities`} at={41} y={900} size={42} serif width={1500} />
      <Source text="Results 4, 7 and 8, docs/04-results.md; Brussels BE.UCC" at={0.5} />
    </Stage>
  );
};

// ══ S12 Limits ═════════════════════════════════════════════════════════════════════════════
const S12_SHOTS: Shot[] = [
  { t: 0, pos: [12, 12, 33], look: [0, 5, 0], fov: 38 },
  { t: 22, pos: [-8, 11, 33], look: [0, 5, 0], fov: 38 },
];
const LIMITS = [
  { x: -7, v: results.dow_median, label: `One season, ${results.n_stations} seismometers`, color: C.graphite, at: 2 },
  { x: 0, v: applied.exact_one_day_median, label: "Seven years, 33 cities", color: "#2c323a", at: 5 },
  { x: 7, v: applied.exact_week_median, label: "Given the whole week around it", color: C.glow, at: 14 },
];

export const S12Limits: React.FC = () => {
  const t = useSec();
  const S = S12_SHOTS;
  return (
    <Stage>
      <Canvas>
        <Studio t={t} shots={S}>
          <Board x={[-11, 11]} z={[-3, 3]} />
          {/* guessing: one in seven */}
          <mesh position={[0, 0.2 + 10 / 7, 0]}>
            <boxGeometry args={[21, 0.03, 5.6]} />
            <meshStandardMaterial color={C.graphite} transparent opacity={0.25} depthWrite={false} />
          </mesh>
          {LIMITS.map((l) => (
            <Column key={l.x} x={l.x} z={0} height={10 * l.v} base={0.2} grow={ramp(t, l.at, l.at + 1.6, "inout")} color={l.color} w={3.4} d={3.4} />
          ))}
        </Studio>
      </Canvas>
      {LIMITS.map((l) => (
        <React.Fragment key={l.x}>
          <Pin t={t} shots={S} p={[l.x, 0.4 + 10 * l.v * ramp(t, l.at, l.at + 1.6, "inout"), 0]} text={pct(l.v)} at={l.at + 0.6} size={60} serif dy={-6} />
          <Pin t={t} shots={S} p={[l.x, 0.2, 1.8]} text={l.label} at={l.at} size={26} color={C.graphite} dy={44} />
        </React.Fragment>
      ))}
      <Pin t={t} shots={S} p={[-10.6, 0.2 + 10 / 7, 0]} text="guessing" at={1} size={24} color={C.graphite} anchor="right" />
      <Caption text="What else didn't work: the exact day" at={0.3} y={60} serif size={56} />
      <Caption text="Naming the exact day from one day of shaking. Guessing gets one in seven." at={0.8} until={8.5} y={900} size={34} width={1500} />
      <Caption text="More days helped, then flattened. A Tuesday and a Thursday simply sound alike." at={9} y={900} size={36} width={1500} />
      <Source text="Results 3, 17 and 18, docs/04-results.md" at={0.5} />
    </Stage>
  );
};

