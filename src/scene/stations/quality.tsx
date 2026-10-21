// Quality-control equipment: vision arch, CMM gantry, electrical test bench, environmental
// chamber, vibration/endurance dyno, rework bench and reject cage.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_Y, REJECT_CAGE, type StationDef } from '../../config/layout';
import { simTime, stationAnim } from '../../sim/runtime';
import { COLORS, G, M } from '../materials';
import { Box, Cyl } from '../primitives';
import { Worker } from '../actors/Worker';

type ModelProps = { def: StationDef };

/** Screen material that shows the station's latest result colour. */
function useStatusScreen(def: StationDef) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0e2433', emissive: new THREE.Color(COLORS.idle), emissiveIntensity: 0.8 }), []);
  useFrame(() => {
    const a = stationAnim(def.id);
    material.emissive.set(a.busy ? '#3fb7ff' : a.status === 'idle' ? COLORS.idle : COLORS[a.status]);
  });
  return material;
}

export function VisionArch({ def }: ModelProps) {
  const S = def.side;
  const scan = useRef<THREE.Mesh>(null);
  const screen = useStatusScreen(def);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (scan.current) {
      scan.current.visible = a.busy;
      scan.current.position.x = -0.7 + 1.4 * ((a.progress * 2) % 1);
    }
  });
  return (
    <group>
      {[-0.85, 0.85].map((z) => <Box key={z} size={[0.18, 2.2, 0.18]} position={[0, 1.1, z]} mat={M.machine} />)}
      <Box size={[0.5, 0.3, 2.0]} position={[0, 2.2, 0]} mat={M.machine} />
      {[-0.5, 0, 0.5].map((z) => <Box key={z} size={[0.16, 0.22, 0.16]} position={[0, 1.95, z]} mat={M.robotDark} />)}
      <mesh ref={scan} position={[0, BELT_Y + 0.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1.6, 0.9, 1]} material={M.scanLight}>
        <planeGeometry />
      </mesh>
      <Box size={[0.08, 1.2, 0.08]} position={[0.3, 0.6, S * 1.6]} mat={M.darkSteel} />
      <Box size={[0.7, 0.45, 0.05]} position={[0.3, 1.35, S * 1.6]} mat={screen} />
    </group>
  );
}

export function Cmm({ def }: ModelProps) {
  const S = def.side;
  const bridge = useRef<THREE.Group>(null);
  const probe = useRef<THREE.Group>(null);
  const screen = useStatusScreen(def);
  useFrame(() => {
    const a = stationAnim(def.id);
    const p = a.busy ? a.progress : 0;
    if (bridge.current) bridge.current.position.x = -0.6 + 1.2 * (0.5 - 0.5 * Math.cos(p * Math.PI * 2));
    if (probe.current) probe.current.position.y = a.busy ? 1.55 - 0.3 * Math.abs(Math.sin(p * Math.PI * 6)) : 1.6;
  });
  return (
    <group>
      {[-1.0, 1.0].map((z) => (
        <group key={z}>
          <Box size={[2.8, 0.14, 0.14]} position={[0, 2.0, z]} mat={M.steel} />
          {[-1.3, 1.3].map((x) => <Box key={x} size={[0.12, 2.0, 0.12]} position={[x, 1.0, z]} mat={M.machine} />)}
        </group>
      ))}
      <group ref={bridge}>
        <Box size={[0.3, 0.3, 2.2]} position={[0, 2.15, 0]} mat={M.machineBlue} />
        <Box size={[0.22, 0.4, 0.22]} position={[0, 2.0, 0]} mat={M.machine} />
        <group ref={probe} position={[0, 1.6, 0]}>
          <Cyl size={[0.04, 0.6, 0.04]} mat={M.steel} />
          <mesh geometry={G.sphere} material={M.binRed} scale={0.05} position={[0, -0.32, 0]} />
        </group>
      </group>
      <Box size={[1.2, 0.75, 0.6]} position={[0, 0.38, S * 1.9]} mat={M.machine} />
      <Box size={[0.6, 0.4, 0.05]} position={[0, 1.0, S * 2.0]} mat={screen} />
      <Worker position={[0, 0, S * 2.6]} yaw={-S * Math.PI / 2} outfit="lab" station={def.id} task="inspect" />
    </group>
  );
}

export function ElectricalBench({ def }: ModelProps) {
  const S = def.side;
  const screen = useStatusScreen(def);
  const cables = useRef<THREE.Group>(null);
  useFrame(() => {
    if (cables.current) cables.current.visible = stationAnim(def.id).busy;
  });
  return (
    <group>
      <Box size={[1.6, 2.0, 0.7]} position={[0, 1.0, S * 2.2]} mat={M.machine} />
      <Box size={[1.2, 0.5, 0.04]} position={[0, 1.45, S * 1.84]} mat={screen} />
      <Box size={[1.2, 0.3, 0.04]} position={[0, 0.85, S * 1.84]} mat={M.screenGreen} />
      {[-0.4, 0, 0.4].map((x) => <Cyl key={x} size={[0.06, 0.04, 0.06]} position={[x, 0.55, S * 1.84]} rotation={[Math.PI / 2, 0, 0]} mat={M.binRed} />)}
      <Box size={[1.0, 0.06, 0.6]} position={[-1.5, 0.92, S * 1.7]} mat={M.wood} />
      <Box size={[0.06, 0.9, 0.55]} position={[-1.95, 0.45, S * 1.7]} mat={M.darkSteel} />
      <group ref={cables}>
        <Box size={[0.05, 0.05, 1.5]} position={[0.15, 1.2, S * 1.0]} mat={M.robotDark} />
        <Box size={[0.05, 0.05, 1.5]} position={[-0.15, 1.25, S * 1.0]} mat={M.binRed} />
      </group>
      <Worker position={[-1.2, 0, S * 1.05]} yaw={S * Math.PI / 2} outfit="lab" station={def.id} task="inspect" />
    </group>
  );
}

export function Chamber({ def }: ModelProps) {
  const S = def.side;
  const glow = useRef<THREE.Mesh>(null);
  const glowMat = useMemo(() => M.chamberWarm.clone(), []);
  const screen = useStatusScreen(def);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (glow.current) glow.current.visible = a.busy;
    if (a.busy) {
      // Phases of the run: heat, humidity, thermal cycles (cold/hot), spray.
      const p = a.progress;
      const color = p < 0.3 ? '#ff7a2a' : p < 0.5 ? '#6fd3ff' : p < 0.8 ? (Math.sin(simTime() * 3) > 0 ? '#ff7a2a' : '#4f8fff') : '#4fe0ff';
      glowMat.emissive.set(color);
      glowMat.color.set(color);
    }
  });
  const half = 1.25;
  return (
    <group>
      {/* Shell: solid back, glass front facing the camera, roof, strip curtains at the ends. */}
      <Box size={[3.6, 2.6, 0.12]} position={[0, 1.3, -S * half]} mat={M.machine} />
      <Box size={[3.6, 2.6, 0.08]} position={[0, 1.3, S * half]} mat={M.glass} cast={false} />
      {[-1.8, 1.8].map((x) => (
        <group key={x}>
          <Box size={[0.15, 2.6, 0.15]} position={[x, 1.3, S * half]} mat={M.machine} />
          <Box size={[0.08, 1.1, 2.4]} position={[x, 2.05, 0]} mat={M.machine} />
          <Box size={[0.03, 1.0, 1.0]} position={[x, BELT_Y + 0.5, 0]} mat={M.glass} cast={false} />
        </group>
      ))}
      <Box size={[3.8, 0.15, 2.7]} position={[0, 2.68, 0]} mat={M.machine} />
      <mesh ref={glow} position={[0, 1.5, 0]} scale={[3.4, 2.2, 2.2]} material={glowMat}>
        <boxGeometry />
      </mesh>
      {/* Refrigeration unit and controller behind the chamber. */}
      <Box size={[1.6, 1.8, 1.0]} position={[-0.8, 0.9, -S * 2.1]} mat={M.machine} />
      <Box size={[1.0, 0.1, 0.8]} position={[-0.8, 1.85, -S * 2.1]} mat={M.darkSteel} />
      <Box size={[0.8, 1.6, 0.6]} position={[1.0, 0.8, -S * 2.0]} mat={M.machineBlue} />
      <Box size={[0.5, 0.35, 0.03]} position={[1.0, 1.2, -S * 1.69]} mat={screen} />
    </group>
  );
}

export function Dyno({ def }: ModelProps) {
  const S = def.side;
  const drum = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const screen = useStatusScreen(def);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (drum.current && a.busy) drum.current.rotation.z = simTime() * 18;
    if (shaft.current) {
      const engaged = a.busy ? Math.min(1, a.progress * 8, (1 - a.progress) * 8) : 0;
      shaft.current.scale.set(0.05, 0.05, 0.2 + engaged * 0.9);
      shaft.current.position.z = S * (1.65 - (0.2 + engaged * 0.9) / 2);
    }
  });
  return (
    <group>
      <Box size={[2.6, 0.5, 1.2]} position={[0, 0.25, S * 2.1]} mat={M.darkSteel} />
      <Box size={[1.0, 0.8, 0.9]} position={[0.6, 0.9, S * 2.1]} mat={M.machineBlue} />
      <group ref={drum} position={[-0.6, 1.05, S * 2.1]}>
        <Cyl size={[0.45, 0.5, 0.45]} rotation={[Math.PI / 2, 0, 0]} mat={M.steel} />
        <Box size={[0.1, 0.9, 0.52]} mat={M.binRed} />
      </group>
      <mesh ref={shaft} geometry={G.box} material={M.steel} position={[0, BELT_Y + 0.35, S * 1.2]} />
      <Box size={[0.7, 1.5, 0.5]} position={[1.6, 0.75, S * 2.6]} mat={M.machine} />
      <Box size={[0.5, 0.4, 0.03]} position={[1.6, 1.2, S * 2.34]} mat={screen} />
      <Box size={[2.8, 1.1, 0.04]} position={[0, 1.05, S * 2.85]} mat={M.glass} cast={false} />
    </group>
  );
}

export function ReworkBench({ def }: ModelProps) {
  const S = def.side;
  return (
    <group>
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <Box size={[2.4, 0.06, 0.9]} position={[x, 0.92, S * 1.9]} mat={M.wood} />
          {[-1.1, 1.1].map((dx) => <Box key={dx} size={[0.06, 0.9, 0.85]} position={[x + dx, 0.45, S * 1.9]} mat={M.darkSteel} />)}
          <Box size={[2.4, 0.8, 0.05]} position={[x, 1.35, S * 2.32]} mat={M.steel} />
        </group>
      ))}
      <Cyl size={[0.25, 0.3, 0.25]} position={[-1.6, 1.1, S * 1.9]} rotation={[0, 0, Math.PI / 2]} mat={M.motorPaint} />
      <Box size={[0.3, 0.2, 0.2]} position={[1.2, 1.05, S * 1.8]} mat={M.screen} />
      <Box size={[0.8, 1.5, 0.5]} position={[3.2, 0.75, S * 1.9]} mat={M.binRed} />
      <Worker position={[-1.5, 0, S * 1.0]} yaw={S * Math.PI / 2} outfit="coverall" station={def.id} task="bench" />
      <Worker position={[1.3, 0, S * 1.0]} yaw={S * Math.PI / 2} outfit="lab" station={def.id} task="inspect" phase={0.9} />
    </group>
  );
}

/** Mesh-fenced reject cage around the end of the scrap lane (open on the lane side). */
export function RejectCage() {
  const [x0, z0, x1, z1] = REJECT_CAGE;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return (
    <group>
      <Box size={[x1 - x0, 1.8, 0.06]} position={[cx, 0.9, z0]} mat={M.glass} cast={false} />
      <Box size={[x1 - x0, 1.8, 0.06]} position={[cx, 0.9, z1]} mat={M.glass} cast={false} />
      <Box size={[0.06, 1.8, z1 - z0]} position={[x1, 0.9, cz]} mat={M.glass} cast={false} />
      {[[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.1, 1.9, 0.1]} position={[x, 0.95, z]} mat={M.cage} />
      ))}
      <Box size={[x1 - x0, 0.06, 0.06]} position={[cx, 1.85, z0]} mat={M.cage} />
      <Box size={[x1 - x0, 0.06, 0.06]} position={[cx, 1.85, z1]} mat={M.cage} />
      <Box size={[0.06, 0.06, z1 - z0]} position={[x1, 1.85, cz]} mat={M.cage} />
    </group>
  );
}
