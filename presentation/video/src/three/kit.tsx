// Shared pieces for the 3D cutscenes: deterministic randomness, colour mixing, the
// time-of-day sky and sun, and a camera that flies along a spline.
//
// Remotion rule for 3D: nothing may animate by itself. Every movement here is a pure
// function of the current frame (useCurrentFrame), never three's own clock or useFrame,
// or the rendered video flickers.
import React, { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Easing, interpolate } from "remotion";

/** Deterministic "random" numbers: the same every frame and every render. */
export const rnd = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const hex = (h: string) => new THREE.Color(h);
export const mixColor = (a: string, b: string, f: number) => hex(a).lerp(hex(b), Math.max(0, Math.min(1, f)));

/** Several colour stops over 0..1. */
export const colorAt = (stops: [number, string][], x: number) => {
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, c0] = stops[i];
    const [x1, c1] = stops[i + 1];
    if (x <= x1) return mixColor(c0, c1, (x - x0) / (x1 - x0));
  }
  return hex(stops[stops.length - 1][1]);
};

// Paper-diorama palette (matte, warm, a little desaturated).
export const P = {
  grass: "#c9cfa6",
  park: "#b7c290",
  pavement: "#e4ddd0",
  road: "#6f7277",
  roadLine: "#f1ece2",
  wallA: "#efe8dc",
  wallB: "#e3d6c2",
  wallC: "#d8c3a5",
  wallD: "#c9d0d3",
  roof: "#8f8a84",
  window: "#59616f",
  windowLit: "#f6c47a",
  trunk: "#8a6a4c",
  leaf: "#8faa6e",
  leaf2: "#a3b77f",
  car: ["#a7480c", "#2e5c95", "#efe8dc", "#59616f", "#c98a3c", "#3d4652"],
  bus: "#c4532a",
  train: "#e8e2d6",
  soil1: "#bfa78a",
  soil2: "#a98f73",
  soil3: "#d3c2a4",
  rock1: "#9c9890",
  rock2: "#83807b",
  vault: "#3a3f47",
  brass: "#b08a4a",
  steel: "#a9adb2",
  ink: "#161b21",
  orange: "#a7480c",
  orangeLight: "#f5993c",
  blue: "#2e5c95",
  sea: "#3f6f9a",
  seaLight: "#7fa6c4",
  sand: "#e2d3b2",
};

/** How light the sky is at a local time (Brussels, mid-January: sunrise ~08:40, sunset ~17:00). */
export const daylight = (minute: number) => {
  const m = ((minute % 1440) + 1440) % 1440;
  const up = interpolate(m, [7.6 * 60, 9.2 * 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const down = interpolate(m, [16.2 * 60, 17.8 * 60], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(up, down);
};

/** Sky colour over the day: deep blue night, peach dawn, pale paper day, amber dusk. */
export const skyColor = (minute: number) => {
  const m = ((minute % 1440) + 1440) % 1440;
  return colorAt(
    [
      [0, "#27303f"],
      [7.2 * 60, "#2d3546"],
      [8.2 * 60, "#e6b892"],
      [9.4 * 60, "#e9e6df"],
      [12 * 60, "#e7ecee"],
      [15.6 * 60, "#eae4d8"],
      [16.9 * 60, "#e0a47e"],
      [18 * 60, "#353c4f"],
      [1440, "#27303f"],
    ],
    m,
  );
};

/** Lights for a time of day: a warm low sun by day, a cool moon by night. */
export const DayLights: React.FC<{ minute: number; shadowSize?: number; extent?: number }> = ({
  minute,
  shadowSize = 2048,
  extent = 30,
}) => {
  const d = daylight(minute);
  const m = ((minute % 1440) + 1440) % 1440;
  // the sun crosses from south-east to south-west, low (it's January)
  const f = interpolate(m, [8.6 * 60, 17 * 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const az = interpolate(f, [0, 1], [-1.1, 1.1]);
  const el = 0.25 + Math.sin(f * Math.PI) * 0.55;
  const sun = new THREE.Vector3(Math.sin(az) * 150, Math.sin(el) * 150 + 20, Math.cos(az) * 150);
  const warm = colorAt(
    [
      [0, "#ffb27a"],
      [0.25, "#fff1dc"],
      [0.75, "#fff1dc"],
      [1, "#ffa070"],
    ],
    f,
  );
  return (
    <>
      <hemisphereLight args={[mixColor("#3c4a66", "#f4f1ea", d), mixColor("#262b36", "#d8cbb2", d), 0.9 + 0.75 * d]} />
      <directionalLight
        position={sun.toArray()}
        color={warm}
        intensity={0.2 + 2.1 * d}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* moonlight */}
      <directionalLight position={[-30, 30, 20]} color="#9fb3d6" intensity={0.7 * (1 - d)} />
    </>
  );
};

export type Shot = { t: number; pos: [number, number, number]; look: [number, number, number]; fov?: number };

const SMOOTH = Easing.bezier(0.45, 0, 0.55, 1);

/** Where the camera is at second t: position, look-at point and field of view. The
 * camera flies along a smooth spline through the key shots, slowing into each one, so the
 * narration has calm moments to land on. */
export const cameraAt = (t: number, shots: Shot[]) => {
  const posCurve = new THREE.CatmullRomCurve3(shots.map((s) => new THREE.Vector3(...s.pos)), false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(shots.map((s) => new THREE.Vector3(...s.look)), false, "centripetal");
  const n = shots.length - 1;
  let u = 0;
  let fov = shots[0].fov ?? 35;
  if (t >= shots[n].t) {
    u = 1;
    fov = shots[n].fov ?? 35;
  } else if (t > shots[0].t) {
    for (let i = 0; i < n; i++) {
      if (t >= shots[i].t && t <= shots[i + 1].t) {
        const local = SMOOTH((t - shots[i].t) / (shots[i + 1].t - shots[i].t));
        u = (i + local) / n;
        fov = (shots[i].fov ?? 35) + ((shots[i + 1].fov ?? 35) - (shots[i].fov ?? 35)) * local;
        break;
      }
    }
  }
  return { pos: posCurve.getPoint(u), look: lookCurve.getPoint(u), fov };
};

/** Screen position (pixels) of a 3D point at second t, so HTML labels can follow it. */
export const screenOf = (t: number, shots: Shot[], p: [number, number, number], w = 1920, h = 1080) => {
  const { pos, look, fov } = cameraAt(t, shots);
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.1, 1000);
  cam.position.copy(pos);
  cam.lookAt(look);
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 };
};

export const CameraPath: React.FC<{ t: number; shots: Shot[] }> = ({ t, shots }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const { pos, look, fov } = cameraAt(t, shots);
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.fov = fov;
    camera.aspect = size.width / size.height;
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
  }, [t, shots, camera, size]);
  return null;
};

/** Sets the background and fog colour of the scene. */
export const Atmosphere: React.FC<{ color: THREE.Color; near?: number; far?: number }> = ({ color, near = 60, far = 190 }) => (
  <>
    <color attach="background" args={[color]} />
    <fog attach="fog" args={[color, near, far]} />
  </>
);
