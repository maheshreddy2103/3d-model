// One camera for everything, like holding a perfect miniature: rotate it, slide it, and zoom
// straight in until you are standing inside at eye level watching the line live. There are no
// separate modes. As you zoom in:
//   - the point you orbit rises from the floor to eye height (1.5 m),
//   - the camera may tilt down to almost horizontal (and is eased there while you zoom),
//   - the lens widens from a 35° "model" view to a 65° "being there" view.
// Close in, left-drag turns your head and right-drag walks you along the floor.
// Camera motion uses real time only and never touches the simulation.

import { useEffect, useRef, type ElementRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
const EYE = 1.5;
/** Distances (camera → orbit point) over which the view blends from miniature to inside. */
const INSIDE_START = 70;
const INSIDE_FULL = 7;
const MIN_HEIGHT = 0.35;
/** Closer than this (camera → orbit point) you are inside: the wheel walks instead of zooming. */
const INSIDE_DISTANCE = 14;
/** Inside, the orbit point sits this far ahead, so dragging turns your head in place. */
const HEAD_DISTANCE = 1.5;
const WALK_STEP = 2.2;
const WALK_SPEED = 3;
const TURN_SPEED = 1.2;
/** Walking stays inside the walls (0.6 m clearance). */
const WALK_BOUNDS = { minX: BUILDING.minX + 0.6, maxX: BUILDING.maxX - 0.6, minZ: BUILDING.minZ + 0.6, maxZ: BUILDING.maxZ - 0.6 };

interface Pose { pos: THREE.Vector3; target: THREE.Vector3 }
interface Transition { from: Pose; to: Pose; t: number; duration: number }

/** 0 when looking at the whole model, 1 when standing inside. */
function insideness(distance: number) {
  const t = THREE.MathUtils.clamp((INSIDE_START - distance) / (INSIDE_START - INSIDE_FULL), 0, 1);
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

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const request = useUI((s) => s.camera);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const transition = useRef<Transition | null>(null);
  const fitted = useRef(false);
  /** Time (s) of the last wheel zoom; the auto-tilt only acts while the user is zooming. */
  const lastZoom = useRef(-10);
  const zoomingIn = useRef(false);
  const clock = useRef(0);
  /** Distance still to walk from wheel notches, as a horizontal vector (consumed smoothly). */
  const walkQueue = useRef(new THREE.Vector3());
  const pointer = useRef(new THREE.Vector2());

  const aspect = () => (size.height ? size.width / size.height : 16 / 9);

  const currentPose = (): Pose => ({
    pos: camera.position.clone(),
    target: controls.current ? controls.current.target.clone() : new THREE.Vector3(),
  });

  const apply = (pose: Pose) => {
    camera.position.copy(pose.pos);
    if (controls.current) controls.current.target.copy(pose.target);
    camera.lookAt(pose.target);
  };

  const startTransition = (to: Pose, duration = 1.1) => {
    transition.current = { from: currentPose(), to, t: 0, duration };
  };

  // First fit as soon as the canvas has a size.
  useEffect(() => {
    if (fitted.current || !size.width || !controls.current) return;
    apply(overviewPose(aspect()));
    controls.current.update();
    fitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Wheel: far out it zooms (OrbitControls). Inside, wheel-up walks you toward the pointer
  // instead of zooming into a dead end; wheel-down still zooms back out to the miniature.
  // Listening on the canvas's parent in the capture phase lets us take the event first.
  useEffect(() => {
    const el = gl.domElement;
    const host = el.parentElement ?? el;
    const onWheel = (e: WheelEvent) => {
      if (e.target !== el) return;
      lastZoom.current = clock.current;
      zoomingIn.current = e.deltaY < 0;
      transition.current = null;
      const c = controls.current;
      if (!c) return;
      if (camera.position.distanceTo(c.target) > INSIDE_DISTANCE) return;
      e.preventDefault();
      e.stopPropagation();
      const notches = Math.min(3, Math.abs(e.deltaY) / 100 || 1);
      if (e.deltaY > 0) {
        // Zoom out: step back and up quickly, so a few notches return to the miniature.
        walkQueue.current.set(0, 0, 0);
        const offset = camera.position.clone().sub(c.target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.radius = Math.max(sph.radius * Math.pow(1.7, notches), sph.radius + 3);
        sph.phi = THREE.MathUtils.lerp(sph.phi, 0.95, 0.3);
        camera.position.copy(c.target).add(offset.setFromSpherical(sph));
        return;
      }
      // Walk toward where the pointer is aiming, along the floor.
      const r = el.getBoundingClientRect();
      pointer.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer.current, camera);
      const dir = ray.ray.direction.clone().setY(0);
      if (dir.lengthSq() < 1e-6) camera.getWorldDirection(dir).setY(0);
      dir.normalize();
      walkQueue.current.addScaledVector(dir, WALK_STEP * notches);
      if (walkQueue.current.length() > 12) walkQueue.current.setLength(12);
      enterHead(c);
    };
    host.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => host.removeEventListener('wheel', onWheel, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera]);

  /** Pull the orbit point to just in front of the eyes (same view, so nothing visibly moves). */
  function enterHead(c: NonNullable<typeof controls.current>) {
    const d = camera.position.distanceTo(c.target);
    if (d <= HEAD_DISTANCE + 0.05) return;
    const dir = c.target.clone().sub(camera.position).normalize();
    c.target.copy(camera.position).addScaledVector(dir, HEAD_DISTANCE);
  }

  /** Move the camera and its orbit point together, staying on the site and above the floor. */
  function travel(c: NonNullable<typeof controls.current>, step: THREE.Vector3) {
    const p = camera.position;
    // Step back inside first if the camera is outside the walls (e.g. arriving from above the yard).
    if (p.x < WALK_BOUNDS.minX || p.x > WALK_BOUNDS.maxX || p.z < WALK_BOUNDS.minZ || p.z > WALK_BOUNDS.maxZ) {
      const cx = THREE.MathUtils.clamp(p.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX) - p.x;
      const cz = THREE.MathUtils.clamp(p.z, WALK_BOUNDS.minZ, WALK_BOUNDS.maxZ) - p.z;
      step = step.clone().add(new THREE.Vector3(cx, 0, cz).multiplyScalar(0.2));
    }
    const nx = THREE.MathUtils.clamp(p.x + step.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX);
    const nz = THREE.MathUtils.clamp(p.z + step.z, WALK_BOUNDS.minZ, WALK_BOUNDS.maxZ);
    c.target.x += nx - p.x;
    c.target.z += nz - p.z;
    p.x = nx;
    p.z = nz;
  }

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
    const now = currentPose();
    const dir = now.target.clone().sub(now.pos);
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
    flat.normalize();
    if (r.kind === 'focus') {
      // A close, eye-level-ish view of the station from the side the camera is already on.
      const target = new THREE.Vector3(...r.center).setY(1.2);
      const back = Math.max(4, r.radius * 1.1);
      const pos = target.clone().addScaledVector(flat, -back).setY(1.2 + back * 0.45);
      return { pos, target };
    }
    // Minimap click: keep the viewing angle and distance, move the orbit point there.
    const target = new THREE.Vector3(r.x, now.target.y, r.z);
    return { pos: target.clone().add(now.pos.clone().sub(now.target)), target };
  }

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.25);
    clock.current += dt;
    const c = controls.current;
    if (!c) return;

    const tr = transition.current;
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / tr.duration);
      const k = tr.t * tr.t * (3 - 2 * tr.t);
      apply({ pos: tr.from.pos.clone().lerp(tr.to.pos, k), target: tr.from.target.clone().lerp(tr.to.target, k) });
      if (tr.t >= 1) transition.current = null;
    } else {
      // Walking: wheel notches and the on-screen walk pad.
      const q = walkQueue.current;
      if (q.lengthSq() > 1e-6) {
        const step = q.clone().multiplyScalar(Math.min(1, dt * 5));
        q.sub(step);
        if (q.lengthSq() < 1e-4) q.set(0, 0, 0);
        travel(c, step);
      }
      if (navInput.forward !== 0 || navInput.turn !== 0) {
        enterHead(c);
        const look = c.target.clone().sub(camera.position);
        if (navInput.turn !== 0) {
          look.applyAxisAngle(new THREE.Vector3(0, 1, 0), navInput.turn * TURN_SPEED * dt);
          c.target.copy(camera.position).add(look);
        }
        if (navInput.forward !== 0) {
          const flat = look.setY(0).normalize();
          travel(c, flat.multiplyScalar(navInput.forward * WALK_SPEED * dt));
        }
      }
      // Dive in / out: blend between the miniature view and standing inside.
      const d = camera.position.distanceTo(c.target);
      const t = insideness(d);
      // Already standing with the orbit point at your eyes: keep the height you are at.
      if (d > HEAD_DISTANCE + 0.1) {
        const dy = (EYE * t - c.target.y) * (1 - Math.exp(-dt * 4));
        c.target.y += dy;
        camera.position.y += dy;
      }
      if (clock.current - lastZoom.current < 0.5 && zoomingIn.current && t > 0.05) {
        // While zooming in, ease the camera toward a horizontal, eye-level view.
        const offset = camera.position.clone().sub(c.target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        const wantPhi = THREE.MathUtils.lerp(0.95, 1.42, t);
        if (sph.phi < wantPhi) {
          sph.phi += (wantPhi - sph.phi) * (1 - Math.exp(-dt * 3));
          camera.position.copy(c.target).add(offset.setFromSpherical(sph));
        }
      }
    }

    // Limits that depend on how far in you are.
    const t = insideness(camera.position.distanceTo(c.target));
    c.maxPolarAngle = THREE.MathUtils.lerp(1.2, 1.56, t);
    c.panSpeed = THREE.MathUtils.lerp(1, 0.6, t);
    c.rotateSpeed = THREE.MathUtils.lerp(0.9, 0.55, t);
    const fov = THREE.MathUtils.lerp(FAR_FOV, NEAR_FOV, t);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 6));
      camera.updateProjectionMatrix();
    }
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;

    // Shared pose for the minimap, the live badge and label detail.
    const dir = camera.getWorldDirection(new THREE.Vector3());
    camState.x = camera.position.x;
    camState.y = camera.position.y;
    camState.z = camera.position.z;
    camState.yaw = Math.atan2(dir.x, dir.z);
    camState.tx = c.target.x;
    camState.tz = c.target.z;
    const tier = t < 0.25 ? 0 : t < 0.7 ? 1 : 2;
    if (tier !== useUI.getState().zoomTier) useUI.getState().setZoomTier(tier);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning={false}
      minDistance={0.8}
      maxDistance={420}
      minPolarAngle={0.05}
      maxPolarAngle={1.2}
      zoomToCursor
      zoomSpeed={1.6}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
      onStart={() => {
        transition.current = null;
        // Inside (e.g. a live cam looking at a machine across the aisle), a drag turns your head
        // where you stand instead of swinging you around that far point and up out of the hall.
        const c = controls.current;
        if (c && camera.position.distanceTo(c.target) <= INSIDE_DISTANCE) enterHead(c);
      }}
    />
  );
}
