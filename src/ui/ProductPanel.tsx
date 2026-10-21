import { STATION_BY_ID } from '../config/layout';
import { engine } from '../sim/engineInstance';
import { STAGE_NAMES, locationOf } from '../sim/describe';
import { formatDuration } from '../sim/metrics';
import { useUI } from '../state/uiStore';
import { ResultTable } from './StationPanel';

export function ProductPanel({ id }: { id: number }) {
  const select = useUI((s) => s.select);
  const focus = useUI((s) => s.focus);
  useUI((s) => s.tick);
  const p = engine.product(id);
  if (!p) {
    return (
      <aside className="panel side">
        <div className="panel-head"><h2>Motor not found</h2><button type="button" className="icon" onClick={() => select(null)} aria-label="Close">×</button></div>
        <p className="muted">It has left the simulation history.</p>
      </aside>
    );
  }
  const end = p.doneAt ?? engine.time;
  const failedTests = p.tests.flatMap((t) => t.measurements.filter((m) => m.status === 'fail').map((m) => ({ ...m, attempt: t.attempt, station: t.station })));
  const pose = { x: 0, y: 0, z: 0, yaw: 0 };

  return (
    <aside className="panel side" aria-label={`Motor ${p.serial}`}>
      <div className="panel-head">
        <div>
          <div className="eyebrow">7.5 kW induction motor</div>
          <h2>{p.serial}</h2>
        </div>
        <button type="button" className="icon" onClick={() => select(null)} aria-label="Close">×</button>
      </div>

      <div className="facts">
        <div className="wide"><span>Location</span><strong>{locationOf(engine, p)}</strong></div>
        <div><span>Current station</span><strong>{p.processing ? STATION_BY_ID[p.processing].name : '—'}</strong></div>
        <div><span>Build state</span><strong>{STAGE_NAMES[p.stage]}</strong></div>
        <div><span>Elapsed (simulated)</span><strong>{formatDuration(end - p.createdAt)}</strong></div>
        <div><span>Quality</span><strong className={p.failed ? 'bad' : ''}>{p.loc === 'scrap' ? 'Scrapped' : p.failed ? 'Failed — to rework' : p.reworkCount ? `Reworked ×${p.reworkCount}` : p.tests.length ? 'Passing' : 'Not tested yet'}</strong></div>
      </div>

      <div className="actions">
        {p.loc !== 'shipped' && (
          <button type="button" className="btn" onClick={() => { engine.productPose(p, pose); focus([pose.x, pose.y, pose.z], 5); }}>Zoom to motor</button>
        )}
      </div>

      <h3>Completed operations ({p.ops.filter((o) => o.end !== null).length})</h3>
      <ol className="ops">
        {p.ops.map((o, i) => (
          <li key={i} className={o.end === null ? 'active' : ''}>
            <span>{STATION_BY_ID[o.station].name}</span>
            <em>{o.end === null ? 'in progress' : `${(o.end - o.start).toFixed(1)} s · t+${formatDuration(o.start - p.createdAt)}`}</em>
          </li>
        ))}
      </ol>

      <h3>Inspection history</h3>
      {p.tests.length === 0 && <p className="muted">Not inspected yet.</p>}
      {p.tests.map((t, i) => (
        <details key={i} className="test" open={t.status !== 'pass'}>
          <summary>
            <span className={`pill ${t.status}`}>{t.status}</span> {STATION_BY_ID[t.station].name}
            <em className="muted"> · attempt {t.attempt}</em>
          </summary>
          <ResultTable measurements={t.measurements} />
        </details>
      ))}

      {failedTests.length > 0 && (
        <>
          <h3>Failed tests</h3>
          <ul className="fails">
            {failedTests.map((f, i) => (
              <li key={i}>{f.label} at {STATION_BY_ID[f.station].name} (attempt {f.attempt}): {f.value.toFixed(2)} {f.unit}, limit {f.limit}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
