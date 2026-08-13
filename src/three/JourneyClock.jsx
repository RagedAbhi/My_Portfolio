import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollState } from '../state/scrollState';
import { SPRING } from '../config/journey';

/*
 * JourneyClock — the single place scrollState.laggedProgress gets updated,
 * once per frame. Mounted first in Scene so Orb/Thread/CameraController all
 * read the same trailing value instead of each maintaining their own
 * (which would let them drift subtly out of sync for no visual benefit).
 */
export function JourneyClock() {
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, SPRING.maxDt);
    scrollState.laggedProgress = THREE.MathUtils.damp(
      scrollState.laggedProgress,
      scrollState.progress,
      SPRING.lagRate,
      dt
    );
  });
  return null;
}
