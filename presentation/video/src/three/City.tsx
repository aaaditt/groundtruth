// The paper-diorama city for the 3D cutscenes: a block of ground with a small street on
// top and its soil and rock layers showing on the cut face at the front. Everything here
// is an ILLUSTRATION; what it does is driven by real data passed in as props (how busy the
// street is comes from Brussels' real hourly rhythm).
//
// Layout (units are arbitrary "metres"): the block spans x -22..22, z -14..14, top at y=0,
// down to y=-16. The front face (z=+14) is the cross-section. The road runs along x.
import React from "react";
import * as THREE from "three";
import { P, rnd } from "./kit";

export const BLOCK = { x0: -22, x1: 22, z0: -14, z1: 14, bottom: -16 };
export const VAULT = { x0: 1, x1: 7.4, y0: -11.4, y1: -7.6, z0: 8.6, z1: 14 }; // the seismometer's room
const LANES = [5.6, 7.5]; // z of the two lanes (+x and -x)
const FAR = 320; // the main road, railway and pavements run on through the whole city
const SPAN = 200; // vehicles and people loop over x in -100..100

// ---- materials (created once; per-frame changes are set on them below) -----------------
const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, ...opts });

export const M = {
  grass: mat(P.grass),
  ground: mat("#ddd6c7"),
  park: mat(P.park),
  pavement: mat(P.pavement),
  road: mat(P.road),
  roadLine: mat(P.roadLine),
  wallA: mat(P.wallA),
  wallB: mat(P.wallB),
  wallC: mat(P.wallC),
  wallD: mat(P.wallD),
  roof: mat(P.roof),
  window: mat(P.window, { roughness: 0.4 }),
  windowLit: mat(P.windowLit, { emissive: new THREE.Color(P.windowLit), emissiveIntensity: 0 }),
  trunk: mat(P.trunk),
  leaf: mat(P.leaf),
  leaf2: mat(P.leaf2),
  wheel: mat("#2a2d33"),
  glass: mat("#3d4652", { roughness: 0.3 }),
  lamp: mat("#fff3d6", { emissive: new THREE.Color("#ffd08a"), emissiveIntensity: 0 }),
  pole: mat("#4a4f57"),
  soil1: mat(P.soil1),
  soil2: mat(P.soil2),
  soil3: mat(P.soil3),
  rock1: mat(P.rock1),
  rock2: mat(P.rock2),
  vault: mat("#cfc8bb"),
  vaultFloor: mat("#b9b1a3"),
  pebble: mat("#8d8a84"),
  train: mat(P.train),
  trainStripe: mat(P.orange),
  viaduct: mat("#d6cfc2"),
  car: P.car.map((c) => mat(c, { roughness: 0.6 })),
  bus: mat(P.bus, { roughness: 0.6 }),
  person: [mat("#3d4652"), mat("#a7480c"), mat("#2e5c95"), mat("#7a6a58"), mat("#59616f")],
  skin: mat("#d9b89a"),
  ripple: new THREE.MeshBasicMaterial({ color: P.orangeLight, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
};

/** A box given by its extents (easier to lay out a city with than centre + size). */
export const Box: React.FC<{
  x: [number, number];
  y: [number, number];
  z: [number, number];
  m: THREE.Material;
  shadow?: boolean;
}> = ({ x, y, z, m, shadow = true }) => (
  <mesh
    position={[(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2]}
    material={m}
    castShadow={shadow}
    receiveShadow
  >
    <boxGeometry args={[x[1] - x[0], y[1] - y[0], z[1] - z[0]]} />
  </mesh>
);

// ---- the ground block and its layers --------------------------------------------------
const LAYERS: { y: [number, number]; m: THREE.Material }[] = [
  { y: [-2.4, -0.25], m: M.soil1 },
  { y: [-4.8, -2.4], m: M.soil3 },
  { y: [-7.6, -4.8], m: M.soil2 },
  { y: [-11.4, -7.6], m: M.rock1 },
  { y: [BLOCK.bottom, -11.4], m: M.rock2 },
];

const PEBBLES = Array.from({ length: 70 }, (_, i) => ({
  x: BLOCK.x0 + 1 + rnd(i) * 42,
  y: -1 - rnd(i + 100) * 14,
  r: 0.12 + rnd(i + 200) * 0.28,
}));

export const Ground: React.FC = () => {
  const { x0, x1, z0, z1 } = BLOCK;
  return (
    <group>
      {/* street-level top (the same paving as the rest of the city) */}
      <Box x={[x0, x1]} y={[-0.25, 0]} z={[z0, z1]} m={M.ground} />
      {LAYERS.map((l, i) => {
        if (l.m !== M.rock1) return <Box key={i} x={[x0, x1]} y={l.y} z={[z0, z1]} m={l.m} shadow={false} />;
        // the rock layer has the vault carved out of it, open to the front face
        const v = VAULT;
        return (
          <group key={i}>
            <Box x={[x0, v.x0]} y={l.y} z={[z0, z1]} m={l.m} shadow={false} />
            <Box x={[v.x1, x1]} y={l.y} z={[z0, z1]} m={l.m} shadow={false} />
            <Box x={[v.x0, v.x1]} y={l.y} z={[z0, v.z0]} m={l.m} shadow={false} />
          </group>
        );
      })}
      {/* the vault's own walls: pale concrete, so the instrument reads against them */}
      <Box x={[VAULT.x0, VAULT.x1]} y={[VAULT.y0, VAULT.y0 + 0.12]} z={[VAULT.z0, VAULT.z1]} m={M.vaultFloor} />
      <Box x={[VAULT.x0, VAULT.x1]} y={[VAULT.y0, VAULT.y1]} z={[VAULT.z0, VAULT.z0 + 0.1]} m={M.vault} />
      <Box x={[VAULT.x0, VAULT.x0 + 0.1]} y={[VAULT.y0, VAULT.y1]} z={[VAULT.z0, VAULT.z1]} m={M.vault} />
      <Box x={[VAULT.x1 - 0.1, VAULT.x1]} y={[VAULT.y0, VAULT.y1]} z={[VAULT.z0, VAULT.z1]} m={M.vault} />
      <Box x={[VAULT.x0, VAULT.x1]} y={[VAULT.y1 - 0.1, VAULT.y1]} z={[VAULT.z0, VAULT.z1]} m={M.vault} />
      {/* pebbles on the cut face, for texture */}
      {PEBBLES.filter((p) => !(p.x > VAULT.x0 - 0.5 && p.x < VAULT.x1 + 0.5 && p.y < VAULT.y1 + 0.5 && p.y > VAULT.y0 - 0.5)).map(
        (p, i) => (
          <mesh key={i} position={[p.x, p.y, z1]} material={M.pebble} scale={[1, 0.7, 0.35]}>
            <dodecahedronGeometry args={[p.r, 0]} />
          </mesh>
        ),
      )}
    </group>
  );
};


// ---- buildings --------------------------------------------------------------------------
type B = { x: [number, number]; z: [number, number]; h: number; m: THREE.Material; seed: number };
export const BUILDINGS: B[] = [
  { x: [-19.5, -12.5], z: [-7, 2], h: 8.5, m: M.wallA, seed: 1 },
  { x: [-10.5, -4.5], z: [-5, 2], h: 15, m: M.wallD, seed: 2 },
  { x: [-2.5, 5], z: [-8, 2], h: 6.5, m: M.wallB, seed: 3 },
  { x: [7.5, 12.5], z: [-6, 2], h: 11.5, m: M.wallC, seed: 4 },
  { x: [14.5, 20], z: [-4, 2], h: 5.5, m: M.wallA, seed: 5 },
];

const Windows: React.FC<{ b: B; lit: number }> = ({ b, lit }) => {
  const out: React.ReactNode[] = [];
  const rows = Math.floor((b.h - 1.6) / 1.6);
  const addFace = (face: "front" | "left" | "right", len: number) => {
    const cols = Math.floor((len - 0.8) / 1.35);
    const start = (len - (cols - 1) * 1.35) / 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = b.seed * 1000 + r * 37 + c + (face === "front" ? 0 : face === "left" ? 400 : 700);
        const on = rnd(k) < lit;
        const y = 1.4 + r * 1.6;
        let pos: [number, number, number];
        let rot: [number, number, number] = [0, 0, 0];
        if (face === "front") pos = [b.x[0] + start + c * 1.35, y, b.z[1] + 0.02];
        else if (face === "left") {
          pos = [b.x[0] - 0.02, y, b.z[0] + start + c * 1.35];
          rot = [0, -Math.PI / 2, 0];
        } else {
          pos = [b.x[1] + 0.02, y, b.z[0] + start + c * 1.35];
          rot = [0, Math.PI / 2, 0];
        }
        out.push(
          <mesh key={k} position={pos} rotation={rot} material={on ? M.windowLit : M.window}>
            <planeGeometry args={[0.62, 0.86]} />
          </mesh>,
        );
      }
  };
  addFace("front", b.x[1] - b.x[0]);
  addFace("left", b.z[1] - b.z[0]);
  addFace("right", b.z[1] - b.z[0]);
  return <>{out}</>;
};

export const Buildings: React.FC<{ lit: number }> = ({ lit }) => (
  <group>
    {BUILDINGS.map((b) => (
      <group key={b.seed}>
        <Box x={b.x} y={[0, b.h]} z={b.z} m={b.m} />
        {/* roof edge and a few rooftop boxes */}
        <Box x={[b.x[0] - 0.15, b.x[1] + 0.15]} y={[b.h, b.h + 0.25]} z={[b.z[0] - 0.15, b.z[1] + 0.15]} m={M.roof} />
        <Box x={[b.x[0] + 1, b.x[0] + 2.4]} y={[b.h + 0.25, b.h + 1.1]} z={[b.z[0] + 1, b.z[0] + 2.2]} m={M.roof} />
        {b.seed % 2 === 0 ? (
          <mesh position={[b.x[1] - 1.5, b.h + 1.2, b.z[0] + 2]} material={M.roof} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 1.9, 10]} />
          </mesh>
        ) : null}
        {/* door */}
        <Box x={[(b.x[0] + b.x[1]) / 2 - 0.5, (b.x[0] + b.x[1]) / 2 + 0.5]} y={[0, 1.5]} z={[b.z[1], b.z[1] + 0.05]} m={M.glass} shadow={false} />
        <Windows b={b} lit={lit} />
      </group>
    ))}
  </group>
);

// ---- street: road, pavements, trees, lamps ------------------------------------------------
const TREES = [-20, -15, -9.5, -3, 3.5, 10, 16, 20.5].map((x, i) => ({ x, z: 11.6 + rnd(i) * 1.4, s: 0.8 + rnd(i + 9) * 0.45 }));
const BACK_TREES = Array.from({ length: 10 }, (_, i) => ({ x: -20 + i * 4.4 + rnd(i) * 1.5, z: -12.6 + rnd(i + 3), s: 0.7 + rnd(i + 5) * 0.5 }));
const LAMPS = Array.from({ length: 19 }, (_, i) => -99 + i * 11);

const Tree: React.FC<{ x: number; z: number; s: number; alt?: boolean }> = ({ x, z, s, alt }) => (
  <group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 0.8, 0]} material={M.trunk} castShadow>
      <cylinderGeometry args={[0.12, 0.17, 1.6, 6]} />
    </mesh>
    <mesh position={[0, 2.3, 0]} material={alt ? M.leaf2 : M.leaf} castShadow>
      <icosahedronGeometry args={[1.05, 0]} />
    </mesh>
    <mesh position={[0.35, 2.9, 0.2]} material={alt ? M.leaf : M.leaf2} castShadow>
      <icosahedronGeometry args={[0.7, 0]} />
    </mesh>
  </group>
);

export const Street: React.FC<{ night: number }> = ({ night }) => {
  M.lamp.emissiveIntensity = 1.6 * night;
  return (
    <group>
      <Box x={[-FAR, FAR]} y={[0, 0.04]} z={[4.6, 8.5]} m={M.road} shadow={false} />
      {Array.from({ length: 80 }, (_, i) => (
        <Box key={i} x={[-120 + 0.6 + i * 3, -120 + 2.0 + i * 3]} y={[0.04, 0.06]} z={[6.5, 6.65]} m={M.roadLine} shadow={false} />
      ))}
      <Box x={[-FAR, FAR]} y={[0, 0.16]} z={[2, 4.6]} m={M.pavement} shadow={false} />
      <Box x={[-FAR, FAR]} y={[0, 0.16]} z={[8.5, 10.4]} m={M.pavement} shadow={false} />
      {/* a park strip at the back */}
      <Box x={[BLOCK.x0, BLOCK.x1]} y={[0, 0.03]} z={[-14, -9]} m={M.park} shadow={false} />
      {TREES.map((t, i) => (
        <Tree key={i} {...t} alt={i % 2 === 1} />
      ))}
      {BACK_TREES.map((t, i) => (
        <Tree key={`b${i}`} {...t} alt={i % 3 === 0} />
      ))}
      {LAMPS.map((x) => (
        <group key={x} position={[x, 0, 9.4]}>
          <mesh position={[0, 1.9, 0]} material={M.pole} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.8, 6]} />
          </mesh>
          <mesh position={[0, 3.8, -0.4]} material={M.pole}>
            <boxGeometry args={[0.12, 0.12, 0.9]} />
          </mesh>
          <mesh position={[0, 3.7, -0.8]} material={M.lamp}>
            <boxGeometry args={[0.36, 0.14, 0.36]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ---- the railway: a viaduct across the back, and a train that comes past ----------------
export const Railway: React.FC<{ t: number; busy: number }> = ({ t, busy }) => {
  const pillars = Array.from({ length: 61 }, (_, i) => -150 + i * 5);
  // a train every ~14 s of screen time; fewer at night
  const period = 14;
  const k = Math.floor(t / period);
  const run = (t % period) / period;
  const runs = rnd(k + 50) < 0.25 + 0.75 * busy;
  const head = -170 + run * 340;
  return (
    <group>
      <Box x={[-FAR, FAR]} y={[3.4, 3.9]} z={[-11.4, -9.4]} m={M.viaduct} />
      {pillars.map((x) => (
        <Box key={x} x={[x - 0.35, x + 0.35]} y={[0, 3.4]} z={[-10.8, -10]} m={M.viaduct} />
      ))}
      {runs
        ? [0, 1, 2].map((c) => {
            const x1 = head - c * 6.3;
            const x0 = x1 - 6;
            const cx0 = x0;
            const cx1 = x1;
            return (
              <group key={c}>
                <Box x={[cx0, cx1]} y={[3.95, 5.5]} z={[-11.1, -9.7]} m={M.train} />
                <Box x={[cx0, cx1]} y={[4.6, 4.8]} z={[-9.72, -9.68]} m={M.trainStripe} shadow={false} />
              </group>
            );
          })
        : null}
    </group>
  );
};

// ---- vehicles and people -------------------------------------------------------------------
const VEHICLES = Array.from({ length: 44 }, (_, i) => ({
  bus: i % 7 === 3,
  lane: i % 2,
  // one speed per lane and evenly spaced slots, so cars never drive through each other
  speed: i % 2 === 0 ? 4.2 : 3.5,
  phase: Math.floor(i / 2) * 9 + rnd(i + 3) * 2,
  appear: rnd(i + 31),
  m: M.car[i % M.car.length],
}));

export const vehicleX = (v: (typeof VEHICLES)[number], t: number) => {
  const dir = v.lane === 0 ? 1 : -1;
  const raw = v.phase + dir * v.speed * t;
  return (((raw % SPAN) + SPAN) % SPAN) - SPAN / 2;
};

/** The vehicles on the road at a moment; `busy` (0..1) decides how many are out. */
export const visibleVehicles = (t: number, busy: number) =>
  VEHICLES.filter((v) => v.appear < 0.08 + 0.92 * busy)
    .map((v) => ({ ...v, x: vehicleX(v, t), z: LANES[v.lane] }))
    .filter((v) => Math.abs(v.x) < SPAN / 2 - 3);

const Car: React.FC<{ x: number; z: number; dir: number; m: THREE.Material; night: number }> = ({ x, z, dir, m }) => (
  <group position={[x, 0, z]} rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
    <Box x={[-1.1, 1.1]} y={[0.3, 0.95]} z={[-0.55, 0.55]} m={m} />
    <Box x={[-0.55, 0.6]} y={[0.95, 1.45]} z={[-0.5, 0.5]} m={M.glass} />
    {[-0.7, 0.7].map((wx) =>
      [-0.56, 0.56].map((wz) => (
        <mesh key={`${wx}${wz}`} position={[wx, 0.3, wz]} rotation={[Math.PI / 2, 0, 0]} material={M.wheel}>
          <cylinderGeometry args={[0.28, 0.28, 0.16, 10]} />
        </mesh>
      )),
    )}
    <Box x={[1.08, 1.14]} y={[0.6, 0.78]} z={[-0.4, 0.4]} m={M.lamp} shadow={false} />
  </group>
);

const Bus: React.FC<{ x: number; z: number; dir: number }> = ({ x, z, dir }) => (
  <group position={[x, 0, z]} rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
    <Box x={[-2.6, 2.6]} y={[0.35, 2.3]} z={[-0.7, 0.7]} m={M.bus} />
    <Box x={[-2.4, 2.5]} y={[1.3, 2.0]} z={[-0.72, 0.72]} m={M.glass} shadow={false} />
    {[-1.7, 1.7].map((wx) =>
      [-0.7, 0.7].map((wz) => (
        <mesh key={`${wx}${wz}`} position={[wx, 0.35, wz]} rotation={[Math.PI / 2, 0, 0]} material={M.wheel}>
          <cylinderGeometry args={[0.35, 0.35, 0.18, 10]} />
        </mesh>
      )),
    )}
  </group>
);

export const Traffic: React.FC<{ t: number; busy: number; night: number }> = ({ t, busy, night }) => (
  <group>
    {visibleVehicles(t, busy).map((v, i) =>
      v.bus ? (
        <Bus key={i} x={v.x} z={v.z} dir={v.lane === 0 ? 1 : -1} />
      ) : (
        <Car key={i} x={v.x} z={v.z} dir={v.lane === 0 ? 1 : -1} m={v.m} night={night} />
      ),
    )}
  </group>
);

const PEOPLE = Array.from({ length: 60 }, (_, i) => ({
  z: i % 2 === 0 ? 3.3 + rnd(i) * 0.9 : 9.0 + rnd(i) * 0.9,
  speed: (0.7 + rnd(i + 4) * 0.5) * (rnd(i + 8) < 0.5 ? 1 : -1),
  phase: rnd(i + 11) * SPAN,
  appear: rnd(i + 61),
  m: M.person[i % M.person.length],
}));

export const People: React.FC<{ t: number; busy: number }> = ({ t, busy }) => (
  <group>
    {PEOPLE.filter((p) => p.appear < 0.05 + 0.95 * busy).map((p, i) => {
      const x = ((((p.phase + p.speed * t) % SPAN) + SPAN) % SPAN) - SPAN / 2;
      const bob = Math.abs(Math.sin(t * 7 + i)) * 0.06;
      return (
        <group key={i} position={[x, 0.16 + bob, p.z]}>
          <mesh position={[0, 0.55, 0]} material={p.m} castShadow>
            <cylinderGeometry args={[0.17, 0.22, 1.1, 8]} />
          </mesh>
          <mesh position={[0, 1.3, 0]} material={M.skin} castShadow>
            <sphereGeometry args={[0.17, 10, 8]} />
          </mesh>
        </group>
      );
    })}
  </group>
);

// ---- ripples: tiny waves going down into the ground, drawn on the cut face -------------
/** Half-rings spreading down from each vehicle, on the front face. `strength` 0..1. */
export const Ripples: React.FC<{ t: number; busy: number; strength: number }> = ({ t, busy, strength }) => {
  if (strength <= 0) return null;
  const vs = visibleVehicles(t, busy).filter((v) => Math.abs(v.x) < BLOCK.x1 - 1);
  const out: React.ReactNode[] = [];
  vs.forEach((v, i) => {
    for (let k = 0; k < 3; k++) {
      const p = (((t * (v.bus ? 0.55 : 0.75) + rnd(i * 7 + k) + k / 3) % 1) + 1) % 1;
      const r = 0.4 + p * (v.bus ? 9 : 6.5);
      const o = (1 - p) * (1 - p) * strength * (v.bus ? 0.8 : 0.55);
      out.push(
        <mesh key={`${i}-${k}`} position={[v.x, -0.02, BLOCK.z1 + 0.03]} scale={r}>
          <ringGeometry args={[0.965, 1, 48, 1, Math.PI, Math.PI]} />
          <meshBasicMaterial color={P.orangeLight} transparent opacity={o} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>,
      );
    }
  });
  return <>{out}</>;
};
