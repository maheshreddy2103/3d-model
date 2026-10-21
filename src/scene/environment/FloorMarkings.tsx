// Painted floor: zone tints and borders, the central aisle, forklift lanes,
// pallet bays, pedestrian crossings and the hatched reject area.

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  BUILDING, FORKLIFTS, INFEED_SLOTS, PALLET_SPOT, RACK_BAYS, RACK_ROW_Z, REJECT_CAGE, ZONES, type Zone,
} from '../../config/layout';
import type { Vec2 } from '../../sim/path';
import { M } from '../materials';
import { FloorMark } from '../primitives';

const LINE = 0.12;

export function FloorMarkings() {
  return (
    <group>
      {ZONES.map((z) => <ZoneFloor key={z.id} zone={z} />)}
      <Aisle />
      {FORKLIFTS.map((f) => <DashedPath key={f.id} points={f.corridor} />)}
      {INFEED_SLOTS.map((p) => <Bay key={p.join()} at={p} />)}
      <Bay at={PALLET_SPOT} />
      {RACK_BAYS.map((x) => <Bay key={x} at={[x, RACK_ROW_Z]} />)}
      <RejectArea />
    </group>
  );
}

function ZoneFloor({ zone }: { zone: Zone }) {
  const tint = useMemo(
    () => new THREE.MeshStandardMaterial({ color: zone.tint, transparent: true, opacity: 0.16, roughness: 0.8, depthWrite: false }),
    [zone.tint],
  );
  const [x1, z1, x2, z2] = zone.rect;
  const inset = 0.4;
  const w = x2 - x1 - inset * 2;
  const d = z2 - z1 - inset * 2;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  return (
    <group>
      <FloorMark size={[x2 - x1, z2 - z1]} position={[cx, cz]} mat={tint} y={0.006} />
      <FloorMark size={[w, LINE]} position={[cx, z1 + inset]} mat={M.safety} />
      <FloorMark size={[w, LINE]} position={[cx, z2 - inset]} mat={M.safety} />
      <FloorMark size={[LINE, d]} position={[x1 + inset, cz]} mat={M.safety} />
      <FloorMark size={[LINE, d]} position={[x2 - inset, cz]} mat={M.safety} />
    </group>
  );
}

/** Central east–west aisle with edge lines, direction arrows and zebra crossings. */
function Aisle() {
  const { minX, maxX } = BUILDING;
  const arrows = useMemo(() => Array.from({ length: 12 }, (_, i) => -48 + i * 8), []);
  return (
    <group>
      {[-1.8, 1.8].map((z) => (
        <group key={z}>
          <FloorMark size={[47 - minX, 0.15]} position={[(minX + 47) / 2, z]} mat={M.safety} />
          <FloorMark size={[maxX - 49, 0.15]} position={[(49 + maxX) / 2, z]} mat={M.safety} />
        </group>
      ))}
      {arrows.map((x) => (
        <group key={x}>
          <FloorMark size={[1.2, 0.18]} position={[x, -0.9]} mat={M.safetyWhite} />
          <FloorMark size={[0.5, 0.18]} position={[x + 0.45, -0.75]} mat={M.safetyWhite} rotation={0.6} />
          <FloorMark size={[1.2, 0.18]} position={[x, 0.9]} mat={M.safetyWhite} />
          <FloorMark size={[0.5, 0.18]} position={[x - 0.45, 1.05]} mat={M.safetyWhite} rotation={0.6} />
        </group>
      ))}
      {[-20, 20].map((x) => (
        <group key={x}>
          {Array.from({ length: 6 }, (_, i) => (
            <FloorMark key={i} size={[3, 0.35]} position={[x, -1.4 + i * 0.56]} mat={M.safetyWhite} />
          ))}
        </group>
      ))}
    </group>
  );
}

/** Dashed centre line along a forklift corridor. */
function DashedPath({ points }: { points: Vec2[] }) {
  const dashes = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      for (let t = 0.5; t < len; t += 2) {
        const l = Math.min(1, len - t);
        out.push({ x: ax + dx * (t + l / 2), z: az + dz * (t + l / 2), len: l, rot: Math.atan2(-dz, dx) });
      }
    }
    return out;
  }, [points]);
  return (
    <group>
      {dashes.map((d, i) => (
        <FloorMark key={i} size={[d.len, 0.12]} position={[d.x, d.z]} mat={M.safetyWhite} rotation={d.rot} />
      ))}
    </group>
  );
}

/** White outline of a pallet bay. */
function Bay({ at }: { at: Vec2 }) {
  const [x, z] = at;
  const s = 1.5;
  return (
    <group>
      <FloorMark size={[s, 0.08]} position={[x, z - s / 2]} mat={M.safetyWhite} />
      <FloorMark size={[s, 0.08]} position={[x, z + s / 2]} mat={M.safetyWhite} />
      <FloorMark size={[0.08, s]} position={[x - s / 2, z]} mat={M.safetyWhite} />
      <FloorMark size={[0.08, s]} position={[x + s / 2, z]} mat={M.safetyWhite} />
    </group>
  );
}

function RejectArea() {
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9473f', transparent: true, opacity: 0.35, depthWrite: false }), []);
  const [x0, z0, x1, z1] = REJECT_CAGE;
  return <FloorMark size={[x1 - x0, z1 - z0]} position={[(x0 + x1) / 2, (z0 + z1) / 2]} mat={red} y={0.009} />;
}
