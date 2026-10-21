// The read-only view that 3D models use to animate themselves. Models never touch the
// engine directly: they ask "what is this station doing right now?" every frame.
// Everything here is in simulated time, so pausing the simulation freezes every model.

import type { StationId } from '../config/layout';

export type Status = 'idle' | 'pass' | 'warn' | 'fail';

export interface StationAnim {
  /** A product is being processed. */
  busy: boolean;
  /** 0..1 through the current cycle (0 when idle). */
  progress: number;
  /** Result of the most recent product (test stations), or idle. */
  status: Status;
}

export interface StationInfo extends StationAnim {
  processed: number;
}

export interface RuntimeSource {
  now(): number;
  beltSpeed(): number;
  station(id: StationId): StationAnim;
  info(id: StationId): StationInfo;
}

const IDLE: StationAnim = { busy: false, progress: 0, status: 'idle' };
const IDLE_INFO: StationInfo = { ...IDLE, processed: 0 };
let source: RuntimeSource | null = null;

export function setRuntimeSource(next: RuntimeSource) {
  source = next;
}

/** Simulated seconds since the last reset. */
export function simTime(): number {
  return source ? source.now() : 0;
}

export function beltSpeed(): number {
  return source ? source.beltSpeed() : 0;
}

export function stationAnim(id: StationId): StationAnim {
  return source ? source.station(id) : IDLE;
}

/** Slower-changing station facts for labels and panels. */
export function stationInfo(id: StationId): StationInfo {
  return source ? source.info(id) : IDLE_INFO;
}

export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
