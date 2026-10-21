// Camera data shared outside React: the live pose (minimap, live badge) and the live cams.

import type { BookmarkId } from '../../state/uiStore';

/** Updated every frame by the camera rig. `tx, tz` is the point the camera orbits / looks at. */
export const camState = { x: 0, y: 0, z: 0, yaw: 0, tx: 0, tz: 0 };

export interface LiveCam {
  id: BookmarkId;
  label: string;
  /** Eye-level camera position and the point it looks at. */
  pos: [number, number, number];
  target: [number, number, number];
}

/** Eye-level viewpoints inside each area, like fixed cameras on the shop floor. */
export const LIVE_CAMS: LiveCam[] = [
  { id: 'receiving', label: 'Receiving dock', pos: [-36, 2.8, -5], target: [-46, 1.2, -15] },
  { id: 'machining', label: 'Machining line', pos: [-2, 3.4, -2.2], target: [-14, 1.2, -13] },
  { id: 'assembly', label: 'Assembly line', pos: [33, 2.4, -4], target: [24, 1.2, -12] },
  { id: 'quality', label: 'Test cells', pos: [37, 4.8, 25], target: [24, 0.8, 15] },
  { id: 'packaging', label: 'Packing & palletising', pos: [-3, 2.8, 9], target: [-13, 1.2, 16] },
  { id: 'dispatch', label: 'Dispatch dock', pos: [-38, 3.2, 15.5], target: [-53, 1.2, 12] },
];

// Development builds expose the live pose for automated camera tests.
if (import.meta.env.DEV) (window as unknown as { __camState: typeof camState }).__camState = camState;

/** Held on-screen walk-pad buttons: forward (+1 / -1) and turn (+1 left / -1 right). */
export const navInput = { forward: 0, turn: 0 };
