// Flow overlays: illuminated, moving route lines above the conveyors and forklift lanes,
// the highlighted path of a selected motor, and a marker that follows it.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type * as THREE from 'three';
import {
  BELT_Y, DIVERTER_S, DOCK_X, DOCKS, FORKLIFTS, LANES, MERGE_S, PALLET_SPOT, RACK_BAYS, RACK_ROW_Z,
} from '../../config/layout';
import { engine } from '../../sim/engineInstance';
import type { Vec2 } from '../../sim/path';
import { simTime } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { COLORS } from '../materials';

const ROUTE_Y = BELT_Y + 1.15;

function toPoints(pts: Vec2[], y: number): [number, number, number][] {
  return pts.map(([x, z]) => [x, y, z]);
}

export function Routes() {
  const show = useUI((s) => s.show.routes);
  return (
    <group>
      {show && <FlowLines />}
      <SelectedPath />
    </group>
  );
}

/** Dashed lines that crawl in the direction of flow (driven by simulated time). */
function FlowLines() {
  const lines = useMemo(() => [
    { pts: toPoints(LANES.main.points, ROUTE_Y), color: COLORS.route, width: 2.2 },
    { pts: toPoints(LANES.rework.points, ROUTE_Y), color: '#ff8a4a', width: 1.8 },
    { pts: toPoints(LANES.scrap.points, ROUTE_Y), color: COLORS.fail, width: 1.6 },
    ...FORKLIFTS.map((f) => ({ pts: toPoints(f.corridor, 0.25), color: '#f2c230', width: 1.4 })),
  ], []);
  const refs = useRef<({ material: { dashOffset: number } } | null)[]>([]);
  useFrame(() => {
    const offset = -simTime() * 1.2;
    for (const l of refs.current) if (l) l.material.dashOffset = offset;
  });
  return (
    <group>
      {lines.map((l, i) => (
        <Line
          key={i}
          ref={(r) => { refs.current[i] = r as unknown as { material: { dashOffset: number } } | null; }}
          points={l.pts}
          color={l.color}
          lineWidth={l.width}
          dashed
          dashSize={1.2}
          gapSize={0.8}
          transparent
          opacity={0.85}
          raycast={() => null}
        />
      ))}
    </group>
  );
}

/** Whole journey of the selected motor, from kit release to the dispatch dock. */
function SelectedPath() {
  const selection = useUI((s) => s.selection);
  useUI((s) => s.tick);
  const id = selection?.type === 'product' ? selection.id : null;
  const product = id !== null ? engine.product(id) : undefined;
  const marker = useRef<THREE.Group>(null);
  const pose = useMemo(() => ({ x: 0, y: 0, z: 0, yaw: 0 }), []);

  useFrame(({ clock }) => {
    if (!marker.current || !product) return;
    engine.productPose(product, pose);
    marker.current.visible = product.loc !== 'shipped';
    marker.current.position.set(pose.x, pose.y + 1.3 + Math.sin(clock.elapsedTime * 4) * 0.12, pose.z);
  });

  if (!product) return null;
  const main = LANES.main;
  const segments: Vec2[][] = [main.slice(0, DIVERTER_S)];
  if (product.visitedRework) {
    segments.push(LANES.rework.points);
    segments.push(main.slice(MERGE_S, DIVERTER_S));
  }
  if (product.reworkCount > 0 && product.loc === 'scrap') segments.push(LANES.scrap.points);
  else {
    segments.push(main.slice(DIVERTER_S, main.length));
    const x = RACK_BAYS[2];
    segments.push([PALLET_SPOT, [PALLET_SPOT[0], 24.5], [x, 24.5], [x, RACK_ROW_Z], [x, 18.2], [-52.8, 18.2], [-52.8, DOCKS.outbound.z], [DOCK_X - 6, DOCKS.outbound.z]]);
  }
  return (
    <group>
      {segments.map((seg, i) => (
        <Line key={i} points={toPoints(seg, ROUTE_Y + 0.05)} color={COLORS.highlight} lineWidth={4} transparent opacity={0.9} raycast={() => null} />
      ))}
      <group ref={marker}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.35, 0]}>
          <coneGeometry args={[0.28, 0.6, 16]} />
          <meshBasicMaterial color={COLORS.highlight} />
        </mesh>
      </group>
    </group>
  );
}
