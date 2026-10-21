// The one continuous 3D world: site, building, every production area, conveyors,
// vehicles, products and overlays, all in a single scene under one camera.

import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CameraRig, FOV, VIEW_DIR } from './camera/CameraRig';
import { Crossovers } from './environment/Crossovers';
import { Site } from './environment/Site';
import { FloorMarkings } from './environment/FloorMarkings';
import { Conveyors } from './transport/Conveyors';
import { Stations } from './stations/Stations';
import { StaticProps } from './props/StaticProps';
import { DecorEquipment } from './props/DecorEquipment';
import { Transport } from './transport/Transport';
import { ZoneLabels } from './overlays/StationLabel';
import { Products } from './products/Products';
import { Routes } from './overlays/Routes';
import { ProductLabels } from './overlays/ProductLabels';
import { engine } from '../sim/engineInstance';
import { useUI } from '../state/uiStore';

/** `?lowgfx=1` turns off shadows and high-DPI rendering for slower graphics hardware. */
const LOW_GFX = new URLSearchParams(window.location.search).get('lowgfx') === '1';

export function FactoryScene() {
  return (
    <Canvas
      shadows={!LOW_GFX}
      dpr={LOW_GFX ? 1 : [1, 2]}
      camera={{ position: VIEW_DIR.clone().multiplyScalar(200).toArray(), fov: FOV, near: 0.1, far: 3000 }}
      gl={{ antialias: true }}
    >
      <SimDriver />
      <color attach="background" args={['#dde6eb']} />
      <SceneEnvironment />
      <Lights />
      <CameraRig />
      <Site />
      <FloorMarkings />
      <Conveyors />
      <Crossovers />
      <Stations />
      <StaticProps />
      <DecorEquipment />
      <Transport />
      <Products />
      <Routes />
      <ZoneLabels />
      <ProductLabels />
    </Canvas>
  );
}

/**
 * Advances the simulation by real frame time × speed while playing. Mounted first so every
 * model reads the same simulated instant within a frame. Camera moves never touch it.
 */
function SimDriver() {
  useFrame((_, delta) => {
    const { playing, speed } = useUI.getState();
    if (playing) engine.advance(Math.min(delta, 0.1) * speed);
  });
  return null;
}

/** Soft studio reflections for metal surfaces, generated locally (no HDR download). */
function SceneEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#f4f7ff', '#8a8f80', 1.1]} />
      <directionalLight
        color="#fff4e2"
        intensity={2.3}
        position={[55, 110, 45]}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      >
        <orthographicCamera attach="shadow-camera" args={[-110, 110, 75, -75, 1, 400]} />
      </directionalLight>
    </>
  );
}
