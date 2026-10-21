import { engine } from '../sim/engineInstance';
import { formatClock } from '../sim/metrics';
import { useUI, type Visibility } from '../state/uiStore';
import { CameraBar } from './CameraBar';

const SPEEDS = [0.5, 1, 2, 4];
const TOGGLES: [keyof Visibility, string][] = [
  ['workers', 'Workers'],
  ['machineLabels', 'Machine labels'],
  ['productLabels', 'Product labels'],
  ['routes', 'Routes'],
  ['quality', 'Quality lights'],
  ['metrics', 'Metrics'],
];

export function Toolbar() {
  const playing = useUI((s) => s.playing);
  const speed = useUI((s) => s.speed);
  const show = useUI((s) => s.show);
  const { setPlaying, setSpeed, toggle, overview, markReset } = useUI.getState();
  useUI((s) => s.tick);

  const reset = () => {
    engine.reset();
    markReset();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <strong>Motor Factory Twin</strong>
        <span>7.5 kW industrial motor · live simulation</span>
      </div>

      <div className="group" role="group" aria-label="Playback">
        <button type="button" className="btn primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn" onClick={reset} title="Restart the run (same seed and settings give the same result)">Reset</button>
        <div className="seg" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={s === speed ? 'on' : ''} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <span className="clock" title="Simulated time since reset (includes 15 min warm-up)">⏱ {formatClock(engine.time)}</span>
      </div>

      <button type="button" className="btn strong" onClick={overview} title="Return to the full factory overview">⌂ Factory overview</button>
      <CameraBar />

      <div className="group toggles" role="group" aria-label="Show">
        {TOGGLES.map(([key, label]) => (
          <label key={key} className={`chip ${show[key] ? 'on' : ''}`}>
            <input type="checkbox" checked={show[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
      </div>
    </header>
  );
}
