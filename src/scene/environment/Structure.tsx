// Steel portal frame of the hall, drawn as an architectural cutaway: over the back half the
// roof structure is left in place (pitched trusses, purlins and a strip of roof sheeting at
// the back wall); over the front half the roof is cut away and the columns stop short, so the
// camera looks straight down onto the line. High-bay lamps hang from the purlins and a
// busbar with drop cables powers every machine on the top line.

import { useMemo } from 'react';
import { BUILDING, STATIONS } from '../../config/layout';
import { Pieces, type Piece } from '../instanced';

const { minX, maxX, minZ, maxZ, backWallH } = BUILDING;
export const GRID_X = [-54, -42, -30, -18, -6, 6, 18, 30, 42, 54];
/** Interior column row along the north edge of the central aisle; the trusses end here. */
export const MID_Z = 2.2;
const EAVE = backWallH;
const RIDGE = 9.8;
const PANELS = 10;
const FRONT_STUB = 3.4;
const BUSBAR_Y = 5.6;

/** Height of the top chord at depth z (rises from the back wall to the interior row). */
const topAt = (z: number) => EAVE + 0.35 + ((z - minZ) / (MID_Z - minZ)) * (RIDGE - EAVE - 0.35);

function member(out: Piece[], a: [number, number, number], b: [number, number, number], w: number, mat: Piece['mat']) {
  const [x, y1, z1] = a;
  const [, y2, z2] = b;
  const dy = y2 - y1;
  const dz = z2 - z1;
  out.push({ shape: 'box', mat, size: [w, w, Math.hypot(dy, dz)], pos: [x, (y1 + y2) / 2, (z1 + z2) / 2], rotX: -Math.atan2(dy, dz) });
}

function column(out: Piece[], x: number, z: number, h: number, cut = false) {
  out.push({ shape: 'box', mat: 'frame', size: [0.42, h, 0.42], pos: [x, h / 2, z] });
  out.push({ shape: 'box', mat: 'darkSteel', size: [0.7, 0.06, 0.7], pos: [x, 0.03, z] });
  // A cut column gets a bright cap so it reads as a section cut, not a stubby post.
  if (cut) out.push({ shape: 'box', mat: 'hazard', size: [0.46, 0.08, 0.46], pos: [x, h + 0.04, z] });
}

function truss(out: Piece[], x: number) {
  const w = 0.16;
  member(out, [x, EAVE, minZ], [x, EAVE, MID_Z], w, 'truss');
  member(out, [x, topAt(minZ), minZ], [x, topAt(MID_Z), MID_Z], w + 0.04, 'truss');
  const step = (MID_Z - minZ) / PANELS;
  for (let i = 0; i <= PANELS; i++) {
    const z = minZ + i * step;
    member(out, [x, EAVE, z], [x, topAt(z), z], 0.08, 'truss');
    if (i < PANELS) {
      const z2 = z + step;
      // Pratt pattern: diagonals lean toward mid-span.
      if (i % 2 === 0) member(out, [x, EAVE, z], [x, topAt(z2), z2], 0.07, 'truss');
      else member(out, [x, topAt(z), z], [x, EAVE, z2], 0.07, 'truss');
    }
  }
}

function buildFrame(): Piece[] {
  const out: Piece[] = [];
  for (const x of GRID_X) {
    column(out, x, minZ + 0.45, EAVE);
    column(out, x, MID_Z, RIDGE);
    column(out, x, maxZ - 0.3, FRONT_STUB, true);
    truss(out, x);
  }
  // Side-wall columns between the grid rows.
  for (const x of [minX, maxX]) {
    column(out, x, (minZ + MID_Z) / 2, topAt((minZ + MID_Z) / 2));
    column(out, x, (MID_Z + maxZ) / 2, FRONT_STUB, true);
  }
  // Purlins along the hall, and eaves/ridge beams.
  const len = maxX - minX;
  for (let i = 0; i <= 5; i++) {
    const z = minZ + ((MID_Z - minZ) * i) / 5;
    out.push({ shape: 'box', mat: 'truss', size: [len, 0.14, 0.12], pos: [0, topAt(z) + 0.14, z] });
  }
  out.push({ shape: 'box', mat: 'frame', size: [len, 0.4, 0.3], pos: [0, RIDGE + 0.05, MID_Z] });
  out.push({ shape: 'box', mat: 'frame', size: [len, 0.4, 0.3], pos: [0, EAVE, minZ + 0.45] });
  // Roof sheeting over the first strip from the back wall: the roof "cut back" for the view.
  const sheetEnd = minZ + 5.2;
  const yA = topAt(minZ) + 0.26;
  const yB = topAt(sheetEnd) + 0.26;
  out.push({
    shape: 'box', mat: 'roof', size: [len + 0.6, 0.12, Math.hypot(sheetEnd - minZ, yB - yA)],
    pos: [0, (yA + yB) / 2, (minZ + sheetEnd) / 2], rotX: -Math.atan2(yB - yA, sheetEnd - minZ),
  });
  // Translucent roof-light strips in the sheeting.
  for (let x = minX + 6; x < maxX; x += 12) {
    out.push({ shape: 'box', mat: 'glass', size: [3, 0.14, 4.2], pos: [x, (yA + yB) / 2 + 0.02, (minZ + sheetEnd) / 2], rotX: -Math.atan2(yB - yA, sheetEnd - minZ) });
  }
  return out;
}

/** High-bay LED lamps hanging from the purlins, one row per truss panel group. */
function buildLamps(): Piece[] {
  const out: Piece[] = [];
  const hang = 6.6;
  for (let i = 0; i < GRID_X.length - 1; i++) {
    const x = (GRID_X[i] + GRID_X[i + 1]) / 2;
    for (const z of [-19.5, -11, -2.5]) {
      for (const dx of [-3, 3]) {
        const top = topAt(z);
        out.push({ shape: 'cyl', mat: 'darkSteel', size: [0.015, top - hang, 0.015], pos: [x + dx, (top + hang) / 2, z] });
        out.push({ shape: 'cyl', mat: 'lampHousing', size: [0.24, 0.16, 0.24], pos: [x + dx, hang, z] });
        out.push({ shape: 'cyl', mat: 'lampOn', size: [0.21, 0.03, 0.21], pos: [x + dx, hang - 0.09, z] });
      }
    }
  }
  return out;
}

/** Busbar trunking over the top line with a drop cable to every machine and robot cell. */
function buildBusbar(): Piece[] {
  const out: Piece[] = [];
  const z = -12;
  out.push({ shape: 'box', mat: 'hazard', size: [94, 0.2, 0.26], pos: [2, BUSBAR_Y, z] });
  for (const x of GRID_X.slice(1, -1)) {
    out.push({ shape: 'cyl', mat: 'darkSteel', size: [0.02, EAVE - BUSBAR_Y, 0.02], pos: [x, (EAVE + BUSBAR_Y) / 2, z] });
  }
  for (const s of STATIONS) {
    if (s.lane !== 'main' || s.pos[1] !== -12) continue;
    const dropZ = z + s.side * 2.6;
    const x = s.pos[0] + 1.2;
    out.push({ shape: 'box', mat: 'darkSteel', size: [0.12, 0.12, Math.abs(dropZ - z)], pos: [x, BUSBAR_Y - 0.12, (z + dropZ) / 2] });
    out.push({ shape: 'cyl', mat: 'black', size: [0.035, BUSBAR_Y - 2.6, 0.035], pos: [x, (BUSBAR_Y + 2.6) / 2, dropZ] });
    out.push({ shape: 'box', mat: 'robotDark', size: [0.3, 0.3, 0.2], pos: [x, BUSBAR_Y - 0.25, z] });
  }
  return out;
}

export function Structure() {
  const frame = useMemo(buildFrame, []);
  const lamps = useMemo(buildLamps, []);
  const busbar = useMemo(buildBusbar, []);
  return (
    <group>
      <Pieces pieces={frame} />
      <Pieces pieces={lamps} shadows={false} />
      <Pieces pieces={busbar} />
    </group>
  );
}
