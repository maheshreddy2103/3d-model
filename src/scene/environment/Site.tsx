// Ground, truck yard, car park and the cutaway factory building: floor slab,
// a full-height back wall and low cut walls on the other three sides (the steel frame
// is in Structure.tsx).

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING, DOCKS, ROAD_X } from '../../config/layout';
import { G, M, makeConcreteTexture, makeHazardTexture } from '../materials';
import { Box, FloorMark } from '../primitives';

const { minX, maxX, minZ, maxZ, backWallH, lowWallH } = BUILDING;
const WALL_T = 0.35;
const DOOR_W = 4;

export function Site() {
  return (
    <group>
      <Ground />
      <Yard />
      <CarPark />
      <FloorSlab />
      <Walls />
    </group>
  );
}

function Ground() {
  return (
    <mesh geometry={G.plane} material={M.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} scale={[600, 600, 1]} receiveShadow />
  );
}

/** Asphalt yard west of the building with the truck road and dock aprons. */
function Yard() {
  const dash = useMemo(() => Array.from({ length: 22 }, (_, i) => -84 + i * 8), []);
  return (
    <group>
      <FloorMark size={[44, 120]} position={[-76, 0]} mat={M.asphalt} y={-0.02} />
      {dash.map((z) => (
        <FloorMark key={z} size={[0.25, 4]} position={[ROAD_X, z]} mat={M.safetyWhite} y={-0.01} />
      ))}
      {[DOCKS.inbound.z, DOCKS.outbound.z].map((z) => (
        <group key={z}>
          <FloorMark size={[0.25, 26]} position={[-64, z - 2]} mat={M.safetyWhite} y={-0.01} rotation={Math.PI / 2} />
          <FloorMark size={[0.25, 26]} position={[-64, z + 2]} mat={M.safetyWhite} y={-0.01} rotation={Math.PI / 2} />
        </group>
      ))}
    </group>
  );
}

/** Staff car park east of the building: a few rows of parked cars. */
function CarPark() {
  const cars = useMemo(() => {
    const list: { x: number; z: number; color: string }[] = [];
    const palette = ['#7f8c99', '#c9ccd0', '#2f3e4d', '#9b3b33', '#e8e8e4', '#4c6a8a'];
    let k = 0;
    for (const x of [62, 70]) {
      for (let z = -26; z <= 26; z += 3.2) {
        if ((k * 7) % 5 !== 0) list.push({ x, z, color: palette[k % palette.length] });
        k++;
      }
    }
    return list;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    cars.forEach((c, i) => {
      m.compose(new THREE.Vector3(c.x, 0.7, c.z), new THREE.Quaternion(), new THREE.Vector3(4.2, 1.4, 1.8));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(c.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);
  return (
    <group>
      <FloorMark size={[18, 64]} position={[66, 0]} mat={M.asphalt} y={-0.02} />
      <instancedMesh ref={ref} args={[G.box, M.car, cars.length]} castShadow receiveShadow />
    </group>
  );
}

function FloorSlab() {
  const material = useMemo(() => {
    const texture = makeConcreteTexture();
    texture.repeat.set((maxX - minX) / 6, (maxZ - minZ) / 6);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: 0.02 });
  }, []);
  return (
    <mesh geometry={G.box} material={material} position={[(minX + maxX) / 2, -0.1, (minZ + maxZ) / 2]}
      scale={[maxX - minX + WALL_T * 2, 0.2, maxZ - minZ + WALL_T * 2]} receiveShadow />
  );
}

/** A straight wall run along x or z, leaving gaps for dock doors. */
function WallRun({ axis, fixed, from, to, height, gaps = [] }: {
  axis: 'x' | 'z'; fixed: number; from: number; to: number; height: number; gaps?: number[];
}) {
  const pieces: [number, number][] = [];
  let cursor = from;
  for (const g of [...gaps].sort((a, b) => a - b)) {
    pieces.push([cursor, g - DOOR_W / 2]);
    cursor = g + DOOR_W / 2;
  }
  pieces.push([cursor, to]);
  return (
    <group>
      {pieces.map(([a, b]) => {
        const len = b - a;
        const mid = (a + b) / 2;
        const size: [number, number, number] = axis === 'x' ? [len, height, WALL_T] : [WALL_T, height, len];
        const pos: [number, number, number] = axis === 'x' ? [mid, height / 2, fixed] : [fixed, height / 2, mid];
        const cap: [number, number, number] = axis === 'x' ? [len, 0.08, WALL_T + 0.08] : [WALL_T + 0.08, 0.08, len];
        return (
          <group key={a}>
            <Box size={size} position={pos} mat={M.wall} />
            <Box size={cap} position={[pos[0], height + 0.04, pos[2]]} mat={M.wallTrim} />
          </group>
        );
      })}
    </group>
  );
}

function Walls() {
  const hazard = useMemo(() => {
    const t = makeHazardTexture();
    t.repeat.set(4, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }, []);
  const dockZs = [DOCKS.inbound.z, DOCKS.outbound.z];
  return (
    <group>
      {/* Back wall: full height with a clerestory window band. */}
      <Box size={[maxX - minX, backWallH, WALL_T]} position={[0, backWallH / 2, minZ]} mat={M.cladding} />
      <Box size={[maxX - minX - 4, 1.4, WALL_T + 0.05]} position={[0, backWallH - 1.6, minZ]} mat={M.glass} cast={false} />
      {[-36, -12, 12, 36].map((x) => (
        <Box key={x} size={[5, 5, 0.2]} position={[x, 2.5, minZ + 0.25]} mat={M.wallTrim} />
      ))}
      {/* Cut-away side and front walls. */}
      <WallRun axis="z" fixed={minX} from={minZ} to={maxZ} height={lowWallH} gaps={dockZs} />
      <WallRun axis="z" fixed={maxX} from={minZ} to={maxZ} height={lowWallH} />
      <WallRun axis="x" fixed={maxZ} from={minX} to={maxX} height={1.2} />
      {/* Dock doors: frames, seals and hazard-striped levellers. */}
      {dockZs.map((z) => (
        <group key={z}>
          <Box size={[0.5, 4.6, 0.5]} position={[minX, 2.3, z - DOOR_W / 2 - 0.25]} mat={M.wallTrim} />
          <Box size={[0.5, 4.6, 0.5]} position={[minX, 2.3, z + DOOR_W / 2 + 0.25]} mat={M.wallTrim} />
          <Box size={[0.5, 0.5, DOOR_W + 1]} position={[minX, 4.6, z]} mat={M.wallTrim} />
          <Box size={[0.3, 3.2, 0.35]} position={[minX - 0.35, 1.9, z - DOOR_W / 2 + 0.1]} mat={M.black} />
          <Box size={[0.3, 3.2, 0.35]} position={[minX - 0.35, 1.9, z + DOOR_W / 2 - 0.1]} mat={M.black} />
          <mesh geometry={G.plane} material={hazard} rotation={[-Math.PI / 2, 0, 0]} position={[minX + 1.5, 0.015, z]} scale={[3, DOOR_W, 1]} receiveShadow />
        </group>
      ))}
    </group>
  );
}
