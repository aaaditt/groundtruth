// C2 "Two kinds of shaking" (60 s): the 3D cutscene for slide 5.
//
// Part A (illustration): a coast in cross-section. The sea rolls long, slow swells; they
// push big, slow waves into the ground (blue). The city's cars send small, quick ripples
// (orange). Both reach the seismometer.
// Part B (REAL DATA): a landscape built from a year of Brussels' recent recordings
// (spectrum.json: BE.UCC, MUSTANG noise PSD, weekday median per hour and frequency). Time
// runs left to right, speed of wobble from back (slow, the sea) to front (fast, people),
// height = how strong. As the clock runs, the sea ridge stays put; the front rises at 6 am.
// Part C (REAL DATA): how well each band reads the weekend (bands.json, Result 12).
import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { C, DISPLAY, H, TEXT, W } from "../theme";
import { bands, spectrum } from "../data";
import { Caption, Clock, fade, HBar, IllustrationTag, lerp, Note, ramp, Source, Stage, useAmbient, useSec } from "../lib";
import { Atmosphere, CameraPath, DayLights, P, rnd, screenOf, Shot } from "../three/kit";
import { Box, M } from "../three/City";

// ======================= Part A: the coast ===================================================
const FACE = 12; // z of the cut face
const SEA_X = -12; // the coastline
const LAYERS: [number, number, THREE.Material][] = [
  [-2.4, -0.25, M.soil1],
  [-4.8, -2.4, M.soil3],
  [-7.6, -4.8, M.soil2],
  [-11.4, -7.6, M.rock1],
  [-16, -11.4, M.rock2],
];
const water = new THREE.MeshStandardMaterial({ color: P.sea, roughness: 0.35, metalness: 0.05, flatShading: true });
const waterFace = new THREE.MeshStandardMaterial({ color: "#5f8db5", roughness: 0.6, transparent: true, opacity: 0.92 });
const sand = new THREE.MeshStandardMaterial({ color: P.sand, roughness: 0.95, flatShading: true });

const COAST_BLDS = Array.from({ length: 22 }, (_, i) => {
  const col = i % 11;
  const row = Math.floor(i / 11);
  const x0 = 4 + col * 5.2 + rnd(i) * 0.6;
  const z0 = row === 0 ? -9 : -2.2;
  return { x: [x0, x0 + 3.6 + rnd(i + 3) * 0.8] as [number, number], z: [z0, z0 + 4.4] as [number, number], h: 4 + rnd(i + 7) * (row === 0 ? 12 : 7), m: [M.wallA, M.wallB, M.wallC, M.wallD][i % 4] };
});
const COAST_CARS = Array.from({ length: 10 }, (_, i) => ({ lane: i % 2, phase: i * 6.4 + rnd(i) * 2, m: M.car[i % M.car.length] }));
const carX = (c: (typeof COAST_CARS)[number], t: number) => {
  const span = 56;
  const raw = c.phase + (c.lane === 0 ? 1 : -1) * 4 * t;
  return 2 + (((raw % span) + span) % span);
};

const Swell: React.FC<{ t: number }> = ({ t }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 24, 160, 24);
    g.rotateX(-Math.PI / 2);
    g.translate(SEA_X - 40, 0, 0);
    return g;
  }, []);
  useLayoutEffect(() => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // long, slow swells rolling towards the shore
      const y = -0.9 + 0.55 * Math.sin(x * 0.42 - t * 1.3 + z * 0.05) + 0.12 * Math.sin(x * 1.3 + z * 0.7 - t * 2.1);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, t]);
  return <mesh geometry={geo} material={water} receiveShadow />;
};

/** Rings on the cut face: big slow blue ones from the coast, small quick orange ones from cars. */
const FaceWaves: React.FC<{ t: number; sea: number; city: number }> = ({ t, sea, city }) => {
  const out: React.ReactNode[] = [];
  if (sea > 0)
    for (let k = 0; k < 4; k++) {
      const p = ((t / 6 + k / 4) % 1 + 1) % 1; // one every 1.5 s, each lives 6 s: slow
      out.push(
        <mesh key={`s${k}`} position={[SEA_X + 2, -6, FACE + 0.04]} scale={2 + p * 52}>
          <ringGeometry args={[0.975, 1, 128, 1, -Math.PI / 2, Math.PI]} />
          <meshBasicMaterial color={C.sea} transparent opacity={(1 - p) * 0.85 * sea} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>,
      );
    }
  if (city > 0)
    COAST_CARS.forEach((c, i) => {
      const x = carX(c, t);
      if (x > 56) return;
      for (let k = 0; k < 3; k++) {
        const p = ((t * 1.6 + rnd(i * 5 + k) + k / 3) % 1 + 1) % 1; // quick
        out.push(
          <mesh key={`c${i}-${k}`} position={[x, -0.05, FACE + 0.05]} scale={0.3 + p * 5}>
            <ringGeometry args={[0.93, 1, 48, 1, Math.PI, Math.PI]} />
            <meshBasicMaterial color={P.orangeLight} transparent opacity={(1 - p) ** 2 * 0.9 * city} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>,
        );
      }
    });
  return <>{out}</>;
};

const COAST_SHOTS: Shot[] = [
  { t: 0, pos: [44, 5, 34], look: [30, 1, 2], fov: 40 }, // in the city
  { t: 6, pos: [18, 34, 82], look: [4, -3, 0], fov: 34 }, // pull up and out: the coast appears
  { t: 12, pos: [6, -2, 72], look: [6, -5, 4], fov: 36 }, // face on to the cut
  { t: 19.5, pos: [10, -3, 64], look: [8, -5, 4], fov: 36 },
];

const Coast: React.FC<{ t: number; a: number }> = ({ t, a }) => {
  const sea = ramp(t, 8, 10);
  const city = ramp(t, 12.5, 14);
  return (
    <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
      <Atmosphere color={new THREE.Color("#e9e6df")} near={110} far={260} />
      <DayLights minute={12 * 60} extent={70} />
      <CameraPath t={t} shots={COAST_SHOTS} />
      {/* the land, with its cut face at the front */}
      <Box x={[SEA_X + 4, 64]} y={[-0.25, 0]} z={[-12, FACE]} m={M.ground} />
      {LAYERS.map(([y0, y1, m], i) => (
        <Box key={i} x={[SEA_X + 4 - (i === 0 ? 0 : 0), 64]} y={[y0, y1]} z={[-12, FACE]} m={m} shadow={false} />
      ))}
      {/* beach: sloping sand down to the sea floor */}
      {[0, 1, 2, 3].map((i) => (
        <Box key={`b${i}`} x={[SEA_X + i, SEA_X + 4]} y={[-1.6 - (3 - i) * 1.1, -0.25 - i * 0.0]} z={[-12, FACE]} m={sand} shadow={false} />
      ))}
      {/* sea floor layers under the water */}
      {LAYERS.slice(2).map(([y0, y1, m], i) => (
        <Box key={`s${i}`} x={[-140, SEA_X + 4]} y={[y0, Math.min(y1, -4.8)]} z={[-12, FACE]} m={m} shadow={false} />
      ))}
      <Box x={[-140, SEA_X + 0.5]} y={[-4.8, -1.1]} z={[-12, FACE - 0.02]} m={waterFace} shadow={false} />
      <Swell t={a} />
      {/* the city: a road with cars and two rows of buildings */}
      <Box x={[SEA_X + 6, 64]} y={[0, 0.04]} z={[4, 8]} m={M.road} shadow={false} />
      <Box x={[SEA_X + 6, 64]} y={[0, 0.14]} z={[2.6, 4]} m={M.pavement} shadow={false} />
      {COAST_BLDS.map((b, i) => (
        <Box key={`h${i}`} x={b.x} y={[0, b.h]} z={b.z} m={b.m} />
      ))}
      {COAST_CARS.map((c, i) => {
        const x = carX(c, a);
        if (x > 60) return null;
        return (
          <group key={`car${i}`} position={[x, 0, c.lane === 0 ? 5 : 7]}>
            <Box x={[-1.1, 1.1]} y={[0.25, 0.9]} z={[-0.55, 0.55]} m={c.m} />
            <Box x={[-0.55, 0.6]} y={[0.9, 1.35]} z={[-0.5, 0.5]} m={M.glass} />
          </group>
        );
      })}
      {/* the seismometer, a small vault deep under the city */}
      <Box x={[26, 31]} y={[-10.2, -7.8]} z={[8, FACE + 0.01]} m={M.vault} shadow={false} />
      <mesh position={[28.5, -9.4, FACE - 0.6]} material={M.trunk}>
        <cylinderGeometry args={[0.45, 0.45, 0.9, 20]} />
      </mesh>
      <FaceWaves t={a} sea={sea} city={city} />
    </ThreeCanvas>
  );
};

// ======================= Part B: the real landscape =========================================
const F = spectrum.freqs;
const LOGF0 = Math.log10(F[0]);
const LOGF1 = Math.log10(F[F.length - 1]);
const HOURS_W = 36; // x: 0..36 = 00:00..24:00
const zOf = (f: number) => lerp(-12, 10, (Math.log10(f) - LOGF0) / (LOGF1 - LOGF0)); // back = slow, front = fast
const xOf = (hour: number) => (hour / 24) * HOURS_W - HOURS_W / 2;
const yOf = (db: number) => Math.max(0, (db + 172) * 0.24);
const COLS = 24 * 6; // ten-minute columns, interpolated smoothly between the real hours

// The export is acceleration power (MUSTANG). We show it as ground VELOCITY power, the usual
// way seismologists draw it (subtract 20*log10(2*pi*f)): the ocean's slow wobbles then form
// the big ridge, and the people band is visible on its own. A unit conversion, not a change.
const VEL = F.map((f) => 20 * Math.log10(2 * Math.PI * f));

/** dB at fractional hour h for frequency index j (Catmull-Rom through the 24 real hours, wrapping). */
const dbAt = (h: number, j: number) => {
  const wd = spectrum.weekday as number[][];
  const i = Math.floor(h);
  const f = h - i;
  const v = (k: number) => wd[((k % 24) + 24) % 24][j] - VEL[j];
  const p0 = v(i - 1);
  const p1 = v(i);
  const p2 = v(i + 1);
  const p3 = v(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
};

const band = (f: number) => (f >= 0.1 && f < 1 ? "sea" : f >= 4 && f <= 14 ? "people" : "other");
const COL = { sea: new THREE.Color("#7fa6c4"), people: new THREE.Color("#e58a3c"), other: new THREE.Color("#d9d1c2") };

const Landscape: React.FC<{ clock: number; focus: number }> = ({ clock, focus }) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const nx = COLS + 1;
    const nz = F.length;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < nx - 1; i++)
      for (let j = 0; j < nz - 1; j++) {
        const a = i * nz + j;
        const b = (i + 1) * nz + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    g.setIndex(idx);
    return g;
  }, []);
  useLayoutEffect(() => {
    const nz = F.length;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i <= COLS; i++) {
      const h = (i / COLS) * 24;
      for (let j = 0; j < nz; j++) {
        const k = i * nz + j;
        const shown = h <= clock;
        const y = shown ? yOf(dbAt(Math.min(h, 23.999), j)) : 0.02;
        pos.setXYZ(k, xOf(h), y, zOf(F[j]));
        const b = band(F[j]);
        c.copy(COL[b]);
        if (b === "other") c.lerp(new THREE.Color("#efe9df"), 0.3 * focus);
        if (b === "sea") c.lerp(new THREE.Color("#d9d1c2"), 0.35 * focus);
        if (!shown) c.set("#ece7da");
        col.setXYZ(k, c.r, c.g, c.b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, clock, focus]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} flatShading />
    </mesh>
  );
};

const LAND_SHOTS: Shot[] = [
  { t: 19.5, pos: [10, 60, 70], look: [0, 0, -2], fov: 34 }, // from high above
  { t: 24, pos: [30, 20, 38], look: [-1, 2, -1], fov: 34 }, // dive to a three-quarter view
  { t: 40, pos: [24, 17, 40], look: [-1, 2, -1], fov: 34 },
  { t: 47, pos: [16, 9, 32], look: [-2, 4, 4], fov: 36 }, // push in towards the people band
  { t: 60, pos: [14, 8.5, 31], look: [-2, 4, 4], fov: 36 },
];
const CLOCK = { a: 24.5, b: 40 }; // seconds over which the clock runs 00:00 -> 24:00

const Land: React.FC<{ t: number }> = ({ t }) => {
  const clock = 24 * ramp(t, CLOCK.a, CLOCK.b, "inout");
  const focus = ramp(t, 41, 43.5, "inout");
  return (
    <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
      <color attach="background" args={[C.paper]} />
      <CameraPath t={t} shots={LAND_SHOTS} />
      <hemisphereLight args={["#fbf8f1", "#cbbfa8", 1.5]} />
      <directionalLight position={[-20, 40, 30]} intensity={1.7} color="#fff1dc" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
      {/* a paper base under the landscape */}
      <Box x={[-HOURS_W / 2 - 1, HOURS_W / 2 + 1]} y={[-0.6, 0]} z={[-13, 11]} m={M.pavement} />
      <Landscape clock={clock} focus={focus} />
      {/* the people band, lit up */}
      {focus > 0 ? (
        <mesh position={[0, 3, (zOf(4) + zOf(14)) / 2]}>
          <boxGeometry args={[HOURS_W + 0.6, 6, zOf(14) - zOf(4)]} />
          <meshBasicMaterial color={C.cityLight} transparent opacity={0.13 * focus} depthWrite={false} />
        </mesh>
      ) : null}
    </ThreeCanvas>
  );
};

/** An HTML label pinned to a 3D point of the landscape. */
const Pin: React.FC<{ t: number; p: [number, number, number]; text: string; at: number; until?: number; color?: string; size?: number; dx?: number; dy?: number }> = ({
  t,
  p,
  text,
  at,
  until,
  color = C.ink,
  size = 34,
  dx = 0,
  dy = 0,
}) => {
  const s = screenOf(t, LAND_SHOTS, p);
  return (
    <div
      style={{
        position: "absolute",
        left: s.x + dx,
        top: s.y + dy,
        transform: "translate(-50%, -100%)",
        fontFamily: TEXT,
        fontSize: size,
        color,
        whiteSpace: "nowrap",
        opacity: fade(t, at, until),
        textShadow: "0 0 12px rgba(245,241,235,0.95), 0 0 4px rgba(245,241,235,0.95)",
      }}
    >
      {text}
    </div>
  );
};

// ======================= the clip ==========================================================
export const C2Sea: React.FC = () => {
  const t = useSec();
  const a = useAmbient(); // background clock: keeps running while the deck holds a cue
  useCurrentFrame();
  const cut = ramp(t, 18.2, 19.5, "inout") * (1 - ramp(t, 19.5, 21, "inout")); // paper wipe between parts
  const clock = 24 * ramp(t, CLOCK.a, CLOCK.b, "inout");
  const bars = ramp(t, 49, 50.5, "inout");
  const ocean = bands.bands.find((b) => b.band === "0.1-1 Hz")!;
  const people = bands.bands.find((b) => b.band === "4-14 Hz")!;
  const seaZ = zOf(0.25);
  const peopleZ = zOf(8);
  return (
    <Stage>
      {t < 19.5 ? <Coast t={t} a={a} /> : <Land t={t} />}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: cut }} />

      {/* Part A captions */}
      <Caption text="Two kinds of shaking" at={0.5} until={6} y={84} serif size={64} />
      <Caption text="A wobble's speed: how many times a second it shakes, in hertz" at={5.5} until={11} y={84} />
      <Note text="Slow: ocean waves on coasts far away. One wobble every few seconds." at={9} until={18} x={120} y={850} size={40} color={C.sea} weight={500} width={1700} />
      <Note text="Fast: engines, wheels and feet. Several wobbles a second." at={13.5} until={18} x={120} y={920} size={40} color={C.city} weight={500} width={1300} />
      <IllustrationTag until={18.5} />

      {/* Part B: the real landscape */}
      <Caption text="A year of Brussels' recordings, split by speed" at={21} until={30} y={84} serif size={54} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: fade(t, 24, 41) }}>
        <rect x={1610} y={60} width={250} height={300} rx={8} fill="rgba(250,249,244,0.92)" />
        <Clock minute={Math.min(clock * 60, 1439.9)} x={1735} y={175} r={86} />
      </svg>
      <div style={{ opacity: 1 - bars }}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Pin key={h} t={t} p={[xOf(h), 0, 11.6]} text={`${String(h).padStart(2, "0")}:00`} at={22.5} size={26} color={C.graphite} dy={40} />
        ))}
        {[0.1, 1, 10].map((f) => (
          <Pin key={f} t={t} p={[-HOURS_W / 2 - 2.5, 0, zOf(f)]} text={`${f} Hz`} at={23} size={26} color={C.graphite} dy={14} />
        ))}
        <Pin t={t} p={[xOf(4), yOf(-128), seaZ]} text="the sea: the same all day" at={30} dy={-10} color={C.sea} size={36} />
        <Pin t={t} p={[xOf(13), yOf(-148), peopleZ]} text="us: up at six, down at night" at={34.5} color={C.city} size={36} />
        <Pin t={t} p={[xOf(19), yOf(-140), (zOf(4) + zOf(14)) / 2]} text="4 to 14 Hz: the people band" at={42} color={C.city} size={42} />
      </div>

      {/* Part C: which band reads the week (real, Result 12) */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: 0.94 * bars }} />
      <div style={{ position: "absolute", left: 160, top: 110, fontFamily: DISPLAY, fontSize: 70, opacity: bars }}>Which band reads the week?</div>
      {bars > 0 ? (
        <>
          <HBar label="Ocean band, 0.1 to 1 Hz" value={ocean.weekend_median} at={51} x={160} y={300} width={1250} color={C.sea} height={80} />
          <HBar label="People band, 4 to 14 Hz" value={people.weekend_median} at={53.5} x={160} y={540} width={1250} color={C.city} height={80} />
          <Note text="Weekday or weekend, median of seven cities. Guessing gets 50%." at={55.5} x={160} y={800} size={36} width={1500} />
        </>
      ) : null}
      <Source text={`Real data: BE.UCC, ${spectrum.period}, weekdays, hour by hour, shown as ground velocity (MUSTANG)`} at={22} until={48.5} />
      <Source text="Real data: Result 12, a year of recent recordings from seven cities" at={51} />
    </Stage>
  );
};
