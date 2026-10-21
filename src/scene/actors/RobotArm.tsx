// Six-axis-style industrial robot. A "program" is a list of keyframes over the station's
// cycle (0..1); each keyframe names a turret yaw and a gripper target (reach r, height y)
// and the arm solves its shoulder and elbow angles with two-link inverse kinematics.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { StationId } from '../../config/layout';
import { smoothstep, stationAnim } from '../../sim/runtime';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';

export interface RobotKey {
  /** Position in the cycle, 0..1. */
  t: number;
  yaw: number;
  /** Horizontal reach of the gripper tip from the turret axis (m, before scaling). */
  r: number;
  /** Height of the gripper tip above the floor (m, before scaling). */
  y: number;
  /** Holding a part. */
  grip: boolean;
}

const L1 = 1.0;
const L2 = 0.95;
const SHOULDER_Y = 0.75;
const TOOL = 0.3;

export const HOME = { yaw: 0, r: 0.85, y: 1.55 };

function solve(r: number, y: number) {
  const dy = y + TOOL - SHOULDER_Y;
  const d = Math.min(L1 + L2 - 0.02, Math.max(0.2, Math.hypot(r, dy)));
  const cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const elbow = -Math.acos(Math.max(-1, Math.min(1, cos2)));
  const shoulder = Math.atan2(dy, r) + Math.atan2(L2 * Math.sin(-elbow), L1 + L2 * Math.cos(elbow));
  return { shoulder, elbow };
}

function poseAt(keys: RobotKey[], p: number) {
  if (p <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (p <= b.t) {
      const k = smoothstep((p - a.t) / Math.max(1e-6, b.t - a.t));
      return { t: p, yaw: a.yaw + (b.yaw - a.yaw) * k, r: a.r + (b.r - a.r) * k, y: a.y + (b.y - a.y) * k, grip: a.grip };
    }
  }
  return keys[keys.length - 1];
}

/**
 * Machine-tending program: take the part from the belt, load the machine, wait while it
 * cuts, unload it and put it back on the belt. `beltYaw` / `machineYaw` point at each target.
 */
export function tendingProgram(beltYaw: number, machineYaw: number, beltR: number, machineR: number, machineY = 1.25): RobotKey[] {
  const home = { ...HOME, grip: false };
  return [
    { t: 0, ...home, yaw: beltYaw },
    { t: 0.08, yaw: beltYaw, r: beltR, y: 1.2, grip: false },
    { t: 0.12, yaw: beltYaw, r: beltR, y: 1.2, grip: true },
    { t: 0.24, yaw: machineYaw, r: machineR, y: machineY, grip: true },
    { t: 0.28, yaw: machineYaw, r: machineR, y: machineY, grip: false },
    { t: 0.36, ...home, yaw: machineYaw },
    { t: 0.7, ...home, yaw: machineYaw },
    { t: 0.76, yaw: machineYaw, r: machineR, y: machineY, grip: false },
    { t: 0.8, yaw: machineYaw, r: machineR, y: machineY, grip: true },
    { t: 0.92, yaw: beltYaw, r: beltR, y: 1.2, grip: true },
    { t: 0.96, yaw: beltYaw, r: beltR, y: 1.2, grip: false },
    { t: 1, ...home, yaw: beltYaw },
  ];
}

/** Assembly program: pick a component from the fixture table and fit it to the motor on the belt. */
export function assemblyProgram(tableYaw: number, beltYaw: number, tableR: number, beltR: number): RobotKey[] {
  const home = { ...HOME, grip: false };
  return [
    { t: 0, ...home, yaw: tableYaw },
    { t: 0.15, yaw: tableYaw, r: tableR, y: 1.05, grip: false },
    { t: 0.22, yaw: tableYaw, r: tableR, y: 1.05, grip: true },
    { t: 0.42, yaw: beltYaw, r: beltR, y: 1.45, grip: true },
    { t: 0.6, yaw: beltYaw, r: beltR, y: 1.25, grip: true },
    { t: 0.7, yaw: beltYaw, r: beltR, y: 1.25, grip: false },
    { t: 0.85, ...home, yaw: beltYaw },
    { t: 1, ...home, yaw: tableYaw },
  ];
}

/**
 * Palletising program matched to the engine's carton transfer: reach the belt, grip at 0.4,
 * carry to the pallet by 0.85 while the carton moves with the gripper, release and return.
 */
export function palletProgram(beltYaw: number, palletYaw: number, beltR: number, palletR: number, beltY: number, palletY: number): RobotKey[] {
  const home = { ...HOME, grip: false };
  return [
    { t: 0, ...home, yaw: beltYaw },
    { t: 0.32, yaw: beltYaw, r: beltR, y: beltY + 0.3, grip: false },
    { t: 0.4, yaw: beltYaw, r: beltR, y: beltY, grip: true },
    { t: 0.5, yaw: beltYaw, r: beltR, y: beltY + 0.5, grip: true },
    { t: 0.78, yaw: palletYaw, r: palletR, y: palletY + 0.4, grip: true },
    { t: 0.85, yaw: palletYaw, r: palletR, y: palletY, grip: false },
    { t: 1, ...home, yaw: palletYaw },
  ];
}

export function RobotArm({ station, program, position, scale = 1, idleYaw = 0, showPart = true }: {
  station: StationId;
  program: RobotKey[];
  position: [number, number, number];
  scale?: number;
  idleYaw?: number;
  /** Show a generic part in the gripper while holding (off when the real product is carried). */
  showPart?: boolean;
}) {
  const turret = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const fore = useRef<THREE.Group>(null);
  const wrist = useRef<THREE.Group>(null);
  const part = useRef<THREE.Group>(null);

  useFrame(() => {
    const anim = stationAnim(station);
    const pose = anim.busy ? poseAt(program, anim.progress) : { ...HOME, yaw: idleYaw, grip: false };
    const { shoulder, elbow } = solve(pose.r, pose.y);
    if (turret.current) turret.current.rotation.y = pose.yaw;
    if (upper.current) upper.current.rotation.z = shoulder;
    if (fore.current) fore.current.rotation.z = elbow;
    if (wrist.current) wrist.current.rotation.z = -(shoulder + elbow) - Math.PI / 2;
    if (part.current) part.current.visible = showPart && pose.grip;
  });

  return (
    <group position={position} scale={scale}>
      <Box size={[0.9, 0.08, 0.9]} position={[0, 0.04, 0]} mat={M.hazard} />
      <Cyl size={[0.34, 0.3, 0.34]} position={[0, 0.23, 0]} mat={M.robotDark} />
      <group ref={turret} position={[0, 0.38, 0]}>
        <Cyl size={[0.28, 0.32, 0.28]} position={[0, 0.16, 0]} mat={M.robot} />
        <group ref={upper} position={[0, SHOULDER_Y - 0.38, 0]}>
          <Cyl size={[0.17, 0.36, 0.17]} rotation={[Math.PI / 2, 0, 0]} mat={M.robotDark} />
          <Box size={[L1, 0.2, 0.22]} position={[L1 / 2, 0, 0]} mat={M.robot} />
          <group ref={fore} position={[L1, 0, 0]}>
            <Cyl size={[0.13, 0.3, 0.13]} rotation={[Math.PI / 2, 0, 0]} mat={M.robotDark} />
            <Box size={[L2, 0.15, 0.16]} position={[L2 / 2, 0, 0]} mat={M.robot} />
            <group ref={wrist} position={[L2, 0, 0]}>
              <Cyl size={[0.08, 0.18, 0.08]} position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.robotDark} />
              <Box size={[0.06, 0.06, 0.2]} position={[0.22, 0, 0]} mat={M.darkSteel} />
              <Box size={[0.12, 0.04, 0.04]} position={[0.29, 0, 0.08]} mat={M.darkSteel} />
              <Box size={[0.12, 0.04, 0.04]} position={[0.29, 0, -0.08]} mat={M.darkSteel} />
              <group ref={part} position={[0.33, 0, 0]}>
                <Cyl size={[0.12, 0.2, 0.12]} rotation={[0, 0, Math.PI / 2]} mat={M.motorRaw} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
