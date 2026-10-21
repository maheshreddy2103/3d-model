// Straight-segment paths on the factory floor (x, z in metres).

export type Vec2 = [number, number];

export interface PathPoint {
  x: number;
  z: number;
  /** Unit direction of travel at this point. */
  dx: number;
  dz: number;
}

export interface Segment {
  a: Vec2;
  b: Vec2;
  length: number;
  dx: number;
  dz: number;
  /** Distance along the path where this segment starts. */
  start: number;
}

export class Polyline {
  readonly points: Vec2[];
  readonly segments: Segment[];
  readonly length: number;

  constructor(points: Vec2[]) {
    this.points = points;
    this.segments = [];
    let start = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-6) continue;
      this.segments.push({ a, b, length, dx: (b[0] - a[0]) / length, dz: (b[1] - a[1]) / length, start });
      start += length;
    }
    this.length = start;
  }

  /** Position and direction at distance s (clamped to the path). */
  at(s: number): PathPoint {
    const segs = this.segments;
    const d = Math.max(0, Math.min(this.length, s));
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].start <= d) lo = mid;
      else hi = mid - 1;
    }
    const seg = segs[lo];
    const t = d - seg.start;
    return { x: seg.a[0] + seg.dx * t, z: seg.a[1] + seg.dz * t, dx: seg.dx, dz: seg.dz };
  }

  /** Distance along the path of the point on it closest to p. */
  project(p: Vec2): number {
    let best = 0;
    let bestDist = Infinity;
    for (const seg of this.segments) {
      const t = Math.max(0, Math.min(seg.length, (p[0] - seg.a[0]) * seg.dx + (p[1] - seg.a[1]) * seg.dz));
      const x = seg.a[0] + seg.dx * t;
      const z = seg.a[1] + seg.dz * t;
      const dist = Math.hypot(p[0] - x, p[1] - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = seg.start + t;
      }
    }
    return best;
  }

  /** The path between distances s0 and s1 as a list of points (s0 < s1). */
  slice(s0: number, s1: number): Vec2[] {
    const a = this.at(s0);
    const out: Vec2[] = [[a.x, a.z]];
    for (const seg of this.segments) {
      const end = seg.start + seg.length;
      if (end > s0 && end < s1) out.push(seg.b);
    }
    const b = this.at(s1);
    out.push([b.x, b.z]);
    return out;
  }
}

/** Yaw (rotation about +y) that turns local +x to point along (dx, dz). */
export function yawOf(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}
