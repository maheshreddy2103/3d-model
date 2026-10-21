// Floating labels. Zone names show at overview distance; station names appear when you
// zoom into an area, and live details (operation, count, status) at close range.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ZONES, type StationDef } from '../../config/layout';
import { stationInfo } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { COLORS } from '../materials';

/** Down on the floor, only labels within this distance are shown. */
const NEAR_LABEL_DISTANCE = 40;
/** Below this camera height you are "inside" and far labels would crowd the view. */
const INSIDE_HEIGHT = 12;

/** Hides an Html label's element when you are inside and it is far away, or (zones) when you are low. */
function useLabelCulling(maxDistance: number, minCameraHeight = 0) {
  const anchor = useRef<THREE.Group>(null);
  const element = useRef<HTMLDivElement>(null);
  const world = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!anchor.current || !element.current) return;
    anchor.current.getWorldPosition(world.current);
    const inside = camera.position.y < INSIDE_HEIGHT;
    const far = inside && camera.position.distanceTo(world.current) > maxDistance;
    const low = camera.position.y < minCameraHeight;
    element.current.style.display = far || low ? 'none' : '';
  });
  return { anchor, element };
}

export function StationLabel({ def, height, offsetZ }: { def: StationDef; height: number; offsetZ: number }) {
  const show = useUI((s) => s.show.machineLabels);
  const tier = useUI((s) => s.zoomTier);
  const { anchor, element } = useLabelCulling(NEAR_LABEL_DISTANCE);
  useUI((s) => s.tick);
  if (!show || tier === 0) return null;
  const info = stationInfo(def.id);
  const color = info.status === 'idle' ? COLORS.idle : COLORS[info.status];
  return (
    <group ref={anchor} position={[0, height, offsetZ]}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={element} className={`label station-label tier-${tier}`}>
          <div className="label-title">
            <span className="dot" style={{ background: color }} />
            {def.name}
          </div>
          {tier === 2 && (
            <div className="label-detail">
              <div>{def.operation}</div>
              <div>{info.processed} processed · {info.busy ? 'running' : 'waiting'}</div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function ZoneLabel({ position, code, name, small }: { position: [number, number, number]; code: string; name: string; small: boolean }) {
  const { anchor, element } = useLabelCulling(Infinity, 14);
  return (
    <group ref={anchor} position={position}>
      <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={element} className={`label zone-label ${small ? 'small' : ''}`}>
          <span className="zone-code">{code}</span>
          {name}
        </div>
      </Html>
    </group>
  );
}

export function ZoneLabels() {
  const tier = useUI((s) => s.zoomTier);
  const show = useUI((s) => s.show.machineLabels);
  if (!show) return null;
  return (
    <group>
      {ZONES.map((z) => {
        const [x1, z1, x2] = z.rect;
        return <ZoneLabel key={z.id} position={[(x1 + x2) / 2, 0.2, z1 + 1.6]} code={z.code} name={z.name} small={tier > 0} />;
      })}
    </group>
  );
}
