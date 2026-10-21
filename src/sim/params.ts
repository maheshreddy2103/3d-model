import { STATIONS, type StationId } from '../config/layout';
import { DEFAULT_TEST_PARAMS, type TestParams } from './quality';

export interface SimParams {
  /** Seed for every random draw; the same seed and settings always give the same run. */
  seed: number;
  /** Conveyor speed, m/s. */
  beltSpeed: number;
  /** Seconds between raw kits released onto the line. */
  spawnInterval: number;
  /** Cycle time per station, simulated seconds. */
  cycle: Record<StationId, number>;
  /** Machine settings that change the parts being made. */
  machine: { toolWearPct: number; wireTensionPct: number };
  tests: TestParams;
}

export function defaultParams(): SimParams {
  return {
    seed: 20251021,
    beltSpeed: 1.0,
    spawnInterval: 9,
    cycle: Object.fromEntries(STATIONS.map((s) => [s.id, s.cycle])) as Record<StationId, number>,
    machine: { toolWearPct: 20, wireTensionPct: 100 },
    tests: structuredClone(DEFAULT_TEST_PARAMS),
  };
}
