// Assembly-line stations: robot cells with fixture tables and safety fencing, and manual
// benches with tools, parts bins and torque arms.

import type { StationDef } from '../../config/layout';
import { M } from '../materials';
import { Box, Cyl } from '../primitives';
import { RobotArm, assemblyProgram } from '../actors/RobotArm';
import { Worker } from '../actors/Worker';

type ModelProps = { def: StationDef };

/** Row of plastic parts bins on a two-shelf flow rack. */
export function FlowRack({ position, yaw = 0, colors = [M.bin, M.binRed, M.binGreen] }: {
  position: [number, number, number]; yaw?: number; colors?: typeof M.bin[];
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[-0.9, 0.9].map((x) => <Box key={x} size={[0.06, 1.7, 0.7]} position={[x, 0.85, 0]} mat={M.steel} />)}
      {[0.55, 1.15].map((y, row) => (
        <group key={y}>
          <Box size={[1.85, 0.04, 0.7]} position={[0, y, 0]} rotation={[0.12, 0, 0]} mat={M.steel} />
          {[-0.6, 0, 0.6].map((x, i) => (
            <Box key={x} size={[0.5, 0.22, 0.6]} position={[x, y + 0.13, 0]} rotation={[0.12, 0, 0]} mat={colors[(i + row) % colors.length]} />
          ))}
        </group>
      ))}
    </group>
  );
}

function SafetyFence({ S, x0, x1, z }: { S: number; x0: number; x1: number; z: number }) {
  const posts = [];
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 3) posts.push(x);
  return (
    <group>
      {posts.map((x) => <Box key={x} size={[0.06, 1.8, 0.06]} position={[x, 0.9, S * z]} mat={M.hazard} />)}
      <Box size={[x1 - x0, 1.5, 0.02]} position={[(x0 + x1) / 2, 0.95, S * z]} mat={M.glass} cast={false} />
      <Box size={[x1 - x0, 0.05, 0.05]} position={[(x0 + x1) / 2, 1.78, S * z]} mat={M.hazard} />
    </group>
  );
}

export function RobotCell({ def }: ModelProps) {
  const S = def.side;
  const isFan = def.id === 'asm_fan';
  return (
    <group>
      <RobotArm station={def.id} position={[0, 0, S * 1.15]}
        program={assemblyProgram(-S * Math.PI / 2, S * Math.PI / 2, 1.45, 1.15)} idleYaw={-S * Math.PI / 2} />
      {/* Fixture table holding the next components. */}
      <Box size={[1.6, 0.85, 0.9]} position={[0, 0.43, S * 2.65]} mat={M.machine} />
      <Box size={[1.6, 0.05, 0.9]} position={[0, 0.88, S * 2.65]} mat={M.steel} />
      {[-0.45, 0, 0.45].map((x) => isFan
        ? <Cyl key={x} size={[0.2, 0.06, 0.2]} position={[x, 0.95, S * 2.6]} mat={M.robotDark} />
        : <mesh key={x} position={[x, 1.0, S * 2.6]} rotation={[0, Math.PI / 2, 0]}><Cyl size={[0.2, 0.22, 0.2]} rotation={[Math.PI / 2, 0, 0]} mat={M.copper} /></mesh>)}
      <SafetyFence S={S} x0={-2} x1={2} z={3.4} />
      <Box size={[0.5, 1.4, 0.4]} position={[1.75, 0.7, S * 2.6]} mat={M.robotDark} />
      <Box size={[0.32, 0.25, 0.03]} position={[1.75, 1.1, S * 2.39]} mat={M.screen} />
      {/* Kanban parts rack on the far side of the belt. */}
      <FlowRack position={[0, 0, -S * 2.2]} yaw={S > 0 ? Math.PI : 0} />
    </group>
  );
}

export function ManualBench({ def }: ModelProps) {
  const S = def.side;
  return (
    <group>
      <Box size={[2.6, 0.06, 0.8]} position={[0, 0.92, S * 2.0]} mat={M.wood} />
      <Box size={[2.6, 0.06, 0.8]} position={[0, 0.3, S * 2.0]} mat={M.steel} />
      {[-1.2, 1.2].map((x) => <Box key={x} size={[0.06, 0.9, 0.75]} position={[x, 0.45, S * 2.0]} mat={M.darkSteel} />)}
      <Box size={[2.6, 0.9, 0.05]} position={[0, 1.4, S * 2.38]} mat={M.steel} />
      {[-0.8, -0.3, 0.2, 0.7].map((x, i) => (
        <Box key={x} size={[0.36, 0.18, 0.3]} position={[x, 1.35, S * 2.28]} mat={[M.bin, M.binRed, M.binGreen, M.bin][i]} />
      ))}
      <Box size={[0.4, 0.15, 0.3]} position={[0.8, 1.02, S * 1.9]} mat={M.robotDark} />
      <Cyl size={[0.04, 0.4, 0.04]} position={[-0.6, 1.15, S * 1.85]} mat={M.darkSteel} />
      {/* Torque arm reaching over the belt. */}
      <Cyl size={[0.06, 2.4, 0.06]} position={[1.4, 1.2, S * 2.4]} mat={M.darkSteel} />
      <Box size={[0.08, 0.08, 2.1]} position={[1.4, 2.35, S * 1.4]} mat={M.darkSteel} />
      <Cyl size={[0.05, 0.6, 0.05]} position={[1.4, 2.0, S * 0.5]} mat={M.robotDark} />
      <Box size={[1.6, 0.05, 0.25]} position={[0, 2.1, S * 2.0]} mat={M.lampOn} />
      <Worker position={[-0.5, 0, S * 1.05]} yaw={S * Math.PI / 2} outfit="vest" station={def.id} task="bench" />
      <Worker position={[0.9, 0, S * 1.05]} yaw={S * Math.PI / 2} outfit="coverall" station={def.id} task="reach" phase={0.7} />
      <FlowRack position={[0, 0, -S * 2.2]} yaw={S > 0 ? Math.PI : 0} />
    </group>
  );
}
