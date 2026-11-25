// Shared worlds for every 3D clip, so the whole talk looks like one place:
//   CityWorld  the city of C1 (the whole city, the seismometer block, the dug-out pit)
//   Studio     a paper "table" with soft light and shadows, for 3D data sculptures
//   Pin        an HTML label stuck to a 3D point (sharp text, follows the camera)
//   PaperSign  a standing paper sign with real typeset text on it
//   Column     a 3D bar that grows
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { continueRender, delayRender } from "remotion";
import { C, DISPLAY, fontState, fontsReady, TEXT } from "../theme";
import { Atmosphere, CameraPath, DayLights, daylight, screenOf, Shot, skyColor } from "./kit";
import { Buildings, Ground, People, Railway, Ripples, Street, Traffic } from "./City";
import { Metro, PitFill } from "./Metro";
import { Seismometer } from "./Seismometer";
import { fade } from "../lib";

// ---- the city ----------------------------------------------------------------------------
export const CityWorld: React.FC<{
  t: number;
  amb?: number; // background clock (cars, people, trains); defaults to t
  frame: number;
  minute: number; // local time: sets the light and the sky
  busy: number; // 0..1: how many cars, buses and people are out (from real data)
  open?: number; // 0..1: how far the pit in front of the seismometer is dug out
  ripples?: number; // 0..1: traffic ripples on the cut face
  shake?: number; // how hard the seismometer's weight moves
  shots: Shot[];
  plazaTrees?: boolean;
  children?: React.ReactNode;
}> = ({ t, amb = t, frame, minute, busy, open = 0, ripples = 0, shake = 0, shots, plazaTrees = true, children }) => {
  const night = 1 - daylight(minute);
  const jiggle = Math.min(0.26, shake) * (Math.sin(frame * 1.9) * 0.7 + Math.sin(frame * 3.3 + 1) * 0.3);
  return (
    <>
      <Atmosphere color={skyColor(minute)} near={110} far={300} />
      <DayLights minute={minute} extent={75} shadowSize={4096} />
      <CameraPath t={t} shots={shots} />
      <Metro t={amb} busy={busy} lit={night * (0.45 + 0.55 * busy) * 1.3} />
      <Ground />
      <PitFill open={open} trees={plazaTrees} />
      <Street night={night} />
      <Buildings lit={0.08 + 0.75 * night * (0.35 + 0.65 * busy)} />
      <Railway t={amb} busy={busy} />
      <Traffic t={amb} busy={busy} night={night} />
      <People t={amb} busy={busy} />
      {ripples > 0 ? <Ripples t={amb} busy={busy} strength={ripples * (0.25 + 0.75 * busy)} /> : null}
      <Seismometer jiggle={jiggle} drumTurn={-amb * 0.6} lamp={1.2 + 1.5 * night} />
      {children}
    </>
  );
};

// ---- the studio --------------------------------------------------------------------------
export const Studio: React.FC<{ shots: Shot[]; t: number; extent?: number; floor?: string; children?: React.ReactNode }> = ({
  shots,
  t,
  extent = 40,
  floor = "#ece7da",
  children,
}) => (
  <>
    <color attach="background" args={[C.paper]} />
    <fog attach="fog" args={[C.paper, 80, 190]} />
    <CameraPath t={t} shots={shots} />
    <hemisphereLight args={["#fbf8f1", "#cbbfa8", 1.45]} />
    <directionalLight
      position={[-30, 55, 40]}
      intensity={1.8}
      color="#fff1dc"
      castShadow
      shadow-mapSize-width={4096}
      shadow-mapSize-height={4096}
      shadow-camera-left={-extent}
      shadow-camera-right={extent}
      shadow-camera-top={extent}
      shadow-camera-bottom={-extent}
      shadow-camera-far={200}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[900, 128]} />
      <meshStandardMaterial color={floor} roughness={0.95} />
    </mesh>
    {children}
  </>
);

// ---- labels ------------------------------------------------------------------------------
/** HTML text pinned to a 3D point. Anchor: the point is at the label's bottom-centre by
 * default ("left" puts it at the left-middle). */
export const Pin: React.FC<{
  t: number;
  shots: Shot[];
  p: [number, number, number];
  text: string;
  at: number;
  until?: number;
  color?: string;
  size?: number;
  dx?: number;
  dy?: number;
  anchor?: "bottom" | "left" | "right" | "center";
  serif?: boolean;
  weight?: number;
  halo?: boolean;
}> = ({ t, shots, p, text, at, until, color = C.ink, size = 34, dx = 0, dy = 0, anchor = "bottom", serif = false, weight = 400, halo = true }) => {
  const o = fade(t, at, until);
  if (o <= 0) return null;
  const s = screenOf(t, shots, p);
  const tr = { bottom: "translate(-50%, -100%)", left: "translate(0, -50%)", right: "translate(-100%, -50%)", center: "translate(-50%, -50%)" }[anchor];
  return (
    <div
      style={{
        position: "absolute",
        left: s.x + dx,
        top: s.y + dy,
        transform: tr,
        fontFamily: serif ? DISPLAY : TEXT,
        fontSize: size,
        fontWeight: weight,
        color,
        whiteSpace: "nowrap",
        opacity: o,
        fontVariantNumeric: "tabular-nums",
        textShadow: halo ? "0 0 14px rgba(245,241,235,0.95), 0 0 5px rgba(245,241,235,0.95)" : undefined,
      }}
    >
      {text}
    </div>
  );
};

// ---- fonts for text drawn INSIDE the 3D scene ------------------------------------------
/** Waits (delayRender) until the talk's fonts are loaded, so canvas text uses them. */
export const useFontsReady = () => {
  const [ready, setReady] = useState(fontState.done);
  const [handle] = useState(() => (fontState.done ? null : delayRender("fonts for 3D text")));
  useEffect(() => {
    if (handle === null) return;
    fontsReady.then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};

const wrap = (g: CanvasRenderingContext2D, text: string, maxW: number) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
};

export type SignFace = {
  kicker?: string; // big serif line at the top (e.g. "01"), orange
  kickerItalic?: boolean;
  body: string; // the sign's sentence
  result?: string; // a big number at the bottom
  resultNote?: string;
  tick?: "yes" | "open"; // a tick stamped in the corner, or an open circle
  dashed?: boolean;
};

/** Paper texture with the sign's text, laid out like the proposal deck's cards. */
const signTexture = (f: SignFace, w: number, h: number, ready: boolean) => {
  const S = 220; // pixels per world unit
  const c = document.createElement("canvas");
  c.width = Math.round(w * S);
  c.height = Math.round(h * S);
  const g = c.getContext("2d")!;
  g.fillStyle = "#faf9f4";
  g.fillRect(0, 0, c.width, c.height);
  if (f.dashed) {
    g.setLineDash([26, 20]);
    g.strokeStyle = C.ink;
    g.lineWidth = 8;
    g.strokeRect(18, 18, c.width - 36, c.height - 36);
    g.setLineDash([]);
  }
  const pad = 0.09 * c.width;
  const disp = ready ? DISPLAY : "Georgia, serif";
  const text = ready ? TEXT : "Arial, sans-serif";
  let y = pad;
  if (f.kicker) {
    g.fillStyle = f.kickerItalic ? C.ink : C.city;
    g.font = `${f.kickerItalic ? "italic " : ""}${Math.round(c.height * 0.17)}px ${disp}`;
    g.textBaseline = "top";
    g.fillText(f.kicker, pad, y);
    y += c.height * 0.24;
  }
  g.fillStyle = C.ink;
  const bodySize = Math.round(c.height * 0.115);
  g.font = `${bodySize}px ${text}`;
  g.textBaseline = "top";
  for (const line of wrap(g, f.body, c.width - pad * 2 - (f.tick && !f.kicker ? c.width * 0.2 : 0))) {
    g.fillText(line, pad, y);
    y += bodySize * 1.25;
  }
  if (f.result) {
    g.fillStyle = f.tick === "open" ? C.graphite : C.glow;
    g.font = `${f.tick === "open" ? "italic " : ""}${Math.round(c.height * 0.2)}px ${disp}`;
    g.textBaseline = "alphabetic";
    g.fillText(f.result, pad, c.height - pad - (f.resultNote ? c.height * 0.08 : 0));
    if (f.resultNote) {
      g.fillStyle = C.graphite;
      g.font = `${Math.round(c.height * 0.075)}px ${text}`;
      g.fillText(f.resultNote, pad, c.height - pad);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

const tickTexture = (kind: "yes" | "open") => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.lineCap = "round";
  g.lineJoin = "round";
  if (kind === "yes") {
    g.strokeStyle = C.good;
    g.lineWidth = 30;
    g.beginPath();
    g.moveTo(50, 135);
    g.lineTo(105, 190);
    g.lineTo(210, 70);
    g.stroke();
  } else {
    g.strokeStyle = C.graphite;
    g.lineWidth = 16;
    g.setLineDash([24, 22]);
    g.beginPath();
    g.arc(128, 128, 90, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** A standing paper sign on a little wooden foot. `rise` 0..1 lifts it out of the ground;
 * `stamp` 0..1 presses the tick onto it. */
export const PaperSign: React.FC<{
  face: SignFace;
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  rise: number;
  stamp?: number;
}> = ({ face, position, rotY = 0, w = 4.4, h = 3.2, rise, stamp = 0 }) => {
  const ready = useFontsReady();
  const key = JSON.stringify(face);
  const map = useMemo(() => signTexture(face, w, h, ready), [key, w, h, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const tick = useMemo(() => (face.tick ? tickTexture(face.tick) : null), [face.tick]);
  if (rise <= 0) return null;
  const lift = 0.9 + h / 2;
  return (
    <group position={[position[0], position[1] - (1 - rise) * (lift + h), position[2]]} rotation={[0, rotY, 0]}>
      {/* the foot */}
      <mesh position={[0, 0.45, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.9, 0.22]} />
        <meshStandardMaterial color="#8a6a4c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.04, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 0.8]} />
        <meshStandardMaterial color="#7a5c40" roughness={0.9} />
      </mesh>
      {/* the paper board */}
      <mesh position={[0, lift, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.08]} />
        <meshStandardMaterial attach="material-0" color="#e9e4d8" />
        <meshStandardMaterial attach="material-1" color="#e9e4d8" />
        <meshStandardMaterial attach="material-2" color="#e9e4d8" />
        <meshStandardMaterial attach="material-3" color="#e9e4d8" />
        <meshStandardMaterial attach="material-4" map={map} roughness={0.92} />
        <meshStandardMaterial attach="material-5" color="#e0d9ca" />
      </mesh>
      {tick && stamp > 0 ? (
        <mesh position={[w / 2 - 0.62, lift + h / 2 - 0.62, 0.06]} scale={0.95 * (1 + (1 - stamp) * 0.6)}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tick} transparent opacity={stamp} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// ---- bars ---------------------------------------------------------------------------------
export const Column: React.FC<{
  x: number;
  z: number;
  height: number;
  grow: number; // 0..1
  color: string;
  w?: number;
  d?: number;
  base?: number;
  opacity?: number;
  emissive?: number;
}> = ({ x, z, height, grow, color, w = 1, d = 1, base = 0, opacity = 1, emissive = 0 }) => {
  const h = Math.max(0.001, Math.abs(height) * grow);
  const y = height >= 0 ? base + h / 2 : base - h / 2;
  if (grow <= 0) return null;
  return (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.75} transparent={opacity < 1} opacity={opacity} emissive={new THREE.Color(color)} emissiveIntensity={emissive} />
    </mesh>
  );
};
