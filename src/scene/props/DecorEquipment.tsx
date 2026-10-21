// Supporting equipment with a job in the flow: feeder machining cells that make the small
// parts (fasteners, bearing seats, terminal parts) the milk-run tuggers carry to the line,
// the QC data cabinet, and the shipping and dock offices. They run on simulated time, so
// pausing freezes them along with the line.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { BUILDING } from '../../config/layout';
import { simTime } from '../../sim/runtime';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { Worker } from '../actors/Worker';

/** Small CNC cell; its door and output bin face the milk-run aisle (+z). */
function FeederCell({ position, phase }: { position: [number, number, number]; phase: number }) {
  const spindle = useRef<THREE.Group>(null);
  useFrame(() => {
    if (spindle.current) spindle.current.rotation.y = (simTime() + phase) * 25;
  });
  return (
    <group position={position}>
      <Box size={[3.0, 2.2, 2.0]} position={[0, 1.1, 0]} mat={M.machine} />
      <Box size={[3.05, 0.28, 2.05]} position={[0, 2.1, 0]} mat={M.machineGreen} />
      <Box size={[1.2, 1.0, 0.05]} position={[-0.4, 1.3, 1.0]} mat={M.glass} cast={false} />
      <group ref={spindle} position={[-0.4, 1.45, 0.4]}>
        <Cyl size={[0.07, 0.45, 0.07]} mat={M.steel} />
        <Box size={[0.2, 0.04, 0.04]} position={[0, -0.2, 0]} mat={M.darkSteel} />
      </group>
      <Box size={[0.5, 0.6, 0.12]} position={[1.0, 1.4, 1.05]} mat={M.robotDark} />
      <Box size={[0.36, 0.25, 0.03]} position={[1.0, 1.5, 1.12]} mat={M.screen} />
      <Box size={[0.6, 0.45, 0.5]} position={[1.0, 0.23, 1.3]} mat={M.bin} />
      <Cyl size={[0.05, 0.5, 0.05]} position={[1.35, 2.5, -0.8]} mat={M.darkSteel} cast={false} />
      <mesh position={[1.35, 2.8, -0.8]} scale={0.12} material={M.screenGreen}><sphereGeometry /></mesh>
    </group>
  );
}

/** Small glass-fronted office box. */
function Office({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[w, 2.6, 0.1]} position={[0, 1.3, -d / 2]} mat={M.wall} />
      <Box size={[0.1, 2.6, d]} position={[-w / 2, 1.3, 0]} mat={M.wall} />
      <Box size={[0.1, 2.6, d]} position={[w / 2, 1.3, 0]} mat={M.glass} cast={false} />
      <Box size={[w, 2.6, 0.06]} position={[0, 1.3, d / 2]} mat={M.glass} cast={false} />
      <Box size={[w, 0.12, 0.12]} position={[0, 2.62, d / 2]} mat={M.wallTrim} />
      <Box size={[w * 0.5, 0.06, 0.8]} position={[-w * 0.15, 0.76, -d / 2 + 0.6]} mat={M.machine} />
      <Box size={[0.55, 0.35, 0.04]} position={[-w * 0.15, 1.05, -d / 2 + 0.3]} mat={M.screen} />
      <Worker position={[-w * 0.15, 0, -d / 2 + 1.4]} yaw={Math.PI / 2} outfit="lab" task="inspect" />
    </group>
  );
}

export function DecorEquipment() {
  const cellZ = BUILDING.minZ + 2.6;
  return (
    <group>
      {[-23, -15, -7, 1].map((x, i) => <FeederCell key={x} position={[x, 0, cellZ]} phase={i * 0.7} />)}
      <Box size={[1.2, 2.0, 0.7]} position={[39, 1.0, 9.0]} mat={M.machine} />
      <Box size={[0.8, 0.5, 0.03]} position={[39, 1.4, 8.64]} mat={M.screen} />
      <Office x={-5} z={6.5} w={7} d={4} />
      <Office x={-46} z={5.2} w={6} d={3.6} />
    </group>
  );
}
