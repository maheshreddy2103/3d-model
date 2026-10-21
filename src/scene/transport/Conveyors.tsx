// Belt conveyors for every lane, built from the lane polylines. Belt textures scroll
// with simulated time, so the belts visibly run while the simulation plays.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_Y, DIVERTER_S, LANES, MERGE_S, type LaneId } from '../../config/layout';
import { beltSpeed, simTime } from '../../sim/runtime';
import { yawOf } from '../../sim/path';
import { G, M, makeBeltTexture } from '../materials';
import { Box, Cyl } from '../primitives';

const BELT_W = 0.9;
const LEG_STEP = 2.2;

const LANE_STYLE: Record<LaneId, { belt: string; frame: THREE.Material }> = {
  main: { belt: '#3a3f44', frame: M.machineBlue },
  rework: { belt: '#4a3a3a', frame: M.cage },
  scrap: { belt: '#4a3a3a', frame: M.cage },
};

export function Conveyors() {
  return (
    <group>
      {(Object.keys(LANES) as LaneId[]).map((id) => <Lane key={id} id={id} />)}
      <Legs />
      <Transfers />
    </group>
  );
}

function Lane({ id }: { id: LaneId }) {
  const path = LANES[id];
  const style = LANE_STYLE[id];
  const belts = useMemo(() => path.segments.map((seg) => {
    const texture = makeBeltTexture(style.belt);
    texture.repeat.set((seg.length + BELT_W) / 1, 1);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    return { seg, texture, material };
  }), [path, style.belt]);

  useFrame(() => {
    const offset = -((simTime() * beltSpeed()) % 1);
    for (const b of belts) b.texture.offset.x = offset;
  });

  return (
    <group>
      {belts.map(({ seg, material }) => {
        const len = seg.length + BELT_W;
        const cx = (seg.a[0] + seg.b[0]) / 2;
        const cz = (seg.a[1] + seg.b[1]) / 2;
        return (
          <group key={seg.start} position={[cx, 0, cz]} rotation={[0, yawOf(seg.dx, seg.dz), 0]}>
            <mesh geometry={G.box} material={material} scale={[len, 0.06, BELT_W]} position={[0, BELT_Y - 0.03, 0]} receiveShadow />
            <Box size={[len, 0.22, BELT_W + 0.12]} position={[0, BELT_Y - 0.17, 0]} mat={style.frame} />
            <Box size={[len, 0.07, 0.05]} position={[0, BELT_Y + 0.03, BELT_W / 2 + 0.05]} mat={M.steel} />
            <Box size={[len, 0.07, 0.05]} position={[0, BELT_Y + 0.03, -BELT_W / 2 - 0.05]} mat={M.steel} />
          </group>
        );
      })}
    </group>
  );
}

/** Support legs under every belt, instanced. */
function Legs() {
  const legs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const scale = new THREE.Vector3(0.08, BELT_Y - 0.28, 0.08);
    const q = new THREE.Quaternion();
    for (const path of Object.values(LANES)) {
      for (const seg of path.segments) {
        const nx = -seg.dz;
        const nz = seg.dx;
        for (let t = 0.3; t <= seg.length; t += LEG_STEP) {
          const x = seg.a[0] + seg.dx * t;
          const z = seg.a[1] + seg.dz * t;
          for (const side of [-1, 1]) {
            const p = new THREE.Vector3(x + nx * side * 0.4, (BELT_Y - 0.28) / 2, z + nz * side * 0.4);
            out.push(new THREE.Matrix4().compose(p, q, scale));
          }
        }
      }
    }
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    legs.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [legs]);
  return <instancedMesh ref={ref} args={[G.box, M.darkSteel, legs.length]} castShadow />;
}

/** Diverter turntable where failed motors leave the line, and the merge unit where they return. */
function Transfers() {
  const div = LANES.main.at(DIVERTER_S);
  const merge = LANES.main.at(MERGE_S);
  const end = LANES.main.at(LANES.main.length);
  return (
    <group>
      <Cyl size={[0.75, 0.12, 0.75]} position={[div.x, BELT_Y + 0.01, div.z]} mat={M.cage} />
      <Box size={[0.3, 1.6, 0.3]} position={[div.x + 0.9, 0.8, div.z - 0.9]} mat={M.darkSteel} />
      <Box size={[0.25, 0.25, 0.25]} position={[div.x + 0.9, 1.7, div.z - 0.9]} mat={M.lampOn} />
      <Box size={[1.4, 0.14, 1.4]} position={[merge.x + 0.6, BELT_Y - 0.02, merge.z]} mat={M.cage} />
      <Box size={[0.3, 0.4, 1.1]} position={[end.x - 0.65, BELT_Y + 0.1, end.z]} mat={M.hazard} />
    </group>
  );
}
