// A factory worker in PPE, drawn slightly larger than life (×1.12) so people stay readable
// from the overview. Role shows in the clothing: operators in orange hi-vis vests,
// technicians in blue coveralls, quality staff in white coats. Arms have shoulders and elbows,
// so working poses read as real tasks: working at a bench, reaching to the belt, holding a
// part up to inspect it. Working workers move in time with their station's cycle; walkers
// swing their legs. All motion follows simulated time.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { StationId } from '../../config/layout';
import { simTime, stationAnim } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { G, M } from '../materials';
import { Box, Cyl } from '../primitives';

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

const SCALE = 1.12;

interface Pose { ls: number; le: number; rs: number; re: number; lean: number; nod: number }

function workPose(task: 'bench' | 'reach' | 'inspect', t: number, busy: boolean): Pose {
  if (!busy) {
    const b = 0.05 * Math.sin(t * 0.8);
    return { ls: 0.1 + b, le: 0.25, rs: 0.1 - b, re: 0.25, lean: 0, nod: 0 };
  }
  if (task === 'bench') {
    // Both hands down on the work, alternating: fitting, fastening.
    const w = t * 3.2;
    return { ls: 0.55 + 0.2 * Math.sin(w), le: 1.05 + 0.25 * Math.sin(w + 1), rs: 0.6 + 0.2 * Math.sin(w + 2.1), re: 1.0 + 0.25 * Math.sin(w + 3), lean: -0.18, nod: -0.25 };
  }
  if (task === 'reach') {
    // Reach out to the belt, draw back to the body: loading and unloading.
    const k = 0.5 + 0.5 * Math.sin(t * 1.9);
    return { ls: 0.5 + 0.85 * k, le: 0.9 - 0.7 * k, rs: 0.45 + 0.8 * k, re: 0.95 - 0.7 * k, lean: -0.08 - 0.15 * k, nod: -0.15 };
  }
  // Inspect: one hand holds the part up, the other turns it; head follows.
  const w = t * 1.4;
  return { ls: 0.75, le: 1.35, rs: 0.65 + 0.15 * Math.sin(w), re: 1.25 + 0.2 * Math.sin(w * 1.3), lean: -0.05, nod: -0.3 + 0.08 * Math.sin(w * 0.7) };
}

export const Worker = forwardRef<WorkerHandle, WorkerProps>(function Worker(
  { position = [0, 0, 0], yaw = 0, outfit = 'vest', station, task = 'bench', walking = false, phase = 0 }, ref,
) {
  const visible = useUI((s) => s.show.workers);
  const lShoulder = useRef<THREE.Group>(null);
  const rShoulder = useRef<THREE.Group>(null);
  const lElbow = useRef<THREE.Group>(null);
  const rElbow = useRef<THREE.Group>(null);
  const lHip = useRef<THREE.Group>(null);
  const rHip = useRef<THREE.Group>(null);
  const lKnee = useRef<THREE.Group>(null);
  const rKnee = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const walkDist = useRef(0);

  useImperativeHandle(ref, () => ({ setWalk: (d: number) => { walkDist.current = d; } }), []);

  useFrame(() => {
    let p: Pose;
    let legL = 0;
    let legR = 0;
    let kneeL = 0;
    let kneeR = 0;
    if (walking) {
      const a = walkDist.current * 3.0;
      const swing = Math.sin(a) * 0.45;
      legL = swing;
      legR = -swing;
      kneeL = Math.max(0, -Math.cos(a)) * 0.6;
      kneeR = Math.max(0, Math.cos(a)) * 0.6;
      // Hands on the trolley handle (walkers push a trolley), with a little bob.
      p = { ls: 0.75, le: 0.55, rs: 0.75, re: 0.55, lean: -0.08, nod: 0 };
      if (body.current) body.current.position.y = 0.9 + Math.abs(Math.sin(a)) * 0.025;
    } else {
      const busy = station ? stationAnim(station).busy : true;
      p = workPose(task, simTime() + phase, busy);
    }
    if (lShoulder.current) lShoulder.current.rotation.z = p.ls;
    if (rShoulder.current) rShoulder.current.rotation.z = p.rs;
    if (lElbow.current) lElbow.current.rotation.z = p.le;
    if (rElbow.current) rElbow.current.rotation.z = p.re;
    if (body.current) body.current.rotation.z = p.lean;
    if (head.current) head.current.rotation.z = p.nod;
    if (lHip.current) lHip.current.rotation.z = legL;
    if (rHip.current) rHip.current.rotation.z = legR;
    if (lKnee.current) lKnee.current.rotation.z = -kneeL;
    if (rKnee.current) rKnee.current.rotation.z = -kneeR;
  });

  if (!visible) return null;

  const trousers = outfit === 'lab' ? M.coverall : outfit === 'coverall' ? M.vestBlue : M.coverall;
  const shirt = outfit === 'lab' ? M.helmetWhite : outfit === 'coverall' ? M.vestBlue : M.shirt;
  const vest = outfit === 'vest' ? M.vest : null;
  const helmet = outfit === 'lab' ? M.helmetWhite : outfit === 'coverall' ? M.helmetBlue : M.helmet;
  const glove = outfit === 'lab' ? M.gloveBlue : M.black;

  const arm = (side: 1 | -1, shoulder: React.RefObject<THREE.Group>, elbow: React.RefObject<THREE.Group>) => (
    <group ref={shoulder} position={[0, 0.5, side * 0.235]}>
      <mesh geometry={G.sphere} material={shirt} scale={0.075} castShadow />
      <Cyl size={[0.058, 0.3, 0.058]} position={[0, -0.15, 0]} mat={shirt} low />
      <group ref={elbow} position={[0, -0.3, 0]}>
        <mesh geometry={G.sphere} material={shirt} scale={0.055} />
        <Cyl size={[0.05, 0.27, 0.05]} position={[0, -0.135, 0]} mat={outfit === 'lab' ? M.helmetWhite : shirt} low />
        <mesh geometry={G.sphere} material={glove} scale={[0.055, 0.07, 0.045]} position={[0, -0.3, 0]} castShadow />
      </group>
    </group>
  );

  const leg = (side: 1 | -1, hip: React.RefObject<THREE.Group>, knee: React.RefObject<THREE.Group>) => (
    <group ref={hip} position={[0, 0.9, side * 0.1]}>
      <Cyl size={[0.075, 0.44, 0.075]} position={[0, -0.22, 0]} mat={trousers} low />
      <group ref={knee} position={[0, -0.44, 0]}>
        <Cyl size={[0.065, 0.4, 0.065]} position={[0, -0.2, 0]} mat={trousers} low />
        <Box size={[0.27, 0.09, 0.13]} position={[0.05, -0.42, 0]} mat={M.boot} />
      </group>
    </group>
  );

  // Local frame: the worker faces +x.
  return (
    <group position={position} rotation={[0, yaw, 0]} scale={SCALE}>
      {leg(1, lHip, lKnee)}
      {leg(-1, rHip, rKnee)}
      <group ref={body} position={[0, 0.9, 0]}>
        {/* Hips, torso (tapered with a chest box over the waist), belt. */}
        <Box size={[0.2, 0.16, 0.34]} position={[0, 0.06, 0]} mat={trousers} />
        <Box size={[0.2, 0.06, 0.35]} position={[0, 0.15, 0]} mat={M.black} />
        <Box size={[0.21, 0.24, 0.36]} position={[0, 0.29, 0]} mat={shirt} />
        <Box size={[0.24, 0.24, 0.44]} position={[0, 0.48, 0]} mat={shirt} />
        {vest && (
          <>
            <Box size={[0.25, 0.4, 0.45]} position={[0, 0.38, 0]} mat={vest} />
            <Box size={[0.255, 0.035, 0.455]} position={[0, 0.3, 0]} mat={M.vestStripe} />
            <Box size={[0.255, 0.035, 0.455]} position={[0, 0.44, 0]} mat={M.vestStripe} />
          </>
        )}
        {outfit === 'lab' && <Box size={[0.25, 0.42, 0.4]} position={[0, 0.2, 0]} mat={M.helmetWhite} />}
        {/* Neck, head with face toward +x, hard hat with brim. */}
        <Cyl size={[0.045, 0.08, 0.045]} position={[0, 0.63, 0]} mat={M.skin} low />
        <group ref={head} position={[0, 0.66, 0]}>
          <mesh geometry={G.sphere} material={M.skin} scale={[0.1, 0.12, 0.095]} position={[0.01, 0.1, 0]} castShadow />
          <Box size={[0.03, 0.03, 0.12]} position={[0.1, 0.12, 0]} mat={M.black} />
          <mesh geometry={G.sphere} material={helmet} scale={[0.125, 0.09, 0.115]} position={[0, 0.19, 0]} castShadow />
          <Cyl size={[0.15, 0.015, 0.14]} position={[0.02, 0.17, 0]} mat={helmet} low />
        </group>
        {arm(1, lShoulder, lElbow)}
        {arm(-1, rShoulder, rElbow)}
      </group>
    </group>
  );
});
