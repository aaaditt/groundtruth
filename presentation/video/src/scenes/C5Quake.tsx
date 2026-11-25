// C5 "The dare: subtract the people" (45 s): the 3D cutscene for slide 13.
//
// Illustration: the same city at rush hour, the cut face full of traffic ripples. A small
// earthquake wave rises from far below and is lost among them. Then the people are
// "subtracted" (the ripples go) and the quake shows. Then the REAL result of the
// pre-registered test (applied.json noise_floor, Result 19): 998 found with the
// subtraction, 953 without, chance 5.3%: not supported.
import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { C, DISPLAY, FPS, H, W } from "../theme";
import { applied, busyAt } from "../data";
import { Caption, IllustrationTag, lerp, Note, ramp, Source, Stage, useAmbient, useSec } from "../lib";
import { Atmosphere, CameraPath, DayLights, Shot, skyColor } from "../three/kit";
import { BLOCK, Buildings, Ground, People, Railway, Ripples, Street, Traffic } from "../three/City";
import { Metro, PitFill } from "../three/Metro";
import { Seismometer } from "../three/Seismometer";

const MINUTE = 9 * 60; // rush hour, light enough to see
const QUAKE = { x: -30, y: -46 }; // where the wave comes from, deep below and to one side

const ClipOn: React.FC = () => {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
};

/** Rings of the earthquake wave, clipped to the cut face so they read as "in the rock". */
const QuakeWave: React.FC<{ t: number; start: number; strength: number }> = ({ t, start, strength }) => {
  const planes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -BLOCK.x0),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), BLOCK.x1),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -BLOCK.bottom),
    ],
    [],
  );
  if (t < start || strength <= 0) return null;
  const out: React.ReactNode[] = [];
  for (let k = 0; k < 5; k++) {
    const age = t - start - k * 0.55;
    if (age < 0) continue;
    const p = (age / 7) % 1;
    const r = 18 + p * 60;
    out.push(
      <mesh key={k} position={[QUAKE.x, QUAKE.y, BLOCK.z1 + 0.06]} scale={r}>
        <ringGeometry args={[0.985, 1, 160]} />
        <meshBasicMaterial color={C.sea} transparent opacity={(1 - p) * 0.9 * strength} side={THREE.DoubleSide} depthWrite={false} clippingPlanes={planes} />
      </mesh>,
    );
  }
  return <>{out}</>;
};

const SHOTS: Shot[] = [
  { t: 0, pos: [30, 14, 62], look: [0, -4, 6], fov: 32 }, // the city at rush hour, the cut face
  { t: 9, pos: [3, 13, 42], look: [0, -8, 14], fov: 40 }, // down into the pit, onto the rock
  { t: 24, pos: [-1, 12.5, 40.5], look: [0, -8, 14], fov: 40 },
];

export const C5Quake: React.FC = () => {
  useCurrentFrame();
  const t = useSec();
  const a = useAmbient(); // background clock: keeps running while the deck holds a cue
  const frame = a * FPS;
  const busy = busyAt(MINUTE);
  const subtract = ramp(t, 16.5, 19.5, "inout");
  const quake = ramp(t, 9, 10);
  const quakeHit = ramp(t, 11.5, 12.5) * (1 - ramp(t, 15, 18));
  const jiggle = (0.12 * (1 - subtract) + 0.25 * quakeHit) * (Math.sin(frame * 1.9) * 0.7 + Math.sin(frame * 3.3 + 1) * 0.3);
  const card = ramp(t, 25, 26.5, "inout");
  const nf = applied.noise_floor;
  const maxV = Math.max(nf.learned, nf.raw);
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <ClipOn />
        <Atmosphere color={skyColor(MINUTE)} near={110} far={300} />
        <DayLights minute={MINUTE} extent={75} shadowSize={4096} />
        <CameraPath t={t} shots={SHOTS} />
        <Metro t={a} busy={busy} lit={0.2} />
        <Ground />
        <PitFill open={1} />
        <Street night={0} />
        <Buildings lit={0.1} />
        <Railway t={a} busy={busy} />
        <Traffic t={a} busy={busy} night={0} />
        <People t={a} busy={busy} />
        <Ripples t={a} busy={busy} strength={ramp(t, 1, 3) * (1 - subtract)} />
        <QuakeWave t={t} start={9} strength={quake * (1 - ramp(t, 23, 25))} />
        <Seismometer jiggle={jiggle} drumTurn={-a * 0.6} lamp={1.4} />
      </ThreeCanvas>

      <Caption text="Rush hour: every car shakes the ground" at={0.5} until={8.5} y={84} />
      <Caption text="A small earthquake, far away, arrives from below" at={9.5} until={16} y={84} />
      <Caption text="The dare: subtract what this hour normally sounds like" at={16.5} until={24.5} y={84} />
      <Note text="With the people gone, would the earthquake stand out?" at={19.5} until={24.5} x={120} y={930} size={40} color={C.ink} width={1600} />
      <IllustrationTag until={25} />

      {/* the real, pre-registered result */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: card }} />
      <div style={{ position: "absolute", left: 160, top: 100, fontFamily: DISPLAY, fontSize: 66, opacity: card }}>
        Written down before running it
      </div>
      <Note text={`${nf.pairs.toLocaleString("en-GB")} earthquake-and-station pairs. How many quakes stand out?`} at={26} x={160} y={200} size={38} width={1600} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: card }}>
        {[
          { label: "With the people subtracted", v: nf.learned, color: C.ink, y: 380 },
          { label: "Without (the raw recording)", v: nf.raw, color: "#8b93a0", y: 560 },
        ].map((b, i) => {
          const g = ramp(t, 27 + i * 0.8, 29.5 + i * 0.8, "inout");
          return (
            <g key={b.label}>
              <text x={160} y={b.y - 20} fontSize={36} fill={C.graphite}>
                {b.label}
              </text>
              <rect x={160} y={b.y} width={(b.v / maxV) * 1200 * g} height={86} fill={b.color} rx={2} />
              <text x={160 + (b.v / maxV) * 1200 * g + 24} y={b.y + 68} fontFamily={DISPLAY} fontSize={78} fill={C.ink}>
                {Math.round(b.v * g)}
              </text>
            </g>
          );
        })}
      </svg>
      <Note text={`Could luck do this? Our bar, set in advance: under 5%. We got ${(nf.p * 100).toFixed(1)}%.`} at={31.5} x={160} y={730} size={40} color={C.ink} width={1600} />
      <div
        style={{
          position: "absolute",
          left: 1250,
          top: 820,
          padding: "10px 34px 16px",
          border: `5px solid ${C.loud}`,
          color: C.loud,
          fontFamily: DISPLAY,
          fontSize: 96,
          transform: `rotate(-4deg) scale(${lerp(1.4, 1, ramp(t, 34, 34.6))})`,
          opacity: ramp(t, 34, 34.4),
        }}
      >
        Not supported
      </div>
      <Note text="Most of the lead comes from one station in Puerto Rico, during an earthquake swarm." at={37} x={160} y={880} size={32} width={1050} />
      <Source text="Real data: Result 19 (docs/17, pre-registered). The city and the waves are an illustration." at={26} />
    </Stage>
  );
};
