// The last two data clips as 3D scenes:
//   S09 Lockdown (35 s) the C1 city, day by day from November to May: how busy the street
//                       is follows each REAL day's level at BE.UCC, so in March it empties.
//   S10 Weekends (48 s) the C3 globe: a city it never heard (83%), Salfit's Friday, and
//                       the UAE's weekend move, at the real station positions.
import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { C, DISPLAY, H, TEXT, W } from "../theme";
import { applied, lockdown, pct, results, stations } from "../data";
import { BigNumber, Caption, HBar, lerp, Note, ramp, Source, Stage, useSec } from "../lib";
import { Shot } from "../three/kit";
import { CityWorld } from "../three/World";
import { globeTexture, onSphere, R, toRad } from "./C3Globe";

// ══ S09 Lockdown ═══════════════════════════════════════════════════════════════════════════
type LDay = { date: string; dow: number; level: number; period: string };
const LD = lockdown.days as LDay[];
const LV = LD.map((d) => d.level);
const LO = Math.min(...LV);
const HI = Math.max(...LV);
const T0 = new Date(`${LD[0].date}T12:00:00Z`).getTime();
const T1 = new Date(`${LD[LD.length - 1].date}T12:00:00Z`).getTime();
const fracOf = (s: string) => (new Date(`${s}T12:00:00Z`).getTime() - T0) / (T1 - T0);
const S09_SHOTS: Shot[] = [
  { t: 0, pos: [34, 15, 40], look: [0, -1, 4], fov: 40 },
  { t: 19, pos: [-26, 14, 42], look: [0, -1, 4], fov: 40 },
  { t: 35, pos: [-36, 20, 56], look: [0, -1, 4], fov: 38 },
];

export const S09Lockdown: React.FC = () => {
  const t = useSec();
  const frame = useCurrentFrame();
  const run = ramp(t, 1, 15, "inout");
  const idx = Math.min(LD.length - 1, Math.floor(run * (LD.length - 1)));
  const today = LD[idx];
  // how busy the street is = this real day's level, scaled 0..1 over the season
  const busy = 0.04 + 0.96 * ((today.level - LO) / (HI - LO));
  const b = { x0: 220, x1: 1700, y0: 790, y1: 950 };
  const xd = (s: string) => b.x0 + fracOf(s) * (b.x1 - b.x0);
  const yl = (v: number) => b.y1 - ((v - LO) / (HI - LO)) * (b.y1 - b.y0);
  const lockX = xd(lockdown.lockdown_date);
  const card = ramp(t, 19.5, 20.5, "inout");
  const rate = lockdown.flag_rate as Record<string, number>;
  const months = ["2019-11-01", "2019-12-01", "2020-01-01", "2020-02-01", "2020-03-01", "2020-04-01", "2020-05-01"];
  const dateText = new Date(`${today.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <CityWorld t={t} frame={frame} minute={13 * 60} busy={busy} shots={S09_SHOTS} open={1} ripples={0.5} />
      </ThreeCanvas>
      <Caption text="Lockdown: a new rhythm, not a long Sunday" at={0.3} until={19.5} y={84} serif size={60} width={1500} />
      <Caption text="The street below follows each real day's shaking under Brussels" at={0.8} until={19.5} y={196} size={34} width={1500} />
      {/* the real days, as dots */}
      <div style={{ position: "absolute", left: b.x0 - 60, top: b.y0 - 60, width: b.x1 - b.x0 + 120, height: b.y1 - b.y0 + 120, background: "rgba(250,249,244,0.94)", borderRadius: 8, boxShadow: "0 10px 40px rgba(22,27,33,0.12)", opacity: 1 - card }} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: 1 - card }} fontFamily={TEXT}>
        <rect x={lockX} y={b.y0 - 10} width={b.x1 - lockX + 10} height={b.y1 - b.y0 + 20} fill={C.loud} opacity={0.08 * ramp(t, 10, 11)} />
        <line x1={lockX} y1={b.y0 - 10} x2={lockX} y2={b.y1 + 10} stroke={C.loud} strokeWidth={3} opacity={ramp(t, 10, 11)} />
        {months.map((m) => (
          <text key={m} x={xd(m)} y={b.y1 + 40} textAnchor="middle" fontSize={22} fill={C.graphite}>
            {new Date(`${m}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
          </text>
        ))}
        {LD.slice(0, idx + 1).map((d, i) => (
          <circle key={i} cx={xd(d.date)} cy={yl(d.level)} r={4.5} fill={d.dow >= 5 ? C.glow : C.ink} />
        ))}
        <text x={b.x0} y={b.y0 - 22} fontSize={26} fill={C.ink}>
          {dateText}
        </text>
        <text x={b.x1} y={b.y0 - 22} fontSize={22} fill={C.graphite} textAnchor="end">
          dark: weekdays · blue: weekends
        </text>
      </svg>
      {/* how often the standard alarm rang */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: 0.9 * card }} />
      {card > 0 ? (
        <>
          <div style={{ position: "absolute", left: 120, top: 84, fontFamily: DISPLAY, fontSize: 66, opacity: card }}>How often the standard alarm rang</div>
          <HBar label="Ordinary days" value={rate.baseline} at={20.5} x={120} y={260} width={1300} color={C.graphite} />
          <HBar label="Public holidays" value={rate.holiday} at={22} x={120} y={440} width={1300} color={C.city} />
          <HBar label="Lockdown days" value={rate.lockdown} at={23.5} x={120} y={620} width={1300} color={C.loud} />
          <Note text="Lockdown looked like no day the model had ever heard." at={26} x={120} y={860} width={1600} color={C.ink} size={46} />
        </>
      ) : null}
      <Source text="Real data: Result 4, docs/04-results.md; Brussels BE.UCC, Lecocq et al. (2020). The city is an illustration." at={0.5} />
    </Stage>
  );
};

// ══ S10 Weekends ═══════════════════════════════════════════════════════════════════════════
const SALFIT = stations.stations.find((s) => s.city === "Salfit")!;
const UAE = { lat: applied.uae.lat, lon: applied.uae.lon };
const facing = (lat: number, lon: number) => ({ spin: -Math.atan2(Math.cos(toRad(lon)), -Math.sin(toRad(lon))), tilt: toRad(lat) });

const GlobeCam: React.FC = () => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(-6, 0, 40);
    camera.lookAt(-6, 0, 0);
    camera.fov = 30;
    camera.near = 0.1;
    camera.far = 500;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
};

const pinMat = new THREE.MeshStandardMaterial({ color: "#59616f", roughness: 0.6 });
const hotMat = new THREE.MeshStandardMaterial({ color: C.city, emissive: new THREE.Color(C.cityLight), emissiveIntensity: 0.7 });

const Pulse: React.FC<{ t: number; on: number }> = ({ t, on }) =>
  on <= 0 ? null : (
    <>
      {[0, 1, 2].map((r) => {
        const p = (t * 0.5 + r / 3) % 1;
        return (
          <mesh key={r} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.2 + p * 1.6}>
            <ringGeometry args={[0.92, 1, 64]} />
            <meshBasicMaterial color={C.city} transparent opacity={(1 - p) * 0.8 * on} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );

const Spot: React.FC<{ lat: number; lon: number; on: number; t: number }> = ({ lat, lon, on, t }) => {
  const n = onSphere(lat, lon, 1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  return (
    <group position={onSphere(lat, lon)} quaternion={q}>
      <mesh position={[0, 0.45, 0]} material={hotMat} scale={on}>
        <sphereGeometry args={[0.2, 16, 12]} />
      </mesh>
      <Pulse t={t} on={on} />
    </group>
  );
};

export const S10Weekends: React.FC = () => {
  const t = useSec();
  const map = useMemo(globeTexture, []);
  const sal = (applied.weekend_shift as { city: string; day: string; called_weekend: number }[]).filter((r) => r.city === "Salfit");
  const uae = applied.uae;
  // orientation: a slow turn, then Salfit (8 s), then the UAE (27 s)
  const a = facing(SALFIT.lat, SALFIT.lon);
  const u = facing(UAE.lat, UAE.lon);
  const toSal = ramp(t, 7, 11, "inout");
  const toUae = ramp(t, 26.5, 30, "inout");
  const spin = lerp(lerp(a.spin + 1.6 - t * 0.05, a.spin, toSal), u.spin, toUae);
  const tilt = lerp(lerp(toRad(15), a.tilt, toSal), u.tilt, toUae);
  const salOn = ramp(t, 10, 11) * (1 - ramp(t, 26, 27));
  const uaeOn = ramp(t, 29.5, 30.5);
  const part1 = ramp(t, 8.3, 9) * (1 - ramp(t, 26, 26.5));
  const part2 = ramp(t, 27, 28);
  const bx = (i: number) => 1080 + i * 190;
  const zeroY = 560;
  return (
    <Stage>
      <ThreeCanvas width={W} height={H} gl={{ antialias: true }} flat>
        <color attach="background" args={[C.paper]} />
        <GlobeCam />
        <hemisphereLight args={["#ffffff", "#d8cbb2", 1.6]} />
        <directionalLight position={[-30, 25, 40]} intensity={1.6} color="#fff4e2" />
        <group position={[-17, 0, 0]} rotation={[tilt, 0, 0]}>
          <group rotation={[0, spin, 0]}>
            <mesh>
              <sphereGeometry args={[R, 128, 96]} />
              <meshStandardMaterial map={map} roughness={0.95} />
            </mesh>
            {stations.stations.map((s) => {
              const n = onSphere(s.lat, s.lon, 1).normalize();
              return (
                <mesh key={s.code} position={onSphere(s.lat, s.lon, R + 0.12)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)} material={pinMat}>
                  <sphereGeometry args={[0.1, 8, 6]} />
                </mesh>
              );
            })}
            <Spot lat={SALFIT.lat} lon={SALFIT.lon} on={salOn} t={t} />
            <Spot lat={UAE.lat} lon={UAE.lon} on={uaeOn} t={t} />
          </group>
        </group>
      </ThreeCanvas>

      {/* a city it has never heard */}
      <div style={{ opacity: 1 - ramp(t, 7.5, 8.3) }}>
        <Caption text="A city it has never heard" at={0.3} until={7.5} x={1000} y={120} serif size={64} />
        <Note text="One model, trained on all the other cities, tested on a city it never saw" at={0.8} until={7.5} x={1000} y={260} width={800} size={36} />
        {t < 8.5 ? <BigNumber value={results.unseen_city_pooled_weekend * 100} at={1.5} x={1000} y={400} size={220} color={C.city} /> : null}
        <Note text="weekday or weekend, right" at={2.5} until={7.5} x={1010} y={640} width={800} size={40} />
      </div>

      {/* Salfit */}
      <div style={{ opacity: part1 }}>
        <div style={{ position: "absolute", left: 1000, top: 110, width: 860, fontFamily: DISPLAY, fontSize: 50, lineHeight: 1.1 }}>It recognises rest, not the day's name</div>
        <div style={{ position: "absolute", left: 1000, top: 250, width: 860, fontSize: 32, color: C.graphite }}>Trained only on Saturday–Sunday countries, then shown Salfit, Palestine. Share of days it called “weekend”:</div>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} fontFamily={TEXT}>
          {sal.map((r, i) => {
            const h = r.called_weekend * 340 * ramp(t, 11 + i * 0.6, 13 + i * 0.6);
            const fri = r.day === "Fri";
            return (
              <g key={r.day}>
                <rect x={bx(i) - 10} y={820 - h} width={150} height={h} fill={fri ? C.city : C.graphite} />
                <text x={bx(i) + 65} y={865} textAnchor="middle" fontSize={34} fill={C.ink}>
                  {r.day}
                </text>
                <text x={bx(i) + 65} y={806 - h} textAnchor="middle" fontSize={42} fontFamily={DISPLAY} fill={C.ink} opacity={ramp(t, 13 + i * 0.6, 14 + i * 0.6)}>
                  {pct(r.called_weekend)}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: 1000, top: 920, width: 860, fontSize: 30, color: C.graphite }}>Friday is Salfit's weekend. Jeddah, our third Friday city, didn't transfer.</div>
      </div>

      {/* the UAE */}
      <div style={{ opacity: part2 }}>
        <div style={{ position: "absolute", left: 1000, top: 110, width: 860, fontFamily: DISPLAY, fontSize: 50, lineHeight: 1.1 }}>The UAE moved its weekend in 2022</div>
        <div style={{ position: "absolute", left: 1000, top: 250, width: 860, fontSize: 32, color: C.graphite }}>Prediction written down before any data was downloaded. One seismometer, in Sharjah.</div>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} fontFamily={TEXT}>
          <line x1={1000} y1={zeroY} x2={1860} y2={zeroY} stroke={C.graphite} strokeWidth={2} />
          {[
            { x: 1040, v: uae.sunday_change, label: "Sundays, after the change", c: C.city, at: 30, p: uae.p },
            { x: 1460, v: uae.placebo_sunday_change, label: "Placebo: the year before", c: C.graphite, at: 33, p: uae.placebo_p },
          ].map((b) => {
            const h = Math.abs(b.v) * 1400 * ramp(t, b.at, b.at + 1.5);
            return (
              <g key={b.label}>
                <rect x={b.x} y={b.v < 0 ? zeroY : zeroY - h} width={300} height={h} fill={b.c} />
                <text x={b.x + 150} y={b.v < 0 ? zeroY - 26 : zeroY + 60} textAnchor="middle" fontSize={58} fontFamily={DISPLAY} fill={C.ink} opacity={ramp(t, b.at + 1, b.at + 2)}>
                  {`${b.v > 0 ? "+" : "−"}${Math.round(Math.abs(b.v) * 100)}%`}
                </text>
                <text x={b.x + 150} y={zeroY + 340} textAnchor="middle" fontSize={28} fill={C.graphite} opacity={ramp(t, b.at, b.at + 1)}>
                  {b.label}
                </text>
                <text x={b.x + 150} y={zeroY + 380} textAnchor="middle" fontSize={26} fill={C.graphite} opacity={ramp(t, b.at + 1.5, b.at + 2.5)}>
                  {`p = ${b.p < 0.01 ? b.p.toFixed(3) : b.p.toFixed(2)}`}
                </text>
              </g>
            );
          })}
        </svg>
        <Note text="Sundays got quieter. The year before, nothing changed." at={36} x={1000} y={980} width={880} size={34} color={C.ink} />
      </div>
      <Source text="Results 9 and 10, docs/04-results.md; positions: FDSN; UAE: II.UOSS (EarthScope MUSTANG)" at={0.5} />
    </Stage>
  );
};
