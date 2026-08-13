import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Trail } from '@react-three/drei';
import { scrollState } from '../state/scrollState';
import { getDisciplineWeights } from '../config/journey';

/*
 * Trail — the orb's temporary motion trail, conceptually separate from
 * Thread.jsx (the permanent journey path). This wraps drei's <Trail>
 * (meshline under the hood, already a drei dependency) rather than hand-
 * rolling a TubeGeometry rewritten every frame: drei's implementation
 * already satisfies the "no per-frame geometry creation/disposal" rule by
 * updating a fixed-size buffer in place, so there's no custom geometry
 * code to write or maintain here. Revisit only if profiling flags it.
 *
 * Cobalt, like the Thread and every other accent on the site (one accent
 * color used everywhere, per the brief) — but a muted tint rather than the
 * full #3A55C9, since drei's <Trail> has no opacity/transparency hook to
 * lean on (checked: MeshLineMaterial supports opacity, but Trail's default
 * material construction doesn't read an opacity prop, only color — see
 * node_modules/@react-three/drei/core/Trail.js). Blending the accent down
 * against the paper background gets the same "quiet, thin, present but not
 * shouting" result without depending on an unexposed internal API.
 *
 * There's no per-frame speed->opacity hook either — visibility comes
 * naturally from length instead: fast movement stretches the same fixed
 * point-count across more world distance, so the trail reads longer/more
 * present; at rest it collapses to almost nothing right behind the orb.
 * `decay` is tuned low enough that this reads clearly without looking like
 * smoke, and Thread.jsx stays the ONLY thing that ever forms the "A" — this
 * is strictly the orb's last moment of movement, nothing permanent.
 *
 * Color also drifts with the discipline material story (see Orb.jsx /
 * getDisciplineWeights in journey.js) — the SAME weighted-blend math as the
 * orb's own material, applied to a handful of muted-cobalt variants rather
 * than the orb's warm ivory profile colors, so the trail's hue family never
 * leaves cobalt (still one accent color) while still echoing whichever
 * discipline is currently active. mesh.material.color is mutated directly
 * every frame (MeshLineMaterial's color is a uniform proxy, confirmed via
 * node_modules/meshline/dist/index.js) rather than through the `color`
 * prop, which would mean a React re-render per frame to get a smooth blend.
 */
const TRAIL_PROFILE_COLORS = {
  base: '#aab4df',
  design: '#b7bfe4',
  code: '#8fa0e0',
  motion: '#a3b8e8',
  creativeTech: '#93a8e6',
};

export function OrbTrail({ children }) {
  const meshRef = useRef(null);
  const state = useRef(null);
  if (!state.current) {
    const colors = {};
    for (const key of Object.keys(TRAIL_PROFILE_COLORS)) {
      colors[key] = new THREE.Color(TRAIL_PROFILE_COLORS[key]);
    }
    state.current = {
      colors,
      current: new THREE.Color(TRAIL_PROFILE_COLORS.base),
      target: new THREE.Color(),
    };
  }

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.material) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const { colors, current, target } = state.current;

    const weights = getDisciplineWeights(scrollState.laggedProgress);
    const baseWeight = Math.max(0, 1 - weights.design - weights.code - weights.motion - weights.creativeTech);
    const totalWeight = baseWeight + weights.design + weights.code + weights.motion + weights.creativeTech;

    target.setRGB(colors.base.r * baseWeight, colors.base.g * baseWeight, colors.base.b * baseWeight);
    for (const key of ['design', 'code', 'motion', 'creativeTech']) {
      const w = weights[key];
      if (w <= 0) continue;
      target.r += colors[key].r * w;
      target.g += colors[key].g * w;
      target.b += colors[key].b * w;
    }
    target.r /= totalWeight;
    target.g /= totalWeight;
    target.b /= totalWeight;

    current.lerp(target, 1 - Math.exp(-1.8 * dt));
    mesh.material.color.copy(current);
  });

  return (
    <Trail
      ref={meshRef}
      width={0.9}
      length={6}
      decay={1.7}
      local={false}
      stride={0}
      interval={1}
      attenuation={(t) => t * t}
      color={TRAIL_PROFILE_COLORS.base}
    >
      {children}
    </Trail>
  );
}
