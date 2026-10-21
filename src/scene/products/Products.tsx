// Every motor in the factory, drawn with one InstancedMesh per component. Each product
// keeps a fixed instance slot, so instance N of every mesh is the same motor; clicking
// any pickable part maps the instance id back to the product.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MAX_PRODUCTS, type Product } from '../../sim/engine';
import { engine } from '../../sim/engineInstance';
import { simTime } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { buildParts, HX, HY, HZ, type PartDef } from './motorParts';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Motors spinning on a test bench. */
function running(p: Product) {
  return p.processing === 'qc_elec' || p.processing === 'qc_endurance';
}

export function Products() {
  const parts = useMemo(buildParts, []);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const slotToProduct = useRef<Int32Array>(new Int32Array(MAX_PRODUCTS).fill(-1));
  const select = useUI((s) => s.select);
  const focus = useUI((s) => s.focus);

  const scratch = useMemo(() => ({
    pose: { x: 0, y: 0, z: 0, yaw: 0 },
    base: new THREE.Matrix4(),
    local: new THREE.Matrix4(),
    out: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    e: new THREE.Euler(),
    v: new THREE.Vector3(),
    s: new THREE.Vector3(),
    spin: new THREE.Matrix4(),
    toAxis: new THREE.Matrix4(),
    fromAxis: new THREE.Matrix4(),
  }), []);

  // Pre-compose each part's local matrix (and its copies).
  const locals = useMemo(() => parts.map((part) => {
    const offsets = part.copies ?? [[0, 0, 0]];
    return offsets.map((o) => new THREE.Matrix4().compose(
      new THREE.Vector3(part.position[0] + o[0], part.position[1] + o[1], part.position[2] + o[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))),
      new THREE.Vector3(...(part.scale ?? [1, 1, 1])),
    ));
  }), [parts]);

  useFrame(() => {
    const { pose, base, out, spin, toAxis, fromAxis } = scratch;
    const products = engine.activeProducts();
    const used = slotToProduct.current;
    used.fill(-1);
    let maxSlot = 0;
    const angle = simTime() * 45;
    for (const p of products) {
      used[p.slot] = p.id;
      if (p.slot + 1 > maxSlot) maxSlot = p.slot + 1;
    }

    parts.forEach((_part, pi) => {
      const mesh = meshes.current[pi];
      if (!mesh) return;
      const copies = locals[pi];
      const count = maxSlot * copies.length;
      for (let i = 0; i < count; i++) mesh.setMatrixAt(i, ZERO);
      mesh.count = count;
    });

    for (const p of products) {
      engine.productPose(p, pose);
      base.makeRotationY(pose.yaw).setPosition(pose.x, pose.y, pose.z);
      const spinning = running(p);
      if (spinning) {
        // Rotate about the motor axis through the housing centre.
        toAxis.makeTranslation(-HX, -HY, -HZ);
        fromAxis.makeTranslation(HX, HY, HZ);
        spin.makeRotationX(angle).premultiply(fromAxis).multiply(toAxis);
      }
      parts.forEach((part, pi) => {
        const mesh = meshes.current[pi];
        if (!mesh) return;
        if (p.stage < part.from || p.stage >= part.to) return;
        if (part.onTrayOnly && p.loc !== 'line') return;
        const copies = locals[pi];
        copies.forEach((local, ci) => {
          out.copy(base);
          if (part.spins && spinning) out.multiply(spin);
          out.multiply(local);
          mesh.setMatrixAt(p.slot * copies.length + ci, out);
        });
      });
    }

    parts.forEach((part, pi) => {
      const mesh = meshes.current[pi];
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (part.pick) mesh.computeBoundingSphere();
    });
  });

  const productAt = (e: ThreeEvent<MouseEvent>, part: PartDef) => {
    const copies = part.copies?.length ?? 1;
    const slot = Math.floor((e.instanceId ?? -1) / copies);
    return slot >= 0 ? slotToProduct.current[slot] : -1;
  };

  return (
    <group>
      {parts.map((part, pi) => (
        <instancedMesh
          key={part.key}
          ref={(m) => { meshes.current[pi] = m; }}
          args={[part.geometry, part.material, MAX_PRODUCTS * (part.copies?.length ?? 1)]}
          castShadow
          receiveShadow
          frustumCulled={false}
          onClick={part.pick ? (e) => {
            if (e.delta > 4) return;
            const id = productAt(e, part);
            if (id < 0) return;
            e.stopPropagation();
            select({ type: 'product', id });
          } : undefined}
          onDoubleClick={part.pick ? (e) => {
            const id = productAt(e, part);
            if (id < 0) return;
            e.stopPropagation();
            select({ type: 'product', id });
            focus([e.point.x, e.point.y, e.point.z], 5);
          } : undefined}
        />
      ))}
    </group>
  );
}
