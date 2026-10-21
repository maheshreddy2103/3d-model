// One eye-view camera, game style. Each input does one thing only:
//   - click: walk there at eye level (click a machine and you stop in front of it, facing it),
//   - left-drag: move — drag the floor and the view slides with it, no turning,
//   - right-drag (or Shift-drag): turn your head where you stand, no moving,
//   - wheel: fly toward (or away from) whatever is under the pointer — up to the whole factory,
//   - W A S D: walk and step sideways, arrows: walk and turn, Q / E: down and up.
// Nothing tilts or moves on its own. The lens widens from a 35° "model" view high up to a
// 65° "being there" view near the floor. Camera motion uses real time and never touches the simulation.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING, SITE_BOUNDS } from '../../config/layout';
import { useUI, type CameraRequest } from '../../state/uiStore';
import { LIVE_CAMS, camState, navInput } from './cameraShared';

const YAW = THREE.MathUtils.degToRad(24);
const ELEVATION = THREE.MathUtils.degToRad(50);
/** Default overview direction: from the front, a little to the right, 50° above the horizon. */
export const VIEW_DIR = new THREE.Vector3(
  Math.sin(YAW) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(YAW) * Math.cos(ELEVATION),
).normalize();
export const FOV = 35;

const FAR_FOV = 35;
const NEAR_FOV = 65;
/** Eye height when you walk somewhere by clicking. */
const EYE = 1.6;
/** Clicking a machine stops you this far in front of it. */
const STAND_OFF = 2.5;
/** Camera heights over which the lens blends from miniature to standing inside. */
const INSIDE_START = 40;
const INSIDE_FULL = 3;
const MIN_HEIGHT = 0.35;
const MAX_HEIGHT = 400;
/** How far beyond the site the camera may wander. */
const ROAM = 200;
/** Radians per pixel when turning your head. */
const LOOK_SPEED = 0.004;
const MAX_PITCH = Math.PI / 2 - 0.01;
/** Pointer travel (px) below which a press counts as a click, not a drag. */
const CLICK_SLOP = 5;
/** The floor can be "held" while dragging only where you look down at it at least this steeply
 *  (sin of the angle); along the floor at eye level a tiny drag would throw you far away. */
const GRAB_STEEPNESS = 0.15;
/** Fraction of the distance to the pointed-at point covered per wheel notch. */
const ZOOM_STEP = 0.2;
const WALK_SPEED = 3;
const TURN_SPEED = 1.2;
const UP = new THREE.Vector3(0, 1, 0);
const FLOOR = new THREE.Plane(UP, 0);

interface Pose { pos: THREE.Vector3; target: THREE.Vector3 }
interface Transition { fromPos: THREE.Vector3; fromQ: THREE.Quaternion; toPos: THREE.Vector3; toQ: THREE.Quaternion; t: number; duration: number }
interface Drag {
  mode: 'move' | 'look' | 'pinch';
  /** Floor point held under the pointer while moving (null: move at a steady pace instead). */
  grab: THREE.Vector3 | null;
  x: number; y: number; startX: number; startY: number; startTime: number;
  spread: number;
  moved: boolean;
}

/** 0 when looking at the whole model, 1 when standing inside. */
function insideness(height: number) {
  const t = THREE.MathUtils.clamp((INSIDE_START - height) / (INSIDE_START - INSIDE_FULL), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Camera pose that frames the whole site along VIEW_DIR (perspective fit by bisection). */
function overviewPose(aspect: number): Pose {
  const cam = new THREE.PerspectiveCamera(FAR_FOV, aspect, 1, 3000);
  const target = new THREE.Vector3((SITE_BOUNDS.minX + SITE_BOUNDS.maxX) / 2, 0, (SITE_BOUNDS.minZ + SITE_BOUNDS.maxZ) / 2);
  const corners: THREE.Vector3[] = [];
  for (const x of [SITE_BOUNDS.minX, SITE_BOUNDS.maxX]) for (const z of [SITE_BOUNDS.minZ, SITE_BOUNDS.maxZ]) for (const y of [0, 6]) corners.push(new THREE.Vector3(x, y, z));
  const extents = (d: number) => {
    cam.position.copy(target).addScaledVector(VIEW_DIR, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    const box = new THREE.Box2();
    for (const c of corners) {
      const p = c.clone().project(cam);
      box.expandByPoint(new THREE.Vector2(p.x, p.y));
    }
    return box;
  };
  let dist = 200;
  for (let pass = 0; pass < 2; pass++) {
    let lo = 10;
    let hi = 1500;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const b = extents(mid);
      if (b.min.x < -0.97 || b.max.x > 0.97 || b.min.y < -0.9 || b.max.y > 0.9) lo = mid; else hi = mid;
    }
    dist = hi;
    const b = extents(hi);
    const c = b.getCenter(new THREE.Vector2());
    const halfH = Math.tan(THREE.MathUtils.degToRad(FAR_FOV / 2)) * dist;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const upV = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, c.x * halfH * aspect).addScaledVector(upV, c.y * halfH);
    target.addScaledVector(VIEW_DIR, -target.y / VIEW_DIR.y);
  }
  return { pos: target.clone().addScaledVector(VIEW_DIR, dist), target };
}

/** Orientation that looks from `pos` at `target`, upright. */
function lookQuat(pos: THREE.Vector3, target: THREE.Vector3) {
  const m = new THREE.Matrix4().lookAt(pos, target, UP);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Hits on hidden or see-through things (glass, guards, zone tints) don't count. */
function isSolidHit(hit: THREE.Intersection) {
  for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false;
  const mats = (hit.object as THREE.Mesh).material;
  if (!mats) return true;
  for (const m of Array.isArray(mats) ? mats : [mats]) {
    if (!m.visible || (m.transparent && m.opacity < 0.35)) return false;
  }
  return true;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const request = useUI((s) => s.camera);
  const transition = useRef<Transition | null>(null);
  const fitted = useRef(false);
  const yaw = useRef(0);
  const pitch = useRef(0);
  /** Distance still to fly from wheel notches (consumed smoothly). */
  const zoomQueue = useRef(new THREE.Vector3());
  const keys = useRef(new Set<string>());

  const aspect = () => (size.height ? size.width / size.height : 16 / 9);

  /** Re-read yaw and pitch from the camera after anything set its orientation directly. */
  const syncAngles = () => {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = e.y;
    pitch.current = e.x;
  };

  const applyAngles = () => {
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
  };

  const clampPosition = () => {
    const p = camera.position;
    p.x = THREE.MathUtils.clamp(p.x, SITE_BOUNDS.minX - ROAM, SITE_BOUNDS.maxX + ROAM);
    p.z = THREE.MathUtils.clamp(p.z, SITE_BOUNDS.minZ - ROAM, SITE_BOUNDS.maxZ + ROAM);
    p.y = THREE.MathUtils.clamp(p.y, MIN_HEIGHT, MAX_HEIGHT);
  };

  /** The point the camera is looking at on the floor (or a little ahead when looking up). */
  const lookPoint = () => {
    const ray = new THREE.Ray(camera.position.clone(), camera.getWorldDirection(new THREE.Vector3()));
    const hit = ray.intersectPlane(FLOOR, new THREE.Vector3());
    if (hit && hit.distanceTo(camera.position) < 300) return hit;
    const flat = ray.direction.clone().setY(0);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
    return camera.position.clone().addScaledVector(flat.normalize(), 15).setY(0);
  };

  const startTransition = (to: Pose, duration = 1.1) => {
    transition.current = {
      fromPos: camera.position.clone(), fromQ: camera.quaternion.clone(),
      toPos: to.pos.clone(), toQ: lookQuat(to.pos, to.target), t: 0, duration,
    };
  };

  // First fit as soon as the canvas has a size.
  useEffect(() => {
    if (fitted.current || !size.width) return;
    camera.rotation.order = 'YXZ';
    const pose = overviewPose(aspect());
    camera.position.copy(pose.pos);
    camera.lookAt(pose.target);
    syncAngles();
    fitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Mouse, touch and wheel on the canvas.
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.05 };
    raycaster.params.Points = { threshold: 0.05 };
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: Drag | null = null;

    const ndc = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };

    /** What is under a screen point: a solid thing, or the bare floor. */
    const pick = (x: number, y: number): { point: THREE.Vector3; floor: boolean } | null => {
      raycaster.setFromCamera(ndc(x, y), camera);
      const hit = raycaster.intersectObjects(scene.children, true).find(isSolidHit);
      if (hit) return { point: hit.point.clone(), floor: hit.point.y < 0.15 };
      const floor = raycaster.ray.intersectPlane(FLOOR, new THREE.Vector3());
      return floor && floor.distanceTo(camera.position) < 1500 ? { point: floor, floor: true } : null;
    };

    /** Click: walk there at eye level, facing the way you go (or the machine you clicked). */
    const goTo = (x: number, y: number) => {
      const hit = pick(x, y);
      if (!hit) return;
      const flat = hit.point.clone().sub(camera.position).setY(0);
      if (flat.lengthSq() < 1e-4) return;
      const dir = flat.clone().normalize();
      let stand: THREE.Vector3;
      let target: THREE.Vector3;
      if (hit.floor) {
        stand = hit.point.clone().setY(EYE);
        target = stand.clone().addScaledVector(dir, 10).setY(EYE - 0.7);
      } else {
        // A machine: stop a couple of metres short and look at the spot you clicked.
        stand = hit.point.clone().addScaledVector(dir, -Math.min(STAND_OFF, flat.length())).setY(EYE);
        target = hit.point.clone();
      }
      const dist = stand.distanceTo(camera.position);
      startTransition({ pos: stand, target }, THREE.MathUtils.clamp(dist / 12, 0.5, 2.5));
    };

    /** Turn your head where you stand. */
    const look = (dx: number, dy: number) => {
      yaw.current -= dx * LOOK_SPEED;
      pitch.current = THREE.MathUtils.clamp(pitch.current - dy * LOOK_SPEED, -MAX_PITCH, MAX_PITCH);
      applyAngles();
    };

    /** Drag the floor: the floor point you grabbed follows the pointer. */
    const move = (d: Drag, x: number, y: number, dx: number, dy: number) => {
      raycaster.setFromCamera(ndc(x, y), camera);
      const hit = raycaster.ray.intersectPlane(FLOOR, new THREE.Vector3());
      const delta = new THREE.Vector3();
      if (d.grab && hit && raycaster.ray.direction.y < -GRAB_STEEPNESS) {
        delta.copy(d.grab).sub(hit).setY(0);
      } else {
        // Nothing near enough to hold (e.g. looking along the floor at eye level): move at a
        // steady pace instead — sideways with the pointer, forward when you pull it down.
        const depth = Math.max(25, camera.position.y * 1.5);
        const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth) / el.clientHeight;
        const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
        const ahead = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
        delta.addScaledVector(right, -dx * k).addScaledVector(ahead, dy * k);
        d.grab = null;
      }
      if (delta.length() > 60) delta.setLength(60);
      camera.position.add(delta);
      clampPosition();
    };

    const flyToward = (point: THREE.Vector3, amount: number) => {
      const dir = point.clone().sub(camera.position);
      const dist = dir.length();
      if (dist < 1e-3) return;
      dir.normalize();
      const step = amount >= 0 ? Math.max(0, Math.min(dist * amount, dist - 0.5)) : dist * amount;
      zoomQueue.current.addScaledVector(dir, step);
    };

    const midpoint = () => {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y) };
    };

    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const two = pointers.size === 2;
      const m = two ? midpoint() : { x: e.clientX, y: e.clientY, spread: 0 };
      const lookMode = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
      raycaster.setFromCamera(ndc(m.x, m.y), camera);
      const floor = raycaster.ray.intersectPlane(FLOOR, new THREE.Vector3());
      drag = {
        mode: two ? 'pinch' : lookMode ? 'look' : 'move',
        grab: floor && raycaster.ray.direction.y < -GRAB_STEEPNESS ? floor : null,
        x: m.x, y: m.y, startX: m.x, startY: m.y, startTime: performance.now(), spread: m.spread, moved: two,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !drag) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = drag;
      const m = d.mode === 'pinch' && pointers.size === 2 ? midpoint() : { x: e.clientX, y: e.clientY, spread: 0 };
      if (!d.moved && Math.hypot(m.x - d.startX, m.y - d.startY) < CLICK_SLOP) return;
      if (!d.moved) transition.current = null;
      d.moved = true;
      const dx = m.x - d.x;
      const dy = m.y - d.y;
      if (d.mode === 'look') look(dx, dy);
      else if (d.mode === 'move') move(d, m.x, m.y, dx, dy);
      else if (pointers.size === 2) {
        // Two fingers: slide to look around, pinch to fly in or out.
        transition.current = null;
        look(dx, dy);
        if (d.spread > 0 && m.spread > 0) {
          const hit = pick(m.x, m.y);
          if (hit) flyToward(hit.point, 1 - d.spread / m.spread);
        }
        d.spread = m.spread;
      }
      d.x = m.x;
      d.y = m.y;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const d = drag;
      drag = null;
      // A quick left click, no drag: walk there.
      if (d && !d.moved && d.mode === 'move' && e.button === 0 && performance.now() - d.startTime < 500) goTo(e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      transition.current = null;
      const notches = THREE.MathUtils.clamp(Math.abs(e.deltaY) / 100 || 1, 0.1, 3);
      const toward = 1 - Math.pow(1 - ZOOM_STEP, notches);
      const hit = pick(e.clientX, e.clientY);
      const point = hit ? hit.point : camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 30);
      flyToward(point, e.deltaY < 0 ? toward : -(1 / (1 - toward) - 1));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene]);

  // Keyboard: W A S D walk and step sideways, arrows walk and turn, Q / E go down and up.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => { if (!typing(e)) keys.current.add(e.code); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // Requests from the UI: overview, focus on a station or motor, live cams, minimap clicks and drags.
  useEffect(() => {
    if (!fitted.current || request.nonce === 0) return;
    startTransition(poseForRequest(request), request.kind === 'goto' && request.quick ? 0.15 : 1.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.nonce]);

  function poseForRequest(r: CameraRequest): Pose {
    if (r.kind === 'overview') return overviewPose(aspect());
    if (r.kind === 'bookmark') {
      const cam = LIVE_CAMS.find((c) => c.id === r.id) ?? LIVE_CAMS[0];
      return { pos: new THREE.Vector3(...cam.pos), target: new THREE.Vector3(...cam.target) };
    }
    const look = lookPoint();
    if (r.kind === 'focus') {
      // A close, eye-level-ish view of the station from the side the camera is already on.
      const flat = look.clone().sub(camera.position).setY(0);
      if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
      flat.normalize();
      const target = new THREE.Vector3(...r.center).setY(1.2);
      const back = Math.max(4, r.radius * 1.1);
      const pos = target.clone().addScaledVector(flat, -back).setY(1.2 + back * 0.45);
      return { pos, target };
    }
    // Minimap: keep the viewing angle and height, slide so the view centres on that spot.
    const shift = new THREE.Vector3(r.x - look.x, 0, r.z - look.z);
    return { pos: camera.position.clone().add(shift), target: look.add(shift) };
  }

  /** Walking from the pad or keyboard: along the floor, turning in place. */
  function walk(dt: number) {
    const k = keys.current;
    const has = (...codes: string[]) => codes.some((c) => k.has(c));
    const forward = navInput.forward + (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    const strafe = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    const turn = navInput.turn + (has('ArrowLeft') ? 1 : 0) - (has('ArrowRight') ? 1 : 0);
    const lift = (has('KeyE', 'PageUp') ? 1 : 0) - (has('KeyQ', 'PageDown') ? 1 : 0);
    if (!forward && !strafe && !turn && !lift) return;
    transition.current = null;
    // Faster high up, walking pace on the floor.
    const speed = Math.max(WALK_SPEED, camera.position.y * 0.8);
    if (turn) {
      yaw.current += THREE.MathUtils.clamp(turn, -1, 1) * TURN_SPEED * dt;
      applyAngles();
    }
    const ahead = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    camera.position
      .addScaledVector(ahead, THREE.MathUtils.clamp(forward, -1, 1) * speed * dt)
      .addScaledVector(right, strafe * speed * dt);
    camera.position.y += lift * speed * dt;
    clampPosition();
  }

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.25);

    const tr = transition.current;
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / tr.duration);
      const k = tr.t * tr.t * (3 - 2 * tr.t);
      camera.position.lerpVectors(tr.fromPos, tr.toPos, k);
      camera.quaternion.slerpQuaternions(tr.fromQ, tr.toQ, k);
      syncAngles();
      if (tr.t >= 1) transition.current = null;
    } else {
      walk(dt);
      const q = zoomQueue.current;
      if (q.lengthSq() > 1e-6) {
        const step = q.clone().multiplyScalar(Math.min(1, dt * 10));
        q.sub(step);
        if (q.lengthSq() < 1e-4) q.set(0, 0, 0);
        camera.position.add(step);
        clampPosition();
      }
    }

    // Lens: miniature far out, wide when standing on the floor.
    const t = insideness(camera.position.y);
    const fov = THREE.MathUtils.lerp(FAR_FOV, NEAR_FOV, t);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 6));
      camera.updateProjectionMatrix();
    }

    // Shared pose for the minimap, the live badge and label detail.
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const look = lookPoint();
    camState.x = camera.position.x;
    camState.y = camera.position.y;
    camState.z = camera.position.z;
    camState.yaw = Math.atan2(dir.x, dir.z);
    // Inside the hall the badge names where you stand; from above, where you look.
    const inHall = camera.position.y < 9
      && camera.position.x > BUILDING.minX && camera.position.x < BUILDING.maxX
      && camera.position.z > BUILDING.minZ && camera.position.z < BUILDING.maxZ;
    camState.tx = inHall ? camera.position.x : look.x;
    camState.tz = inHall ? camera.position.z : look.z;
    const tier = t < 0.25 ? 0 : t < 0.7 ? 1 : 2;
    if (tier !== useUI.getState().zoomTier) useUI.getState().setZoomTier(tier);
  });

  return null;
}
