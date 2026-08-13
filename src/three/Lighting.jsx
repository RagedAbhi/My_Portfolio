import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { scrollState } from '../state/scrollState';
import { getDisciplineWeights, SIGNATURE_START, SIGNATURE_PEAK } from '../config/journey';

const RIM_BASE_INTENSITY = 0.22;
const RIM_CREATIVE_TECH_INTENSITY = 0.75;
const KEY_BASE_INTENSITY = 1.2;
const KEY_GEM_INTENSITY = 1.9;

/*
 * Lighting — deliberately minimal per the scene budget: one directional key
 * light, a soft hemisphere fill, and a dim cobalt-tinted rim to hint at the
 * accent color on the orb's edge. No environment map / Lightformer / HDRI —
 * this reads as a clean matte pearl without one, and the scene budget
 * excludes anything that isn't earning its place.
 *
 * Two dynamic values here, both pure functions of progress (same convention
 * as everything else — see Orb.jsx):
 * - the rim light lifts slightly whenever the journey is near a "Creative
 *   Technology" mention (see getDisciplineWeights in journey.js), so the
 *   orb's cobalt edge gets a touch more present exactly when that's
 *   thematically on-screen.
 * - the key light brightens across the same SIGNATURE_START->PEAK window
 *   Orb.jsx uses for its gold/facet transformation — a soft single light is
 *   fine for a matte pearl, but the cut-gem facets need a punchier key light
 *   to actually throw distinct specular highlights per facet.
 */
export function Lighting() {
  const rimRef = useRef(null);
  const keyRef = useRef(null);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);

    const rim = rimRef.current;
    if (rim) {
      const weight = getDisciplineWeights(scrollState.laggedProgress).creativeTech;
      const target = THREE.MathUtils.lerp(RIM_BASE_INTENSITY, RIM_CREATIVE_TECH_INTENSITY, weight);
      rim.intensity = THREE.MathUtils.damp(rim.intensity, target, 1.8, dt);
    }

    const key = keyRef.current;
    if (key) {
      const goldWeight = THREE.MathUtils.smoothstep(scrollState.laggedProgress, SIGNATURE_START, SIGNATURE_PEAK);
      const target = THREE.MathUtils.lerp(KEY_BASE_INTENSITY, KEY_GEM_INTENSITY, goldWeight);
      key.intensity = THREE.MathUtils.damp(key.intensity, target, 1.8, dt);
    }
  });

  return (
    <>
      <hemisphereLight args={['#fffaf0', '#ddd6c4', 0.7]} />
      <directionalLight ref={keyRef} position={[3, 4, 5]} intensity={KEY_BASE_INTENSITY} color="#fff4de" />
      <directionalLight ref={rimRef} position={[-4, -1, -3]} intensity={RIM_BASE_INTENSITY} color="#3a55c9" />
    </>
  );
}
