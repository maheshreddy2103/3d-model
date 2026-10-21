// Live logistics: trucks, forklifts, pallets (with raw-material crates), the AGV tugger
// and walking staff. Positions come from the engine every frame; nothing here owns state.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AGV_LOOP } from '../../config/layout';
import { engine } from '../../sim/engineInstance';
import { Polyline, yawOf } from '../../sim/path';
import { simTime } from '../../sim/runtime';
import { G, M } from '../materials';
import { Agv, Forklift, Truck } from './vehicles';

export function Transport() {
  return (
    <group>
      <TruckView id="inbound" />
      <TruckView id="outbound" />
      {engine.forklifts.map((f, i) => <ForkliftView key={f.def.id} index={i} />)}
      <Pallets />
      <AgvView offset={0} />
      <AgvView offset={0.5} />
    </group>
  );
}

function TruckView({ id }: { id: 'inbound' | 'outbound' }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = engine.trucks[id];
    const g = ref.current;
    if (!g) return;
    g.visible = t.state !== 'away';
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.yaw;
  });
  return (
    <group ref={ref}>
      <Truck inbound={id === 'inbound'} />
    </group>
  );
}

function ForkliftView({ index }: { index: number }) {
  const body = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  useFrame(() => {
    const f = engine.forklifts[index];
    if (!f || !body.current) return;
    body.current.position.set(f.x, f.y, f.z);
    body.current.rotation.y = f.yaw;
    if (carriage.current) carriage.current.position.y = f.fork;
  });
  return (
    <group ref={body}>
      <Forklift ref={carriage} />
    </group>
  );
}

const MAX_PALLETS = 48;
const KIT_OFFSETS: [number, number][] = [[-0.38, -0.24], [0, -0.24], [0.38, -0.24], [-0.38, 0.24], [0, 0.24], [0.38, 0.24]];

/** Pallet bases plus the raw-material crates still on raw pallets. */
function Pallets() {
  const bases = useRef<THREE.InstancedMesh>(null);
  const crates = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame(() => {
    const b = bases.current;
    const c = crates.current;
    if (!b || !c) return;
    let nb = 0;
    let nc = 0;
    for (const pallet of engine.pallets) {
      if (nb >= MAX_PALLETS) break;
      const pose = engine.palletPose(pallet);
      tmp.q.setFromAxisAngle(tmp.up, pose.yaw);
      tmp.m.compose(tmp.p.set(pose.x, pose.y + 0.07, pose.z), tmp.q, tmp.s.set(1.2, 0.14, 1.0));
      b.setMatrixAt(nb++, tmp.m);
      if (pallet.kind !== 'raw') continue;
      const cos = Math.cos(pose.yaw);
      const sin = Math.sin(pose.yaw);
      for (let i = 0; i < pallet.kits && i < KIT_OFFSETS.length; i++) {
        const [lx, lz] = KIT_OFFSETS[i];
        tmp.m.compose(
          tmp.p.set(pose.x + lx * cos + lz * sin, pose.y + 0.14 + 0.2, pose.z - lx * sin + lz * cos),
          tmp.q, tmp.s.set(0.34, 0.4, 0.42),
        );
        c.setMatrixAt(nc++, tmp.m);
      }
    }
    b.count = nb;
    c.count = nc;
    b.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bases} args={[G.box, M.wood, MAX_PALLETS]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={crates} args={[G.box, M.casting, MAX_PALLETS * KIT_OFFSETS.length]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}

/** Milk-run tugger train (1.1 m/s); `offset` spaces the trains around the loop (0..1). */
function AgvView({ offset }: { offset: number }) {
  const loop = useMemo(() => new Polyline(AGV_LOOP), []);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = loop.at((simTime() * 1.1 + offset * loop.length) % loop.length);
    if (!ref.current) return;
    ref.current.position.set(p.x, 0, p.z);
    ref.current.rotation.y = yawOf(p.dx, p.dz);
  });
  return (
    <group ref={ref}>
      <Agv />
    </group>
  );
}
