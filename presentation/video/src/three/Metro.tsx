// The rest of the city around the focus block: streets in a grid, hundreds of buildings,
// parks and trees out to the fog, so the scene reads as a real city with ONE section cut
// out of it (the pit in front of the seismometer block), not as an island.
//
// Performance: every building is a single box with a tiling window texture (UVs scaled so
// floors line up), and all boxes of one wall colour are merged into one geometry. Night
// windows are an emissive map whose strength the scene sets each frame.
// ILLUSTRATION: nothing here is data.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BLOCK, Box, M } from "./City";
import { P, rnd } from "./kit";

export const EXTENT = 320; // the ground runs out past the fog
export const PIT = { x0: BLOCK.x0, x1: BLOCK.x1, z0: BLOCK.z1, z1: 30, floor: -15.6 };

// street grid (centre lines). The main road (z 4.6..8.5) belongs to the focus block's street.
const XROADS = [-185, -153, -121, -89, -57, -25, 25, 57, 89, 121, 153, 185]; // roads running along z
const ZROADS = [-138, -106, -74, -42, 38, 70, 102, 134, 166]; // roads running along x
const ROAD_W = 4;
const RAIL = { z0: -13.5, z1: -7.5 };

// ---- window texture --------------------------------------------------------------------
const TILE = { cols: 8, rows: 8, w: 8 * 1.35, h: 8 * 1.6 };
const windowTextures = () => {
  const px = 64;
  const make = (lit: boolean) => {
    const c = document.createElement("canvas");
    c.width = TILE.cols * px;
    c.height = TILE.rows * px;
    const g = c.getContext("2d")!;
    g.fillStyle = lit ? "#000000" : "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    for (let r = 0; r < TILE.rows; r++)
      for (let col = 0; col < TILE.cols; col++) {
        const on = rnd(r * 31 + col * 7 + 5) < 0.55;
        if (lit && !on) continue;
        g.fillStyle = lit ? "#ffc979" : "#7d838c";
        g.fillRect(col * px + px * 0.24, r * px + px * 0.2, px * 0.52, px * 0.56);
      }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  return { map: make(false), emissive: make(true) };
};

let TEX: ReturnType<typeof windowTextures> | null = null;
const tex = () => (TEX ??= windowTextures());

const WALLS = [P.wallA, P.wallB, P.wallC, P.wallD, "#dcd3c6"];
let WALL_MATS: THREE.MeshStandardMaterial[] | null = null;
const wallMats = () =>
  (WALL_MATS ??= WALLS.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        map: tex().map,
        emissive: new THREE.Color("#ffffff"),
        emissiveMap: tex().emissive,
        emissiveIntensity: 0,
        roughness: 0.9,
      }),
  ));

/** A box whose side faces tile the window texture at real scale (floors line up). */
const buildingGeometry = (w: number, h: number, d: number, cx: number, cz: number, seed: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const du = rnd(seed) * TILE.cols;
  const dv = Math.floor(rnd(seed + 1) * TILE.rows);
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const faceW = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const isSide = f !== 2 && f !== 3;
      const u = uv.getX(i) * (isSide ? faceW[f] / TILE.w : 0) + du / TILE.cols;
      const v = uv.getY(i) * (isSide ? h / TILE.h : 0) + dv / TILE.rows;
      uv.setXY(i, u, v);
    }
  g.translate(cx, h / 2, cz);
  return g;
};

// ---- the city plan ---------------------------------------------------------------------
type Bld = { x: [number, number]; z: [number, number]; h: number; wall: number; seed: number };
type Tree = { x: number; z: number; s: number };

const between = (lines: number[], lo: number, hi: number) => {
  const all = [lo, ...lines, hi].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i < all.length - 1; i++) out.push([all[i], all[i + 1]]);
  return out;
};

const KEEP_CLEAR = { x0: -23.5, x1: 23.5, z0: -15, z1: 35.5 }; // the focus block and the pit
const hits = (a: { x: [number, number]; z: [number, number] }, b: typeof KEEP_CLEAR) =>
  a.x[1] > b.x0 && a.x[0] < b.x1 && a.z[1] > b.z0 && a.z[0] < b.z1;

const plan = () => {
  const blds: Bld[] = [];
  const trees: Tree[] = [];
  const parks: { x: [number, number]; z: [number, number] }[] = [];
  let seed = 100;
  const xs = between(XROADS, -215, 215);
  // the main road's pavements are part of the plan too: lots stop short of them
  const zs = between([...ZROADS, 6.5], -170, 198);
  for (const [xa, xb] of xs)
    for (const [za, zb] of zs) {
      const half = (c: number) => (c === 6.5 ? 8.6 : ROAD_W / 2 + 1.6); // inset from the road
      const lot = {
        x: [xa + ROAD_W / 2 + 1.6, xb - ROAD_W / 2 - 1.6] as [number, number],
        z: [za + half(za), zb - half(zb)] as [number, number],
      };
      if (lot.x[1] - lot.x[0] < 6 || lot.z[1] - lot.z[0] < 6) continue;
      const cx = (lot.x[0] + lot.x[1]) / 2;
      const cz = (lot.z[0] + lot.z[1]) / 2;
      // the lots in front of the cut stay open (a park), so the camera has room to fly
      const nearFront = cz > 36 && Math.abs(cx) < 60;
      const lowZone = cz > 10 && Math.abs(cx) < 60;
      const isPark = nearFront || rnd(seed + 9) < 0.1;
      seed += 17;
      if (isPark) {
        parks.push(lot);
        const n = 7 + Math.floor(rnd(seed) * 6);
        for (let k = 0; k < n; k++)
          trees.push({
            x: lot.x[0] + 2 + rnd(seed + k * 3) * (lot.x[1] - lot.x[0] - 4),
            z: lot.z[0] + 2 + rnd(seed + k * 3 + 1) * (lot.z[1] - lot.z[0] - 4),
            s: 0.8 + rnd(seed + k * 3 + 2) * 0.5,
          });
        continue;
      }
      // split the lot into a few buildings
      const nx = 2 + Math.floor(rnd(seed + 1) * 2);
      const nz = 2;
      const far = Math.hypot(cx, cz) > 95;
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          seed += 3;
          const x0 = lot.x[0] + ((lot.x[1] - lot.x[0]) * i) / nx + 0.5;
          const x1 = lot.x[0] + ((lot.x[1] - lot.x[0]) * (i + 1)) / nx - 0.5;
          const z0 = lot.z[0] + ((lot.z[1] - lot.z[0]) * j) / nz + 0.5;
          const z1 = lot.z[0] + ((lot.z[1] - lot.z[0]) * (j + 1)) / nz - 0.5;
          const b = { x: [x0, x1] as [number, number], z: [z0, z1] as [number, number] };
          if (hits(b, KEEP_CLEAR)) continue;
          if (b.z[1] > RAIL.z0 && b.z[0] < RAIL.z1) continue; // the railway runs through
          let h = 5 + rnd(seed) * 13;
          if (far && rnd(seed + 2) < 0.12) h = 26 + rnd(seed + 5) * 14; // a few towers, far off
          if (lowZone) h = 3 + rnd(seed) * 3;
          blds.push({ ...b, h, wall: Math.floor(rnd(seed + 4) * WALLS.length), seed });
        }
    }
  // street trees along the main road outside the block, and along the cross streets
  for (let x = -100; x <= 100; x += 7.5) {
    if (x > -70 && x < 23) continue; // keep the camera's fly-in path to the street clear
    trees.push({ x: x + rnd(x) * 2, z: 11.2 + rnd(x + 3), s: 0.8 + rnd(x + 5) * 0.4 });
  }
  for (const x of [25, -57, 57])
    for (let z = -36; z <= 60; z += 9) {
      if (z > -16 && z < 36 && Math.abs(x) === 25) continue;
      if (z > RAIL.z0 - 1 && z < RAIL.z1 + 1) continue;
      if (z > 2 && z < 11) continue;
      trees.push({ x: x + (x > 0 ? 3.4 : -3.4), z, s: 0.75 + rnd(z + x) * 0.3 });
    }
  return { blds, trees, parks };
};

export const CITY = plan();

// ---- components --------------------------------------------------------------------------
/** Instanced low-poly trees (trunk + two leafy blobs). */
export const Trees: React.FC<{ trees: Tree[] }> = ({ trees }) => {
  const parts = useMemo(() => {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.17, 1.6, 6), M.trunk, trees.length);
    const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.05, 0), M.leaf, trees.length);
    const leaf2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), M.leaf2, trees.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    trees.forEach((t, i) => {
      const s = new THREE.Vector3(t.s, t.s, t.s);
      trunk.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, 0.8 * t.s, t.z), q, s));
      leaf.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, 2.3 * t.s, t.z), q, s));
      leaf2.setMatrixAt(i, m.compose(new THREE.Vector3(t.x + 0.35 * t.s, 2.9 * t.s, t.z + 0.2 * t.s), q, s));
    });
    for (const p of [trunk, leaf, leaf2]) {
      p.castShadow = true;
      p.receiveShadow = true;
      p.instanceMatrix.needsUpdate = true;
    }
    return [trunk, leaf, leaf2];
  }, [trees]);
  return (
    <>
      {parts.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
    </>
  );
};

/** All the buildings of the surrounding city. `lit` (0..1) lights the windows at night. */
export const CityBuildings: React.FC<{ lit: number }> = ({ lit }) => {
  const mats = wallMats();
  for (const m of mats) m.emissiveIntensity = lit;
  const { walls, roofs } = useMemo(() => {
    const byWall: THREE.BufferGeometry[][] = WALLS.map(() => []);
    const roofG: THREE.BufferGeometry[] = [];
    for (const b of CITY.blds) {
      const w = b.x[1] - b.x[0];
      const d = b.z[1] - b.z[0];
      const cx = (b.x[0] + b.x[1]) / 2;
      const cz = (b.z[0] + b.z[1]) / 2;
      byWall[b.wall].push(buildingGeometry(w, b.h, d, cx, cz, b.seed));
      const cap = new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3);
      cap.translate(cx, b.h + 0.15, cz);
      roofG.push(cap);
      if (rnd(b.seed + 7) < 0.6) {
        const box = new THREE.BoxGeometry(Math.min(2.4, w * 0.3), 1.1, Math.min(2.2, d * 0.3));
        box.translate(cx - w * 0.2, b.h + 0.85, cz - d * 0.15);
        roofG.push(box);
      }
    }
    return {
      walls: byWall.map((gs) => (gs.length ? mergeGeometries(gs) : null)),
      roofs: mergeGeometries(roofG),
    };
  }, []);
  return (
    <group>
      {walls.map((g, i) => (g ? <mesh key={i} geometry={g} material={mats[i]} castShadow receiveShadow /> : null))}
      <mesh geometry={roofs} material={M.roof} castShadow receiveShadow />
    </group>
  );
};

/** The ground of the whole city (everything but the focus block and the pit), the street
 * grid, parks, and the three earth walls of the pit. */
export const CityGround: React.FC = () => {
  const E = EXTENT;
  const top: [number, number] = [-0.25, -0.001];
  const L = PIT;
  // layers for the pit walls (same as the focus block's cut face)
  const layers: [number, number, THREE.Material][] = [
    [-0.25, 0, M.ground],
    [-2.4, -0.25, M.soil1],
    [-4.8, -2.4, M.soil3],
    [-7.6, -4.8, M.soil2],
    [-11.4, -7.6, M.rock1],
    [BLOCK.bottom - 0.5, -11.4, M.rock2],
  ];
  const walls: { x: [number, number]; z: [number, number] }[] = [
    { x: [L.x0 - 4, L.x0], z: [L.z0, L.z1 + 4] }, // left wall
    { x: [L.x1, L.x1 + 4], z: [L.z0, L.z1 + 4] }, // right wall
    { x: [L.x0, L.x1], z: [L.z1, L.z1 + 4] }, // far wall
  ];
  return (
    <group>
      {/* ground surfaces (four big pieces around the block + pit) */}
      <Box x={[-E, E]} y={top} z={[-E, BLOCK.z0]} m={M.ground} shadow={false} />
      <Box x={[-E, L.x0 - 4]} y={top} z={[BLOCK.z0, E]} m={M.ground} shadow={false} />
      <Box x={[L.x1 + 4, E]} y={top} z={[BLOCK.z0, E]} m={M.ground} shadow={false} />
      <Box x={[L.x0 - 4, L.x1 + 4]} y={top} z={[L.z1 + 4, E]} m={M.ground} shadow={false} />
      <Box x={[L.x0 - 4, L.x0]} y={top} z={[BLOCK.z0, L.z0]} m={M.ground} shadow={false} />
      <Box x={[L.x1, L.x1 + 4]} y={top} z={[BLOCK.z0, L.z0]} m={M.ground} shadow={false} />
      {/* the earth walls of the pit */}
      {walls.map((w, i) =>
        layers.map(([y0, y1, m], k) => <Box key={`${i}-${k}`} x={w.x} y={[y0, y1]} z={w.z} m={m} shadow={false} />),
      )}
      {/* parks */}
      {CITY.parks.map((p, i) => (
        <Box key={`p${i}`} x={p.x} y={[0, 0.03]} z={p.z} m={M.park} shadow={false} />
      ))}
      {/* the street grid */}
      {XROADS.map((x) => (
        <Box key={`x${x}`} x={[x - ROAD_W / 2, x + ROAD_W / 2]} y={[0, 0.035]} z={[-E, E]} m={M.road} shadow={false} />
      ))}
      {ZROADS.map((z) => (
        <Box key={`z${z}`} x={[-E, E]} y={[0, 0.045]} z={[z - ROAD_W / 2, z + ROAD_W / 2]} m={M.road} shadow={false} />
      ))}
    </group>
  );
};

/** The lot in front of the block: a plaza that is dug away to reveal the cut face.
 * `open` 0..1: the top of the fill sinks from street level to the pit floor. */
export const PitFill: React.FC<{ open: number; trees?: boolean }> = ({ open, trees = true }) => {
  const topY = -open * -PIT.floor;
  const layers: [number, number, THREE.Material][] = [
    [-0.25, 0, M.pavement],
    [-2.4, -0.25, M.soil1],
    [-4.8, -2.4, M.soil3],
    [-7.6, -4.8, M.soil2],
    [-11.4, -7.6, M.rock1],
    [BLOCK.bottom, -11.4, M.rock2],
  ];
  const e = 0.01;
  const plazaTrees = [-16, -6, 4, 14].map((x, i) => ({ x, z: 22 + rnd(i) * 2, s: 1 }));
  const treeScale = 1 - Math.min(1, open * 8);
  return (
    <group>
      {layers.map(([y0, y1, m], k) => {
        const hi = Math.min(y1, topY);
        if (hi - y0 <= 0.001) return null;
        return <Box key={k} x={[PIT.x0 + e, PIT.x1 - e]} y={[y0, hi]} z={[PIT.z0 + e, PIT.z1 - e]} m={m} shadow={false} />;
      })}
      {trees && treeScale > 0
        ? plazaTrees.map((t, i) => (
            <group key={i} position={[t.x, 0, t.z]} scale={treeScale}>
              <mesh position={[0, 0.8, 0]} material={M.trunk} castShadow>
                <cylinderGeometry args={[0.12, 0.17, 1.6, 6]} />
              </mesh>
              <mesh position={[0, 2.3, 0]} material={M.leaf} castShadow>
                <icosahedronGeometry args={[1.05, 0]} />
              </mesh>
            </group>
          ))
        : null}
    </group>
  );
};

// ---- traffic on the other streets ---------------------------------------------------------
const SIDE = [
  ...[-57, -25, 25, 57].map((x) => ({ axis: "z" as const, at: x })),
  ...[-42, 38, 70].map((z) => ({ axis: "x" as const, at: z })),
];
const SIDE_CARS = SIDE.flatMap((road, r) =>
  Array.from({ length: 10 }, (_, i) => ({
    road,
    dir: i % 2 === 0 ? 1 : -1,
    phase: Math.floor(i / 2) * 32 + rnd(r * 50 + i) * 8,
    speed: 4 + rnd(r * 50 + i + 3) * 0.6,
    appear: rnd(r * 50 + i + 7),
    m: M.car[(i + r) % M.car.length],
  })),
);

export const SideTraffic: React.FC<{ t: number; busy: number }> = ({ t, busy }) => {
  const span = 160;
  return (
    <group>
      {SIDE_CARS.filter((c) => c.appear < 0.08 + 0.92 * busy).map((c, i) => {
        const raw = c.phase + c.dir * c.speed * t;
        const along = ((((raw % span) + span) % span) - span / 2) * 1;
        const off = c.dir * 0.95;
        // keep the cars out of the pit's street stubs
        let x: number, z: number, rot: number;
        if (c.road.axis === "z") {
          x = c.road.at + off;
          z = along - 40;
          rot = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          if (z > RAIL.z0 - 2 && z < RAIL.z1 + 2) return null;
        } else {
          x = along;
          z = c.road.at - off;
          rot = c.dir > 0 ? 0 : Math.PI;
        }
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
            <Box x={[-1.1, 1.1]} y={[0.25, 0.9]} z={[-0.55, 0.55]} m={c.m} />
            <Box x={[-0.55, 0.6]} y={[0.9, 1.35]} z={[-0.5, 0.5]} m={M.glass} />
          </group>
        );
      })}
    </group>
  );
};

/** The whole surrounding city in one go. */
export const Metro: React.FC<{ t: number; busy: number; lit: number }> = ({ t, busy, lit }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.updateMatrixWorld();
  }, []);
  return (
    <group ref={ref}>
      <CityGround />
      <CityBuildings lit={lit} />
      <Trees trees={CITY.trees} />
      <SideTraffic t={t} busy={busy} />
    </group>
  );
};
