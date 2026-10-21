// Quality tests for the simulated 7.5 kW, 4-pole, 400 V / 50 Hz induction motor.
//
// IMPORTANT: these are ILLUSTRATIVE engineering calculations with EXAMPLE thresholds.
// They follow the shape of real relationships (current vs. voltage and load, I²
// temperature rise, Coffin–Manson fatigue, bearing L10 life, ISO 10816-style vibration
// zones) so that the results respond sensibly to the test conditions, but they are not
// validated models and the limits are not taken from, or a claim of compliance with,
// any certification standard.

import type { TestStationId } from '../config/layout';
import { normal } from './random';
import type { Status } from './runtime';

// ---- product variation ---------------------------------------------------------

/** Built-in variation of one motor, drawn when its raw kit enters the line. */
export interface ProductAttrs {
  /** Visual defect score 0..1 (scratches, paint, missing parts). */
  surfaceDefect: number;
  /** Housing bore deviation from nominal as cut by a sharp tool, µm. */
  boreDevUm: number;
  /** Shaft run-out, µm. */
  runoutUm: number;
  /** Phase-resistance imbalance from winding, %. */
  windingImbalancePct: number;
  /** Efficiency deviation from nominal (fraction, e.g. -0.01 = one point lower). */
  effDelta: number;
  /** Cooling effectiveness factor (fan and fins), ~1. */
  cooling: number;
  /** Seal and insulation quality factor, ~1. */
  seal: number;
  /** Solder/crimp joint fatigue strength factor, ~1. */
  joint: number;
  /** Residual imbalance vibration at 1500 rpm, mm/s. */
  balanceMmS: number;
  /** Bearing quality factor applied to its dynamic rating, ~1. */
  bearing: number;
}

/** Machine settings in force when the motor's parts were made. */
export interface MfgRecord {
  toolWearPct: number;
  wireTensionPct: number;
}

/** Draws a motor's attributes. A few percent of motors carry a specific defect. */
export function drawAttrs(rand: () => number): ProductAttrs {
  const defect = rand();
  const a: ProductAttrs = {
    surfaceDefect: Math.min(1, rand() ** 3 * 0.45),
    boreDevUm: normal(rand, 0, 6),
    runoutUm: Math.abs(normal(rand, 12, 6)),
    windingImbalancePct: Math.abs(normal(rand, 0.6, 0.35)),
    effDelta: normal(rand, 0, 0.007),
    cooling: normal(rand, 1, 0.05),
    seal: normal(rand, 1, 0.08),
    joint: normal(rand, 1, 0.1),
    balanceMmS: Math.abs(normal(rand, 1.3, 0.35)),
    bearing: normal(rand, 1, 0.05),
  };
  // Roughly one motor in eight carries one specific defect.
  if (defect < 0.02) a.surfaceDefect = 0.6 + rand() * 0.4;
  else if (defect < 0.035) a.boreDevUm = (rand() < 0.5 ? -1 : 1) * (26 + rand() * 12);
  else if (defect < 0.05) a.windingImbalancePct = 2.1 + rand();
  else if (defect < 0.065) a.seal = 0.45 + rand() * 0.15;
  else if (defect < 0.08) a.joint = 0.5 + rand() * 0.1;
  else if (defect < 0.095) a.balanceMmS = 3.6 + rand() * 1.5;
  else if (defect < 0.11) a.bearing = 0.8 + rand() * 0.04;
  else if (defect < 0.125) a.effDelta = -0.045 - rand() * 0.02;
  return a;
}

// ---- test conditions ------------------------------------------------------------

export interface TestParams {
  visual: { threshold: number };
  dimensional: { boreTolUm: number; runoutLimitUm: number };
  electrical: { voltage: number; frequency: number; loadPct: number };
  environmental: { ambientC: number; humidityPct: number; cycles: number; cycleLowC: number; cycleHighC: number; sprayMin: number };
  endurance: { loadPct: number; targetHours: number; bearingCkN: number };
}

export const DEFAULT_TEST_PARAMS: TestParams = {
  visual: { threshold: 0.55 },
  dimensional: { boreTolUm: 25, runoutLimitUm: 40 },
  electrical: { voltage: 400, frequency: 50, loadPct: 100 },
  environmental: { ambientC: 40, humidityPct: 85, cycles: 20, cycleLowC: -20, cycleHighC: 85, sprayMin: 10 },
  endurance: { loadPct: 100, targetHours: 40000, bearingCkN: 33 },
};

/** Editable fields per test station, for the station panel. */
export interface ParamField { group: keyof TestParams; key: string; label: string; unit: string; min: number; max: number; step: number }

export const TEST_FIELDS: Record<TestStationId, ParamField[]> = {
  qc_visual: [
    { group: 'visual', key: 'threshold', label: 'Reject threshold (defect score)', unit: '', min: 0.2, max: 1, step: 0.05 },
  ],
  qc_dim: [
    { group: 'dimensional', key: 'boreTolUm', label: 'Bore tolerance ±', unit: 'µm', min: 5, max: 60, step: 1 },
    { group: 'dimensional', key: 'runoutLimitUm', label: 'Shaft run-out limit', unit: 'µm', min: 10, max: 80, step: 1 },
  ],
  qc_elec: [
    { group: 'electrical', key: 'voltage', label: 'Supply voltage', unit: 'V', min: 300, max: 460, step: 5 },
    { group: 'electrical', key: 'frequency', label: 'Supply frequency', unit: 'Hz', min: 40, max: 60, step: 1 },
    { group: 'electrical', key: 'loadPct', label: 'Mechanical load', unit: '% rated', min: 0, max: 150, step: 5 },
  ],
  qc_env: [
    { group: 'environmental', key: 'ambientC', label: 'Chamber temperature', unit: '°C', min: -20, max: 80, step: 1 },
    { group: 'environmental', key: 'humidityPct', label: 'Relative humidity', unit: '%', min: 10, max: 98, step: 1 },
    { group: 'environmental', key: 'cycles', label: 'Thermal cycles', unit: 'cycles', min: 0, max: 60, step: 1 },
    { group: 'environmental', key: 'cycleLowC', label: 'Cycle low', unit: '°C', min: -60, max: 20, step: 1 },
    { group: 'environmental', key: 'cycleHighC', label: 'Cycle high', unit: '°C', min: 40, max: 150, step: 1 },
    { group: 'environmental', key: 'sprayMin', label: 'Dust/water spray time', unit: 'min', min: 0, max: 30, step: 1 },
  ],
  qc_endurance: [
    { group: 'endurance', key: 'loadPct', label: 'Dyno load', unit: '% rated', min: 0, max: 150, step: 5 },
    { group: 'endurance', key: 'targetHours', label: 'Required bearing life (L10)', unit: 'h', min: 5000, max: 100000, step: 1000 },
    { group: 'endurance', key: 'bearingCkN', label: 'Bearing dynamic rating C', unit: 'kN', min: 15, max: 60, step: 1 },
  ],
};

// ---- motor model ------------------------------------------------------------------

export const MOTOR = {
  ratedKW: 7.5,
  poles: 4,
  ratedV: 400,
  ratedHz: 50,
  efficiency: 0.91,
  powerFactor: 0.86,
  ratedSlip: 0.03,
  /** Magnetising current as a fraction of rated load current. */
  magnetising: 0.3,
  /** Winding temperature rise at rated current, K. */
  ratedRiseK: 80,
  /** Equivalent dynamic bearing load at rated output, kN. */
  bearingLoadKN: 1.8,
};

function loadCurrent(kw: number, volts: number, eff: number) {
  return (kw * 1000) / (Math.sqrt(3) * volts * eff * MOTOR.powerFactor);
}
const RATED_LOAD_I = loadCurrent(MOTOR.ratedKW, MOTOR.ratedV, MOTOR.efficiency);
/** Nameplate full-load current, A. */
export const RATED_CURRENT = Math.hypot(RATED_LOAD_I, MOTOR.magnetising * RATED_LOAD_I);

interface Operating { current: number; speed: number; sync: number; slip: number; torque: number }

/** Steady-state operating point of a motor at a supply and load. */
function operatingPoint(attrs: ProductAttrs, volts: number, hz: number, loadPct: number): Operating {
  const load = loadPct / 100;
  const eff = MOTOR.efficiency + attrs.effDelta;
  const iLoad = loadCurrent(MOTOR.ratedKW * load, volts, eff);
  const iMag = MOTOR.magnetising * RATED_LOAD_I * (volts / MOTOR.ratedV) * (MOTOR.ratedHz / hz);
  const current = Math.hypot(iLoad, iMag);
  const sync = (120 * hz) / MOTOR.poles;
  const slip = MOTOR.ratedSlip * load * (MOTOR.ratedV / volts) ** 2;
  const speed = sync * (1 - slip);
  const torque = speed > 0 ? (9550 * MOTOR.ratedKW * load) / speed : 0;
  return { current, speed, sync, slip, torque };
}

// ---- tests --------------------------------------------------------------------------

export interface Measurement {
  key: string;
  label: string;
  value: number;
  unit: string;
  limit: string;
  status: Exclude<Status, 'idle'>;
  /** Which attribute rework can correct when this fails (none = caused by test conditions). */
  fix?: keyof ProductAttrs | 'bore';
}

export interface TestOutcome {
  station: TestStationId;
  measurements: Measurement[];
  status: Exclude<Status, 'idle'>;
}

/** pass if ≤ passMax, warn if ≤ failMax, otherwise fail. */
function upper(value: number, passMax: number, failMax: number): Measurement['status'] {
  return value <= passMax ? 'pass' : value <= failMax ? 'warn' : 'fail';
}
/** pass if ≥ passMin, warn if ≥ failMin, otherwise fail. */
function lower(value: number, passMin: number, failMin: number): Measurement['status'] {
  return value >= passMin ? 'pass' : value >= failMin ? 'warn' : 'fail';
}

export function runTest(station: TestStationId, attrs: ProductAttrs, mfg: MfgRecord, p: TestParams): TestOutcome {
  const m: Measurement[] = [];

  if (station === 'qc_visual') {
    const thr = p.visual.threshold;
    m.push({ key: 'defect', label: 'Surface defect score', value: attrs.surfaceDefect, unit: '', limit: `< ${thr.toFixed(2)}`, status: attrs.surfaceDefect < 0.8 * thr ? 'pass' : attrs.surfaceDefect < thr ? 'warn' : 'fail', fix: 'surfaceDefect' });
  }

  if (station === 'qc_dim') {
    // Tool wear pushes the bore oversize by 0.35 µm per % wear.
    const bore = attrs.boreDevUm + mfg.toolWearPct * 0.35;
    const tol = p.dimensional.boreTolUm;
    m.push({ key: 'bore', label: 'Bore deviation', value: bore, unit: 'µm', limit: `±${tol}`, status: upper(Math.abs(bore), 0.8 * tol, tol), fix: 'bore' });
    const ro = p.dimensional.runoutLimitUm;
    m.push({ key: 'runout', label: 'Shaft run-out', value: attrs.runoutUm, unit: 'µm', limit: `≤ ${ro}`, status: upper(attrs.runoutUm, 0.8 * ro, ro), fix: 'runoutUm' });
  }

  if (station === 'qc_elec') {
    const { voltage, frequency, loadPct } = p.electrical;
    const op = operatingPoint(attrs, voltage, frequency, loadPct);
    const iRatio = op.current / RATED_CURRENT;
    m.push({ key: 'current', label: 'Line current', value: op.current, unit: 'A', limit: `≤ ${(RATED_CURRENT * 1.08).toFixed(1)} (In ${RATED_CURRENT.toFixed(1)})`, status: upper(iRatio, 1.03, 1.08), fix: 'effDelta' });
    m.push({ key: 'voltage', label: 'Applied voltage', value: voltage, unit: 'V', limit: `${MOTOR.ratedV} ±10%`, status: upper(Math.abs(voltage / MOTOR.ratedV - 1), 0.05, 0.1) });
    const slipLimit = MOTOR.ratedSlip * 1.5;
    m.push({ key: 'speed', label: 'Rotational speed', value: op.speed, unit: 'rpm', limit: `≥ ${(op.sync * (1 - slipLimit)).toFixed(0)}`, status: upper(op.slip, slipLimit, MOTOR.ratedSlip * 2) });
    const ratedTorque = (9550 * MOTOR.ratedKW) / ((120 * MOTOR.ratedHz) / MOTOR.poles * (1 - MOTOR.ratedSlip));
    m.push({ key: 'torque', label: 'Shaft torque (load)', value: op.torque, unit: 'N·m', limit: `≤ ${(ratedTorque * 1.15).toFixed(1)}`, status: upper(op.torque / ratedTorque, 1.0, 1.15) });
    const imbalance = attrs.windingImbalancePct + Math.abs(mfg.wireTensionPct - 100) * 0.04;
    m.push({ key: 'imbalance', label: 'Winding resistance imbalance', value: imbalance, unit: '%', limit: '≤ 2.0', status: upper(imbalance, 1.5, 2.0), fix: 'windingImbalancePct' });
  }

  if (station === 'qc_env') {
    const e = p.environmental;
    const op = operatingPoint(attrs, p.electrical.voltage, p.electrical.frequency, p.electrical.loadPct);
    // I²-proportional temperature rise above the chamber temperature.
    const windingC = e.ambientC + (MOTOR.ratedRiseK * (op.current / RATED_CURRENT) ** 2) / attrs.cooling;
    m.push({ key: 'temp', label: 'Winding temperature', value: windingC, unit: '°C', limit: '≤ 155 (class F)', status: upper(windingC, 140, 155), fix: 'cooling' });
    // Insulation resistance falls tenfold per +45 %RH above 40 %, halves per +10 °C above 40 °C.
    const ir = 2000 * attrs.seal * 10 ** (-(e.humidityPct - 40) / 45) * 2 ** (-(e.ambientC - 40) / 10);
    m.push({ key: 'insulation', label: 'Insulation resistance (humid)', value: ir, unit: 'MΩ', limit: '≥ 100', status: lower(ir, 150, 100), fix: 'seal' });
    // Coffin–Manson: cycles to crack initiation scale with (ΔT_ref/ΔT)^2.5; 40 cycles at 100 K for a nominal joint.
    const dT = Math.max(1, e.cycleHighC - e.cycleLowC);
    const cyclesToFail = 40 * attrs.joint * (100 / dT) ** 2.5;
    const damage = e.cycles / cyclesToFail;
    m.push({ key: 'thermal', label: 'Thermal-cycling damage index', value: damage, unit: '', limit: '< 1.0', status: upper(damage, 0.7, 1.0), fix: 'joint' });
    const ingress = (e.sprayMin / 10) * Math.max(0, 1.15 - attrs.seal) / 0.4;
    m.push({ key: 'ingress', label: 'Dust/water ingress index', value: ingress, unit: '', limit: '< 1.0', status: upper(ingress, 0.7, 1.0), fix: 'seal' });
  }

  if (station === 'qc_endurance') {
    const d = p.endurance;
    const op = operatingPoint(attrs, p.electrical.voltage, p.electrical.frequency, d.loadPct);
    const load = d.loadPct / 100;
    const vib = attrs.balanceMmS * (op.speed / 1500) * (0.7 + 0.3 * load) + Math.max(0, 1 - attrs.bearing) * 4;
    m.push({ key: 'vibration', label: 'Vibration velocity (RMS)', value: vib, unit: 'mm/s', limit: '≤ 4.5 (zone C)', status: upper(vib, 2.8, 4.5), fix: 'balanceMmS' });
    m.push({ key: 'rpm', label: 'Speed under load', value: op.speed, unit: 'rpm', limit: `≥ ${(op.sync * (1 - MOTOR.ratedSlip * 1.5)).toFixed(0)}`, status: upper(op.slip, MOTOR.ratedSlip * 1.5, MOTOR.ratedSlip * 2) });
    // Bearing basic rating life L10h = 10^6 / (60 n) × (C / P)^3.
    const P = Math.max(0.05, MOTOR.bearingLoadKN * load);
    const C = d.bearingCkN * attrs.bearing;
    const l10 = op.speed > 0 ? (1e6 / (60 * op.speed)) * (C / P) ** 3 : 0;
    m.push({ key: 'l10', label: 'Bearing life L10', value: l10, unit: 'h', limit: `≥ ${d.targetHours.toLocaleString()}`, status: lower(l10, d.targetHours * 1.2, d.targetHours), fix: 'bearing' });
  }

  const status = m.some((x) => x.status === 'fail') ? 'fail' : m.some((x) => x.status === 'warn') ? 'warn' : 'pass';
  return { station, measurements: m, status };
}

/** What the rework bench does about each failed measurement. Returns the repaired attributes. */
export function repair(attrs: ProductAttrs, mfg: MfgRecord, failed: Measurement[]): ProductAttrs {
  const a = { ...attrs };
  for (const f of failed) {
    switch (f.fix) {
      case 'surfaceDefect': a.surfaceDefect = 0.05; break;
      case 'bore': a.boreDevUm = -mfg.toolWearPct * 0.35; break;
      case 'runoutUm': a.runoutUm = 8; break;
      case 'effDelta': a.effDelta = 0; break;
      case 'windingImbalancePct': a.windingImbalancePct = 0.4; break;
      case 'cooling': a.cooling = 1.05; break;
      case 'seal': a.seal = 1.05; break;
      case 'joint': a.joint = 1.1; break;
      case 'balanceMmS': a.balanceMmS = 0.9; a.bearing = Math.max(a.bearing, 1); break;
      case 'bearing': a.bearing = 1.05; break;
      default: break;
    }
  }
  return a;
}
