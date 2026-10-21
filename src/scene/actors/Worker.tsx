// A 1.75 m factory worker in PPE. Working workers move their arms in time with their
// station's cycle; walkers swing their legs. All motion follows simulated time.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { StationId } from '../../config/layout';
import { simTime, stationAnim } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { M } from '../materials';
import { Box } from '../primitives';
import { G } from '../materials';

export type Outfit = 'vest' | 'coverall' | 'lab';

export interface WorkerHandle {
  /** Walk-cycle phase in metres walked; drives leg swing. */
  setWalk: (distance: number) => void;
}

interface WorkerProps {
  position?: [number, number, number];
  yaw?: number;
  outfit?: Outfit;
  /** Station whose cycle drives the arm motion. */
  station?: StationId;
  /** Arm reach style while working. */
  task?: 'bench' | 'reach' | 'inspect';
  walking?: boolean;
  /** Offset so neighbouring workers do not move in lockstep. */
  phase?: number;
}

export const Worker = forwardRef<WorkerHandle, WorkerProps>(function Worker(
  { position = [0, 0, 0], yaw = 0, outfit = 'vest', station, task = 'bench', walking = false, phase = 0 }, ref,
) {
  const visible = useUI((s) => s.show.workers);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const walkDist = useRef(0);

  useImperativeHandle(ref, () => ({ setWalk: (d: number) => { walkDist.current = d; } }), []);

  useFrame(() => {
    const t = simTime() + phase;
    if (walking) {
      const swing = Math.sin(walkDist.current * 3.2) * 0.5;
      if (leftLeg.current) leftLeg.current.rotation.z = swing;
      if (rightLeg.current) rightLeg.current.rotation.z = -swing;
      if (leftArm.current) leftArm.current.rotation.z = -swing * 0.8;
      if (rightArm.current) rightArm.current.rotation.z = swing * 0.8;
      return;
    }
    const busy = station ? stationAnim(station).busy : true;
    let l = 0.08 * Math.sin(t * 0.8);
    let r = l;
    if (busy) {
      const w = t * (task === 'inspect' ? 1.6 : 3.4);
      if (task === 'bench') { l = 0.9 + 0.35 * Math.sin(w); r = 0.9 + 0.35 * Math.sin(w + 2.1); }
      if (task === 'reach') { l = 1.2 + 0.5 * Math.sin(w); r = 0.5 + 0.3 * Math.sin(w * 0.5); }
      if (task === 'inspect') { l = 0.3; r = 1.1 + 0.25 * Math.sin(w); }
    }
    if (leftArm.current) leftArm.current.rotation.z = l;
    if (rightArm.current) rightArm.current.rotation.z = r;
    if (body.current) body.current.rotation.z = busy ? -0.12 - 0.04 * Math.sin(t * 1.3) : 0;
  });

  if (!visible) return null;

  const torso = outfit === 'coverall' ? M.coverall : outfit === 'lab' ? M.helmetWhite : M.coverall;
  const vest = outfit === 'vest' ? M.vest : outfit === 'lab' ? M.helmetWhite : M.vestBlue;
  const helmet = outfit === 'lab' ? M.helmetWhite : M.helmet;

  // Local frame: the worker faces +x.
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group ref={leftLeg} position={[0, 0.88, 0.1]}>
        <Box size={[0.16, 0.86, 0.15]} position={[0, -0.44, 0]} mat={M.coverall} />
        <Box size={[0.26, 0.08, 0.15]} position={[0.05, -0.86, 0]} mat={M.black} />
      </group>
      <group ref={rightLeg} position={[0, 0.88, -0.1]}>
        <Box size={[0.16, 0.86, 0.15]} position={[0, -0.44, 0]} mat={M.coverall} />
        <Box size={[0.26, 0.08, 0.15]} position={[0.05, -0.86, 0]} mat={M.black} />
      </group>
      <group ref={body} position={[0, 0.88, 0]}>
        <Box size={[0.24, 0.6, 0.42]} position={[0, 0.32, 0]} mat={torso} />
        <Box size={[0.26, 0.42, 0.44]} position={[0, 0.38, 0]} mat={vest} />
        <mesh geometry={G.sphere} material={M.skin} scale={0.12} position={[0.02, 0.78, 0]} castShadow />
        <mesh geometry={G.sphere} material={helmet} scale={[0.14, 0.09, 0.14]} position={[0.02, 0.85, 0]} castShadow />
        <group ref={leftArm} position={[0, 0.56, 0.27]}>
          <Box size={[0.12, 0.58, 0.12]} position={[0, -0.27, 0]} mat={torso} />
          <Box size={[0.1, 0.1, 0.1]} position={[0, -0.58, 0]} mat={M.black} />
        </group>
        <group ref={rightArm} position={[0, 0.56, -0.27]}>
          <Box size={[0.12, 0.58, 0.12]} position={[0, -0.27, 0]} mat={torso} />
          <Box size={[0.1, 0.1, 0.1]} position={[0, -0.58, 0]} mat={M.black} />
        </group>
      </group>
    </group>
  );
});
