import { useState } from 'react';
import { STATION_BY_ID, ZONES, type StationId, type TestStationId } from '../config/layout';
import { engine } from '../sim/engineInstance';
import { utilization } from '../sim/metrics';
import { TEST_FIELDS, runTest, type Measurement, type TestParams } from '../sim/quality';
import { useUI } from '../state/uiStore';
import { stationFocus } from '../scene/stations/StationShell';

const TEST_NOTES: Record<TestStationId, string> = {
  qc_visual: 'Camera defect score per motor (0 = flawless). Pass below 80% of the threshold, warning up to it, fail at or above.',
  qc_dim: 'Bore = as-cut deviation + 0.35 µm per % of CNC tool wear. Pass within 80% of tolerance, warning up to tolerance.',
  qc_elec: 'Current = √(I_load² + I_mag²), I_load = P·load / (√3·V·η·pf), I_mag ∝ V/f. Slip ∝ load·(400/V)². Torque = 9550·P / n.',
  qc_env: 'Winding °C = chamber + 80 K·(I/In)²/cooling. Insulation = 2000 MΩ·seal·10^(−(RH−40)/45)·2^(−(T−40)/10). Cycling damage = cycles / (40·joint·(100/ΔT)^2.5).',
  qc_endurance: 'Vibration scales with imbalance, speed and load (zones after ISO 10816 shape). Bearing L10h = 10⁶/(60·n)·(C/P)³, P = 1.8 kN × load.',
};

function NumberField({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); }} />
        <em>{unit}</em>
      </span>
    </label>
  );
}

function fmt(m: Measurement) {
  const v = m.value;
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${m.unit ? ` ${m.unit}` : ''}`;
}

export function ResultTable({ measurements }: { measurements: Measurement[] }) {
  return (
    <table className="results">
      <thead><tr><th>Measurement</th><th>Value</th><th>Limit</th><th /></tr></thead>
      <tbody>
        {measurements.map((m) => (
          <tr key={m.key}>
            <td>{m.label}</td>
            <td className="num">{fmt(m)}</td>
            <td className="muted">{m.limit}</td>
            <td><span className={`pill ${m.status}`}>{m.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StationPanel({ id }: { id: StationId }) {
  const def = STATION_BY_ID[id];
  const select = useUI((s) => s.select);
  const focus = useUI((s) => s.focus);
  const bump = useUI((s) => s.bumpTick);
  useUI((s) => s.tick);
  const [preview, setPreview] = useState<Measurement[] | null>(null);
  const st = engine.stations[id];
  const current = st.current !== null ? engine.product(st.current) : undefined;
  const hours = engine.time / 3600;
  const set = (fn: () => void) => { fn(); setPreview(null); bump(); };
  const tested = st.pass + st.warn + st.fail;
  const last = st.lastProduct !== null ? engine.product(st.lastProduct) : undefined;

  return (
    <aside className="panel side" aria-label={`${def.name} details`}>
      <div className="panel-head">
        <div>
          <div className="eyebrow">{ZONES.find((z) => z.id === def.zone)?.name}</div>
          <h2>{def.name}</h2>
        </div>
        <button type="button" className="icon" onClick={() => select(null)} aria-label="Close">×</button>
      </div>
      <p className="muted">{def.operation}</p>

      <div className="facts">
        <div><span>Status</span><strong className={current ? 'ok' : ''}>{current ? `Running · ${Math.round(current.progress * 100)}%` : 'Waiting for part'}</strong></div>
        <div><span>Processed</span><strong>{st.processed}</strong></div>
        <div><span>Cycle time</span><strong>{engine.params.cycle[id].toFixed(1)} s</strong></div>
        <div><span>Throughput</span><strong>{hours > 0 ? (st.processed / hours).toFixed(0) : 0}/h</strong></div>
        <div><span>Utilisation</span><strong>{(utilization(engine, id) * 100).toFixed(0)}%</strong></div>
        <div><span>Operator</span><strong>{def.operator}</strong></div>
        {def.test && (
          <div className="wide"><span>Quality results</span>
            <strong>
              <span className="pill pass">{st.pass} pass</span> <span className="pill warn">{st.warn} warn</span> <span className="pill fail">{st.fail} fail</span>
              <em className="muted"> · {tested ? ((st.pass + st.warn) / tested * 100).toFixed(1) : '100'}% accepted</em>
            </strong>
          </div>
        )}
      </div>

      {current && (
        <button type="button" className="link" onClick={() => select({ type: 'product', id: current.id })}>
          Now processing {current.serial} →
        </button>
      )}

      <h3>Operating parameters</h3>
      <div className="fields">
        <NumberField label="Cycle time" unit="s" value={engine.params.cycle[id]} min={1} max={60} step={0.5}
          onChange={(v) => set(() => { engine.params.cycle[id] = v; })} />
        {id === 'cnc_housing' && (
          <NumberField label="Tool wear" unit="%" value={engine.params.machine.toolWearPct} min={0} max={100} step={5}
            onChange={(v) => set(() => { engine.params.machine.toolWearPct = v; })} />
        )}
        {id === 'stator_wind' && (
          <NumberField label="Wire tension" unit="% nominal" value={engine.params.machine.wireTensionPct} min={50} max={150} step={5}
            onChange={(v) => set(() => { engine.params.machine.wireTensionPct = v; })} />
        )}
        {id === 'inbound_qc' && (
          <>
            <NumberField label="Kit release interval" unit="s" value={engine.params.spawnInterval} min={3} max={60} step={0.5}
              onChange={(v) => set(() => { engine.params.spawnInterval = v; })} />
            <NumberField label="Conveyor speed" unit="m/s" value={engine.params.beltSpeed} min={0.2} max={2} step={0.1}
              onChange={(v) => set(() => { engine.params.beltSpeed = v; })} />
          </>
        )}
        {def.test && TEST_FIELDS[def.test].map((f) => {
          const group = engine.params.tests[f.group] as unknown as Record<string, number>;
          return (
            <NumberField key={f.key} label={f.label} unit={f.unit} value={group[f.key]} min={f.min} max={f.max} step={f.step}
              onChange={(v) => set(() => { group[f.key] = v; })} />
          );
        })}
      </div>
      {(id === 'cnc_housing' || id === 'stator_wind') && (
        <p className="note">Applies to parts made from now on; the effect shows up later at dimensional or electrical test.</p>
      )}

      {def.test && (
        <>
          <h3>Latest result {st.lastResult && <span className="muted">· {engine.product(st.lastProduct ?? -1)?.serial}</span>}</h3>
          {st.lastResult ? <ResultTable measurements={st.lastResult.measurements} /> : <p className="muted">No motor tested yet.</p>}
          {last && (
            <div className="actions">
              <button type="button" className="btn" onClick={() => setPreview(runTest(def.test as TestStationId, last.attrs, last.mfg, engine.params.tests as TestParams).measurements)}>
                Re-test {last.serial} with these settings
              </button>
              <button type="button" className="btn" onClick={() => { engine.reset(); useUI.getState().markReset(); useUI.getState().select({ type: 'station', id }); }}>
                Restart run with these settings
              </button>
            </div>
          )}
          {preview && (<><h3>Preview with current settings</h3><ResultTable measurements={preview} /></>)}
          <p className="note">
            <strong>Illustrative calculation, example limits.</strong> {TEST_NOTES[def.test]} Not a certification or a validated
            lifetime prediction.
          </p>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => { const f = stationFocus(def); focus(f.center, f.radius); }}>Zoom to station</button>
      </div>
    </aside>
  );
}
