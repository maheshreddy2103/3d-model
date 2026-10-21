// Receiving inspection and component-manufacturing equipment. Each model is drawn in
// its station's local frame: +x is the direction of belt travel, and `S` (±1) is the
// side of the belt the equipment stands on.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { StationDef } from '../../config/layout';
import { simTime, stationAnim } from '../../sim/runtime';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { RobotArm, tendingProgram } from '../actors/RobotArm';
import { Worker } from '../actors/Worker';

type ModelProps = { def: StationDef };

/** Door open while the robot loads (start) and unloads (end) the machine. */
function doorOpen(progress: number, busy: boolean) {
  if (!busy) return 1;
  if (progress < 0.3) return 1 - Math.max(0, (progress - 0.26) / 0.04);
  if (progress > 0.68) return Math.min(1, (progress - 0.68) / 0.04);
  return 0;
}

export function InspectionTable({ def }: ModelProps) {
  const S = def.side;
  return (
    <group>
      <Box size={[2.2, 0.06, 0.9]} position={[0, 0.92, S * 1.45]} mat={M.steel} />
      {[-1, 1].map((i) => [-1, 1].map((j) => (
        <Box key={`${i}${j}`} size={[0.06, 0.9, 0.06]} position={[i * 1.0, 0.45, S * (1.45 + j * 0.38)]} mat={M.darkSteel} />
      )))}
      <Box size={[0.5, 0.35, 0.05]} position={[-0.6, 1.25, S * 1.8]} mat={M.screen} />
      <Box size={[0.3, 0.12, 0.3]} position={[0.5, 1.0, S * 1.4]} mat={M.machineBlue} />
      <Cyl size={[0.12, 0.25, 0.12]} position={[0.1, 1.07, S * 1.35]} mat={M.casting} />
      <Box size={[0.9, 0.5, 0.6]} position={[0.2, 1.2, S * 1.45]} mat={M.steel} />
      <Worker position={[0.2, 0, S * 2.35]} yaw={S * Math.PI / 2} outfit="lab" station={def.id} task="inspect" />
      <Worker position={[-1.6, 0, S * 0.95]} yaw={S * Math.PI / 2} outfit="vest" station={def.id} task="reach" phase={1.3} />
    </group>
  );
}

export function Saw({ def }: ModelProps) {
  const S = def.side;
  const blade = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (blade.current && a.busy) blade.current.rotation.z = -simTime() * 14;
    if (head.current) head.current.position.y = a.busy ? 1.75 - 0.45 * Math.sin(Math.PI * Math.min(1, a.progress * 1.25)) : 1.75;
  });
  return (
    <group>
      <Box size={[3.2, 0.9, 1.3]} position={[0, 0.45, S * 2.4]} mat={M.machineGreen} />
      <Box size={[3.2, 0.06, 1.1]} position={[0, 0.93, S * 2.4]} mat={M.steel} />
      <Box size={[0.25, 1.6, 0.3]} position={[0.6, 1.6, S * 2.9]} mat={M.machineGreen} />
      <group ref={head} position={[0, 1.75, S * 2.4]}>
        <Box size={[1.6, 0.45, 0.35]} position={[0, 0, 0]} mat={M.machine} />
        <group ref={blade} position={[0.3, -0.05, 0]}>
          <Cyl size={[0.38, 0.04, 0.38]} rotation={[Math.PI / 2, 0, 0]} mat={M.steel} />
          <Box size={[0.7, 0.05, 0.05]} position={[0, 0, 0.03]} mat={M.darkSteel} />
        </group>
      </group>
      {/* Bar-stock rack behind the saw. */}
      <Box size={[4, 0.08, 1.2]} position={[0, 0.6, S * 4.1]} mat={M.rackBeam} />
      {[-1.7, 0, 1.7].map((x) => <Box key={x} size={[0.1, 1.2, 1.2]} position={[x, 0.6, S * 4.1]} mat={M.rackUpright} />)}
      {Array.from({ length: 8 }, (_, i) => (
        <Cyl key={i} size={[0.05, 3.8, 0.05]} position={[0, 0.7 + (i % 2) * 0.1, S * (3.65 + (i >> 1) * 0.28)]} rotation={[0, 0, Math.PI / 2]} mat={M.steel} low />
      ))}
      <Box size={[0.45, 0.6, 0.12]} position={[1.9, 1.2, S * 1.75]} mat={M.screen} />
    </group>
  );
}

/** Enclosed machining centre with a sliding door, tended by a robot. */
function MachineEnclosure({ def, width, spindle }: ModelProps & { width: number; spindle: 'vertical' | 'horizontal' }) {
  const S = def.side;
  const door = useRef<THREE.Group>(null);
  const tool = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    const open = doorOpen(a.progress, a.busy);
    if (door.current) door.current.position.x = -0.35 - open * 1.25;
    if (tool.current) {
      const cutting = a.busy && open === 0;
      if (spindle === 'vertical') {
        tool.current.rotation.y = cutting ? simTime() * 30 : 0;
        tool.current.position.y = cutting ? 1.55 - 0.12 * (0.5 + 0.5 * Math.sin(simTime() * 2.5)) : 1.7;
      } else {
        tool.current.rotation.x = cutting ? simTime() * 30 : 0;
      }
    }
  });
  const front = S * 2.0;
  return (
    <group>
      <Box size={[width, 2.5, 2.2]} position={[0, 1.25, S * 3.1]} mat={M.machine} />
      <Box size={[width + 0.05, 0.3, 2.25]} position={[0, 2.4, S * 3.1]} mat={M.machineBlue} />
      <Box size={[width + 0.05, 0.25, 2.25]} position={[0, 0.12, S * 3.1]} mat={M.darkSteel} />
      {/* Opening in the front face, with the sliding door in front of it. */}
      <Box size={[1.4, 1.3, 0.02]} position={[-0.35, 1.35, front - S * 0.005]} mat={M.black} />
      <group ref={tool} position={[-0.35, 1.6, S * 2.9]}>
        {spindle === 'vertical'
          ? <Cyl size={[0.08, 0.5, 0.08]} mat={M.steel} />
          : <Cyl size={[0.22, 0.3, 0.22]} rotation={[0, 0, Math.PI / 2]} mat={M.steel} />}
      </group>
      <group ref={door} position={[-0.35, 1.35, front - S * 0.06]}>
        <Box size={[1.45, 1.4, 0.06]} mat={M.machineBlue} />
        <Box size={[0.9, 0.7, 0.07]} position={[0, 0.15, 0]} mat={M.glass} cast={false} />
      </group>
      <Box size={[0.6, 0.8, 0.15]} position={[width / 2 - 0.4, 1.45, front - S * 0.1]} mat={M.robotDark} />
      <Box size={[0.45, 0.35, 0.05]} position={[width / 2 - 0.4, 1.55, front - S * 0.18]} mat={M.screen} />
      {/* Chip conveyor and coolant tank. */}
      <Box size={[0.6, 0.6, 1.4]} position={[width / 2 + 0.35, 0.3, S * 3.3]} mat={M.darkSteel} />
      <Box size={[0.7, 0.5, 0.6]} position={[width / 2 + 0.4, 0.25, S * 4.3]} mat={M.binGreen} />
      <RobotArm station={def.id} position={[0.3, 0, S * 1.05]}
        program={tendingProgram(S * Math.PI / 2, -S * Math.PI / 2, 1.05, 1.15)} idleYaw={S * Math.PI / 2} />
    </group>
  );
}

export function Cnc({ def }: ModelProps) {
  return <MachineEnclosure def={def} width={3.4} spindle="vertical" />;
}

export function Drill({ def }: ModelProps) {
  return <MachineEnclosure def={def} width={2.9} spindle="vertical" />;
}

export function Lathe({ def }: ModelProps) {
  const S = def.side;
  const ram = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (ram.current) {
      const press = a.busy && a.progress > 0.45 && a.progress < 0.65;
      ram.current.position.y = press ? 1.45 - 0.25 * Math.sin(((a.progress - 0.45) / 0.2) * Math.PI) : 1.45;
    }
  });
  return (
    <group>
      <group position={[-0.8, 0, 0]}>
        <MachineEnclosure def={def} width={3.6} spindle="horizontal" />
      </group>
      {/* Rotor press: a C-frame hydraulic press next to the lathe. */}
      <group position={[2.25, 0, S * 3.0]}>
        <Box size={[1.2, 0.9, 1.0]} position={[0, 0.45, 0]} mat={M.machineGreen} />
        <Box size={[0.3, 1.6, 0.3]} position={[0, 1.7, S * 0.35]} mat={M.machineGreen} />
        <Box size={[1.0, 0.3, 0.9]} position={[0, 2.4, 0]} mat={M.machineGreen} />
        <group ref={ram} position={[0, 1.45, 0]}>
          <Cyl size={[0.12, 0.8, 0.12]} position={[0, 0.35, 0]} mat={M.steel} />
          <Cyl size={[0.25, 0.1, 0.25]} mat={M.darkSteel} />
        </group>
        <Cyl size={[0.18, 0.3, 0.18]} position={[0, 1.05, 0]} mat={M.casting} />
      </group>
    </group>
  );
}

export function Winder({ def }: ModelProps) {
  const S = def.side;
  const flyer = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (flyer.current && a.busy) flyer.current.rotation.x = simTime() * 9;
  });
  return (
    <group>
      <Box size={[2.6, 1.0, 1.6]} position={[0, 0.5, S * 2.6]} mat={M.machine} />
      <Box size={[2.6, 0.12, 1.65]} position={[0, 1.05, S * 2.6]} mat={M.machineBlue} />
      <Cyl size={[0.32, 0.5, 0.32]} position={[-0.4, 1.35, S * 2.6]} rotation={[0, 0, Math.PI / 2]} mat={M.casting} />
      <group ref={flyer} position={[0.2, 1.35, S * 2.6]}>
        <Box size={[0.12, 1.1, 0.12]} mat={M.steel} />
        <Box size={[0.12, 0.12, 1.1]} mat={M.steel} />
        <Cyl size={[0.08, 0.2, 0.08]} position={[0, 0.55, 0]} mat={M.copper} />
        <Cyl size={[0.08, 0.2, 0.08]} position={[0, -0.55, 0]} mat={M.copper} />
      </group>
      <Box size={[0.4, 1.6, 0.4]} position={[1.1, 0.8, S * 3.2]} mat={M.machine} />
      <Box size={[0.38, 0.3, 0.04]} position={[1.1, 1.3, S * 2.99]} mat={M.screen} />
      {/* Copper wire creel: spools feeding the winder. */}
      <group position={[0, 0, S * 4.2]}>
        <Box size={[2.8, 1.6, 0.08]} position={[0, 0.8, S * 0.35]} mat={M.darkSteel} />
        {Array.from({ length: 10 }, (_, i) => (
          <Cyl key={i} size={[0.17, 0.3, 0.17]} position={[-1.1 + (i % 5) * 0.55, 0.5 + Math.floor(i / 5) * 0.6, 0]} mat={M.copper} />
        ))}
      </group>
      <Worker position={[-1.6, 0, S * 1.3]} yaw={S * Math.PI / 2} outfit="coverall" station={def.id} task="bench" />
    </group>
  );
}
