// C3 "158 seismometers" (40 s): the 3D cutscene for slide 4.
//
// A paper globe turns; one pin rises at each REAL station location (stations.json, FDSN
// coordinates); the globe turns to Europe and the camera settles on Brussels, where BE.UCC
// lights up. Then how the days are split: ordinary days we learn from, and the ones set
// aside (also real counts from stations.json).
import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import land50 from "world-atlas/land-50m.json";
import { C, DISPLAY, H, W } from "../theme";
import { stations } from "../data";
import { Caption, fade, lerp, Note, ramp, Source, Stage, useSec } from "../lib";

export const R = 10;
export const toRad = (d: number) => (d * Math.PI) / 180;
/** Lat/lon to a point on the sphere (matches three's sphere UVs with an equirectangular map). */
export const onSphere = (lat: number, lon: number, r = R) =>
  new THREE.Vector3(r * Math.cos(toRad(lat)) * Math.cos(toRad(lon)), r * Math.sin(toRad(lat)), -r * Math.cos(toRad(lat)) * Math.sin(toRad(lon)));

export const globeTexture = () => {
  const w = 4096;
  const h = 2048;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9d8e6"; // sea: a pale version of the deck's blue
  g.fillRect(0, 0, w, h);
  const proj = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2]);
  const path = geoPath(proj, g);
  g.beginPath();
  path(geoGraticule10());
  g.strokeStyle = "rgba(46,92,149,0.16)";
  g.lineWidth = 2;
  g.stroke();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const land = feature(land50 as any, (land50 as any).objects.land) as any;
  g.beginPath();
  path(land);
  g.fillStyle = "#f7f3ea";
  g.fill();
  g.strokeStyle = "#b9b2a3";
  g.lineWidth = 2.5;
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const UCC = stations.stations.find((s) => s.code === "BE.UCC")!;
// pins appear in a sweep from west to east
const PINS = [...stations.stations].sort((a, b) => a.lon - b.lon).map((s, i, all) => ({ ...s, order: i / (all.length - 1) }));

/** Globe orientation over time: spins, then turns so Brussels faces the camera. */
const orient = (t: number) => {
  const settle = ramp(t, 13, 24, "inout");
  const target = -Math.atan2(Math.cos(toRad(UCC.lon)), -Math.sin(toRad(UCC.lon)));
  const spin = target + (1 - settle) * Math.PI * 0.62 - t * 0.015 * (1 - settle); // Americas -> Atlantic -> Europe
  const tilt = lerp(toRad(18), toRad(UCC.lat), settle);
  return { spin, tilt, settle };
};

const Cam: React.FC<{ dist: number }> = ({ dist }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.fov = 30;
    camera.near = 0.1;
    camera.far = 500;
    camera.updateProjectionMatrix();
  }, [camera, dist]);
  return null;
};

const pinMat = new THREE.MeshStandardMaterial({ color: C.city, roughness: 0.5 });
const stemMat = new THREE.MeshStandardMaterial({ color: "#59616f", roughness: 0.6 });
const uccMat = new THREE.MeshStandardMaterial({ color: C.city, emissive: new THREE.Color(C.cityLight), emissiveIntensity: 0.6 });

export const C3Globe: React.FC = () => {
  const t = useSec();
  const map = useMemo(globeTexture, []);
  const { spin, tilt, settle } = orient(t);
  const dist = lerp(50, 26, ramp(t, 15, 25, "inout"));
  const grow = ramp(t, 2.5, 11, "linear");
  const focus = ramp(t, 23, 25);
  const split = ramp(t, 27, 29, "inout");
  const n = stations.n_stations;
  const shown = Math.min(n, Math.round(grow * n * 1.05));
  const dp = stations.days_by_period;
  const total = stations.n_station_days;
  const parts: { key: keyof typeof dp; label: string; color: string }[] = [
    { key: "baseline", label: "ordinary days: the model learns from these", color: C.ink },
    { key: "lockdown", label: "lockdown", color: C.graphite },
    { key: "festive", label: "Christmas weeks", color: "#8b93a0" },
    { key: "holiday", label: "holidays", color: C.city },
  ];
  const barX = 160;
  const barW = 1600;
  let acc = 0;
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} gl={{ antialias: true }} flat>
        <color attach="background" args={[C.paper]} />
        <Cam dist={dist} />
        <hemisphereLight args={["#ffffff", "#d8cbb2", 1.6]} />
        <directionalLight position={[-30, 25, 40]} intensity={1.6} color="#fff4e2" />
        <group rotation={[tilt, 0, 0]} position={[lerp(0, 0, settle), lerp(0, -0.8, split), 0]}>
          <group rotation={[0, spin, 0]}>
            <mesh>
              <sphereGeometry args={[R, 128, 96]} />
              <meshStandardMaterial map={map} roughness={0.95} />
            </mesh>
            {PINS.map((s) => {
              const k = Math.max(0, Math.min(1, (grow * 1.05 - s.order) * 10));
              if (k <= 0) return null;
              const isUcc = s.code === "BE.UCC";
              const normal = onSphere(s.lat, s.lon, 1).normalize();
              const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
              const len = 0.55 * k * (isUcc ? 1 + 0.6 * focus : 1);
              const dim = isUcc ? 1 : 1 - 0.55 * focus;
              return (
                <group key={s.code} position={onSphere(s.lat, s.lon)} quaternion={q}>
                  <mesh position={[0, len / 2, 0]} material={stemMat} scale={[1, Math.max(0.001, len), 1]}>
                    <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
                  </mesh>
                  <mesh position={[0, len, 0]} material={isUcc && focus > 0 ? uccMat : pinMat} scale={(isUcc ? 1 + 0.5 * focus : 1) * k * dim}>
                    <sphereGeometry args={[0.13, 16, 12]} />
                  </mesh>
                  {isUcc && focus > 0
                    ? [0, 1, 2].map((r) => {
                        const p = (t * 0.5 + r / 3) % 1;
                        return (
                          <mesh key={r} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.2 + p * 1.6}>
                            <ringGeometry args={[0.92, 1, 64]} />
                            <meshBasicMaterial color={C.city} transparent opacity={(1 - p) * 0.8 * focus} side={THREE.DoubleSide} depthWrite={false} />
                          </mesh>
                        );
                      })
                    : null}
                </group>
              );
            })}
          </group>
        </group>
      </ThreeCanvas>

      <Caption text="Where the recordings come from" at={0.5} until={12.5} y={84} serif size={60} />
      {/* the count climbs with the pins */}
      <div style={{ position: "absolute", right: 140, top: 240, textAlign: "right", opacity: fade(t, 2.5, 13) }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 170, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
        <div style={{ fontSize: 40, color: C.graphite, marginTop: 8 }}>seismometers</div>
        <div style={{ fontSize: 34, color: C.graphite, marginTop: 30, opacity: fade(t, 8) }}>a reading every 15 minutes</div>
        <div style={{ fontSize: 34, color: C.graphite, marginTop: 6, opacity: fade(t, 9) }}>late 2019 to mid-2020</div>
      </div>
      <Note text="BE.UCC" at={24} until={27} x={W / 2 + 90} y={H / 2 - 160} size={54} color={C.ink} weight={500} width={600} />
      <Note text="Uccle, south Brussels" at={24.4} until={27} x={W / 2 + 90} y={H / 2 - 90} size={36} width={600} />

      {/* the days: what the model learns from, and what is set aside */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: 0.9 * split }} />
      <div style={{ position: "absolute", left: barX, top: 150, opacity: split }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 130, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(total * ramp(t, 28, 30)).toLocaleString("en-GB")}
        </div>
        <div style={{ fontSize: 40, color: C.graphite, marginTop: 10 }}>days of real recording, one station at a time</div>
      </div>
      <svg width={W} height={H} style={{ position: "absolute", opacity: split }}>
        {parts.map((p, i) => {
          const v = dp[p.key];
          const x = barX + (acc / total) * barW;
          const w = (v / total) * barW * ramp(t, 31 + i * 0.6, 32.5 + i * 0.6, "inout");
          acc += v;
          const lifted = p.key === "baseline" ? 0 : ramp(t, 34, 36, "inout") * 70;
          return <rect key={p.key} x={x} y={520 + lifted} width={Math.max(0, w - 3)} height={90} fill={p.color} opacity={p.key === "baseline" ? 1 : 0.85} />;
        })}
      </svg>
      <Note text={`${dp.baseline.toLocaleString("en-GB")} ordinary days: the model learns only from these`} at={33} x={barX} y={430} size={42} color={C.ink} width={1600} />
      <Note text="Set aside, never trained on: lockdown, the Christmas weeks, holidays" at={35.5} x={barX + barW} y={720} size={36} align="right" width={1300} />
      <Source text="Real data: Lecocq et al. (2020), Science. Station positions: FDSN." at={1} />
    </Stage>
  );
};
