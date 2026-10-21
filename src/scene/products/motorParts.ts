// Electric motor components and raw materials, drawn in the product's local frame:
// origin = bottom centre of the conveyor tray, +x = direction of travel = motor axis
// (drive end forward), y up. Each part says which build stages it is visible at.
//
// Build stages (set by the stations, see config/layout.ts):
//   0 raw kit · 1 inspected · 2 shaft blank cut · 3 housing machined · 4 feet drilled ·
//   5 shaft turned + rotor pressed · 6 stator wound · 7 stator inserted · 8 rotor & bearings ·
//   9 end shield & fan · 10 terminal box & fasteners · 11 nameplate · 12 boxed

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, M } from '../materials';

/** Housing centre in the tray frame. */
export const HX = -0.08;
export const HY = 0.31;
export const HZ = -0.07;
const R = 0.2;
const LEN = 0.46;

export interface PartDef {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Local transform of the part. */
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  /** Visible for stages in [from, to). */
  from: number;
  to: number;
  /** Only drawn while the product rides on a conveyor tray. */
  onTrayOnly?: boolean;
  /** Spins about the motor axis while the motor is running on a test bench. */
  spins?: boolean;
  /** Repeated at several offsets (e.g. four bolts). */
  copies?: [number, number, number][];
  /** Clickable: selects the product. */
  pick?: boolean;
}

/** Cylindrical housing with cooling fins, axis along x. */
function finnedHousing(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(R, R, LEN, 24);
  body.rotateZ(Math.PI / 2);
  parts.push(body);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.abs(Math.sin(a) + 1) < 0.3) continue; // no fins under the feet
    const fin = new THREE.BoxGeometry(LEN * 0.92, 0.05, 0.022);
    fin.translate(0, R + 0.02, 0);
    fin.rotateX(a);
    parts.push(fin);
  }
  for (const x of [-LEN / 2, LEN / 2]) {
    const flange = new THREE.CylinderGeometry(R + 0.015, R + 0.015, 0.03, 24);
    flange.rotateZ(Math.PI / 2);
    flange.translate(x, 0, 0);
    parts.push(flange);
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Cross of fan blades, axis along x. */
function fanBlades(): THREE.BufferGeometry {
  const a = new THREE.BoxGeometry(0.02, 0.32, 0.05);
  const b = new THREE.BoxGeometry(0.02, 0.05, 0.32);
  const merged = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()]);
  a.dispose();
  b.dispose();
  return merged;
}

const AXIS_X: [number, number, number] = [0, 0, Math.PI / 2];

export function buildParts(): PartDef[] {
  const housing = finnedHousing();
  const blades = fanBlades();
  return [
    // Conveyor fixture tray.
    { key: 'tray', geometry: G.box, material: M.darkSteel, position: [0, 0.03, 0], scale: [1.1, 0.06, 0.75], from: 0, to: 99, onTrayOnly: true, pick: true },
    { key: 'trayPads', geometry: G.box, material: M.rubber, position: [HX, 0.075, HZ], scale: [0.5, 0.03, 0.4], from: 0, to: 12, onTrayOnly: true },

    // Raw kit: housing casting, steel bar, lamination stack, copper wire.
    { key: 'casting', geometry: G.cyl, material: M.casting, position: [HX, 0.25, HZ], rotation: AXIS_X, scale: [0.18, 0.42, 0.18], from: 0, to: 3, pick: true },
    { key: 'bar', geometry: G.cylLow, material: M.steel, position: [0, 0.1, 0.27], rotation: AXIS_X, scale: [0.035, 0.8, 0.035], from: 0, to: 2 },
    { key: 'shaftBlank', geometry: G.cylLow, material: M.steel, position: [0.02, 0.1, 0.27], rotation: AXIS_X, scale: [0.035, 0.56, 0.035], from: 2, to: 5 },
    { key: 'lamination', geometry: G.box, material: M.darkSteel, position: [0.36, 0.13, -0.15], scale: [0.22, 0.12, 0.22], from: 0, to: 6 },
    { key: 'spool', geometry: G.cyl, material: M.copper, position: [0.45, 0.12, 0.14], scale: [0.08, 0.1, 0.08], from: 0, to: 6 },

    // Machined housing (primed blue) and drilled mounting feet.
    { key: 'housing', geometry: housing, material: M.motorPaint, position: [HX, HY, HZ], from: 3, to: 12, pick: true },
    { key: 'feet', geometry: G.box, material: M.motorPaint, position: [HX, 0.1, HZ], scale: [0.36, 0.06, 0.44], from: 4, to: 12 },

    // Turned shaft with rotor core, waiting beside the housing.
    { key: 'rotorCore', geometry: G.cyl, material: M.darkSteel, position: [0.18, 0.17, 0.25], rotation: AXIS_X, scale: [0.09, 0.3, 0.09], from: 5, to: 8 },
    { key: 'rotorShaft', geometry: G.cylLow, material: M.steel, position: [0.18, 0.17, 0.25], rotation: AXIS_X, scale: [0.028, 0.62, 0.028], from: 5, to: 8 },

    // Wound stator, then its copper end-turns visible in the open housing.
    { key: 'stator', geometry: G.cyl, material: M.copper, position: [0.38, 0.22, -0.12], rotation: AXIS_X, scale: [0.14, 0.18, 0.14], from: 6, to: 7 },
    { key: 'endTurns', geometry: G.torus, material: M.copper, position: [HX + LEN / 2 + 0.01, HY, HZ], rotation: [0, Math.PI / 2, 0], scale: [0.12, 0.12, 0.12], from: 7, to: 8 },

    // Rotor in: drive-end shield, bearing and shaft stub.
    { key: 'endShield', geometry: G.cyl, material: M.motorPaint, position: [HX + LEN / 2 + 0.03, HY, HZ], rotation: AXIS_X, scale: [0.19, 0.04, 0.19], from: 8, to: 12 },
    { key: 'bearing', geometry: G.torus, material: M.steel, position: [HX + LEN / 2 + 0.06, HY, HZ], rotation: [0, Math.PI / 2, 0], scale: [0.045, 0.045, 0.045], from: 8, to: 12 },
    { key: 'shaftStub', geometry: G.cylLow, material: M.steel, position: [HX + LEN / 2 + 0.13, HY, HZ], rotation: AXIS_X, scale: [0.032, 0.16, 0.032], from: 8, to: 12, spins: true },

    // Cooling fan and fan cover at the non-drive end.
    { key: 'fanCover', geometry: G.cyl, material: M.robotDark, position: [HX - LEN / 2 - 0.07, HY, HZ], rotation: AXIS_X, scale: [0.19, 0.13, 0.19], from: 9, to: 12 },
    { key: 'fan', geometry: blades, material: M.steel, position: [HX - LEN / 2 - 0.14, HY, HZ], from: 9, to: 12, spins: true },

    // Terminal box, fasteners, nameplate.
    { key: 'terminalBox', geometry: G.box, material: M.motorPaint, position: [HX + 0.02, HY + R + 0.06, HZ], scale: [0.16, 0.11, 0.16], from: 10, to: 12 },
    { key: 'terminalLid', geometry: G.box, material: M.darkSteel, position: [HX + 0.02, HY + R + 0.12, HZ], scale: [0.17, 0.02, 0.17], from: 10, to: 12 },
    {
      key: 'bolts', geometry: G.cylLow, material: M.steel, position: [HX, 0.14, HZ], scale: [0.018, 0.03, 0.018], from: 10, to: 12,
      copies: [[-0.14, 0, -0.18], [0.14, 0, -0.18], [-0.14, 0, 0.18], [0.14, 0, 0.18]],
    },
    { key: 'nameplate', geometry: G.box, material: M.label, position: [HX, HY + 0.03, HZ + R + 0.012], scale: [0.14, 0.08, 0.008], from: 11, to: 12 },

    // Carton with tape: from the packing station onward.
    { key: 'carton', geometry: G.box, material: M.carton, position: [0, 0.06 + 0.25, 0], scale: [0.58, 0.5, 0.48], from: 12, to: 99, pick: true },
    { key: 'tape', geometry: G.box, material: M.cartonTape, position: [0, 0.06 + 0.502, 0], scale: [0.58, 0.006, 0.09], from: 12, to: 99 },
    { key: 'cartonLabel', geometry: G.box, material: M.label, position: [0.1, 0.06 + 0.3, 0.242], scale: [0.2, 0.14, 0.005], from: 12, to: 99 },
  ];
}
