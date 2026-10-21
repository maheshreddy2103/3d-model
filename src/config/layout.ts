// Physical layout of the factory: building, zones, conveyor lanes, stations,
// forklift corridors, storage slots and truck docks. All positions are metres;
// x runs left → right, z runs back → front (the camera looks from the front).

import { Polyline, type Vec2 } from '../sim/path';

export const BELT_Y = 0.85; // top of conveyor belts

export const BUILDING = { minX: -54, maxX: 54, minZ: -24, maxZ: 28.5, backWallH: 8, lowWallH: 2.4 };

/** Everything the overview camera has to fit: building, truck yard and docked trucks. */
export const SITE_BOUNDS = { minX: -70, maxX: 56, minZ: -25, maxZ: 29.5 };

export type ZoneId = 'receiving' | 'machining' | 'assembly' | 'quality' | 'packaging' | 'dispatch';

export interface Zone {
  id: ZoneId;
  code: string;
  name: string;
  /** [minX, minZ, maxX, maxZ] */
  rect: [number, number, number, number];
  tint: string;
}

export const ZONES: Zone[] = [
  { id: 'receiving', code: 'A', name: 'Raw material receiving', rect: [-54, -24, -30, -2], tint: '#7a8b99' },
  { id: 'machining', code: 'B', name: 'Component manufacturing', rect: [-30, -24, 10, -2], tint: '#8a8f7a' },
  { id: 'assembly', code: 'C', name: 'Motor assembly', rect: [10, -24, 54, -2], tint: '#7f8aa1' },
  { id: 'quality', code: 'D', name: 'Quality control & testing', rect: [10, 2, 54, 28.5], tint: '#8d8197' },
  { id: 'packaging', code: 'E', name: 'Packaging', rect: [-24, 2, 10, 28.5], tint: '#998d78' },
  { id: 'dispatch', code: 'F', name: 'Finished goods & dispatch', rect: [-54, 2, -24, 28.5], tint: '#7d9488' },
];

// ---- conveyor lanes ---------------------------------------------------------

export type LaneId = 'main' | 'rework' | 'scrap';

/** Main line: receiving → machining → assembly → quality → packaging, one continuous belt. */
export const MAIN_POINTS: Vec2[] = [
  [-44, -12], [48, -12], [48, 14], [-16, 14],
];
/** Rework loop: leaves the main line at the diverter, passes the rework bench, rejoins before inspection. */
export const REWORK_POINTS: Vec2[] = [
  [10, 14], [10, 25], [52, 25], [52, 6], [48, 6],
];
/** Scrap lane: from the rework bench into the reject cage. */
export const SCRAP_POINTS: Vec2[] = [
  [24, 25], [24, 21.5], [32, 21.5],
];
/** Reject cage around the end of the scrap lane: [minX, minZ, maxX, maxZ]. */
export const REJECT_CAGE: [number, number, number, number] = [26, 19.4, 34, 23.6];

export const LANES: Record<LaneId, Polyline> = {
  main: new Polyline(MAIN_POINTS),
  rework: new Polyline(REWORK_POINTS),
  scrap: new Polyline(SCRAP_POINTS),
};

export const DIVERTER_S = LANES.main.project([10, 14]);
export const MERGE_S = LANES.main.project([48, 6]);
export const SCRAP_BRANCH_S = LANES.rework.project([24, 25]);

// ---- stations ----------------------------------------------------------------

export type StationId =
  | 'inbound_qc' | 'saw' | 'cnc_housing' | 'drill' | 'lathe_shaft' | 'stator_wind'
  | 'asm_stator' | 'asm_rotor' | 'asm_fan' | 'asm_terminal'
  | 'qc_visual' | 'qc_dim' | 'qc_elec' | 'qc_env' | 'qc_endurance'
  | 'rework' | 'pack_label' | 'pack_box' | 'palletize';

export type StationKind =
  | 'inspectionTable' | 'saw' | 'cnc' | 'drill' | 'lathe' | 'winder'
  | 'robotCell' | 'manualBench' | 'visionArch' | 'cmm' | 'electricalBench'
  | 'chamber' | 'dyno' | 'reworkBench' | 'labeler' | 'cartoner' | 'palletizer';

export type TestStationId = 'qc_visual' | 'qc_dim' | 'qc_elec' | 'qc_env' | 'qc_endurance';

export interface StationDef {
  id: StationId;
  name: string;
  zone: ZoneId;
  kind: StationKind;
  lane: LaneId;
  pos: Vec2;
  /** Which side of the belt the equipment stands on: +1 = right of travel, -1 = left. */
  side: 1 | -1;
  operation: string;
  /** Default cycle time in simulated seconds. */
  cycle: number;
  /** Build stage the product reaches when this station finishes (assembly progress). */
  stage?: number;
  operator: 'worker' | 'robot' | 'machine';
  test?: TestStationId;
}

export const STATIONS: StationDef[] = [
  { id: 'inbound_qc', name: 'Incoming material inspection', zone: 'receiving', kind: 'inspectionTable', lane: 'main', pos: [-38, -12], side: 1, operation: 'Check raw kit: bar stock, castings, lamination steel', cycle: 3.5, operator: 'worker', stage: 1 },
  { id: 'saw', name: 'Bar saw', zone: 'machining', kind: 'saw', lane: 'main', pos: [-26, -12], side: -1, operation: 'Cut shaft blank from steel bar', cycle: 4.5, operator: 'machine', stage: 2 },
  { id: 'cnc_housing', name: 'CNC machining centre', zone: 'machining', kind: 'cnc', lane: 'main', pos: [-18, -12], side: -1, operation: 'Mill and bore the motor housing casting', cycle: 7, operator: 'robot', stage: 3 },
  { id: 'drill', name: 'Drilling & tapping cell', zone: 'machining', kind: 'drill', lane: 'main', pos: [-10, -12], side: -1, operation: 'Drill and tap mounting feet and flange holes', cycle: 5, operator: 'robot', stage: 4 },
  { id: 'lathe_shaft', name: 'CNC lathe & rotor press', zone: 'machining', kind: 'lathe', lane: 'main', pos: [-2, -12], side: -1, operation: 'Turn the shaft and press on the rotor core', cycle: 6, operator: 'robot', stage: 5 },
  { id: 'stator_wind', name: 'Stator winding machine', zone: 'machining', kind: 'winder', lane: 'main', pos: [6, -12], side: -1, operation: 'Wind copper coils into the stator core', cycle: 7, operator: 'worker', stage: 6 },
  { id: 'asm_stator', name: 'Stator insertion robot', zone: 'assembly', kind: 'robotCell', lane: 'main', pos: [16, -12], side: 1, operation: 'Press the wound stator into the housing', cycle: 5, operator: 'robot', stage: 7 },
  { id: 'asm_rotor', name: 'Rotor & bearing assembly', zone: 'assembly', kind: 'manualBench', lane: 'main', pos: [24, -12], side: 1, operation: 'Fit bearings and insert the rotor and shaft', cycle: 6, operator: 'worker', stage: 8 },
  { id: 'asm_fan', name: 'End shield & fan robot', zone: 'assembly', kind: 'robotCell', lane: 'main', pos: [32, -12], side: 1, operation: 'Mount end shield, cooling fan and fan cover', cycle: 5, operator: 'robot', stage: 9 },
  { id: 'asm_terminal', name: 'Terminal box & fastening', zone: 'assembly', kind: 'manualBench', lane: 'main', pos: [40, -12], side: 1, operation: 'Fit terminal box, wire leads, torque all fasteners', cycle: 6, operator: 'worker', stage: 10 },
  { id: 'qc_visual', name: 'Visual inspection', zone: 'quality', kind: 'visionArch', lane: 'main', pos: [43, 14], side: -1, operation: 'Camera scan for surface and assembly defects', cycle: 3.5, operator: 'machine', test: 'qc_visual' },
  { id: 'qc_dim', name: 'Dimensional measurement', zone: 'quality', kind: 'cmm', lane: 'main', pos: [36, 14], side: -1, operation: 'CMM probe: bore diameter and shaft run-out', cycle: 5, operator: 'machine', test: 'qc_dim' },
  { id: 'qc_elec', name: 'Electrical test bench', zone: 'quality', kind: 'electricalBench', lane: 'main', pos: [29, 14], side: -1, operation: 'Supply current, speed, torque and winding balance', cycle: 6, operator: 'worker', test: 'qc_elec' },
  { id: 'qc_env', name: 'Environmental test chamber', zone: 'quality', kind: 'chamber', lane: 'main', pos: [21, 14], side: -1, operation: 'Heat, humidity, thermal cycling and spray exposure', cycle: 7.5, operator: 'machine', test: 'qc_env' },
  { id: 'qc_endurance', name: 'Vibration & endurance dyno', zone: 'quality', kind: 'dyno', lane: 'main', pos: [14, 14], side: -1, operation: 'Run under load: vibration and bearing life', cycle: 6.5, operator: 'machine', test: 'qc_endurance' },
  { id: 'rework', name: 'Rework station', zone: 'quality', kind: 'reworkBench', lane: 'rework', pos: [24, 25], side: 1, operation: 'Diagnose and repair failed motors', cycle: 9, operator: 'worker' },
  { id: 'pack_label', name: 'Nameplate labelling', zone: 'packaging', kind: 'labeler', lane: 'main', pos: [2, 14], side: -1, operation: 'Print and apply rating plate and serial label', cycle: 3.5, operator: 'machine', stage: 11 },
  { id: 'pack_box', name: 'Packing station', zone: 'packaging', kind: 'cartoner', lane: 'main', pos: [-6, 14], side: -1, operation: 'Place motor in carton with inserts and seal', cycle: 5.5, operator: 'worker', stage: 12 },
  { id: 'palletize', name: 'Palletising robot', zone: 'packaging', kind: 'palletizer', lane: 'main', pos: [-16, 14], side: -1, operation: 'Stack cartons four to a pallet', cycle: 3.5, operator: 'robot' },
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<StationId, StationDef>;

/** Distance of each station along its lane. */
export const STATION_S = Object.fromEntries(
  STATIONS.map((s) => [s.id, LANES[s.lane].project(s.pos)]),
) as Record<StationId, number>;

/** Main-line stations in travel order. */
export const MAIN_STATIONS = STATIONS.filter((s) => s.lane === 'main')
  .sort((a, b) => STATION_S[a.id] - STATION_S[b.id]);

export const TEST_STATIONS = STATIONS.filter((s) => s.test);

// ---- storage, pallets, docks ------------------------------------------------

/** Raw-material pallets waiting at the start of the line. */
export const INFEED_SLOTS: Vec2[] = [[-48, -16.5], [-45.5, -16.5], [-43, -16.5]];
/** Where the palletiser builds finished-goods pallets. */
export const PALLET_SPOT: Vec2 = [-16, 18.5];
/** Finished-goods rack, pass-through: loaded from the south aisle, unloaded from the north aisle. */
export const RACK_ROW_Z = 21;
export const RACK_BAYS = [-51, -48, -45, -42, -39, -36, -33, -30];
/** Shelf heights of the working rack levels (floor beam, first beam). */
export const RACK_LEVELS = [0.12, 1.82];
/** Rack slot i = bay (i mod bays) on level ⌊i / bays⌋: all ground bays fill before the upper level. */
export const RACK_SLOTS: Vec2[] = RACK_LEVELS.flatMap(() => RACK_BAYS.map((x) => [x, RACK_ROW_Z] as Vec2));
export function rackSlotLevel(slot: number) {
  return Math.floor(slot / RACK_BAYS.length);
}

export const DOCKS = {
  inbound: { z: -20, roadSide: -1 as const },
  outbound: { z: 12, roadSide: 1 as const },
};
/** Outside face of the left wall, where trailers back up to. */
export const DOCK_X = BUILDING.minX - 0.6;
export const ROAD_X = -80;
/** Pallet positions inside a docked trailer, measured from its rear door: eight pallets, 32 motors. */
export const TRAILER_SLOTS = [1.0, 2.4, 3.8, 5.2, 6.6, 8.0, 9.4, 10.8];

// ---- forklift corridors ----------------------------------------------------------

export interface ForkliftDef {
  id: string;
  name: string;
  corridor: Vec2[];
  home: Vec2;
  color: string;
}

export const FORKLIFTS: ForkliftDef[] = [
  { id: 'fl_receiving', name: 'Receiving forklift', corridor: [[-68, -20], [-40, -20]], home: [-41, -20], color: '#e2a32b' },
  { id: 'fl_storage', name: 'Put-away forklift', corridor: [[-12, 24.5], [-53, 24.5]], home: [-20, 24.5], color: '#e2a32b' },
  { id: 'fl_dispatch', name: 'Loading forklift', corridor: [[-27, 18.2], [-52.8, 18.2], [-52.8, 12], [-68, 12]], home: [-50, 15], color: '#e2a32b' },
];

/**
 * Milk-run aisle behind the line: tugger trains carry part bins from the feeder cells and the
 * parts supermarket to the flow racks at each station.
 */
export const AGV_LOOP: Vec2[] = [[-28, -18.3], [50, -18.3], [50, -19.5], [-28, -19.5], [-28, -18.3]];
