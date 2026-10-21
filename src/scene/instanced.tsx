// Static geometry batched into one InstancedMesh per (shape, material): racks, steel frame,
// trusses, roller ends. Hundreds of pieces cost a handful of draw calls.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { G, M } from './materials';

export type MatKey = keyof typeof M;
export type V3 = [number, number, number];
export interface Piece { shape: 'box' | 'cyl'; mat: MatKey; size: V3; pos: V3; rotX?: number; rotY?: number; rotZ?: number }

/** Renders a list of pieces, grouped into one instanced mesh per shape and material. */
export function Pieces({ pieces, shadows = true }: { pieces: Piece[]; shadows?: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, Piece[]>();
    for (const p of pieces) {
      const key = `${p.shape}:${p.mat}`;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [pieces]);
  return (
    <group>
      {groups.map(([key, list]) => <PieceBatch key={key} pieces={list} shadows={shadows} />)}
    </group>
  );
}

function PieceBatch({ pieces, shadows }: { pieces: Piece[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { shape, mat } = pieces[0];
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler(0, 0, 0, 'YXZ');
    pieces.forEach((p, i) => {
      q.setFromEuler(e.set(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0, 'YXZ'));
      m.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces]);
  const geometry = shape === 'box' ? G.box : G.cyl;
  const transparent = M[mat].transparent;
  return <instancedMesh ref={ref} args={[geometry, M[mat], pieces.length]} castShadow={shadows && !transparent} receiveShadow />;
}
