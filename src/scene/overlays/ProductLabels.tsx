// Optional serial-number tags over motors. Shown when zoomed in, so the overview stays clean.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { engine } from '../../sim/engineInstance';
import { STAGE_NAMES } from '../../sim/describe';
import { useUI } from '../../state/uiStore';

const MAX_LABELS = 90;

export function ProductLabels() {
  const show = useUI((s) => s.show.productLabels);
  const tier = useUI((s) => s.zoomTier);
  useUI((s) => s.tick);
  if (!show || tier === 0) return null;
  const products = engine.activeProducts().filter((p) => p.loc === 'line' || p.loc === 'pallet').slice(0, MAX_LABELS);
  return (
    <group>
      {products.map((p) => <ProductTag key={p.id} id={p.id} serial={p.serial} stage={p.stage} failed={p.failed} detailed={tier === 2} />)}
    </group>
  );
}

function ProductTag({ id, serial, stage, failed, detailed }: { id: number; serial: string; stage: number; failed: boolean; detailed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pose = useRef({ x: 0, y: 0, z: 0, yaw: 0 });
  useFrame(() => {
    const p = engine.product(id);
    if (!p || !ref.current) return;
    engine.productPose(p, pose.current);
    ref.current.position.set(pose.current.x, pose.current.y + 0.9, pose.current.z);
  });
  return (
    <group ref={ref}>
      <Html center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`label product-label ${failed ? 'failed' : ''}`}>
          {serial}
          {detailed && <span className="product-stage">{STAGE_NAMES[stage]}</span>}
        </div>
      </Html>
    </group>
  );
}
