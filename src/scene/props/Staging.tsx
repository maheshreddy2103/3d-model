// Floor areas that complete the story around the line: incoming material staged by the
// receiving dock, finished pallets staged for loading, packaging supplies, the utilities
// corner (compressed air and switchgear) and the power cabinets that feed the test benches.
// Static pieces are batched; a few people move between the areas.

import { useMemo } from 'react';
import { Pieces, type Piece } from '../instanced';
import { Worker } from '../actors/Worker';
import { Walker } from './PrepCells';

const pallet = (x: number, z: number): Piece => ({ shape: 'box', mat: 'wood', size: [1.2, 0.14, 1.0], pos: [x, 0.07, z] });

function bay(out: Piece[], x: number, z: number, w = 1.5, d = 1.3) {
  out.push({ shape: 'box', mat: 'safetyWhite', size: [w, 0.01, 0.07], pos: [x, 0.013, z - d / 2] });
  out.push({ shape: 'box', mat: 'safetyWhite', size: [w, 0.01, 0.07], pos: [x, 0.013, z + d / 2] });
  out.push({ shape: 'box', mat: 'safetyWhite', size: [0.07, 0.01, d], pos: [x - w / 2, 0.013, z] });
  out.push({ shape: 'box', mat: 'safetyWhite', size: [0.07, 0.01, d], pos: [x + w / 2, 0.013, z] });
}

/** Raw material just off the receiving dock: castings, bar stock, copper, lamination coils. */
function incoming(out: Piece[]) {
  const rows = [-9.2, -6.6, -4.0];
  const cols = [-51, -49, -47, -45];
  rows.forEach((z, r) => cols.forEach((x, c) => {
    bay(out, x, z);
    const kind = (r + c) % 4;
    out.push(pallet(x, z));
    if (kind === 0) {
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.25, 0.25]) out.push({ shape: 'box', mat: 'casting', size: [0.5, 0.4, 0.42], pos: [x + dx, 0.34, z + dz] });
    } else if (kind === 1) {
      for (let i = 0; i < 7; i++) out.push({ shape: 'cyl', mat: 'steel', size: [0.05, 1.15, 0.05], pos: [x, 0.2 + (i % 2) * 0.09, z - 0.3 + i * 0.1], rotZ: Math.PI / 2 });
    } else if (kind === 2) {
      for (const dx of [-0.32, 0.32]) for (const dz of [-0.25, 0.25]) out.push({ shape: 'cyl', mat: 'copper', size: [0.2, 0.32, 0.2], pos: [x + dx, 0.3, z + dz] });
    } else {
      out.push({ shape: 'cyl', mat: 'motorRaw', size: [0.42, 0.55, 0.42], pos: [x, 0.56, z], rotX: Math.PI / 2 });
      out.push({ shape: 'cyl', mat: 'darkSteel', size: [0.16, 0.56, 0.16], pos: [x, 0.56, z], rotX: Math.PI / 2 });
    }
  }));
}

/** A finished-goods pallet: four cartons, stretch-wrapped. */
function wrappedPallet(out: Piece[], x: number, z: number, layers = 2) {
  out.push(pallet(x, z));
  for (let l = 0; l < layers; l++) {
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.24, 0.24]) {
      out.push({ shape: 'box', mat: 'carton', size: [0.56, 0.5, 0.46], pos: [x + dx, 0.39 + l * 0.52, z + dz] });
    }
  }
  out.push({ shape: 'box', mat: 'film', size: [1.22, layers * 0.52 + 0.04, 1.02], pos: [x, 0.14 + (layers * 0.52 + 0.04) / 2, z] });
}

/** Outbound staging lanes in front of the shipping office: pallets waiting for the next truck. */
function outbound(out: Piece[]) {
  const lanes = [5.4, 7.4, 9.4];
  const xs = [-40.5, -38.8, -37.1, -35.4, -33.7];
  lanes.forEach((z, l) => xs.forEach((x, i) => {
    bay(out, x, z, 1.5, 1.4);
    if (i < 5 - l) wrappedPallet(out, x, z, 1 + ((i + l) % 2));
  }));
  // Lane-end posts with lane numbers.
  for (const z of lanes) out.push({ shape: 'box', mat: 'hazard', size: [0.12, 1.2, 0.12], pos: [-42, 0.6, z] });
}

/** Packaging supplies for the packing line: carton blanks, foam inserts, film rolls. */
function supplies(out: Piece[]) {
  const spots: [number, number][] = [[-3, 21.5], [-1.4, 21.5], [0.2, 21.5], [-3, 23.4], [-1.4, 23.4], [2.4, 23.4], [4.0, 23.4], [2.4, 25.6], [4.0, 25.6]];
  spots.forEach(([x, z], i) => {
    bay(out, x, z);
    out.push(pallet(x, z));
    if (i % 3 === 2) {
      for (const dx of [-0.3, 0.3]) out.push({ shape: 'cyl', mat: 'film', size: [0.2, 0.5, 0.2], pos: [x + dx, 0.4, z] });
    } else if (i % 3 === 1) {
      out.push({ shape: 'box', mat: 'label', size: [1.1, 0.7, 0.9], pos: [x, 0.5, z] });
    } else {
      out.push({ shape: 'box', mat: 'carton', size: [1.15, 0.55 + (i % 2) * 0.3, 0.95], pos: [x, 0.42 + (i % 2) * 0.15, z] });
    }
  });
}

/** Utilities corner: two screw compressors, an air receiver, dryer and a switchgear line-up. */
function utilities(out: Piece[]) {
  const x0 = -21.5;
  const z0 = 5.0;
  out.push({ shape: 'box', mat: 'cellFloor', size: [10, 0.012, 5.6], pos: [x0 + 4.6, 0.006, z0 + 2.4] });
  for (const dx of [0, 2.4]) {
    out.push({ shape: 'box', mat: 'machineBlue', size: [1.9, 1.7, 1.2], pos: [x0 + dx, 0.85, z0] });
    out.push({ shape: 'box', mat: 'darkSteel', size: [1.9, 0.12, 1.22], pos: [x0 + dx, 1.76, z0] });
    out.push({ shape: 'box', mat: 'black', size: [0.8, 0.6, 0.02], pos: [x0 + dx - 0.3, 1.1, z0 + 0.61] });
  }
  out.push({ shape: 'cyl', mat: 'machine', size: [0.55, 2.6, 0.55], pos: [x0 + 5.0, 1.45, z0 - 0.2] });
  out.push({ shape: 'cyl', mat: 'machine', size: [0.55, 0.3, 0.55], pos: [x0 + 5.0, 2.8, z0 - 0.2] });
  out.push({ shape: 'box', mat: 'darkSteel', size: [0.9, 0.15, 0.9], pos: [x0 + 5.0, 0.08, z0 - 0.2] });
  out.push({ shape: 'box', mat: 'machine', size: [0.9, 1.4, 0.8], pos: [x0 + 6.6, 0.7, z0] });
  // Compressed-air main rising to the roof.
  out.push({ shape: 'cyl', mat: 'binRed', size: [0.07, 4.6, 0.07], pos: [x0 + 5.0, 5.0, z0 - 0.2] });
  out.push({ shape: 'box', mat: 'binRed', size: [6.6, 0.12, 0.12], pos: [x0 + 1.7, 2.3, z0 - 0.7] });
  // Switchgear line-up with doors and handles.
  for (let i = 0; i < 6; i++) {
    const x = x0 + 0.2 + i * 1.0;
    out.push({ shape: 'box', mat: 'machine', size: [0.95, 2.1, 0.6], pos: [x, 1.05, z0 + 4.4] });
    out.push({ shape: 'box', mat: 'darkSteel', size: [0.04, 0.25, 0.04], pos: [x + 0.3, 1.1, z0 + 4.1] });
    out.push({ shape: 'box', mat: i % 2 ? 'screenGreen' : 'screen', size: [0.3, 0.2, 0.02], pos: [x, 1.6, z0 + 4.09] });
  }
  out.push({ shape: 'box', mat: 'darkSteel', size: [6.2, 0.1, 0.4], pos: [x0 + 2.7, 2.6, z0 + 4.4] });
}

/** Power and data cabinets for the test benches, with a cable tray running along the test line. */
function testPower(out: Piece[]) {
  for (let i = 0; i < 5; i++) {
    const x = 40.8 + i * 1.05;
    out.push({ shape: 'box', mat: 'machine', size: [1.0, 2.1, 0.65], pos: [x, 1.05, 10.0] });
    out.push({ shape: 'box', mat: i === 2 ? 'screenGreen' : 'screen', size: [0.32, 0.22, 0.02], pos: [x, 1.55, 10.34] });
    out.push({ shape: 'box', mat: 'binRed', size: [0.08, 0.08, 0.02], pos: [x + 0.3, 1.8, 10.34] });
  }
  out.push({ shape: 'box', mat: 'darkSteel', size: [33, 0.1, 0.45], pos: [29.5, 2.9, 11.6] });
  for (const x of [43, 36, 29, 21, 14]) {
    out.push({ shape: 'box', mat: 'darkSteel', size: [0.06, 2.9, 0.06], pos: [x - 0.6, 1.45, 11.6] });
    out.push({ shape: 'cyl', mat: 'black', size: [0.03, 2.3, 0.03], pos: [x, 1.6, 12.4] });
    out.push({ shape: 'box', mat: 'robotDark', size: [0.4, 0.5, 0.25], pos: [x, 0.45, 12.4] });
  }
}

export function Staging() {
  const pieces = useMemo(() => {
    const out: Piece[] = [];
    incoming(out);
    outbound(out);
    supplies(out);
    utilities(out);
    testPower(out);
    return out;
  }, []);
  return (
    <group>
      <Pieces pieces={pieces} />
      {/* People with a job in each area. */}
      <Worker position={[-48, 0, -2.6]} yaw={Math.PI / 2} outfit="vest" task="inspect" phase={0.8} />
      <Worker position={[-36.2, 0, 11.0]} yaw={Math.PI / 2} outfit="vest" task="inspect" phase={2.4} />
      <Worker position={[-17.5, 0, 8.4]} yaw={-Math.PI / 2} outfit="coverall" task="inspect" phase={1.5} />
      <Worker position={[43, 0, 10.9]} yaw={Math.PI / 2} outfit="lab" task="bench" phase={0.3} />
      <Walker path={[[-44, -5.4], [-41.5, -5.4], [-40.4, -8.6]]} period={26} outfit="vest" />
      <Walker path={[[1.2, 22.6], [-1.6, 19.6], [-2.6, 18.9]]} period={22} phase={7} outfit="coverall" />
    </group>
  );
}
