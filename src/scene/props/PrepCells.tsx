// Sub-assembly preparation between the two lines, so the floor shows the whole story
// rather than one belt: the rotor cell (balancing machines and an induction bearing heater)
// in front of machining, the stator cell (coil forming and a varnish impregnation oven)
// behind the test line, and two AGVs shuttling finished rotors and stators to the assembly
// stations. Everything runs on simulated time, so pausing freezes it with the line.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simTime, smoothstep } from '../../sim/runtime';
import { Polyline, yawOf, type Vec2 } from '../../sim/path';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { Worker, type WorkerHandle } from '../actors/Worker';

/** A rotor lying along local x: laminated core, copper end rings, shaft. */
function Rotor({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Cyl size={[0.14, 0.36, 0.14]} rotation={[0, 0, Math.PI / 2]} mat={M.darkSteel} />
      {[-0.19, 0.19].map((x) => <Cyl key={x} size={[0.145, 0.03, 0.145]} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.copper} />)}
      <Cyl size={[0.035, 0.9, 0.035]} rotation={[0, 0, Math.PI / 2]} mat={M.steel} />
    </group>
  );
}

/** A wound stator standing upright: steel core ring with copper end windings showing. */
function Stator({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Cyl size={[0.2, 0.26, 0.2]} position={[0, 0.13, 0]} mat={M.darkSteel} />
      <Cyl size={[0.15, 0.06, 0.15]} position={[0, 0.29, 0]} mat={M.copper} />
      <Cyl size={[0.09, 0.07, 0.09]} position={[0, 0.3, 0]} mat={M.black} />
    </group>
  );
}

/** Dynamic balancing machine: the rotor spins in its cradles, the hood lifts between rotors. */
function BalancingMachine({ position, phase }: { position: [number, number, number]; phase: number }) {
  const rotor = useRef<THREE.Group>(null);
  const hood = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = ((simTime() + phase) % 24) / 24;
    const spinning = c > 0.15 && c < 0.85;
    if (rotor.current) rotor.current.rotation.x = spinning ? simTime() * 40 : 0;
    if (hood.current) hood.current.rotation.x = -smoothstep(c < 0.15 ? 1 - c / 0.15 : c > 0.85 ? (c - 0.85) / 0.15 : 0) * 1.2;
  });
  return (
    <group position={position}>
      <Box size={[2.2, 0.85, 0.9]} position={[0, 0.43, 0]} mat={M.machineBlue} />
      <Box size={[2.2, 0.06, 0.95]} position={[0, 0.88, 0]} mat={M.steel} />
      {[-0.5, 0.5].map((x) => <Box key={x} size={[0.14, 0.42, 0.3]} position={[x, 1.1, 0]} mat={M.darkSteel} />)}
      <group ref={rotor} position={[0, 1.35, 0]}><Rotor position={[0, 0, 0]} /></group>
      {/* Belt-drive head and the measuring console. */}
      <Box size={[0.4, 0.5, 0.5]} position={[0.9, 1.15, 0]} mat={M.machine} />
      <Box size={[0.08, 0.9, 0.08]} position={[-0.95, 1.3, -0.35]} mat={M.darkSteel} />
      <Box size={[0.5, 0.36, 0.05]} position={[-0.95, 1.85, -0.3]} rotation={[0.3, 0, 0]} mat={M.screenGreen} />
      {/* Guard hood, hinged at the back. */}
      <group ref={hood} position={[0, 1.2, -0.45]}>
        <Box size={[1.5, 0.05, 0.85]} position={[0, 0.5, 0.42]} mat={M.glass} cast={false} />
        <Box size={[1.5, 0.5, 0.04]} position={[0, 0.25, 0]} mat={M.machine} />
      </group>
    </group>
  );
}

/** Induction bearing heater: a yoke with a bearing ring that glows while it heats. */
function BearingHeater({ position }: { position: [number, number, number] }) {
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7b7f84', roughness: 0.4, metalness: 0.6, emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 0 }), []);
  useFrame(() => {
    const c = (simTime() % 16) / 16;
    glow.emissiveIntensity = c < 0.7 ? 0.9 * smoothstep(c / 0.7) : 0;
  });
  return (
    <group position={position}>
      <Box size={[0.9, 0.85, 0.6]} position={[0, 0.43, 0]} mat={M.machine} />
      <Box size={[0.9, 0.06, 0.62]} position={[0, 0.88, 0]} mat={M.darkSteel} />
      <Box size={[0.14, 0.6, 0.14]} position={[0, 1.2, 0]} mat={M.darkSteel} />
      <Box size={[0.6, 0.1, 0.14]} position={[0, 1.52, 0]} mat={M.darkSteel} />
      <mesh position={[0, 1.2, 0]} material={glow} scale={[0.22, 0.22, 0.22]} castShadow>
        <torusGeometry args={[1, 0.32, 10, 24]} />
      </mesh>
      <Box size={[0.3, 0.2, 0.04]} position={[0.25, 0.65, 0.31]} mat={M.screen} />
    </group>
  );
}

/** Wheeled shelf cart holding rotors. */
function RotorCart({ position, yaw = 0 }: { position: [number, number, number]; yaw?: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[0.25, 0.85].map((y) => <Box key={y} size={[1.3, 0.04, 0.7]} position={[0, y, 0]} mat={M.steel} />)}
      {[-0.62, 0.62].map((x) => [-0.32, 0.32].map((z) => (
        <group key={`${x}${z}`}>
          <Box size={[0.04, 1.0, 0.04]} position={[x, 0.5, z]} mat={M.darkSteel} />
          <Cyl size={[0.06, 0.04, 0.06]} position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]} mat={M.rubber} />
        </group>
      )))}
      {[-0.22, 0.22].map((z) => <Rotor key={z} position={[0, 1.02, z]} />)}
      {[-0.22, 0.22].map((z) => <Rotor key={`l${z}`} position={[0, 0.42, z]} />)}
    </group>
  );
}

/** Rotor cell, in front of the machining line. */
function RotorCell() {
  return (
    <group position={[-15, 0, -6.8]}>
      <Box size={[22, 0.012, 5.2]} position={[0, 0.006, 0]} mat={M.cellFloor} cast={false} />
      <BalancingMachine position={[-7, 0, -0.6]} phase={0} />
      <BalancingMachine position={[-2.6, 0, -0.6]} phase={9} />
      <BearingHeater position={[1.6, 0, -0.8]} />
      <RotorCart position={[4.2, 0, -0.6]} yaw={0.15} />
      <RotorCart position={[-9.8, 0, 1.2]} />
      {/* Rotor WIP rack at the cell exit, where the AGV picks up. */}
      <group position={[8.6, 0, 1.0]}>
        {[0.15, 0.85, 1.55].map((y) => <Box key={y} size={[2.0, 0.05, 0.8]} position={[0, y, 0]} mat={M.rackBeam} />)}
        {[-0.98, 0.98].map((x) => <Box key={x} size={[0.07, 1.8, 0.8]} position={[x, 0.9, 0]} mat={M.rackUpright} />)}
        {[0.2, 0.9].flatMap((y) => [-0.5, 0.5].map((x) => <Rotor key={`${x}${y}`} position={[x, y + 0.2, 0]} rotation={[0, Math.PI / 2, 0]} />))}
      </group>
      <Worker position={[-7, 0, 0.4]} yaw={Math.PI / 2} outfit="coverall" task="inspect" phase={0.4} />
      <Worker position={[-2.6, 0, 0.4]} yaw={Math.PI / 2} outfit="vest" task="bench" phase={2.2} />
      <Worker position={[1.6, 0, 0.1]} yaw={Math.PI / 2} outfit="vest" task="reach" phase={1.1} />
      <CellSign position={[-10.8, 0, -2.4]} color={M.machineBlue} />
    </group>
  );
}

/** Varnish impregnation oven: stators go in on racks; the window glows while it cures. */
function VarnishOven({ position }: { position: [number, number, number] }) {
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a2a14', emissive: new THREE.Color('#ff8a2a'), emissiveIntensity: 0.6 }), []);
  const door = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = (simTime() % 30) / 30;
    const open = c > 0.86 ? smoothstep((c - 0.86) / 0.07) * (1 - smoothstep((c - 0.95) / 0.05)) : 0;
    glow.emissiveIntensity = open > 0.1 ? 0.15 : 0.5 + 0.15 * Math.sin(simTime() * 1.3);
    if (door.current) door.current.position.y = 1.35 + open * 1.4;
  });
  return (
    <group position={position}>
      <Box size={[4.6, 2.8, 2.6]} position={[0, 1.4, 0]} mat={M.machine} />
      <Box size={[4.65, 0.3, 2.65]} position={[0, 2.8, 0]} mat={M.machineGreen} />
      <Box size={[1.9, 2.2, 0.05]} position={[-0.9, 1.25, 1.31]} mat={M.black} />
      <group ref={door} position={[-0.9, 1.35, 1.36]}>
        <Box size={[2.0, 2.3, 0.08]} mat={M.machineGreen} />
        <Box size={[0.9, 0.6, 0.09]} position={[0, 0.4, 0]} mat={glow} />
      </group>
      {/* Controller, varnish tank with its pump, and the exhaust duct up to the roof. */}
      <Box size={[0.8, 1.6, 0.4]} position={[1.6, 1.1, 1.45]} mat={M.robotDark} />
      <Box size={[0.5, 0.35, 0.03]} position={[1.6, 1.5, 1.66]} mat={M.screen} />
      <Cyl size={[0.6, 1.8, 0.6]} position={[3.2, 0.9, -0.3]} mat={M.steel} />
      <Cyl size={[0.08, 0.6, 0.08]} position={[3.2, 2.0, -0.3]} mat={M.darkSteel} />
      <Cyl size={[0.25, 2.6, 0.25]} position={[1.4, 4.1, -0.6]} mat={M.steel} />
      <Box size={[0.5, 0.5, 0.5]} position={[1.4, 2.95, -0.6]} mat={M.darkSteel} />
      {/* Loading rack of stators waiting in front of the door. */}
      <group position={[-0.9, 0, 2.3]}>
        <Box size={[1.6, 0.06, 0.9]} position={[0, 0.7, 0]} mat={M.steel} />
        {[-0.75, 0.75].map((x) => <Box key={x} size={[0.06, 0.7, 0.85]} position={[x, 0.35, 0]} mat={M.darkSteel} />)}
        {[-0.45, 0, 0.45].flatMap((x) => [-0.22, 0.22].map((z) => <Stator key={`${x}${z}`} position={[x, 0.73, z]} />))}
      </group>
    </group>
  );
}

/** Coil-forming machine: the winding head turns while the operator forms the next coil. */
function CoilFormer({ position }: { position: [number, number, number] }) {
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = (simTime() % 12) / 12;
    if (head.current && c < 0.75) head.current.rotation.z = simTime() * 7;
  });
  return (
    <group position={position}>
      <Box size={[1.6, 0.95, 1.0]} position={[0, 0.48, 0]} mat={M.machine} />
      <Box size={[1.6, 0.06, 1.0]} position={[0, 0.98, 0]} mat={M.machineBlue} />
      <group ref={head} position={[0.2, 1.35, 0.1]}>
        <Box size={[0.7, 0.12, 0.12]} mat={M.steel} />
        <Cyl size={[0.16, 0.14, 0.16]} rotation={[Math.PI / 2, 0, 0]} mat={M.copper} />
      </group>
      <Box size={[0.2, 0.5, 0.2]} position={[0.2, 1.1, -0.3]} mat={M.darkSteel} />
      {/* Copper wire drum feeding it. */}
      <Cyl size={[0.38, 0.5, 0.38]} position={[-1.2, 0.25, -0.2]} mat={M.copper} />
      <Box size={[0.4, 0.3, 0.04]} position={[-0.4, 1.3, 0.45]} mat={M.screen} />
    </group>
  );
}

/** Stator cell, between the aisle and the test line. */
function StatorCell() {
  const stators = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const y of [0.2, 0.9, 1.6]) for (const x of [-0.65, -0.2, 0.25, 0.7]) out.push([x, y + 0.03, 0]);
    return out;
  }, []);
  return (
    <group position={[22, 0, 7.2]}>
      <Box size={[18, 0.012, 6.6]} position={[0, 0.006, 0]} mat={M.cellFloor} cast={false} />
      <VarnishOven position={[-4.5, 0, -0.6]} />
      <CoilFormer position={[4.2, 0, 1.2]} />
      <CoilFormer position={[7.0, 0, 1.2]} />
      {/* Stator WIP rack on the aisle side, where the AGV collects finished stators. */}
      <group position={[2.6, 0, -2.4]}>
        {[0.2, 0.9, 1.6].map((y) => <Box key={y} size={[1.9, 0.05, 0.7]} position={[0, y, 0]} mat={M.rackBeam} />)}
        {[-0.95, 0.95].map((x) => <Box key={x} size={[0.07, 1.8, 0.7]} position={[x, 0.9, 0]} mat={M.rackUpright} />)}
        {stators.map((p) => <Stator key={p.join()} position={p} />)}
      </group>
      <Worker position={[-4.2, 0, 2.6]} yaw={Math.PI / 2} outfit="coverall" task="reach" phase={0.6} />
      <Worker position={[4.2, 0, 2.2]} yaw={Math.PI / 2} outfit="vest" task="bench" phase={1.7} />
      <Worker position={[7.0, 0, 2.2]} yaw={Math.PI / 2} outfit="vest" task="bench" phase={3.1} />
      <CellSign position={[-8.6, 0, -3.0]} color={M.machineGreen} />
    </group>
  );
}

/** Hanging cell identification board on a post. */
function CellSign({ position, color }: { position: [number, number, number]; color: THREE.Material }) {
  return (
    <group position={position}>
      <Box size={[0.08, 2.6, 0.08]} position={[0, 1.3, 0]} mat={M.darkSteel} />
      <Box size={[1.2, 0.5, 0.06]} position={[0.55, 2.4, 0]} mat={color} />
      <Box size={[1.0, 0.12, 0.07]} position={[0.55, 2.42, 0]} mat={M.label} />
    </group>
  );
}

// ---- AGVs ------------------------------------------------------------------

const AGV_PERIOD = 80;

/**
 * An AGV shuttling between a prep cell and an assembly station: drives out loaded, waits while
 * the operator unloads, drives back empty, waits while it is reloaded.
 */
function Agv({ path, phase, load }: { path: Vec2[]; phase: number; load: 'rotor' | 'stator' }) {
  const line = useMemo(() => new Polyline(path), [path]);
  const body = useRef<THREE.Group>(null);
  const cargo = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const c = ((simTime() + phase) % AGV_PERIOD) / AGV_PERIOD;
    // 0–0.38 out (loaded), 0.38–0.5 unload, 0.5–0.88 back (empty), 0.88–1 reload.
    let s: number;
    if (c < 0.38) s = smoothstep(c / 0.38) * line.length;
    else if (c < 0.5) s = line.length;
    else if (c < 0.88) s = (1 - smoothstep((c - 0.5) / 0.38)) * line.length;
    else s = 0;
    const p = line.at(s);
    if (body.current) {
      body.current.position.set(p.x, 0, p.z);
      body.current.rotation.y = yawOf(p.dx, p.dz);
    }
    if (cargo.current) cargo.current.visible = c < 0.44 || c > 0.94;
    const moving = (c < 0.38 && c > 0.005) || (c > 0.5 && c < 0.88);
    if (beacon.current) beacon.current.emissiveIntensity = moving && Math.sin(simTime() * 8) > 0 ? 1.4 : 0.2;
  });
  return (
    <group ref={body}>
      <Box size={[1.5, 0.32, 0.9]} position={[0, 0.2, 0]} mat={M.agv} />
      <Box size={[1.52, 0.08, 0.92]} position={[0, 0.06, 0]} mat={M.black} />
      <Box size={[0.08, 0.12, 0.7]} position={[0.77, 0.24, 0]} mat={M.hazard} />
      <Box size={[0.08, 0.12, 0.7]} position={[-0.77, 0.24, 0]} mat={M.hazard} />
      <mesh position={[0.55, 0.42, 0.3]} scale={0.07}>
        <sphereGeometry />
        <meshStandardMaterial ref={beacon} color="#ffb020" emissive="#ffb020" emissiveIntensity={0.2} />
      </mesh>
      <Box size={[1.3, 0.04, 0.8]} position={[0, 0.4, 0]} mat={M.steel} />
      <group ref={cargo} position={[0, 0.42, 0]}>
        {load === 'rotor'
          ? [-0.2, 0.2].flatMap((z) => [0.12, 0.42].map((y) => <Rotor key={`${z}${y}`} position={[0, y, z]} />))
          : [-0.4, 0, 0.4].flatMap((x) => [-0.2, 0.2].map((z) => <Stator key={`${x}${z}`} position={[x, 0, z]} />))}
      </group>
    </group>
  );
}

/** A material handler pushing a trolley back and forth between two points. */
export function Walker({ path, period, phase = 0, outfit = 'vest' }: {
  path: Vec2[]; period: number; phase?: number; outfit?: 'vest' | 'coverall' | 'lab';
}) {
  const line = useMemo(() => new Polyline(path), [path]);
  const group = useRef<THREE.Group>(null);
  const worker = useRef<WorkerHandle>(null);
  useFrame(() => {
    const c = ((simTime() + phase) % period) / period;
    const out = c < 0.5;
    const k = out ? Math.min(1, c / 0.42) : Math.min(1, (c - 0.5) / 0.42);
    const s = (out ? k : 1 - k) * line.length;
    const p = line.at(s);
    const dir = out ? 1 : -1;
    if (group.current) {
      group.current.position.set(p.x, 0, p.z);
      group.current.rotation.y = yawOf(p.dx * dir, p.dz * dir);
    }
    worker.current?.setWalk(k < 1 ? s : 0);
  });
  return (
    <group ref={group}>
      <Worker ref={worker} walking outfit={outfit} />
      {/* Trolley in front of the walker. */}
      <group position={[0.85, 0, 0]}>
        <Box size={[0.9, 0.05, 0.6]} position={[0, 0.45, 0]} mat={M.steel} />
        <Box size={[0.04, 0.6, 0.6]} position={[-0.45, 0.75, 0]} mat={M.darkSteel} />
        {[-0.38, 0.38].map((x) => [-0.25, 0.25].map((z) => (
          <Cyl key={`${x}${z}`} size={[0.06, 0.04, 0.06]} position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]} mat={M.rubber} />
        )))}
        <Box size={[0.4, 0.25, 0.35]} position={[-0.15, 0.6, 0]} mat={M.bin} />
        <Box size={[0.3, 0.2, 0.3]} position={[0.25, 0.58, 0]} mat={M.casting} />
      </group>
    </group>
  );
}

const ROTOR_AGV: Vec2[] = [[-5.8, -4.3], [-5.8, -0.9], [20, -0.9], [20, -6.9]];
const STATOR_AGV: Vec2[] = [[24.6, 3.5], [24.6, 0.9], [28, 0.9], [28, -6.9]];

export function PrepCells() {
  return (
    <group>
      <RotorCell />
      <StatorCell />
      <Agv path={ROTOR_AGV} phase={0} load="rotor" />
      <Agv path={STATOR_AGV} phase={AGV_PERIOD / 2} load="stator" />
    </group>
  );
}
