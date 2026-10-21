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
  ['Left-drag', 'Rotate the factory. Inside, it turns your head to look around.'],
  ['Right-drag / middle-drag', 'Slide across the floor. Inside, it moves you sideways and forward.'],
  ['Wheel up', 'Zoom in toward the pointer. Once inside, it keeps walking you forward toward where you point.'],
  ['Wheel down', 'Zoom back out, all the way to the whole miniature.'],
  ['▲ ▼ ◀ ▶ (inside)', 'Hold to walk forward / back or turn left / right.'],
  ['Click', 'Select a station or motor'],
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
          ? 'Wheel up walks toward the pointer · wheel down zooms out · drag to look around · right-drag to step aside · hold the arrows to walk'
          : 'Drag to rotate · right-drag to move · wheel to zoom — keep zooming in to stand inside · double-click a machine to go close'}</span>
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
          <p className="muted small-note">One camera, mouse only. Production keeps running whatever you do with the view.</p>
        </section>
      )}
    </>
  );
}
