// Deterministic manufacturing simulation. Fixed 50 ms steps, seeded randomness, no
// dependence on frame rate or camera. Products move as a state machine along physical
// conveyor lanes, so they cannot skip a station or jump between places.

import {
  DIVERTER_S, DOCK_X, DOCKS, FORKLIFTS, INFEED_SLOTS, LANES, MAIN_STATIONS, MERGE_S, PALLET_SPOT,
  RACK_LEVELS, RACK_SLOTS, REJECT_CAGE, ROAD_X, rackSlotLevel, STATION_BY_ID, STATION_S, STATIONS, TRAILER_SLOTS, BELT_Y,
  type ForkliftDef, type LaneId, type StationDef, type StationId, type TestStationId,
} from '../config/layout';
import { Polyline, yawOf, type Vec2 } from './path';
import { defaultParams, type SimParams } from './params';
import { drawAttrs, repair, runTest, type Measurement, type MfgRecord, type ProductAttrs } from './quality';
import { mulberry32 } from './random';
import type { RuntimeSource, StationAnim, StationInfo, Status } from './runtime';

export const DT = 0.05;
export const WARMUP_SECONDS = 900;
const SPACING = 1.7;
const PALLET_CAPACITY = 4;
const KITS_PER_PALLET = 6;
const FORK_REACH = 1.3;
const FORK_CARRY = 0.4;
const FORKLIFT_SPEED = 2.4;
const TRAILER_BED_Y = 0.25;
const TRUCK_FWD = 7;
const TRUCK_REV = 2.5;
const CAGE_CAPACITY = 15;
export const MAX_PRODUCTS = 360;

const LANE_STATIONS: Record<LaneId, StationDef[]> = {
  main: MAIN_STATIONS,
  rework: [STATION_BY_ID.rework],
  scrap: [],
};
const QC_START_INDEX = MAIN_STATIONS.findIndex((s) => s.id === 'qc_visual');

// ---- entities ---------------------------------------------------------------------

export type ProductLoc = 'line' | 'pallet' | 'scrap' | 'shipped';

export interface OpRecord { station: StationId; start: number; end: number | null }
export interface TestRecord {
  station: TestStationId;
  time: number;
  attempt: number;
  status: Exclude<Status, 'idle'>;
  measurements: Measurement[];
}

export interface Product {
  id: number;
  serial: string;
  slot: number;
  attrs: ProductAttrs;
  mfg: MfgRecord;
  stage: number;
  loc: ProductLoc;
  lane: LaneId;
  s: number;
  nextIdx: number;
  processing: StationId | null;
  progress: number;
  failed: boolean;
  reworkCount: number;
  visitedRework: boolean;
  ops: OpRecord[];
  tests: TestRecord[];
  createdAt: number;
  finishedAt: number | null;
  doneAt: number | null;
  palletId: number | null;
  palletSlot: number;
  cageIndex: number;
}

export type Spot =
  | { kind: 'truck'; truck: TruckId; slot: number }
  | { kind: 'infeed'; slot: number }
  | { kind: 'spot' }
  | { kind: 'rack'; slot: number }
  | { kind: 'forklift'; id: string };

export interface Pallet {
  id: number;
  kind: 'raw' | 'fg';
  kits: number;
  products: number[];
  reserved: number;
  state: 'filling' | 'ready' | 'stored' | 'moving' | 'loaded' | 'raw';
  at: Spot;
  /** Rotation relative to whatever holds the pallet (forklift, truck, floor). */
  relYaw: number;
  since: number;
}

export type TruckId = 'inbound' | 'outbound';
export interface Truck {
  id: TruckId;
  dockZ: number;
  state: 'away' | 'arriving' | 'docked' | 'departing';
  path: Polyline | null;
  s: number;
  reverseFrom: number;
  timer: number;
  x: number;
  z: number;
  yaw: number;
  slots: (number | null)[];
  reserved: boolean[];
  trips: number;
}

export interface Forklift {
  def: ForkliftDef;
  corridor: Polyline;
  x: number;
  z: number;
  y: number;
  yaw: number;
  fork: number;
  phase: 'idle' | 'toPickup' | 'lift' | 'pullOut' | 'toDrop' | 'lower' | 'backoff' | 'home';
  path: Polyline | null;
  s: number;
  reverse: boolean;
  timer: number;
  idleFor: number;
  pickup: Spot | null;
  drop: Spot | null;
  pallet: number | null;
  moves: number;
}

export interface StationState {
  current: number | null;
  busyTime: number;
  processed: number;
  pass: number;
  warn: number;
  fail: number;
  lastStatus: Status;
  lastResult: TestRecord | null;
  lastProduct: number | null;
}

export interface Sample { t: number; finished: number; wip: number; throughput: number; fpy: number }

export interface Pose { x: number; y: number; z: number; yaw: number }

// ---- engine -------------------------------------------------------------------------

export class Engine implements RuntimeSource {
  params: SimParams;
  time = 0;
  products: Product[] = [];
  archive = new Map<number, Product>();
  stations = {} as Record<StationId, StationState>;
  pallets: Pallet[] = [];
  forklifts: Forklift[] = [];
  trucks = {} as Record<TruckId, Truck>;
  counters = { started: 0, finished: 0, shipped: 0, scrapped: 0, reworked: 0, firstPassTested: 0, firstPassOk: 0, trucksOut: 0, trucksIn: 0 };
  leadTimes: number[] = [];
  finishTimes: number[] = [];
  history: Sample[] = [];
  /** Bumped whenever something structural changes, so views can refresh caches. */
  version = 0;

  private acc = 0;
  private nextSpawn = 0;
  private nextId = 1;
  private nextPalletId = 1;
  private freeSlots: number[] = [];
  private cage: number[] = [];
  private byId = new Map<number, Product>();
  private nextSample = 0;

  constructor(params: SimParams = defaultParams()) {
    this.params = params;
    this.reset();
  }

  /** Back to an empty factory, then fast-forward so the line is already running. */
  reset(warmup = WARMUP_SECONDS) {
    this.time = 0;
    this.acc = 0;
    this.products = [];
    this.archive.clear();
    this.byId.clear();
    this.pallets = [];
    this.cage = [];
    this.leadTimes = [];
    this.finishTimes = [];
    this.history = [];
    this.nextSpawn = 0;
    this.nextId = 1;
    this.nextPalletId = 1;
    this.nextSample = 0;
    this.freeSlots = Array.from({ length: MAX_PRODUCTS }, (_, i) => MAX_PRODUCTS - 1 - i);
    this.counters = { started: 0, finished: 0, shipped: 0, scrapped: 0, reworked: 0, firstPassTested: 0, firstPassOk: 0, trucksOut: 0, trucksIn: 0 };
    for (const s of STATIONS) {
      this.stations[s.id] = { current: null, busyTime: 0, processed: 0, pass: 0, warn: 0, fail: 0, lastStatus: 'idle', lastResult: null, lastProduct: null };
    }
    this.setupLogistics();
    this.version++;
    this.advance(warmup);
  }

  /** Advance by `seconds` of simulated time in fixed steps. */
  advance(seconds: number) {
    this.acc += seconds;
    while (this.acc >= DT - 1e-9) {
      this.acc -= DT;
      this.step();
    }
  }

  private step() {
    this.time += DT;
    this.spawn();
    this.moveLane('main');
    this.moveLane('rework');
    this.moveLane('scrap');
    for (const f of this.forklifts) this.stepForklift(f);
    this.stepTruck(this.trucks.inbound);
    this.stepTruck(this.trucks.outbound);
    if (this.time >= this.nextSample) {
      this.sample();
      this.nextSample += 30;
    }
  }

  // ---- products on the line --------------------------------------------------------

  private spawn() {
    if (this.time < this.nextSpawn) return;
    const pallet = this.infeedPallets().find((p) => p.kits > 0);
    if (!pallet) return;
    if (this.products.some((p) => p.loc === 'line' && p.lane === 'main' && p.s < SPACING)) return;
    const slot = this.freeSlots.pop();
    if (slot === undefined) return;
    const id = this.nextId++;
    const product: Product = {
      id,
      serial: `EM-${String(id).padStart(5, '0')}`,
      slot,
      attrs: drawAttrs(mulberry32(this.params.seed * 31 + id * 7919)),
      mfg: { ...this.params.machine },
      stage: 0,
      loc: 'line',
      lane: 'main',
      s: 0,
      nextIdx: 0,
      processing: null,
      progress: 0,
      failed: false,
      reworkCount: 0,
      visitedRework: false,
      ops: [],
      tests: [],
      createdAt: this.time,
      finishedAt: null,
      doneAt: null,
      palletId: null,
      palletSlot: 0,
      cageIndex: -1,
    };
    this.products.push(product);
    this.byId.set(id, product);
    this.counters.started++;
    pallet.kits--;
    if (pallet.kits === 0) this.removePallet(pallet);
    this.nextSpawn = this.time + this.params.spawnInterval;
    this.version++;
  }

  private moveLane(lane: LaneId) {
    const list = this.products.filter((p) => p.loc === 'line' && p.lane === lane).sort((a, b) => b.s - a.s);
    let leader = Infinity;
    for (const p of list) {
      if (p.processing) this.process(p);
      else this.move(p, leader);
      if (p.loc === 'line' && p.lane === lane) leader = p.s;
    }
  }

  private nextStation(p: Product): StationDef | null {
    return LANE_STATIONS[p.lane][p.nextIdx] ?? null;
  }

  private move(p: Product, leader: number) {
    const path = LANES[p.lane];
    let limit = Math.min(path.length, leader - SPACING);
    const st = this.nextStation(p);
    if (st) limit = Math.min(limit, STATION_S[st.id]);
    const divert = p.lane === 'main' && p.failed && p.s <= DIVERTER_S + 1e-6;
    if (divert) limit = Math.min(limit, DIVERTER_S);
    const target = Math.min(p.s + this.params.beltSpeed * DT, limit);
    if (target > p.s) p.s = target;

    if (st && p.s >= STATION_S[st.id] - 1e-6) this.tryStart(p, st);
    else if (divert && p.s >= DIVERTER_S - 1e-6) this.tryDivert(p);
    else if (p.lane === 'rework' && !st && p.s >= path.length - 1e-6) this.tryMerge(p);
    else if (p.lane === 'scrap' && p.s >= path.length - 1e-6) this.toCage(p);
  }

  private tryStart(p: Product, st: StationDef) {
    const state = this.stations[st.id];
    if (state.current !== null) return;
    if (st.id === 'palletize') {
      const pallet = this.spotPallet();
      if (!pallet || pallet.state !== 'filling' || pallet.products.length + pallet.reserved >= PALLET_CAPACITY) return;
      pallet.reserved++;
    }
    state.current = p.id;
    p.processing = st.id;
    p.progress = 0;
    p.ops.push({ station: st.id, start: this.time, end: null });
  }

  private process(p: Product) {
    const id = p.processing as StationId;
    const state = this.stations[id];
    state.busyTime += DT;
    p.progress += DT / Math.max(0.5, this.params.cycle[id]);
    if (p.progress >= 1) this.complete(p, id);
  }

  private complete(p: Product, id: StationId) {
    const def = STATION_BY_ID[id];
    const state = this.stations[id];
    const op = p.ops[p.ops.length - 1];
    if (op) op.end = this.time;
    state.current = null;
    state.processed++;
    state.lastProduct = p.id;
    p.processing = null;
    p.progress = 0;
    if (def.stage !== undefined) p.stage = Math.max(p.stage, def.stage);
    if (id === 'cnc_housing') p.mfg.toolWearPct = this.params.machine.toolWearPct;
    if (id === 'stator_wind') p.mfg.wireTensionPct = this.params.machine.wireTensionPct;

    if (def.test) {
      const outcome = runTest(def.test, p.attrs, p.mfg, this.params.tests);
      const record: TestRecord = { ...outcome, time: this.time, attempt: p.reworkCount + 1 };
      p.tests.push(record);
      state[outcome.status]++;
      state.lastStatus = outcome.status;
      state.lastResult = record;
      if (outcome.status === 'fail') p.failed = true;
      if (id === 'qc_endurance' && p.reworkCount === 0) {
        this.counters.firstPassTested++;
        if (!p.failed) this.counters.firstPassOk++;
      }
    }

    if (id === 'rework') {
      if (p.reworkCount >= 1) {
        // Failed again after one repair: scrap it.
        p.lane = 'scrap';
        p.s = 0;
        p.nextIdx = 0;
        this.version++;
        return;
      }
      const attempt = p.reworkCount + 1;
      const failed = p.tests.filter((t) => t.attempt === attempt).flatMap((t) => t.measurements.filter((m) => m.status === 'fail'));
      p.attrs = repair(p.attrs, p.mfg, failed);
      p.reworkCount++;
      p.failed = false;
      this.counters.reworked++;
    }

    if (id === 'palletize') {
      const pallet = this.spotPallet();
      if (pallet) {
        pallet.reserved--;
        p.loc = 'pallet';
        p.palletId = pallet.id;
        p.palletSlot = pallet.products.length;
        pallet.products.push(p.id);
        if (pallet.products.length >= PALLET_CAPACITY) pallet.state = 'ready';
      }
      p.finishedAt = this.time;
      this.counters.finished++;
      this.leadTimes.push(this.time - p.createdAt);
      if (this.leadTimes.length > 60) this.leadTimes.shift();
      this.finishTimes.push(this.time);
      if (this.finishTimes.length > 400) this.finishTimes.shift();
      this.version++;
      return;
    }
    p.nextIdx++;
  }

  private tryDivert(p: Product) {
    if (this.products.some((q) => q.loc === 'line' && q.lane === 'rework' && q.s < SPACING)) return;
    p.lane = 'rework';
    p.s = 0;
    p.nextIdx = 0;
    p.visitedRework = true;
    this.version++;
  }

  private tryMerge(p: Product) {
    if (this.products.some((q) => q !== p && q.loc === 'line' && q.lane === 'main' && Math.abs(q.s - MERGE_S) < SPACING)) return;
    p.lane = 'main';
    p.s = MERGE_S;
    p.nextIdx = QC_START_INDEX;
    this.version++;
  }

  private toCage(p: Product) {
    p.loc = 'scrap';
    p.doneAt = this.time;
    p.cageIndex = this.cage.length % CAGE_CAPACITY;
    this.cage.push(p.id);
    this.counters.scrapped++;
    if (this.cage.length > CAGE_CAPACITY) {
      // The oldest scrapped motor is cleared out of the cage to the scrap bin.
      const old = this.byId.get(this.cage.shift() as number);
      if (old) this.retire(old);
    }
    p.cageIndex = (this.cage.length - 1) % CAGE_CAPACITY;
    this.cage.forEach((id, i) => { const q = this.byId.get(id); if (q) q.cageIndex = i; });
    this.version++;
  }

  private retire(p: Product) {
    this.products = this.products.filter((q) => q !== p);
    this.byId.delete(p.id);
    this.freeSlots.push(p.slot);
    this.archive.set(p.id, p);
    if (this.archive.size > 400) {
      const first = this.archive.keys().next().value as number;
      this.archive.delete(first);
    }
  }

  // ---- pallets, forklifts and trucks ------------------------------------------------

  private setupLogistics() {
    this.trucks = {
      inbound: this.newTruck('inbound'),
      outbound: this.newTruck('outbound'),
    };
    // Start with two raw pallets at the infeed and a loaded inbound truck at the dock.
    for (let i = 0; i < 2; i++) this.addPallet('raw', { kind: 'infeed', slot: i }, KITS_PER_PALLET);
    this.loadInboundTruck();
    this.addPallet('fg', { kind: 'spot' }, 0);
    this.forklifts = FORKLIFTS.map((def) => ({
      def,
      corridor: new Polyline(def.corridor),
      x: def.home[0],
      z: def.home[1],
      y: 0,
      yaw: 0,
      fork: 0.1,
      phase: 'idle',
      path: null,
      s: 0,
      reverse: false,
      timer: 0,
      idleFor: 0,
      pickup: null,
      drop: null,
      pallet: null,
      moves: 0,
    }));
  }

  private newTruck(id: TruckId): Truck {
    const dockZ = DOCKS[id].z;
    return {
      id, dockZ, state: 'docked', path: null, s: 0, reverseFrom: 0, timer: 0,
      x: DOCK_X, z: dockZ, yaw: Math.PI, slots: emptySlots(), reserved: emptyReserved(), trips: 0,
    };
  }

  private loadInboundTruck() {
    const t = this.trucks.inbound;
    t.slots = emptySlots();
    t.reserved = emptyReserved();
    for (let i = 0; i < TRAILER_SLOTS.length; i++) {
      const pallet = this.addPallet('raw', { kind: 'truck', truck: 'inbound', slot: i }, KITS_PER_PALLET);
      t.slots[i] = pallet.id;
    }
  }

  private addPallet(kind: Pallet['kind'], at: Spot, kits: number): Pallet {
    const pallet: Pallet = {
      id: this.nextPalletId++, kind, kits, products: [], reserved: 0,
      state: kind === 'raw' ? 'raw' : 'filling', at, relYaw: 0, since: this.time,
    };
    this.pallets.push(pallet);
    this.version++;
    return pallet;
  }

  private removePallet(pallet: Pallet) {
    this.pallets = this.pallets.filter((p) => p !== pallet);
    this.version++;
  }

  palletById(id: number | null): Pallet | undefined {
    return id === null ? undefined : this.pallets.find((p) => p.id === id);
  }

  private infeedPallets() {
    return this.pallets.filter((p) => p.at.kind === 'infeed').sort((a, b) => a.since - b.since);
  }

  spotPallet(): Pallet | undefined {
    return this.pallets.find((p) => p.at.kind === 'spot');
  }

  /** World position of a pallet location (pallet centre, bottom). */
  spotPose(spot: Spot): Pose {
    switch (spot.kind) {
      case 'infeed': return { x: INFEED_SLOTS[spot.slot][0], y: 0, z: INFEED_SLOTS[spot.slot][1], yaw: 0 };
      case 'spot': return { x: PALLET_SPOT[0], y: 0, z: PALLET_SPOT[1], yaw: 0 };
      case 'rack': return { x: RACK_SLOTS[spot.slot][0], y: RACK_LEVELS[rackSlotLevel(spot.slot)], z: RACK_SLOTS[spot.slot][1], yaw: 0 };
      case 'truck': {
        const t = this.trucks[spot.truck];
        const hx = Math.cos(t.yaw);
        const hz = -Math.sin(t.yaw);
        const d = TRAILER_SLOTS[spot.slot];
        return { x: t.x + hx * d, y: TRAILER_BED_Y, z: t.z + hz * d, yaw: t.yaw };
      }
      case 'forklift': {
        const f = this.forklifts.find((q) => q.def.id === spot.id) as Forklift;
        return { x: f.x + Math.cos(f.yaw) * FORK_REACH, y: f.y + f.fork, z: f.z - Math.sin(f.yaw) * FORK_REACH, yaw: f.yaw };
      }
    }
  }

  palletPose(p: Pallet): Pose {
    const pose = this.spotPose(p.at);
    pose.yaw += p.relYaw;
    return pose;
  }

  /** Hands a pallet to a new holder without changing its world rotation. */
  private movePallet(pallet: Pallet, to: Spot) {
    const worldYaw = this.palletPose(pallet).yaw;
    pallet.at = to;
    pallet.relYaw = angleDiff(this.spotPose(to).yaw, worldYaw);
  }

  private spotFree(spot: Spot) {
    return !this.pallets.some((p) => JSON.stringify(p.at) === JSON.stringify(spot))
      && !this.forklifts.some((f) => f.drop && JSON.stringify(f.drop) === JSON.stringify(spot));
  }

  private claimed(spot: Spot) {
    return this.forklifts.some((f) => f.pickup && JSON.stringify(f.pickup) === JSON.stringify(spot));
  }

  /** Next job for a forklift, or null if there is nothing it can do. */
  private findJob(f: Forklift): { pickup: Spot; drop: Spot; pallet: Pallet } | null {
    const id = f.def.id;
    if (id === 'fl_receiving') {
      const t = this.trucks.inbound;
      if (t.state !== 'docked') return null;
      const slot = t.slots.findIndex((pid, i) => pid !== null && !this.claimed({ kind: 'truck', truck: 'inbound', slot: i }));
      if (slot < 0) return null;
      const free = INFEED_SLOTS.findIndex((_, i) => this.spotFree({ kind: 'infeed', slot: i }));
      if (free < 0) return null;
      const pallet = this.palletById(t.slots[slot]);
      return pallet ? { pickup: { kind: 'truck', truck: 'inbound', slot }, drop: { kind: 'infeed', slot: free }, pallet } : null;
    }
    if (id === 'fl_storage') {
      const pallet = this.spotPallet();
      if (!pallet || pallet.state !== 'ready' || this.claimed({ kind: 'spot' })) return null;
      const free = RACK_SLOTS.findIndex((_, i) => this.spotFree({ kind: 'rack', slot: i }));
      return free < 0 ? null : { pickup: { kind: 'spot' }, drop: { kind: 'rack', slot: free }, pallet };
    }
    // Loading forklift: oldest stored pallet into the deepest free trailer slot.
    const t = this.trucks.outbound;
    if (t.state !== 'docked') return null;
    let slot = -1;
    for (let i = TRAILER_SLOTS.length - 1; i >= 0; i--) {
      if (t.slots[i] === null && !t.reserved[i]) { slot = i; break; }
    }
    if (slot < 0) return null;
    const stored = this.pallets
      .filter((p) => p.at.kind === 'rack' && p.state === 'stored' && !this.claimed(p.at))
      .sort((a, b) => a.since - b.since)[0];
    if (!stored) return null;
    return { pickup: stored.at, drop: { kind: 'truck', truck: 'outbound', slot }, pallet: stored };
  }

  /** Path along the forklift's corridor that ends with the forks under `target`. */
  private route(f: Forklift, target: Vec2, approach: boolean): Polyline | null {
    const c = f.corridor;
    const from: Vec2 = [f.x, f.z];
    const sA = c.project(from);
    const sB = c.project(target);
    const pts: Vec2[] = [from];
    const a = c.at(sA);
    pts.push([a.x, a.z]);
    const verts = c.segments.map((seg) => seg.start).slice(1);
    if (sB > sA) for (const v of verts) { if (v > sA && v < sB) { const q = c.at(v); pts.push([q.x, q.z]); } }
    else for (const v of [...verts].reverse()) { if (v < sA && v > sB) { const q = c.at(v); pts.push([q.x, q.z]); } }
    const b = c.at(sB);
    const spur = Math.hypot(target[0] - b.x, target[1] - b.z);
    if (!approach) {
      pts.push([b.x, b.z]);
      if (spur > 0.3) pts.push(target);
    } else if (spur > 0.3) {
      pts.push([b.x, b.z]);
      const dx = (target[0] - b.x) / spur;
      const dz = (target[1] - b.z) / spur;
      pts.push([target[0] - dx * FORK_REACH, target[1] - dz * FORK_REACH]);
    } else {
      const sign = sB >= sA ? 1 : -1;
      pts.push([target[0] - b.dx * sign * FORK_REACH, target[1] - b.dz * sign * FORK_REACH]);
    }
    const clean: Vec2[] = [];
    for (const p of pts) {
      const last = clean[clean.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.05) clean.push(p);
    }
    if (clean.length < 2) return null;
    const line = new Polyline(clean);
    return line.length > 0.05 ? line : null;
  }

  private stepForklift(f: Forklift) {
    const pickY = (spot: Spot) => this.spotPose(spot).y + 0.05;

    if (f.phase === 'idle' || f.phase === 'home') {
      const job = this.findJob(f);
      if (job) {
        f.pickup = job.pickup;
        f.drop = job.drop;
        f.pallet = job.pallet.id;
        if (job.drop.kind === 'truck') this.trucks.outbound.reserved[job.drop.slot] = true;
        const target = this.spotPose(job.pickup);
        f.path = this.route(f, [target.x, target.z], true);
        f.s = 0;
        f.reverse = false;
        f.phase = 'toPickup';
        f.idleFor = 0;
      } else if (f.phase === 'idle') {
        f.idleFor += DT;
        if (f.idleFor > 4 && Math.hypot(f.x - f.def.home[0], f.z - f.def.home[1]) > 1) {
          f.path = this.route(f, f.def.home, false);
          f.s = 0;
          f.reverse = false;
          f.phase = 'home';
        }
      }
    }

    if (f.phase === 'toPickup' || f.phase === 'pullOut' || f.phase === 'toDrop' || f.phase === 'backoff' || f.phase === 'home') {
      const arrived = this.drive(f);
      if (f.phase === 'toPickup') f.fork += (pickY(f.pickup as Spot) - f.fork) * Math.min(1, DT * 2);
      if (f.phase === 'toDrop' || (f.phase === 'pullOut' && f.s > 1)) f.fork += (FORK_CARRY - f.fork) * Math.min(1, DT * 1.5);
      if (!arrived) return;
      if (f.phase === 'toPickup') { f.phase = 'lift'; f.timer = 0; }
      else if (f.phase === 'pullOut') {
        const target = this.spotPose(f.drop as Spot);
        f.path = this.route(f, [target.x, target.z], true);
        f.s = 0;
        f.reverse = false;
        f.phase = 'toDrop';
      }
      else if (f.phase === 'toDrop') { f.phase = 'lower'; f.timer = 0; }
      else if (f.phase === 'backoff') { f.phase = 'idle'; f.idleFor = 0; }
      else { f.phase = 'idle'; f.idleFor = -1e9; }
      return;
    }

    if (f.phase === 'lift') {
      f.timer += DT;
      if (f.timer < 0.4) return;
      const pallet = this.palletById(f.pallet);
      if (pallet && pallet.at.kind !== 'forklift') {
        const from = pallet.at;
        this.movePallet(pallet, { kind: 'forklift', id: f.def.id });
        pallet.state = 'moving';
        if (from.kind === 'truck') {
          const t = this.trucks[from.truck];
          t.slots[from.slot] = null;
        }
        if (from.kind === 'spot') this.addPallet('fg', { kind: 'spot' }, 0);
        this.version++;
      }
      // Lift just clear of the shelf or bed; the forks settle to carry height while driving.
      f.fork = Math.min(pickY(f.pickup as Spot) + 0.15, f.fork + DT * 0.5);
      if (f.timer < 1.2) return;
      this.backOut(f, 'pullOut');
      return;
    }

    if (f.phase === 'lower') {
      f.timer += DT;
      const drop = f.drop as Spot;
      f.fork += (this.spotPose(drop).y - f.fork) * Math.min(1, DT * 4);
      if (f.timer < 1.6) return;
      f.fork = this.spotPose(drop).y;
      const pallet = this.palletById(f.pallet);
      if (pallet) {
        this.movePallet(pallet, drop);
        pallet.since = this.time;
        if (drop.kind === 'rack') pallet.state = 'stored';
        else if (drop.kind === 'truck') {
          pallet.state = 'loaded';
          const t = this.trucks[drop.truck];
          t.slots[drop.slot] = pallet.id;
          t.reserved[drop.slot] = false;
        } else pallet.state = pallet.kind === 'raw' ? 'raw' : pallet.state;
      }
      f.moves++;
      f.pickup = null;
      f.drop = null;
      f.pallet = null;
      this.version++;
      this.backOut(f, 'backoff');
    }
  }

  /** Reverse 1.6 m straight back with the forks still facing the rack, truck or bay. */
  private backOut(f: Forklift, phase: 'pullOut' | 'backoff') {
    const hx = Math.cos(f.yaw);
    const hz = -Math.sin(f.yaw);
    f.path = new Polyline([[f.x, f.z], [f.x - hx * 1.6, f.z - hz * 1.6]]);
    f.s = 0;
    f.reverse = true;
    f.phase = phase;
  }

  /** Moves a forklift along its path; returns true on arrival. */
  private drive(f: Forklift): boolean {
    const path = f.path;
    if (!path) return true;
    f.s = Math.min(path.length, f.s + FORKLIFT_SPEED * DT * (f.reverse ? 0.6 : 1));
    const p = path.at(f.s);
    f.x = p.x;
    f.z = p.z;
    const target = f.reverse ? yawOf(-p.dx, -p.dz) : yawOf(p.dx, p.dz);
    f.yaw = turnToward(f.yaw, target, 3.5 * DT);
    f.y = f.x < DOCK_X + 0.3 ? TRAILER_BED_Y : 0;
    const arrived = f.s >= path.length - 1e-6;
    // Square up on the pallet so the forks sit exactly under it.
    if (arrived && !f.reverse) f.yaw = target;
    return arrived;
  }

  private stepTruck(t: Truck) {
    if (t.state === 'docked') {
      const full = t.slots.every((s) => s !== null);
      const empty = t.slots.every((s) => s === null);
      const busy = this.forklifts.some((f) => (f.pickup?.kind === 'truck' && f.pickup.truck === t.id) || (f.drop?.kind === 'truck' && f.drop.truck === t.id));
      const leave = t.id === 'inbound' ? empty && !busy : full && !busy;
      if (!leave) return;
      t.timer += DT;
      if (t.timer < 3) return;
      t.state = 'departing';
      t.timer = 0;
      const north = t.id === 'outbound';
      t.path = new Polyline([[DOCK_X, t.dockZ], [ROAD_X + 2, t.dockZ], [ROAD_X + 2, north ? -95 : 95]]);
      t.s = 0;
      t.reverseFrom = Infinity;
      return;
    }
    if (t.state === 'away') {
      t.timer += DT;
      if (t.timer < (t.id === 'inbound' ? 20 : 25)) return;
      t.state = 'arriving';
      t.timer = 0;
      if (t.id === 'inbound') {
        this.loadInboundTruck();
        this.counters.trucksIn++;
      }
      const fromNorth = t.id === 'inbound';
      t.path = new Polyline([[ROAD_X - 2, fromNorth ? -95 : 95], [ROAD_X - 2, t.dockZ], [DOCK_X, t.dockZ]]);
      t.reverseFrom = t.path.segments[1].start;
      t.s = 0;
      const p0 = t.path.at(0);
      t.x = p0.x;
      t.z = p0.z;
      t.yaw = yawOf(p0.dx, p0.dz);
      return;
    }
    const path = t.path as Polyline;
    const reversing = t.s >= t.reverseFrom;
    t.s = Math.min(path.length, t.s + (reversing ? TRUCK_REV : TRUCK_FWD) * DT);
    const p = path.at(t.s);
    t.x = p.x;
    t.z = p.z;
    const target = t.s >= t.reverseFrom ? yawOf(-p.dx, -p.dz) : yawOf(p.dx, p.dz);
    t.yaw = turnToward(t.yaw, target, 1.1 * DT);
    if (t.s < path.length - 1e-6) return;
    if (t.state === 'arriving') {
      t.state = 'docked';
      t.yaw = Math.PI;
      t.x = DOCK_X;
      t.z = t.dockZ;
      t.timer = 0;
      return;
    }
    // Departed: anything on board has left the site.
    t.state = 'away';
    t.timer = 0;
    t.trips++;
    if (t.id === 'outbound') {
      this.counters.trucksOut++;
      for (const pid of t.slots) {
        const pallet = this.palletById(pid);
        if (!pallet) continue;
        for (const id of pallet.products) {
          const prod = this.byId.get(id);
          if (prod) {
            prod.loc = 'shipped';
            prod.doneAt = this.time;
            this.counters.shipped++;
            this.retire(prod);
          }
        }
        this.removePallet(pallet);
      }
    }
    t.slots = emptySlots();
    t.reserved = emptyReserved();
    this.version++;
  }

  // ---- views ----------------------------------------------------------------------------

  /** Where a product is drawn: its tray bottom (on the belt) or its carton bottom (elsewhere). */
  productPose(p: Product, out: Pose): Pose {
    if (p.loc === 'line') {
      const pt = LANES[p.lane].at(p.s);
      out.x = pt.x;
      out.z = pt.z;
      out.y = BELT_Y;
      out.yaw = yawOf(pt.dx, pt.dz);
      if (p.processing === 'palletize' && p.progress > 0.4) {
        const pallet = this.spotPallet();
        if (pallet) {
          const target = this.palletSlotPose(pallet, pallet.products.length, { x: 0, y: 0, z: 0, yaw: 0 });
          const k = smooth((p.progress - 0.4) / 0.45);
          out.x += (target.x - out.x) * k;
          out.z += (target.z - out.z) * k;
          out.y += (target.y - out.y) * k + Math.sin(k * Math.PI) * 0.6;
          out.yaw += angleDiff(out.yaw, target.yaw) * k;
        }
      }
      return out;
    }
    if (p.loc === 'pallet') {
      const pallet = this.palletById(p.palletId);
      if (pallet) return this.palletSlotPose(pallet, p.palletSlot, out);
    }
    if (p.loc === 'scrap') {
      const [x0, z0] = REJECT_CAGE;
      out.x = x0 + 1.8 + (p.cageIndex % 5) * 1.2;
      out.z = z0 + 0.9 + Math.floor(p.cageIndex / 5) * 1.3;
      out.y = -0.06;
      out.yaw = 0;
      return out;
    }
    out.x = 0; out.y = -100; out.z = 0; out.yaw = 0;
    return out;
  }

  private palletSlotPose(pallet: Pallet, slot: number, out: Pose): Pose {
    const base = this.palletPose(pallet);
    const lx = slot % 2 === 0 ? -0.31 : 0.31;
    const lz = slot < 2 ? -0.25 : 0.25;
    const c = Math.cos(base.yaw);
    const s = Math.sin(base.yaw);
    out.x = base.x + lx * c + lz * s;
    out.z = base.z - lx * s + lz * c;
    out.y = base.y + 0.14 - 0.06;
    out.yaw = base.yaw;
    return out;
  }

  product(id: number): Product | undefined {
    return this.byId.get(id) ?? this.archive.get(id);
  }

  activeProducts(): Product[] {
    return this.products;
  }

  // RuntimeSource ---------------------------------------------------------------

  station(id: StationId): StationAnim {
    const st = this.stations[id];
    const p = st.current !== null ? this.byId.get(st.current) : undefined;
    return { busy: !!p, progress: p ? p.progress : 0, status: st.lastStatus };
  }

  info(id: StationId): StationInfo {
    return { ...this.station(id), processed: this.stations[id].processed };
  }

  now() {
    return this.time;
  }

  beltSpeed() {
    return this.params.beltSpeed;
  }

  // ---- metrics history ----------------------------------------------------------------

  throughputPerHour(window = 600): number {
    const since = this.time - window;
    const n = this.finishTimes.filter((t) => t > since).length;
    const span = Math.min(window, this.time);
    return span > 0 ? (n / span) * 3600 : 0;
  }

  private sample() {
    const wip = this.products.filter((p) => p.loc === 'line' && p.lane !== 'scrap').length;
    const fpy = this.counters.firstPassTested ? this.counters.firstPassOk / this.counters.firstPassTested : 1;
    this.history.push({ t: this.time, finished: this.counters.finished, wip, throughput: this.throughputPerHour(), fpy });
    if (this.history.length > 120) this.history.shift();
  }
}

function emptySlots(): (number | null)[] {
  return TRAILER_SLOTS.map(() => null);
}

function emptyReserved(): boolean[] {
  return TRAILER_SLOTS.map(() => false);
}

export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDiff(current, target);
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smooth(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
