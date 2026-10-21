// Pedestrian crossover bridges: stairs up, a deck over the belt, stairs down.

import { yawOf } from '../../sim/path';
import { M } from '../materials';
import { Box } from '../primitives';

const DECK_Y = 1.45;

/** Bridge positions; `dx, dz` is the belt direction at that point. */
const CROSSOVERS: { x: number; z: number; dx: number; dz: number }[] = [
  { x: -14, z: -12, dx: 1, dz: 0 },
  { x: 28, z: -12, dx: 1, dz: 0 },
  { x: 48, z: 0, dx: 0, dz: 1 },
  { x: 32.5, z: 14, dx: -1, dz: 0 },
  { x: -1, z: 14, dx: -1, dz: 0 },
  { x: 10, z: 20, dx: 0, dz: 1 },
  { x: 40, z: 25, dx: 1, dz: 0 },
];

function Bridge() {
  // Local frame: +x along the belt, z across it (the walking direction).
  const steps = 5;
  return (
    <group>
      <Box size={[1.1, 0.08, 1.4]} position={[0, DECK_Y, 0]} mat={M.hazard} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: steps }, (_, i) => {
            const h = (DECK_Y / steps) * (i + 1);
            const z = side * (0.7 + (steps - i - 0.5) * 0.2);
            return <Box key={i} size={[1.1, 0.06, 0.22]} position={[0, h - 0.03, z]} mat={M.steel} />;
          })}
          {[-0.55, 0.55].map((x) => (
            <Box key={x} size={[0.05, 1.0, 2.4]} position={[x, DECK_Y * 0.5 + 0.55, side * 0.8]} rotation={[side * -0.5, 0, 0]} mat={M.hazard} cast={false} />
          ))}
          {[-0.55, 0.55].map((x) => (
            <Box key={`p${x}`} size={[0.06, DECK_Y + 1.0, 0.06]} position={[x, (DECK_Y + 1.0) / 2, side * 0.7]} mat={M.darkSteel} />
          ))}
        </group>
      ))}
      {[-0.55, 0.55].map((x) => <Box key={x} size={[0.05, 0.05, 1.4]} position={[x, DECK_Y + 1.0, 0]} mat={M.hazard} cast={false} />)}
    </group>
  );
}

export function Crossovers() {
  return (
    <group>
      {CROSSOVERS.map((c) => (
        <group key={`${c.x},${c.z}`} position={[c.x, 0, c.z]} rotation={[0, yawOf(c.dx, c.dz), 0]}>
          <Bridge />
        </group>
      ))}
    </group>
  );
}
