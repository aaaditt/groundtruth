// The seismometer in its vault: a heavy brass weight hanging on a spring from a frame, a
// pen on the weight, and a paper drum turning past the pen. (Illustration: the shape of a
// classic instrument, so the idea of "a weight that lags behind the ground" is visible.)
// `jiggle` is how far the weight moves; the scene passes in the real reading of the
// moment, so it shakes harder when the real city was busier.
import React, { useMemo } from "react";
import * as THREE from "three";
import { M, VAULT } from "./City";
import { P } from "./kit";

const brass = new THREE.MeshStandardMaterial({ color: P.brass, roughness: 0.35, metalness: 0.55 });
const steel = new THREE.MeshStandardMaterial({ color: P.steel, roughness: 0.35, metalness: 0.6 });
const dark = new THREE.MeshStandardMaterial({ color: "#2f343b", roughness: 0.6 });
const pier = new THREE.MeshStandardMaterial({ color: "#a39b8d", roughness: 0.95, flatShading: true });
const ink = new THREE.MeshStandardMaterial({ color: P.orange, roughness: 0.5 });

/** Paper with faint grid lines, wrapped round the drum. */
const paperTexture = () => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#faf7ef";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(46,92,149,0.22)";
  g.lineWidth = 2;
  for (let x = 0; x < c.width; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let y = 0; y < c.height; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const SEIS = { x: (VAULT.x0 + VAULT.x1) / 2 - 0.6, y: VAULT.y0 + 0.12, z: 11.4 };

export const Seismometer: React.FC<{ jiggle: number; drumTurn: number; lamp: number }> = ({ jiggle, drumTurn, lamp }) => {
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.9 }), []);
  const top = 3.05; // height of the beam above the floor
  const rest = 1.55; // spring length at rest
  const len = rest + jiggle;
  const spring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 9;
    for (let i = 0; i <= turns * 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.16, -i / (turns * 24), Math.sin(a) * 0.16));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.025, 6, false);
  }, []);
  const massY = top - len - 0.3;
  return (
    <group position={[SEIS.x, SEIS.y, SEIS.z]}>
      {/* concrete pier the instrument is bolted to (it moves with the ground) */}
      <mesh position={[0.4, 0.2, 0]} material={pier} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.4, 2.0]} />
      </mesh>
      {/* the frame */}
      <mesh position={[-0.8, 0.4 + (top - 0.4) / 2, 0]} material={steel} castShadow>
        <boxGeometry args={[0.14, top - 0.4, 0.14]} />
      </mesh>
      <mesh position={[0.2, top, 0]} material={steel} castShadow>
        <boxGeometry args={[2.2, 0.14, 0.18]} />
      </mesh>
      {/* the spring, stretched to the current length */}
      <mesh geometry={spring} material={steel} position={[0, top - 0.07, 0]} scale={[1, len, 1]} />
      {/* the heavy weight: it "stays still" while the ground moves */}
      <group position={[0, massY, 0]}>
        <mesh material={brass} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.6, 28]} />
        </mesh>
        {/* pen arm to the drum */}
        <mesh position={[0.75, 0, 0]} material={dark}>
          <boxGeometry args={[1.1, 0.06, 0.06]} />
        </mesh>
        <mesh position={[1.32, 0, 0.0]} rotation={[0, 0, Math.PI / 2]} material={ink}>
          <coneGeometry args={[0.07, 0.22, 8]} />
        </mesh>
      </group>
      {/* the paper drum, turning */}
      <group position={[1.85, top - rest - 0.3, 0]}>
        <mesh rotation={[Math.PI / 2, drumTurn, 0]} material={paper} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 1.3, 40]} />
        </mesh>
        <mesh position={[0, -0.95, 0]} material={steel}>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
        </mesh>
      </group>
      {/* a small lamp in the vault so the instrument is lit even at night */}
      <pointLight position={[0.6, 3.1, 1.6]} intensity={lamp} distance={7} decay={1.6} color="#ffe2b8" />
      <mesh position={[0.6, VAULT.y1 - SEIS.y - 0.18, 0.4]} material={M.lamp}>
        <boxGeometry args={[0.5, 0.08, 0.3]} />
      </mesh>
    </group>
  );
};
