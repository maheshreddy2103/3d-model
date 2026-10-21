// Tiny wrappers that place the shared unit geometries with a size, so models read like
// "a 2 × 1 × 0.5 steel box here" instead of creating a geometry per object.

import { forwardRef } from 'react';
import type * as THREE from 'three';
import { G } from './materials';

type V3 = [number, number, number];

interface PrimitiveProps {
  size: V3;
  position?: V3;
  rotation?: V3;
  mat: THREE.Material;
  cast?: boolean;
  receive?: boolean;
}

/** Box of the given size centred on `position`. */
export const Box = forwardRef<THREE.Mesh, PrimitiveProps>(function Box(
  { size, position, rotation, mat, cast = true, receive = true }, ref,
) {
  return (
    <mesh ref={ref} geometry={G.box} material={mat} scale={size} position={position} rotation={rotation}
      castShadow={cast} receiveShadow={receive} />
  );
});

/** Cylinder: size = [radius, height, radius], axis along local y. */
export const Cyl = forwardRef<THREE.Mesh, PrimitiveProps & { low?: boolean }>(function Cyl(
  { size, position, rotation, mat, cast = true, receive = true, low = false }, ref,
) {
  return (
    <mesh ref={ref} geometry={low ? G.cylLow : G.cyl} material={mat} scale={size} position={position} rotation={rotation}
      castShadow={cast} receiveShadow={receive} />
  );
});

/** Flat marking lying on the floor: size = [x, z]. */
export function FloorMark({ size, position, mat, y = 0.012, rotation = 0 }: {
  size: [number, number]; position: [number, number]; mat: THREE.Material; y?: number; rotation?: number;
}) {
  return (
    <mesh geometry={G.plane} material={mat} scale={[size[0], size[1], 1]} position={[position[0], y, position[1]]}
      rotation={[-Math.PI / 2, 0, rotation]} receiveShadow />
  );
}
