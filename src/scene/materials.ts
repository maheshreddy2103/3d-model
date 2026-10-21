// Shared materials, unit geometries and procedural textures. Everything in the scene
// reuses these, so adding another machine adds draw calls but no new GPU resources.

import * as THREE from 'three';

function std(color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export const COLORS = {
  pass: '#2fbf5b',
  warn: '#f2a51b',
  fail: '#e0433a',
  idle: '#8a96a3',
  highlight: '#3fb7ff',
  route: '#38c6ff',
};

export const M = {
  concrete: std('#c4c3bc', 0.9),
  asphalt: std('#4a4d50', 0.95),
  grass: std('#8fa77a', 1),
  wall: std('#d8d6cf', 0.85),
  wallTrim: std('#5d6b78', 0.6),
  cladding: std('#8fa0ae', 0.6, 0.2),
  glass: std('#a9cfe0', 0.1, 0.1, { transparent: true, opacity: 0.35 }),
  safety: std('#f2c230', 0.6),
  safetyWhite: std('#f4f4f0', 0.6),
  hazard: std('#f2c230', 0.6),
  black: std('#22272b', 0.6),
  steel: std('#a2abb2', 0.35, 0.65),
  darkSteel: std('#4b545b', 0.45, 0.55),
  machine: std('#e3e6e8', 0.45, 0.1),
  machineBlue: std('#2f6f9f', 0.45, 0.15),
  machineGreen: std('#3e7c6a', 0.5, 0.1),
  robot: std('#f0a21c', 0.4, 0.15),
  robotDark: std('#3a3f44', 0.5, 0.3),
  rubber: std('#2a2d30', 0.9),
  belt: std('#33383d', 0.8),
  beltRework: std('#5a3f3f', 0.8),
  roller: std('#9aa4ab', 0.35, 0.7),
  copper: std('#c2703a', 0.35, 0.8),
  motorPaint: std('#2d5f8f', 0.45, 0.25),
  motorRaw: std('#8e979e', 0.4, 0.7),
  casting: std('#6e7378', 0.8, 0.4),
  carton: std('#c79d66', 0.85),
  cartonTape: std('#a7834f', 0.6),
  label: std('#f2f2ee', 0.6),
  wood: std('#b88a54', 0.85),
  rackUpright: std('#2c5aa0', 0.5, 0.3),
  rackBeam: std('#f08a1c', 0.5, 0.3),
  screen: std('#0e2433', 0.3, 0, { emissive: new THREE.Color('#1f7fb8'), emissiveIntensity: 0.9 }),
  screenGreen: std('#0e2a1a', 0.3, 0, { emissive: new THREE.Color('#2fbf5b'), emissiveIntensity: 0.8 }),
  lampOn: std('#fff6d8', 0.4, 0, { emissive: new THREE.Color('#ffe9a8'), emissiveIntensity: 1.2 }),
  scanLight: new THREE.MeshBasicMaterial({ color: '#4fe0ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  vest: std('#f27a1a', 0.8),
  vestBlue: std('#2b5c9e', 0.8),
  coverall: std('#33495e', 0.85),
  skin: std('#d9a982', 0.8),
  helmet: std('#f4d03f', 0.5),
  helmetWhite: std('#f4f4f0', 0.5),
  truckCab: std('#c8382f', 0.45, 0.2),
  truckCabBlue: std('#2f5d8a', 0.45, 0.2),
  trailer: std('#e8e9ea', 0.6, 0.1),
  tire: std('#1e2124', 0.95),
  forklift: std('#e8a321', 0.45, 0.15),
  cage: std('#c9473f', 0.5, 0.3),
  bin: std('#2f6f9f', 0.7),
  binRed: std('#c0443a', 0.7),
  binGreen: std('#3f8f5a', 0.7),
  car: std('#7f8c99', 0.4, 0.4),
  chamberWarm: std('#ff9a4a', 0.4, 0, { emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 0.6, transparent: true, opacity: 0.55 }),
};

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(1, 0.28, 8, 20),
};

// ---- procedural textures ------------------------------------------------------

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Polished concrete slab with saw-cut joints every 6 m (the texture covers one 6 m bay). */
export function makeConcreteTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#c9c8c1';
    ctx.fillRect(0, 0, s, s);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      const v = 180 + Math.floor(rand() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v - 6},0.25)`;
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1 + rand() * 3);
    }
    ctx.strokeStyle = 'rgba(90,90,85,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  });
}

/** Belt surface with chevrons pointing along +u, so scrolling the offset shows the direction of travel. */
export function makeBeltTexture(base: string) {
  return canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.1);
    ctx.lineTo(s * 0.6, s * 0.5);
    ctx.lineTo(s * 0.25, s * 0.9);
    ctx.stroke();
  });
}

/** Yellow/black diagonal hazard stripes. */
export function makeHazardTexture() {
  return canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#222';
    for (let i = -s; i < s * 2; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 - s, s);
      ctx.lineTo(i - s, s);
      ctx.closePath();
      ctx.fill();
    }
  });
}
