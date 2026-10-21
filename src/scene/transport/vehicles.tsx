// Vehicle models. Each is drawn in its own frame with +x as "forward":
//  - Truck: origin at the rear door, cab at +x, open curtain side at -z.
//  - Forklift: origin at the drive-axle centre, forks pointing +x.
//  - Agv: low tugger with two part carts trailing behind.

import { forwardRef } from 'react';
import type * as THREE from 'three';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { Worker } from '../actors/Worker';

export const TRAILER_BED_Y = 0.25;
export const TRAILER_LEN = 12;

export function Truck({ inbound }: { inbound: boolean }) {
  const cab = inbound ? M.truckCabBlue : M.truckCab;
  return (
    <group>
      {/* Trailer: low bed, front bulkhead, one side wall; roof and near curtain left open. */}
      <Box size={[TRAILER_LEN, 0.15, 2.5]} position={[TRAILER_LEN / 2, TRAILER_BED_Y - 0.07, 0]} mat={M.trailer} />
      <Box size={[0.12, 2.6, 2.5]} position={[TRAILER_LEN - 0.06, TRAILER_BED_Y + 1.3, 0]} mat={M.trailer} />
      <Box size={[TRAILER_LEN, 2.6, 0.06]} position={[TRAILER_LEN / 2, TRAILER_BED_Y + 1.3, 1.22]} mat={M.trailer} />
      <Box size={[TRAILER_LEN, 0.12, 0.08]} position={[TRAILER_LEN / 2, TRAILER_BED_Y + 2.6, -1.22]} mat={M.darkSteel} />
      {[0.1, 4, 8, TRAILER_LEN - 0.2].map((x) => (
        <Box key={x} size={[0.08, 2.6, 0.08]} position={[x, TRAILER_BED_Y + 1.3, -1.22]} mat={M.darkSteel} />
      ))}
      <Box size={[TRAILER_LEN - 0.4, 0.5, 0.06]} position={[TRAILER_LEN / 2, TRAILER_BED_Y + 2.4, 1.18]} mat={cab} />
      {[1.2, 2.4].map((x) => [-1, 1].map((s) => (
        <Cyl key={`${x}${s}`} size={[0.45, 0.3, 0.45]} position={[x, 0.45, s * 1.05]} rotation={[Math.PI / 2, 0, 0]} mat={M.tire} low />
      )))}
      {/* Tractor unit. */}
      <group position={[TRAILER_LEN + 0.3, 0, 0]}>
        <Box size={[3.2, 0.5, 2.3]} position={[1.4, 0.75, 0]} mat={M.darkSteel} />
        <Box size={[2.1, 2.4, 2.4]} position={[2.0, 2.1, 0]} mat={cab} />
        <Box size={[0.05, 0.9, 2.1]} position={[3.06, 2.6, 0]} mat={M.glass} cast={false} />
        <Box size={[1.2, 0.08, 2.4]} position={[2.0, 3.35, 0]} mat={M.darkSteel} />
        {[0.4, 2.6].map((x) => [-1, 1].map((s) => (
          <Cyl key={`${x}${s}`} size={[0.5, 0.35, 0.5]} position={[x, 0.5, s * 1.05]} rotation={[Math.PI / 2, 0, 0]} mat={M.tire} low />
        )))}
      </group>
    </group>
  );
}

/** Raised fork carriage height is applied to the returned group by the caller. */
export const Forklift = forwardRef<THREE.Group, { color?: THREE.Material }>(function Forklift({ color = M.forklift }, carriageRef) {
  return (
    <group>
      <Box size={[1.7, 0.9, 1.1]} position={[-0.35, 0.65, 0]} mat={color} />
      <Box size={[0.6, 0.7, 1.12]} position={[-1.05, 0.8, 0]} mat={M.darkSteel} />
      {[-0.95, 0.35].map((x) => [-0.48, 0.48].map((z) => (
        <Box key={`${x}${z}`} size={[0.06, 1.25, 0.06]} position={[x, 1.7, z]} mat={M.darkSteel} />
      )))}
      <Box size={[1.4, 0.06, 1.05]} position={[-0.3, 2.33, 0]} mat={M.darkSteel} />
      <Box size={[0.4, 0.5, 0.5]} position={[-0.6, 1.25, 0]} mat={M.black} />
      <Worker position={[-0.45, 0.35, 0]} outfit="vest" task="inspect" />
      {[-0.65, 0.4].map((x) => [-0.5, 0.5].map((z) => (
        <Cyl key={`${x}${z}`} size={[0.28, 0.2, 0.28]} position={[x, 0.28, z]} rotation={[Math.PI / 2, 0, 0]} mat={M.tire} low />
      )))}
      {/* Mast. */}
      {[-0.35, 0.35].map((z) => <Box key={z} size={[0.1, 2.5, 0.1]} position={[0.6, 1.25, z]} mat={M.darkSteel} />)}
      <group ref={carriageRef} position={[0, 0.12, 0]}>
        <Box size={[0.08, 0.6, 0.85]} position={[0.68, 0.3, 0]} mat={M.darkSteel} />
        {[-0.3, 0.3].map((z) => <Box key={z} size={[1.2, 0.05, 0.12]} position={[1.3, 0.02, z]} mat={M.darkSteel} />)}
      </group>
    </group>
  );
});

export function Agv() {
  return (
    <group>
      <Box size={[1.2, 0.35, 0.8]} position={[0, 0.2, 0]} mat={M.machine} />
      <Box size={[1.22, 0.06, 0.82]} position={[0, 0.4, 0]} mat={M.hazard} />
      <Box size={[0.25, 0.12, 0.3]} position={[0.45, 0.48, 0]} mat={M.screen} />
      {[-1.6, -3.0].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[1.2, 0.08, 0.8]} position={[0, 0.35, 0]} mat={M.steel} />
          <Box size={[0.5, 0.3, 0.6]} position={[-0.3, 0.55, 0]} mat={M.bin} />
          <Box size={[0.5, 0.3, 0.6]} position={[0.3, 0.55, 0]} mat={M.binGreen} />
          <Box size={[0.4, 0.04, 0.04]} position={[0.75, 0.3, 0]} mat={M.darkSteel} />
        </group>
      ))}
    </group>
  );
}
