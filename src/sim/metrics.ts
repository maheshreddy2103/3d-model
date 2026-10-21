// Production KPIs, all derived from the engine's actual state.

import { MAIN_STATIONS, STATION_BY_ID, STATIONS, type StationId } from '../config/layout';
import type { Engine, Product } from './engine';

const LAST_TEST_INDEX = MAIN_STATIONS.findIndex((s) => s.id === 'qc_endurance');

export interface Metrics {
  time: number;
  inProduction: number;
  completed: number;
  shipped: number;
  awaitingInspection: number;
  inTest: number;
  inRework: number;
  reworkedTotal: number;
  scrapped: number;
  firstPassYield: number;
  overallYield: number;
  avgLeadTime: number;
  throughput: number;
  utilization: number;
}

function inTest(p: Product) {
  return !!p.processing && !!STATION_BY_ID[p.processing].test;
}

export function computeMetrics(e: Engine): Metrics {
  const line = e.products.filter((p) => p.loc === 'line');
  const awaiting = line.filter((p) => p.lane === 'main' && p.stage >= 10 && p.nextIdx <= LAST_TEST_INDEX && !inTest(p)).length;
  const done = e.counters.finished + e.counters.scrapped;
  const lead = e.leadTimes.length ? e.leadTimes.reduce((a, b) => a + b, 0) / e.leadTimes.length : 0;
  const util = STATIONS.reduce((sum, s) => sum + utilization(e, s.id), 0) / STATIONS.length;
  return {
    time: e.time,
    inProduction: line.filter((p) => p.lane !== 'scrap').length,
    completed: e.counters.finished,
    shipped: e.counters.shipped,
    awaitingInspection: awaiting,
    inTest: line.filter(inTest).length,
    inRework: line.filter((p) => p.lane === 'rework').length,
    reworkedTotal: e.counters.reworked,
    scrapped: e.counters.scrapped,
    firstPassYield: e.counters.firstPassTested ? e.counters.firstPassOk / e.counters.firstPassTested : 1,
    overallYield: done ? e.counters.finished / done : 1,
    avgLeadTime: lead,
    throughput: e.throughputPerHour(),
    utilization: util,
  };
}

export function utilization(e: Engine, id: StationId) {
  return e.time > 0 ? e.stations[id].busyTime / e.time : 0;
}

export function formatClock(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  const m = Math.floor(seconds / 60);
  return `${m} min ${Math.round(seconds % 60)} s`;
}
