// Packaging stations: nameplate labeller, packing station with carton erector, and the
// palletising robot that stacks cartons on the finished-goods pallet.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { BELT_Y, PALLET_SPOT, STATION_BY_ID, type StationDef } from '../../config/layout';
import { simTime, stationAnim } from '../../sim/runtime';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { RobotArm, palletProgram } from '../actors/RobotArm';
import { Worker } from '../actors/Worker';

type ModelProps = { def: StationDef };

export function Labeler({ def }: ModelProps) {
  const S = def.side;
  const arm = useRef<THREE.Group>(null);
  const roll = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    const reach = a.busy ? Math.sin(Math.min(1, Math.max(0, (a.progress - 0.3) / 0.45)) * Math.PI) : 0;
    if (arm.current) arm.current.position.z = S * (1.2 - reach * 0.55);
    if (roll.current && a.busy) roll.current.rotation.z = simTime() * 4;
  });
  return (
    <group>
      <Box size={[1.1, 1.2, 0.8]} position={[0, 0.6, S * 1.6]} mat={M.machine} />
      <Box size={[1.1, 0.4, 0.6]} position={[0, 1.4, S * 1.55]} mat={M.machineBlue} />
      <group ref={roll} position={[-0.25, 1.75, S * 1.6]}>
        <Cyl size={[0.2, 0.18, 0.2]} rotation={[Math.PI / 2, 0, 0]} mat={M.label} />
      </group>
      <group ref={arm} position={[0.2, BELT_Y + 0.45, S * 1.2]}>
        <Box size={[0.12, 0.12, 0.6]} mat={M.steel} />
        <Box size={[0.25, 0.2, 0.05]} position={[0, 0, -S * 0.3]} mat={M.label} />
      </group>
      <Box size={[0.4, 0.3, 0.04]} position={[0.35, 1.15, S * 1.19]} mat={M.screen} />
    </group>
  );
}

export function Cartoner({ def }: ModelProps) {
  const S = def.side;
  const flap = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = stationAnim(def.id);
    if (flap.current) flap.current.rotation.x = a.busy ? Math.sin(a.progress * Math.PI * 2) * 0.6 : 0;
  });
  return (
    <group>
      {/* Carton erector folding flat blanks into boxes. */}
      <Box size={[2.2, 1.5, 1.3]} position={[-0.6, 0.75, S * 2.6]} mat={M.machine} />
      <Box size={[2.2, 0.25, 1.35]} position={[-0.6, 1.5, S * 2.6]} mat={M.machineGreen} />
      <group ref={flap} position={[0.6, 1.1, S * 2.0]}>
        <Box size={[0.6, 0.04, 0.6]} position={[0, 0, 0]} mat={M.carton} />
      </group>
      <Box size={[0.75, 0.6, 0.75]} position={[0.75, 0.3, S * 2.1]} mat={M.carton} />
      {/* Pallet of flat carton blanks and a tape station. */}
      <Box size={[1.2, 0.14, 1.0]} position={[1.9, 0.07, S * 3.4]} mat={M.wood} />
      <Box size={[1.1, 0.8, 0.9]} position={[1.9, 0.55, S * 3.4]} mat={M.carton} />
      <Box size={[1.2, 0.06, 0.6]} position={[1.4, 0.92, S * 1.6]} mat={M.wood} />
      <Cyl size={[0.1, 0.06, 0.1]} position={[1.2, 1.0, S * 1.6]} mat={M.cartonTape} />
      <Worker position={[0.3, 0, S * 1.05]} yaw={S * Math.PI / 2} outfit="vest" station={def.id} task="reach" />
      <Worker position={[1.5, 0, S * 1.0]} yaw={S * Math.PI / 2} outfit="coverall" station={def.id} task="bench" phase={1.1} />
    </group>
  );
}

export function Palletizer({ def }: ModelProps) {
  const S = def.side;
  const station = STATION_BY_ID.palletize;
  // Pallet spot relative to the end of the line (station frame faces -x, so world +z is local -z).
  const palletDist = Math.abs(PALLET_SPOT[1] - station.pos[1]);
  const scale = 1.35;
  const baseZ = 2.3;
  return (
    <group>
      <RobotArm station={def.id} position={[0, 0, S * baseZ]} scale={scale} showPart={false}
        program={palletProgram(S * Math.PI / 2, -S * Math.PI / 2, baseZ / scale, (palletDist - baseZ) / scale, (BELT_Y + 0.75) / scale, 0.95 / scale)}
        idleYaw={S * Math.PI / 2} />
      {/* Light curtain posts and fence around the pallet bay. */}
      {[-1.6, 1.6].map((x) => (
        <Box key={x} size={[0.12, 2.0, 0.12]} position={[x, 1.0, S * (palletDist - 1.1)]} mat={M.hazard} />
      ))}
      <Box size={[0.05, 1.6, 2.6]} position={[-1.7, 0.9, S * (palletDist + 0.2)]} mat={M.glass} cast={false} />
      <Box size={[0.05, 1.6, 2.6]} position={[1.7, 0.9, S * (palletDist + 0.2)]} mat={M.glass} cast={false} />
      {/* Stack of empty pallets and a stretch wrapper beside the bay. */}
      <group position={[2.8, 0, S * palletDist]}>
        {[0, 1, 2, 3, 4].map((i) => <Box key={i} size={[1.2, 0.13, 1.0]} position={[0, 0.07 + i * 0.15, 0]} mat={M.wood} />)}
      </group>
      <group position={[-3.0, 0, S * palletDist]}>
        <Cyl size={[0.9, 0.08, 0.9]} position={[0, 0.04, 0]} mat={M.darkSteel} />
        <Box size={[0.3, 2.4, 0.3]} position={[0, 1.2, S * 1.1]} mat={M.machineGreen} />
        <Box size={[0.4, 0.3, 0.4]} position={[0, 1.4, S * 0.85]} mat={M.machine} />
      </group>
    </group>
  );
}
