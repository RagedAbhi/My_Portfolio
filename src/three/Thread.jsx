import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useJourney } from '../state/JourneyContext';
import { scrollState } from '../state/scrollState';
import { signatureWeight } from '../config/journey';

const RADIUS = 0.009;
const RADIAL_SEGMENTS = 6;

// Normal is passed through (and transformed) so the fragment shader can do
// a cheap Lambert term — just enough that the thread reads as a physical
// filament existing in the same lit 3D space as the orb, not a flat
// 2D line drawn over the page. No specular, no glow.
const vertexShader = /* glsl */ `
  varying float vU;
  varying vec3 vNormal;
  void main() {
    vU = uv.x;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vU;
  varying vec3 vNormal;
  uniform float uProgress;
  uniform float uSignatureWeight;
  uniform vec3 uColor;

  void main() {
    float drawn = step(vU, uProgress);
    // A fine, quiet filament — visible, but never reads as "a UI line".
    // The traveled portion is only a touch more present than what's ahead,
    // and the whole thing lifts during the signature moment so the full
    // path can be seen.
    float ghostAlpha = mix(0.09, 0.24, uSignatureWeight);
    float drawnAlpha = mix(0.16, 0.4, uSignatureWeight);
    float alpha = mix(ghostAlpha, drawnAlpha, drawn);

    // Cheap directional Lambert term (fixed light, roughly matching the
    // scene's key light) — gives the stroke a soft sheen around its
    // circumference so it reads as round and lit, not flat.
    vec3 light = normalize(vec3(0.45, 0.55, 0.7));
    float diff = max(dot(normalize(vNormal), light), 0.0);
    float shade = mix(0.6, 1.05, diff);

    gl_FragColor = vec4(uColor * shade, alpha);
  }
`;

/*
 * Thread — the permanent journey path. A fine, quiet filament, not a UI
 * line: thin radius, low alpha, and a soft per-pixel Lambert term (see the
 * shaders above) so it feels like it exists in the same lit 3D space as
 * the orb rather than a flat stroke drawn over the page. One static
 * TubeGeometry built once from the journey curve (the curve's own S-weaves
 * and swings toward project anchors already give it its expressive shape —
 * see config/journey.js — so the shader only has to answer one question:
 * how much of it is drawn yet, and how strongly to show it).
 *
 * Visibility is steady rather than a hard reveal — the whole curve stays
 * faintly visible, with the traveled portion only a little more present,
 * and during the signature reveal window (see signatureWeight in
 * journey.js) the whole path lifts so the complete shape can be seen.
 */
export function Thread({ reducedMotion = false }) {
  const { curve } = useJourney();

  const geometry = useMemo(() => {
    const tubularSegments = 400;
    return new THREE.TubeGeometry(curve, tubularSegments, RADIUS, RADIAL_SEGMENTS, false);
  }, [curve]);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uSignatureWeight: { value: 0 },
      uColor: { value: new THREE.Color('#3a55c9') },
    }),
    []
  );

  useFrame(() => {
    const p = scrollState.laggedProgress;
    uniforms.uProgress.value = p;
    // The signature reveal is tied to the camera dolly, which is disabled
    // under reduced motion (see CameraController) — so the thread's own
    // full-path reveal is held off too, keeping it a simple, calm line.
    uniforms.uSignatureWeight.value = reducedMotion ? 0 : signatureWeight(p);
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
