// Places one station on its conveyor and gives it the shared behaviour: click to select,
// double-click to focus the camera, a selection highlight, a stack light and a label.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { BELT_Y, LANES, STATION_S, type StationDef, type StationKind } from '../../config/layout';
import { yawOf } from '../../sim/path';
import { stationAnim } from '../../sim/runtime';
import { useUI } from '../../state/uiStore';
import { COLORS, G, M } from '../materials';
import { Cyl } from '../primitives';
import { StationLabel } from '../overlays/StationLabel';

/** Footprint per kind: [length along the belt, depth across it, centre offset toward `side`]. */
export const FOOTPRINT: Record<StationKind, [number, number, number]> = {
  inspectionTable: [3, 4, 1.4],
  saw: [4, 5, 1.8],
  cnc: [4.4, 5, 1.8],
  drill: [4, 5, 1.8],
  lathe: [6.5, 5, 1.8],
  winder: [4.5, 5.5, 1.9],
  robotCell: [4.2, 5.2, 1.3],
  manualBench: [4.4, 4.2, 1.2],
  visionArch: [3, 3.6, 0.6],
  cmm: [3.2, 3.8, 0.7],
  electricalBench: [3.4, 4, 1.2],
  chamber: [4.4, 4.6, 0],
  dyno: [3.8, 4.4, 1.3],
  reworkBench: [6, 4, 1.3],
  labeler: [2.6, 3, 0.8],
  cartoner: [4.6, 5, 1.6],
  palletizer: [5, 7.5, 2.6],
};

export function stationFrame(def: StationDef) {
  const p = LANES[def.lane].at(STATION_S[def.id]);
  return { x: p.x, z: p.z, yaw: yawOf(p.dx, p.dz) };
}

/** World-space centre and radius of a station, for camera focusing. */
export function stationFocus(def: StationDef): { center: [number, number, number]; radius: number } {
  const { x, z, yaw } = stationFrame(def);
  const [lx, lz, zc] = FOOTPRINT[def.kind];
  const off = zc * def.side;
  return {
    center: [x + Math.sin(yaw) * off, 1.2, z + Math.cos(yaw) * off],
    radius: Math.max(lx, lz) * 0.9 + 2,
  };
}

export function StationShell({ def, children }: { def: StationDef; children: ReactNode }) {
  const { x, z, yaw } = stationFrame(def);
  const [lx, lz, zc] = FOOTPRINT[def.kind];
  const S = def.side;
  const selected = useUI((s) => s.selection?.type === 'station' && s.selection.id === def.id);
  const select = useUI((s) => s.select);
  const focus = useUI((s) => s.focus);
  const showQuality = useUI((s) => s.show.quality);
  const [hovered, setHovered] = useState(false);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // the end of a drag, not a click
    e.stopPropagation();
    select({ type: 'station', id: def.id });
  };
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ type: 'station', id: def.id });
    const f = stationFocus(def);
    focus(f.center, f.radius);
  };

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <group
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
      >
        {children}
        {/* Invisible hit volume so the whole footprint is clickable, not just thin parts. */}
        <mesh geometry={G.box} scale={[lx, 2.6, lz]} position={[0, 1.3, zc * S]} visible={false} />
      </group>
      {(selected || hovered) && <Highlight size={[lx, lz]} center={zc * S} strong={selected} />}
      {showQuality && <StackLight def={def} position={[lx / 2 - 0.25, 0, (zc + lz / 2 - 0.25) * S]} />}
      <StationLabel def={def} height={3.6} offsetZ={zc * S} />
    </group>
  );
}

function Highlight({ size, center, strong }: { size: [number, number]; center: number; strong: boolean }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.opacity = strong ? 0.16 + 0.08 * Math.sin(clock.elapsedTime * 4) : 0.08;
  });
  return (
    <group position={[0, 0, center]}>
      <mesh geometry={G.box} scale={[size[0] + 0.3, 2.8, size[1] + 0.3]} position={[0, 1.4, 0]} raycast={() => null}>
        <meshBasicMaterial ref={ref} color={COLORS.highlight} transparent opacity={0.12} depthWrite={false} />
        <Edges color={COLORS.highlight} threshold={15} />
      </mesh>
    </group>
  );
}

/** Pole with a lamp: test stations show their last result, others show running / idle. */
function StackLight({ def, position }: { def: StationDef; position: [number, number, number] }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.idle, emissive: new THREE.Color(COLORS.idle), emissiveIntensity: 0.6 }), []);
  useFrame(() => {
    const a = stationAnim(def.id);
    let color = COLORS.idle;
    if (def.test) color = a.status === 'idle' ? COLORS.idle : COLORS[a.status];
    else if (a.busy) color = COLORS.pass;
    material.color.set(color);
    material.emissive.set(color);
  });
  return (
    <group position={position}>
      <Cyl size={[0.04, 2.6, 0.04]} position={[0, 1.3, 0]} mat={M.darkSteel} cast={false} />
      <mesh geometry={G.sphere} material={material} scale={0.2} position={[0, 2.75, 0]} />
    </group>
  );
}

/** Height of a product's top surface on a belt tray — handy for models that touch the product. */
export const PRODUCT_Y = BELT_Y + 0.35;

