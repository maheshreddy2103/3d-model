// Static furniture of the factory: storage racks and their loads, tool cabinets, benches,
// carton stacks. Hundreds of pieces, so they are collected into one InstancedMesh per
// (shape, material) instead of one mesh each.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING, RACK_BAYS, RACK_ROW_Z } from '../../config/layout';
import { G, M } from '../materials';

type MatKey = keyof typeof M;
type V3 = [number, number, number];
interface Piece { shape: 'box' | 'cyl'; mat: MatKey; size: V3; pos: V3; rotX?: number; rotZ?: number }

/** Pallet-rack bays along x. `load(bay, level)` returns pieces relative to the bay's shelf centre. */
function rack(out: Piece[], opts: {
  x0: number; z: number; bays: number; bayW?: number; depth?: number; levels?: number; levelH?: number;
  load?: (bay: number, level: number) => Piece[]; firstLoadedLevel?: number;
}) {
  const { x0, z, bays, bayW = 3, depth = 1.1, levels = 3, levelH = 1.7, load, firstLoadedLevel = 0 } = opts;
  const height = levels * levelH + 0.3;
  for (let b = 0; b <= bays; b++) {
    const x = x0 + b * bayW;
    for (const dz of [-depth / 2, depth / 2]) out.push({ shape: 'box', mat: 'rackUpright', size: [0.09, height, 0.09], pos: [x, height / 2, z + dz] });
  }
  for (let l = 0; l < levels; l++) {
    const y = l * levelH + (l === 0 ? 0.12 : 0);
    if (l > 0) {
      for (const dz of [-depth / 2, depth / 2]) out.push({ shape: 'box', mat: 'rackBeam', size: [bays * bayW, 0.12, 0.07], pos: [x0 + (bays * bayW) / 2, y, z + dz] });
    }
    if (!load || l < firstLoadedLevel) continue;
    for (let b = 0; b < bays; b++) {
      for (const p of load(b, l)) {
        out.push({ ...p, pos: [x0 + (b + 0.5) * bayW + p.pos[0], y + 0.06 + p.pos[1], z + p.pos[2]] });
      }
    }
  }
}

const pallet = (): Piece => ({ shape: 'box', mat: 'wood', size: [1.2, 0.14, 1.0], pos: [0, 0.07, 0] });
/** Flat carton blanks (packaging material, not finished goods): a low, pale stack. */
const blanksPallet = (x: number, z: number): Piece[] => [
  { ...pallet(), pos: [x, 0.07, z] },
  { shape: 'box', mat: 'label', size: [1.15, 0.32, 0.95], pos: [x, 0.3, z] },
];

function buildPieces(): Piece[] {
  const out: Piece[] = [];
  const backZ = BUILDING.minZ + 0.7;

  // A. Raw-material rack along the back wall: bar stock, castings, lamination steel, copper wire.
  rack(out, {
    x0: -52, z: backZ, bays: 6, levels: 3,
    load: (b, l) => {
      const kind = (b + l) % 4;
      if (kind === 0) return [0, 1, 2, 3].map((i) => ({ shape: 'cyl', mat: 'steel', size: [0.07, 2.7, 0.07], pos: [0, 0.12 + (i % 2) * 0.14, -0.3 + i * 0.2], rotZ: Math.PI / 2 }) as Piece);
      if (kind === 1) return [-0.7, 0.7].flatMap((dx) => [{ ...pallet(), pos: [dx, 0.07, 0] as V3 }, { shape: 'box', mat: 'casting', size: [1.0, 0.6, 0.9], pos: [dx, 0.45, 0] } as Piece]);
      if (kind === 2) return [-0.7, 0.7].map((dx) => ({ shape: 'box', mat: 'darkSteel', size: [1.1, 0.5, 0.9], pos: [dx, 0.25, 0] }) as Piece);
      return [-0.8, 0, 0.8].map((dx) => ({ shape: 'cyl', mat: 'copper', size: [0.3, 0.45, 0.3], pos: [dx, 0.23, 0] }) as Piece);
    },
  });

  // B. Tooling cabinets along the machining back wall, behind the feeder cells.
  for (let x = -27; x <= 7; x += 2.2) {
    out.push({ shape: 'box', mat: 'binRed', size: [1.8, 1.9, 0.6], pos: [x, 0.95, BUILDING.minZ + 0.5] });
  }

  // C. Parts supermarket along the assembly back wall; the milk-run tuggers pick from it.
  rack(out, {
    x0: 12, z: backZ, bays: 12, bayW: 3.4, levels: 3, levelH: 1.2,
    load: (b, l) => [-1.1, -0.35, 0.4, 1.15].map((dx, i) => ({
      shape: 'box', mat: (['bin', 'binRed', 'binGreen', 'bin'] as MatKey[])[(b + l + i) % 4], size: [0.6, 0.35, 0.8], pos: [dx, 0.18, 0],
    }) as Piece),
  });

  // D. Quality lab: glass-walled metrology room.
  const lab = { x0: 38, x1: 48, z0: 18.5, z1: 22.5 };
  out.push({ shape: 'box', mat: 'glass', size: [lab.x1 - lab.x0, 2.6, 0.06], pos: [(lab.x0 + lab.x1) / 2, 1.3, lab.z0] });
  out.push({ shape: 'box', mat: 'glass', size: [0.06, 2.6, lab.z1 - lab.z0], pos: [lab.x0, 1.3, (lab.z0 + lab.z1) / 2] });
  out.push({ shape: 'box', mat: 'glass', size: [0.06, 2.6, lab.z1 - lab.z0], pos: [lab.x1, 1.3, (lab.z0 + lab.z1) / 2] });
  out.push({ shape: 'box', mat: 'wallTrim', size: [lab.x1 - lab.x0, 0.1, 0.1], pos: [(lab.x0 + lab.x1) / 2, 2.6, lab.z0] });
  for (const x of [40, 43, 46]) {
    out.push({ shape: 'box', mat: 'machine', size: [1.8, 0.06, 0.8], pos: [x, 0.76, 21.5] });
    out.push({ shape: 'box', mat: 'screen', size: [0.6, 0.38, 0.04], pos: [x, 1.05, 21.8] });
  }
  out.push({ shape: 'box', mat: 'darkSteel', size: [1.4, 0.8, 1.0], pos: [44, 0.4, 19.6] });

  // E. Packaging material beside the packing station: carton blanks only.
  for (const [x, z] of [[-9, 18.5], [-7.6, 18.5], [-9, 20]] as [number, number][]) out.push(...blanksPallet(x, z));

  // F. Finished-goods rack: frames only. Every pallet in it comes from the simulation.
  rack(out, { x0: RACK_BAYS[0] - 1.5, z: RACK_ROW_Z, bays: RACK_BAYS.length, levels: 3 });

  return out;
}

export function StaticProps() {
  const groups = useMemo(() => {
    const map = new Map<string, Piece[]>();
    for (const p of buildPieces()) {
      const key = `${p.shape}:${p.mat}`;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()];
  }, []);
  return (
    <group>
      {groups.map(([key, pieces]) => <PieceBatch key={key} pieces={pieces} />)}
    </group>
  );
}

function PieceBatch({ pieces }: { pieces: Piece[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { shape, mat } = pieces[0];
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    pieces.forEach((p, i) => {
      q.setFromEuler(e.set(p.rotX ?? 0, 0, p.rotZ ?? 0));
      m.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces]);
  const geometry = shape === 'box' ? G.box : G.cyl;
  const transparent = mat === 'glass';
  return <instancedMesh ref={ref} args={[geometry, M[mat], pieces.length]} castShadow={!transparent} receiveShadow />;
}
