import { Canvas } from '@react-three/fiber';
import { Lighting } from './Lighting';
import { Orb } from './Orb';
import { Thread } from './Thread';
import { CameraController } from './CameraController';
import { JourneyClock } from './JourneyClock';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*
 * Scene — the entire WebGL scene budget, deliberately short: one orb, one
 * thread (+ the orb's own motion trail), minimal lighting, one camera.
 * No particles, no environment, no post-processing. See the plan's scene
 * budget section for what's intentionally excluded and why.
 *
 * reducedMotion is read once here and threaded down: it disables the orb's
 * spring bounce/noise/trail and the camera's dolly/parallax choreography,
 * per prefers-reduced-motion — a static orb and thread remain, still tied
 * to scroll position, just without any of the "excessive" motion.
 */
export function Scene() {
  const reducedMotion = useReducedMotion();

  return (
    <Canvas
      className="scene-layer"
      style={{ position: 'fixed', inset: 0 }}
      dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, 6.5] }}
    >
      <JourneyClock />
      <Lighting />
      <Thread reducedMotion={reducedMotion} />
      <Orb reducedMotion={reducedMotion} />
      <CameraController reducedMotion={reducedMotion} />
    </Canvas>
  );
}
