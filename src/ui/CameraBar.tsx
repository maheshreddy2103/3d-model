import { LIVE_CAMS } from '../scene/camera/cameraShared';
import { useUI, type BookmarkId } from '../state/uiStore';

/** Live-cam picker (eye-level views inside each area) and the controls help toggle. */
export function CameraBar() {
  const helpOpen = useUI((s) => s.helpOpen);
  const { bookmark, toggleHelp } = useUI.getState();
  return (
    <div className="group" role="group" aria-label="Camera">
      <select className="goto" aria-label="Live cams" value=""
        onChange={(e) => { if (e.target.value) bookmark(e.target.value as BookmarkId); e.target.blur(); }}>
        <option value="">● Live cams…</option>
        {LIVE_CAMS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button type="button" className={`btn help-btn ${helpOpen ? 'on' : ''}`} onClick={toggleHelp} aria-pressed={helpOpen} title="Camera controls">?</button>
    </div>
  );
}
