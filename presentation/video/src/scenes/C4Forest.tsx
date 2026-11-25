// C4 "A hundred trees vote" (40 s): the 3D cutscene for slide 7.
//
// One tree grows whose branches are the REAL questions of the first tree of the random
// forest trained on Brussels (forest.json tree0): yes to the left, no to the right, leaves
// coloured by the day most of their training days were (weekend blue, weekday orange).
// Then 99 more trees grow around it (their shapes are illustration: each real tree differs),
// and every tree lights up with its REAL vote on Wednesday 15 January 2020, a day the
// forest never saw (forest.json day.votes).
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { C, DISPLAY, H, TEXT, W } from "../theme";
import { forest } from "../data";
import { Caption, fade, Note, ramp, Source, Stage, useSec } from "../lib";
import { CameraPath, DayLights, rnd, screenOf, Shot } from "../three/kit";
import { M } from "../three/City";

type TNode = { samples: number; majority: string; question?: string; yes?: TNode; no?: TNode };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const WEEKEND = new Set(["Sat", "Sun"]);

const mat = (c: string, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, emissive: new THREE.Color(c), emissiveIntensity: e });
const MAT = {
  bark: mat("#8a6a4c"),
  green: mat("#9fb27c"),
  weekday: mat("#e58a3c", 0.25),
  weekend: mat("#5f8db5", 0.25),
  wed: mat("#c2550f", 0.9),
  dim: mat("#e6e0d4"),
};

// ---- tree geometry -----------------------------------------------------------------------
type Seg = { a: THREE.Vector3; b: THREE.Vector3; depth: number; r: number };
type Leaf = { p: THREE.Vector3; depth: number; majority?: string };
type Shape = { segs: Seg[]; leaves: Leaf[]; depth: number; nodes: { p: THREE.Vector3; q: string; depth: number }[] };

const grow = (node: TNode | null, seed: number, maxDepth: number): Shape => {
  const segs: Seg[] = [];
  const leaves: Leaf[] = [];
  const nodes: Shape["nodes"] = [];
  let deepest = 0;
  const trunkTop = new THREE.Vector3(0, 2.4, 0);
  segs.push({ a: new THREE.Vector3(0, 0, 0), b: trunkTop, depth: 0, r: 0.26 });
  const rec = (n: TNode | null, p: THREE.Vector3, dir: THREE.Vector3, depth: number, k: number) => {
    deepest = Math.max(deepest, depth);
    const isLeaf = n ? !n.question : depth >= maxDepth;
    if (isLeaf) {
      leaves.push({ p, depth, majority: n?.majority });
      return;
    }
    if (n?.question) nodes.push({ p: p.clone(), q: n.question, depth });
    const len = 1.9 * Math.pow(0.78, depth);
    const spread = 0.62 + rnd(seed + k) * 0.18;
    const twist = (rnd(seed + k + 5) - 0.5) * 1.2;
    ["yes", "no"].forEach((side, i) => {
      const s = i === 0 ? -1 : 1;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -s * spread).applyAxisAngle(new THREE.Vector3(0, 1, 0), twist).normalize();
      const q = p.clone().addScaledVector(d, len);
      segs.push({ a: p, b: q, depth: depth + 1, r: 0.2 * Math.pow(0.7, depth + 1) });
      const child = n ? (side === "yes" ? n.yes! : n.no!) : null;
      rec(child, q, d, depth + 1, k * 2 + i + 1);
    });
  };
  rec(node, trunkTop, new THREE.Vector3(0, 1, 0), 0, 1);
  return { segs, leaves, depth: deepest + 1, nodes };
};

const REAL = grow(forest.tree0 as TNode, 7, 3);

// 100 trees in a grove: the real one at the front, in the middle
const VOTES: string[] = (() => {
  const v = forest.day.votes as Record<string, number>;
  const list = DAYS.flatMap((d) => Array.from({ length: v[d] }, () => d as string));
  // deterministic shuffle so the colours are spread through the grove
  return list.map((d, i) => ({ d, k: rnd(i * 13 + 1) })).sort((a, b) => a.k - b.k).map((x) => x.d);
})();
const GROVE = Array.from({ length: forest.n_trees }, (_, i) => {
  const col = i % 10;
  const row = Math.floor(i / 10);
  const real = i === 4 + 0 * 10; // front row, near the middle
  return {
    i,
    real,
    x: (col - 4.5) * 5.6 + (real ? 2.8 : (rnd(i) - 0.5) * 1.6),
    z: -row * 5.4 + (real ? 3 : (rnd(i + 50) - 0.5) * 1.6),
    rot: rnd(i + 80) * Math.PI * 2,
    scale: real ? 1 : 0.85 + rnd(i + 30) * 0.3,
    shape: real ? REAL : grow(null, i * 31 + 3, 2 + (rnd(i + 9) < 0.5 ? 1 : 0)),
    delay: real ? 0 : 15 + (row * 0.35 + rnd(i + 20) * 1.5),
    vote: VOTES[i],
  };
});

const Branch: React.FC<{ s: Seg; f: number }> = ({ s, f }) => {
  if (f <= 0) return null;
  const b = s.a.clone().lerp(s.b, f);
  const mid = s.a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(s.a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q} material={MAT.bark} castShadow>
      <cylinderGeometry args={[s.r * 0.75, s.r, Math.max(0.001, dir.length()), 7]} />
    </mesh>
  );
};

const Tree: React.FC<{ g: (typeof GROVE)[number]; t: number; leafMat: (leaf: Leaf) => THREE.Material; wedBoost: boolean }> = ({ g, t, leafMat, wedBoost }) => {
  const speed = g.real ? 9 : 3; // seconds to grow
  const p = ramp(t, g.delay + (g.real ? 1 : 0), g.delay + (g.real ? 1 : 0) + speed, "inout");
  if (p <= 0) return null;
  const D = g.shape.depth + 1;
  return (
    <group position={[g.x, 0, g.z]} rotation={[0, g.real ? 0 : g.rot, 0]} scale={g.scale}>
      {g.shape.segs.map((s, k) => (
        <Branch key={k} s={s} f={Math.max(0, Math.min(1, p * D - s.depth))} />
      ))}
      {g.shape.leaves.map((l, k) => {
        const f = Math.max(0, Math.min(1, p * D - (l.depth + 0.6)) / 0.4);
        if (f <= 0) return null;
        return (
          <mesh key={`l${k}`} position={l.p} material={leafMat(l)} scale={f * (0.5 + rnd(g.i * 9 + k) * 0.15) * (wedBoost && g.vote === "Wed" ? 1.35 : 1)} castShadow>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        );
      })}
    </group>
  );
};

const SHOTS: Shot[] = [
  { t: 0, pos: [3, 3.6, 25], look: [2.8, 3.9, 3], fov: 34 }, // close on the real tree
  { t: 13, pos: [3.6, 4.4, 23.5], look: [2.8, 4.1, 3], fov: 34 },
  { t: 21, pos: [16, 26, 44], look: [0, 0, -18], fov: 36 }, // pull back over the grove
  { t: 40, pos: [-6, 22, 46], look: [0, 0, -18], fov: 36 },
];

const plain = (q: string) => {
  // the real first question, in words (6:00 shape <= threshold)
  if (q.startsWith("6:00 shape")) return "At 6 am, was the ground still no busier than the rest of the day?";
  return q.replace(/^(\d):/, "0$1:").replace("<=", "≤");
};

export const C4Forest: React.FC = () => {
  const t = useSec();
  const vote = ramp(t, 23, 26, "inout");
  const wedOnly = ramp(t, 31, 32.5, "inout");
  const votes = forest.day.votes as Record<string, number>;
  const weekday = DAYS.slice(0, 5).reduce((a, d) => a + votes[d], 0);
  const realLeaf = (l: Leaf) => (t < 6 ? MAT.green : WEEKEND.has(l.majority ?? "") ? MAT.weekend : MAT.weekday);
  const grovLeaf = (g: (typeof GROVE)[number]) => (l: Leaf) => {
    if (vote < rnd(g.i + 300)) return g.real && t < 21 ? realLeaf(l) : MAT.green;
    if (wedOnly > 0.5) return g.vote === "Wed" ? MAT.wed : MAT.dim;
    return WEEKEND.has(g.vote) ? MAT.weekend : MAT.weekday;
  };
  const root = REAL.nodes[0];
  const realTree = GROVE.find((g) => g.real)!;
  const at = (p: THREE.Vector3) => screenOf(t, SHOTS, [p.x + realTree.x, p.y, p.z + realTree.z]);
  const rootS = at(root.p);
  const yesLeaf = at(REAL.leaves[0].p);
  const noLeaf = at(REAL.leaves[REAL.leaves.length - 1].p);
  const tally = ramp(t, 25, 29, "inout");
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <color attach="background" args={[C.paper]} />
        <fog attach="fog" args={[C.paper, 60, 140]} />
        <DayLights minute={11 * 60} extent={45} />
        <CameraPath t={t} shots={SHOTS} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]} receiveShadow material={M.park}>
          <circleGeometry args={[90, 64]} />
        </mesh>
        {GROVE.map((g) => (
          <Tree key={g.i} g={g} t={t} leafMat={grovLeaf(g)} wedBoost={wedOnly > 0.5} />
        ))}
      </ThreeCanvas>

      <Caption text="One real tree, trained on Brussels" at={0.5} until={12.5} y={84} serif size={56} />
      {/* the real first question, pinned to the first fork */}
      <div
        style={{
          position: "absolute",
          left: rootS.x + 40,
          top: rootS.y - 40,
          width: 520,
          padding: "16px 22px",
          background: "rgba(250,249,244,0.94)",
          borderRadius: 6,
          boxShadow: "0 8px 30px rgba(22,27,33,0.12)",
          fontSize: 32,
          lineHeight: 1.25,
          opacity: fade(t, 3, 13),
        }}
      >
        {plain(root.q)}
      </div>
      <Note text="yes: mostly weekends" at={7} until={13} x={yesLeaf.x + 60} y={yesLeaf.y - 250} size={34} color={C.sea} weight={500} width={420} align="center" />
      <Note text="no: mostly weekdays" at={7.8} until={13} x={noLeaf.x} y={noLeaf.y - 250} size={34} color={C.city} weight={500} width={420} align="center" />

      <Caption text="A hundred trees, each from a random slice of days" at={15} until={23} y={84} serif size={50} />
      <Caption text="Their votes on a Wednesday they never saw" at={23.5} y={84} serif size={50} />

      {/* the tally, real votes */}
      <div style={{ position: "absolute", right: 90, top: 210, width: 470, padding: "26px 30px", background: "rgba(250,249,244,0.94)", borderRadius: 8, boxShadow: "0 10px 40px rgba(22,27,33,0.12)", opacity: fade(t, 25) }}>
        {DAYS.map((d) => {
          const v = votes[d];
          const shown = Math.round(v * tally);
          const isWed = d === "Wed";
          const col = WEEKEND.has(d) ? C.sea : C.city;
          return (
            <div key={d} style={{ display: "flex", alignItems: "center", height: 50, opacity: wedOnly > 0.5 && !isWed ? 0.35 : 1 }}>
              <div style={{ width: 70, fontSize: 30, color: C.graphite, fontFamily: TEXT }}>{d}</div>
              <div style={{ width: (v / 31) * 260 * tally, height: 26, background: col, borderRadius: 2 }} />
              <div style={{ marginLeft: 14, fontFamily: DISPLAY, fontSize: 36, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 120, top: 800, fontFamily: DISPLAY, fontSize: 92, lineHeight: 1, opacity: fade(t, 28.5) }}>
        {Math.round(weekday * ramp(t, 28.5, 30))} of {forest.n_trees} say weekday
      </div>
      <Note text={`But only ${votes.Wed} say Wednesday: sure about the weekend, unsure about the exact day`} at={32.5} x={120} y={915} size={38} color={C.ink} width={1600} />
      <Source text={`Real data: a random forest trained on ${forest.n_train_days} Brussels days; the votes are real. Tree shapes in the grove are an illustration.`} at={1} />
    </Stage>
  );
};

