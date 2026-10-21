// UI state: playback, selection, visibility toggles and camera requests.
// Simulation state lives in the engine, not here, so the 3D loop never triggers React renders.

import { create } from 'zustand';
import type { StationId } from '../config/layout';

export type Selection =
  | { type: 'station'; id: StationId }
  | { type: 'product'; id: number }
  | null;

export interface Visibility {
  workers: boolean;
  machineLabels: boolean;
  productLabels: boolean;
  routes: boolean;
  quality: boolean;
  metrics: boolean;
}

export type BookmarkId = 'receiving' | 'machining' | 'assembly' | 'quality' | 'packaging' | 'dispatch';

export type CameraRequest =
  | { kind: 'overview'; nonce: number }
  | { kind: 'focus'; center: [number, number, number]; radius: number; nonce: number }
  | { kind: 'bookmark'; id: BookmarkId; nonce: number }
  | { kind: 'goto'; x: number; z: number; quick?: boolean; nonce: number };

interface UIState {
  playing: boolean;
  speed: number;
  selection: Selection;
  show: Visibility;
  camera: CameraRequest;
  helpOpen: boolean;
  /** 0 = whole factory, 1 = area, 2 = close-up / on the floor. Drives label detail. */
  zoomTier: 0 | 1 | 2;
  /** Bumped a few times a second so panels re-read the engine. */
  tick: number;
  /** Bumped on reset so views drop stale references. */
  resetCount: number;

  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  select: (selection: Selection) => void;
  toggle: (key: keyof Visibility) => void;
  overview: () => void;
  focus: (center: [number, number, number], radius: number) => void;
  bookmark: (id: BookmarkId) => void;
  /** Move the orbit point to (x, z). `quick` follows a minimap drag instead of gliding. */
  goto: (x: number, z: number, quick?: boolean) => void;
  toggleHelp: () => void;
  setZoomTier: (tier: 0 | 1 | 2) => void;
  bumpTick: () => void;
  markReset: () => void;
}

export const useUI = create<UIState>((set) => ({
  playing: true,
  speed: 1,
  selection: null,
  show: { workers: true, machineLabels: true, productLabels: false, routes: true, quality: true, metrics: true },
  camera: { kind: 'overview', nonce: 0 },
  helpOpen: false,
  zoomTier: 0,
  tick: 0,
  resetCount: 0,

  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  select: (selection) => set({ selection }),
  toggle: (key) => set((s) => ({ show: { ...s.show, [key]: !s.show[key] } })),
  overview: () => set((s) => ({ camera: { kind: 'overview', nonce: s.camera.nonce + 1 } })),
  focus: (center, radius) => set((s) => ({ camera: { kind: 'focus', center, radius, nonce: s.camera.nonce + 1 } })),
  bookmark: (id) => set((s) => ({ camera: { kind: 'bookmark', id, nonce: s.camera.nonce + 1 } })),
  goto: (x, z, quick) => set((s) => ({ camera: { kind: 'goto', x, z, quick, nonce: s.camera.nonce + 1 } })),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setZoomTier: (zoomTier) => set({ zoomTier }),
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
  markReset: () => set((s) => ({ resetCount: s.resetCount + 1, selection: null })),
}));
