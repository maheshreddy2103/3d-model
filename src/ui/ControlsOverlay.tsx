import { useEffect, useState } from 'react';
import { ZONES } from '../config/layout';
import { camState, navInput } from '../scene/camera/cameraShared';
import { formatClock } from '../sim/metrics';
import { engine } from '../sim/engineInstance';
import { useUI } from '../state/uiStore';

/** Hold-to-move button for the walk pad. */
function PadButton({ label, title, set }: { label: string; title: string; set: (on: boolean) => void }) {
  return (
    <button type="button" className="pad-btn" title={title} aria-label={title}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}>
      {label}
    </button>
  );
}

/** On-screen arrows, shown while inside: hold to walk forward/back or turn. */
function WalkPad() {
  return (
    <div className="walk-pad" role="group" aria-label="Walk">
      <span />
      <PadButton label="▲" title="Walk forward" set={(on) => { navInput.forward = on ? 1 : 0; }} />
      <span />
      <PadButton label="◀" title="Turn left" set={(on) => { navInput.turn = on ? 1 : 0; }} />
      <PadButton label="▼" title="Walk back" set={(on) => { navInput.forward = on ? -1 : 0; }} />
      <PadButton label="▶" title="Turn right" set={(on) => { navInput.turn = on ? -1 : 0; }} />
    </div>
  );
}

const HELP: [string, string][] = [
  ['Click', 'Walk there at eye level. Click a machine to stop in front of it, facing it (and select it).'],
  ['Left-drag', 'Move: drag the floor and the view slides with it. It never turns.'],
  ['Right-drag / Shift-drag', 'Turn your head where you stand. It never moves.'],
  ['Wheel', 'Fly toward whatever is under the pointer; wheel back to rise and see the whole factory.'],
  ['W A S D', 'Walk forward / back, step left / right.'],
  ['Arrows / on-screen pad', 'Walk forward / back, turn left / right.'],
  ['Q / E', 'Go down / up.'],
  ['Two fingers (touch)', 'Slide to look around, pinch to fly in or out.'],
  ['Double-click', 'Go close to the station or motor'],
  ['● Live cams', 'Jump to an eye-level view inside each area'],
  ['⌂ Factory overview', 'Back to the whole factory'],
];

/** One control hint, the help panel, and a LIVE tag while you are down on the factory floor. */
export function ControlsOverlay() {
  const helpOpen = useUI((s) => s.helpOpen);
  const toggleHelp = useUI((s) => s.toggleHelp);
  const [live, setLive] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (camState.y > 9) { setLive(null); return; }
      const zone = ZONES.find((z) => camState.tx >= z.rect[0] && camState.tx <= z.rect[2] && camState.tz >= z.rect[1] && camState.tz <= z.rect[3]);
      setLive(zone ? zone.name : 'Factory floor');
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {live && <WalkPad />}
      {live && (
        <div className="live-tag">
          <span className="rec" /> LIVE · {live} · {formatClock(engine.time)}
        </div>
      )}
      <div className="controls-bar">
        <span className="mode-tag">{live ? 'Inside' : 'Miniature'}</span>
        <span>{live
          ? 'Click to walk there · drag to move · right-drag to look around · wheel to fly · W A S D to walk'
          : 'Click to go there · drag to move · right-drag to look around · wheel to fly in or out'}</span>
      </div>
      {helpOpen && (
        <section className="panel help" aria-label="Camera controls">
          <div className="panel-head">
            <h2>Exploring the factory</h2>
            <button type="button" className="icon" onClick={toggleHelp} aria-label="Close">×</button>
          </div>
          <table className="results">
            <tbody>
              {HELP.map(([k, v]) => <tr key={k}><td className="key">{k}</td><td>{v}</td></tr>)}
            </tbody>
          </table>
          <p className="muted small-note">One free camera: mouse, touch or keyboard. Production keeps running whatever you do with the view.</p>
        </section>
      )}
    </>
  );
}
