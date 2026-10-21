// Small plan of the site: zones, conveyors, docks, and the camera with its viewing
// direction. Click anywhere on it to move the camera there, or drag to slide it around.

import { useEffect, useRef } from 'react';
import { BUILDING, LANES, SITE_BOUNDS, ZONES } from '../config/layout';
import { camState } from '../scene/camera/cameraShared';
import { useUI } from '../state/uiStore';

const W = 230;
const PAD = 6;
const MIN_X = SITE_BOUNDS.minX - 4;
const MAX_X = SITE_BOUNDS.maxX + 2;
const MIN_Z = SITE_BOUNDS.minZ - 2;
const MAX_Z = SITE_BOUNDS.maxZ + 2;
const SCALE = (W - PAD * 2) / (MAX_X - MIN_X);
const H = Math.round((MAX_Z - MIN_Z) * SCALE + PAD * 2);

const toPx = (x: number, z: number): [number, number] => [PAD + (x - MIN_X) * SCALE, PAD + (z - MIN_Z) * SCALE];

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const goto = useUI((s) => s.goto);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = W * dpr;
    el.height = H * dpr;
    const ctx = el.getContext('2d') as CanvasRenderingContext2D;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#9fb08f';
      ctx.fillRect(0, 0, W, H);
      const [bx0, bz0] = toPx(BUILDING.minX, BUILDING.minZ);
      const [bx1, bz1] = toPx(BUILDING.maxX, BUILDING.maxZ);
      ctx.fillStyle = '#5a5e62';
      const [yx0] = toPx(-88, 0);
      ctx.fillRect(yx0, 0, bx0 - yx0, H);
      ctx.fillStyle = '#e4e3dd';
      ctx.fillRect(bx0, bz0, bx1 - bx0, bz1 - bz0);
      for (const z of ZONES) {
        const [x0, y0] = toPx(z.rect[0], z.rect[1]);
        const [x1, y1] = toPx(z.rect[2], z.rect[3]);
        ctx.fillStyle = z.tint + '40';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = '#17212b';
        ctx.font = '700 9px Segoe UI, sans-serif';
        ctx.fillText(z.code, x0 + 3, y0 + 10);
      }
      ctx.lineCap = 'round';
      for (const [id, lane] of Object.entries(LANES)) {
        ctx.strokeStyle = id === 'main' ? '#1f6fb2' : '#c9473f';
        ctx.lineWidth = id === 'main' ? 2 : 1.5;
        ctx.beginPath();
        lane.points.forEach(([x, z], i) => {
          const [px, py] = toPx(x, z);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      ctx.strokeStyle = '#17212b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx0, bz0, bx1 - bx0, bz1 - bz0);

      // Camera: dot plus a view cone along its heading.
      const [cx, cy] = toPx(camState.x, camState.z);
      const len = camState.y < 9 ? 14 : 20;
      const spread = 0.45;
      const ax = Math.sin(camState.yaw);
      const az = Math.cos(camState.yaw);
      ctx.fillStyle = 'rgba(63, 183, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (ax * Math.cos(spread) - az * Math.sin(spread)) * len, cy + (az * Math.cos(spread) + ax * Math.sin(spread)) * len);
      ctx.lineTo(cx + (ax * Math.cos(-spread) - az * Math.sin(-spread)) * len, cy + (az * Math.cos(-spread) + ax * Math.sin(-spread)) * len);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3fb7ff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.max(4, Math.min(W - 4, cx)), Math.max(4, Math.min(H - 4, cy)), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    draw();
    const id = window.setInterval(draw, 100);
    return () => window.clearInterval(id);
  }, []);

  const dragging = useRef(false);

  const moveTo = (e: React.PointerEvent<HTMLCanvasElement>, quick: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = MIN_X + (e.clientX - r.left - PAD) / SCALE;
    const z = MIN_Z + (e.clientY - r.top - PAD) / SCALE;
    goto(x, z, quick);
  };

  // Click glides the camera there; dragging keeps it under the pointer.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e, false);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging.current) moveTo(e, true);
  };
  const onPointerUp = () => { dragging.current = false; };

  return (
    <div className="minimap panel" aria-label="Factory map — click or drag to move the camera">
      <canvas
        ref={canvas}
        style={{ width: W, height: H, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
