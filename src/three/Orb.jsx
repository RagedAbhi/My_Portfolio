import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useJourney } from '../state/JourneyContext';
import { scrollState } from '../state/scrollState';
import { pointerState } from '../state/pointerState';
import {
  SPRING,
  PROJECT_ANCHORS,
  signatureWeight,
  DISCIPLINE_PROFILES,
  getDisciplineWeights,
  SIGNATURE_START,
  SIGNATURE_PEAK,
} from '../config/journey';
import { OrbTrail } from './Trail';
import { orbState } from '../state/orbState';

// The orb's surface carries a fine, permanent craquelure pattern (Voronoi
// cell edges in local/object space, see handleBeforeCompile below) that's
// invisible at rest — pure white-on-white — and only reads once
// uCrackVisibility rises above 0. It's "baked into the surface", not
// animated: as the orb rolls (see the rotation block in useFrame), the
// SAME fixed pattern turns into and out of view, rather than a texture
// sliding across a static orb. Aged/gold are the only two crack colors it
// ever mixes toward. Gold is a deliberate, one-time exception to the site's
// single-cobalt-accent rule: this is the one payoff moment the whole
// journey builds to, and an actual precious-metal hue is what makes it read
// as "gem", not "painted crack" — see handleBeforeCompile for why blue
// specifically didn't work once metalness rose to sell "metal".
//
// At the signature reveal (uGoldMix rising from 0->1 across SIGNATURE_START
// -> SIGNATURE_PEAK) the story compounds: the cracks fill gold AND each
// Voronoi cell's shading normal flattens toward that cell's own outward
// direction, so the smooth organic sphere reads as faceted — raw stone cut
// into a gem, right as the gold pours into the seams between facets. The
// seams also carry their own emissive glow (see the emissivemap_fragment
// injection) — self-lit, as if there's light inside the orb escaping
// through the cracks, not just gold paint on top of them.
const CRACK_AGED_COLOR = '#8c8272';
const CRACK_GOLD_COLOR = '#b8862f';

// JS port of orbHash3/orbVoronoi from handleBeforeCompile's injected GLSL
// below — SAME dot-product constants, SAME fract(sin(x)*43758.5453123)
// hash. This is what the geometric grooves/facet-bulges precomputed in
// decayGeometry (see useMemo below) need: without matching hashes, the
// mesh would carve grooves along a DIFFERENT pattern than the one the
// shader colors gold, which would look like two unrelated effects rather
// than one coherent crack/facet structure. If either hash changes, change
// the other to match — they must never drift apart.
const ORB_HASH_SCRATCH = { x: 0, y: 0, z: 0 };
function orbFrac(v) {
  return v - Math.floor(v);
}
function orbHash3JS(x, y, z, out) {
  out.x = orbFrac(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123);
  out.y = orbFrac(Math.sin(x * 269.5 + y * 183.3 + z * 246.1) * 43758.5453123);
  out.z = orbFrac(Math.sin(x * 113.5 + y * 271.9 + z * 124.6) * 43758.5453123);
}
// Returns { edge, bulge }: edge mirrors the GLSL orbVoronoi's .w (small only
// near cell borders); bulge is an independent per-cell pseudo-random value
// in [-1, 1] (reseeded with a +0.37 offset so it isn't just a reuse of the
// jitter that already placed the feature point) used to give each facet its
// own slightly different radial depth — real hand-cut gems aren't perfectly
// even, and it's what turns "faceted-looking" into an actually deformed,
// irregular cut surface rather than a uniform bevel.
function orbVoronoiJS(x, y, z, scale) {
  const px = x * scale;
  const py = y * scale;
  const pz = z * scale;
  const ipx = Math.floor(px);
  const ipy = Math.floor(py);
  const ipz = Math.floor(pz);
  const fpx = px - ipx;
  const fpy = py - ipy;
  const fpz = pz - ipz;
  let d1 = 8;
  let d2 = 8;
  let cellX = 0;
  let cellY = 0;
  let cellZ = 0;
  for (let cx = -1; cx <= 1; cx++) {
    for (let cy = -1; cy <= 1; cy++) {
      for (let cz = -1; cz <= 1; cz++) {
        orbHash3JS(ipx + cx, ipy + cy, ipz + cz, ORB_HASH_SCRATCH);
        const ox = cx + ORB_HASH_SCRATCH.x - fpx;
        const oy = cy + ORB_HASH_SCRATCH.y - fpy;
        const oz = cz + ORB_HASH_SCRATCH.z - fpz;
        const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
          cellX = ipx + cx;
          cellY = ipy + cy;
          cellZ = ipz + cz;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
  }
  orbHash3JS(cellX + 0.37, cellY + 0.37, cellZ + 0.37, ORB_HASH_SCRATCH);
  return { edge: d2 - d1, bulge: ORB_HASH_SCRATCH.x * 2 - 1 };
}

// ~90px on desktop, ~65px on mobile at the default camera distances — small
// enough to be a companion, not a centerpiece. See journey.js SPRING for
// the physics constants and CameraController for why screen size varies a
// little with camera distance (perspective, not orb scale).
const ORB_RADIUS = 0.28;

// Standard easeOutBack: overshoots past 1 before settling back to it — the
// small "pop and settle" that sells an entrance as an arrival rather than a
// linear grow. Same character as the spring physics driving the orb's
// position (SPRING.stiffness/damping in journey.js), just for a scalar.
const ENTRANCE_DURATION = 1.1; // seconds — lands as Hero's roles line finishes revealing (see Hero.jsx's tl)
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/*
 * Orb — the living visual element the whole site orbits around. It should
 * read as a small, soft, physical object with a little life of its own —
 * not a perfect geometric sphere, not a liquid simulation.
 *
 * PHYSICS (the "why" behind every constant below, see SPRING in
 * config/journey.js for the tunable numbers):
 *
 *   scroll progress -> laggedProgress -> curve target -> spring -> position
 *
 * 1. laggedProgress (scrollState.laggedProgress, updated once per frame by
 *    JourneyClock via THREE.MathUtils.damp — frame-rate independent
 *    exponential smoothing, shared with Thread/CameraController so all
 *    three stay in sync) trails the raw scroll progress. This alone
 *    produces the "orb lags behind fast scrolling" feeling — it never
 *    overshoots on its own, it just arrives late.
 * 2. The curve target is sampled at laggedProgress, then nudged by a small
 *    cursor-follow offset and, near a project, an attraction toward that
 *    project's exact anchor point (see PROJECT_ANCHORS).
 * 3. A true damped spring (accel = (target-pos)*stiffness - vel*damping)
 *    chases that target. THIS is what produces acceleration and slight
 *    overshoot-then-settle — the part a plain lerp/lag can never do, and
 *    the reason we never write `orb.position = curvePoint` directly.
 *
 * SHAPE: two effects layered on the CPU, once per frame, both nudging
 * vertices along the sphere's own base normals/axes rather than a custom
 * shader:
 *   a) squash & stretch — vertices are decomposed into a component along
 *      the current travel direction and a perpendicular remainder; the
 *      along-component stretches with speed (capped, gentle) and the
 *      perpendicular component squashes to compensate, like a physical
 *      object with inertia. At rest it fully relaxes back toward round.
 *   b) a low-frequency sum-of-sines wobble (~4.5% of radius, slow time
 *      evolution) — this is what makes the RESTING shape read as a soft,
 *      slightly irregular pebble/blob rather than a geometric sphere. Low
 *      frequency is the key word: few, broad bumps that shift the visible
 *      silhouette, not fine ripples across the surface.
 * Vertex count is intentionally small (see geometry detail) so a JS loop +
 * computeVertexNormals() is cheap — no custom GLSL needed for a
 * deformation this subtle.
 */
export function Orb({ reducedMotion = false }) {
  const { curve, isMobile } = useJourney();
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  // Total world-space arc length of the journey curve — computed once. The
  // orb's roll angle is (arc length traveled) / radius, the standard
  // rolling-without-slipping relationship, which is why curve.getPointAt
  // (arc-length-parameterized, not just curve.getPoint) has been the right
  // choice all along for sampling position too.
  const curveLength = useMemo(() => curve.getLength(), [curve]);

  // THREE.Color instances for every profile, built once — never allocated
  // inside useFrame. See DISCIPLINE_PROFILES in journey.js for the values.
  const profileColors = useMemo(() => {
    const colors = {};
    for (const key of Object.keys(DISCIPLINE_PROFILES)) {
      colors[key] = new THREE.Color(DISCIPLINE_PROFILES[key].color);
    }
    return colors;
  }, []);

  // A UV sphere, not an Icosahedron: three.js's subdivided IcosahedronGeometry
  // is non-indexed, so computeVertexNormals() can only give it flat per-face
  // shading (visible faceting) no matter how fine the subdivision — verified
  // empirically, 4x the triangles didn't smooth it at all. SphereGeometry is
  // properly indexed, so shared vertices get correctly averaged normals,
  // and it needs far fewer triangles to look smooth.
  const [widthSeg, heightSeg] = isMobile ? [32, 24] : [48, 36];
  const geometry = useMemo(
    () => new THREE.SphereGeometry(ORB_RADIUS, widthSeg, heightSeg),
    [widthSeg, heightSeg]
  );

  // Base (undisplaced) vertex positions + per-vertex normals, captured once
  // so displacement each frame is always relative to the true sphere, not
  // cumulative drift from the previous frame's displaced positions.
  const basePositions = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);
  const baseNormals = useMemo(() => geometry.attributes.normal.array.slice(), [geometry]);

  // Per-vertex decay geometry, computed ONCE (not per frame) since the
  // pattern itself is fixed to the mesh's local vertices — only how much of
  // it shows (crackVisibility/goldMix) changes over time, and that's a
  // cheap per-frame scalar blend applied down in the shape block. Running
  // the actual 27-iteration Voronoi search here instead of inside useFrame
  // is what keeps this affordable: the expensive part happens once at mesh
  // build, not ~1750 times every frame.
  //
  // Two scales, matching the shader exactly (see handleBeforeCompile):
  // fine (crackEdge, ~80 cells) drives a shallow pre-reveal groove — kept
  // shallow deliberately, since this mesh's vertex density can only
  // resolve ~80 cells roughly, so going deeper would look undersampled/
  // jagged rather than like fine aged craquelure. Coarse (facetEdge +
  // facetBulge, ~24 cells) drives the reveal's actual cut-gem deformation —
  // a real groove along each facet edge plus a small per-facet radial
  // offset, so the sphere becomes a genuinely different, irregular faceted
  // shape at the climax, not just a differently-shaded one.
  const decayGeometry = useMemo(() => {
    const count = basePositions.length / 3;
    const crackEdge = new Float32Array(count);
    const facetEdge = new Float32Array(count);
    const facetBulge = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = basePositions[i * 3];
      const y = basePositions[i * 3 + 1];
      const z = basePositions[i * 3 + 2];
      const fine = orbVoronoiJS(x, y, z, 9.0);
      const coarse = orbVoronoiJS(x, y, z, 5.0);
      crackEdge[i] = 1 - THREE.MathUtils.smoothstep(fine.edge, 0, 0.09);
      facetEdge[i] = 1 - THREE.MathUtils.smoothstep(coarse.edge, 0, 0.14);
      facetBulge[i] = coarse.bulge;
    }
    return { crackEdge, facetEdge, facetBulge };
  }, [basePositions]);

  // Persistent scratch state, allocated once — never inside useFrame.
  const state = useRef({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    target: new THREE.Vector3(),
    cursorOffset: new THREE.Vector3(),
    anchorScratch: new THREE.Vector3(),
    travelDir: new THREE.Vector3(0, -1, 0),
    // Rolling rotation (see the mesh.rotation.x block below) means the
    // mesh's local axes no longer match world axes once the orb has moved.
    // The squash/stretch block decomposes vertices in LOCAL space against
    // a WORLD-space travel direction, so that direction has to be rotated
    // into local space first each frame — otherwise the stretch axis would
    // visibly swing independently of the orb's true direction of travel as
    // it spins, rather than staying aligned with it.
    invRotation: new THREE.Quaternion(),
    localTravelDir: new THREE.Vector3(),
    initialized: false,
    // Material story — current values the material is damping toward its
    // target each frame (see the block after the position update below).
    roughness: DISCIPLINE_PROFILES.base.roughness,
    metalness: DISCIPLINE_PROFILES.base.metalness,
    clearcoat: DISCIPLINE_PROFILES.base.clearcoat,
    color: new THREE.Color(DISCIPLINE_PROFILES.base.color),
    targetColor: new THREE.Color(),
    // Decay/craquelure — see handleBeforeCompile and CRACK_* above. Damped
    // the same way as the material-story values: a drift, never a snap.
    crackVisibility: 0,
    goldMix: 0,
    // One-time entrance scale-in — see the ENTRANCE block in useFrame.
    // Time-based (elapsed since first frame), not progress-based: this is
    // the 3D scene's equivalent of Hero's own "plays once on load" DOM
    // timeline (see Hero.jsx's opening comment), not a function of scroll,
    // so it deliberately doesn't fit the site's usual pure-function-of-
    // progress rule — same exception Hero itself already is.
    entranceStart: null,
    entranceScale: 0,
  }).current;

  // Injects the craquelure pattern into MeshPhysicalMaterial's generated
  // shader (three.js's normal customization path — see the standing note
  // on why this needs raw chunk surgery, not a prop, further down). Stored
  // on material.userData.shader so useFrame can update its uniforms every
  // frame without recompiling. Defined once (empty deps): onBeforeCompile
  // must stay referentially stable or three.js treats it as a new material
  // and recompiles needlessly.
  const handleBeforeCompile = useCallback((shader) => {
    shader.uniforms.uCrackVisibility = { value: 0 };
    shader.uniforms.uGoldMix = { value: 0 };
    shader.uniforms.uAgedColor = { value: new THREE.Color(CRACK_AGED_COLOR) };
    shader.uniforms.uGoldColor = { value: new THREE.Color(CRACK_GOLD_COLOR) };

    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vViewPosition;', 'varying vec3 vViewPosition;\nvarying vec3 vLocalPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLocalPosition = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        'varying vec3 vViewPosition;',
        `varying vec3 vViewPosition;
varying vec3 vLocalPosition;
uniform float uCrackVisibility;
uniform float uGoldMix;
uniform vec3 uAgedColor;
uniform vec3 uGoldColor;

vec3 orbHash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// Voronoi lookup — .xyz is the grid-space position of the nearest feature
// point (CONSTANT across an entire cell, since every fragment inside one
// Voronoi region shares the same nearest feature by definition — this is
// what makes it usable as a per-facet flat normal below), .w is the
// cell-edge distance (2nd-nearest minus nearest, small only near cell
// borders, which is where the craquelure traces). Sampled in local/object
// space so the whole pattern is glued to the mesh's own surface, not world
// or screen space.
vec4 orbVoronoi(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  vec3 nearestFeature = vec3(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 cell = vec3(float(x), float(y), float(z));
        vec3 featureOffset = cell + orbHash3(ip + cell);
        float dist = length(featureOffset - fp);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
          nearestFeature = ip + featureOffset;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
  }
  return vec4(nearestFeature, d2 - d1);
}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  // Two Voronoi fields: a fine one for the pre-reveal aged craquelure
  // (~80 cells, unchanged from the first pass), and a coarse one for the
  // reveal's actual gem facets (~24 cells). The FIRST cut-gem attempt kept
  // these fully independent — fine gold seams scattered across big facets
  // with no relationship to their edges — which is exactly why it read as
  // a blotchy overlay rather than a structured object: a real cut gem's
  // seams trace ITS OWN facet edges, not an unrelated finer pattern. Fixed
  // by crossfading the EDGE MASK itself (not just the color) from the fine
  // field to the coarse one as uGoldMix rises, so at full transformation
  // the gold traces exactly the same edges the facet normals below use.
  vec4 orbVor = orbVoronoi(vLocalPosition * 9.0);
  vec4 orbVorFacet = orbVoronoi(vLocalPosition * 5.0);
  float orbFineEdge = 1.0 - smoothstep(0.0, 0.09, orbVor.w);
  float orbFacetEdge = 1.0 - smoothstep(0.0, 0.14, orbVorFacet.w);
  float orbEdgeMask = mix(orbFineEdge, orbFacetEdge, uGoldMix);
  float orbCrack = orbEdgeMask * max(uCrackVisibility, uGoldMix);
  vec3 orbCrackColor = mix(uAgedColor, uGoldColor, uGoldMix);
  diffuseColor.rgb = mix(diffuseColor.rgb, orbCrackColor, orbCrack);`
      )
      .replace(
        '// non perturbed normal for clearcoat among others\n\nvec3 nonPerturbedNormal = normal;',
        `// non perturbed normal for clearcoat among others

vec3 nonPerturbedNormal = normal;

// Raw stone -> cut gem: flatten the shading normal toward each facet
// cell's own (constant-per-cell) outward direction as uGoldMix rises —
// reuses orbVorFacet from the color_fragment block above, so the facet
// boundaries here are the SAME edges the gold seams trace, not a
// coincidentally similar but separate pattern. Blends all the way to
// fully replaced at uGoldMix=1 — a partial blend held it back toward
// "smooth", not "faceted". Feeds nonPerturbedNormal too so clearcoat's
// reflection breaks across facets as well, not just the base lighting.
vec3 orbFacetNormal = normalize(normalMatrix * normalize(orbVorFacet.xyz));
normal = normalize(mix(normal, orbFacetNormal, uGoldMix));
nonPerturbedNormal = normal;`
      )
      .replace(
        'float roughnessFactor = roughness;',
        `float roughnessFactor = roughness;
  // A cut gem is uniformly polished, not just glossy at its facet edges —
  // so the whole surface gets gradually more refined as uGoldMix rises,
  // on top of (not instead of) the discipline-story's own roughness. The
  // seams themselves stay their own distinct, even more defined finish.
  // Lower than the first pass at this (0.45/0.7-0.12) — the facet breakup
  // needs a sharp enough specular response to actually show as separate
  // highlights per facet, not just an overall softer sheen.
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.25, uGoldMix);
  roughnessFactor = mix(roughnessFactor, mix(0.7, 0.08, uGoldMix), orbCrack);`
      )
      .replace(
        'float metalnessFactor = metalness;',
        `float metalnessFactor = metalness;
  // A crisper, more mirror-like response makes each facet's highlight read
  // as a distinct glint rather than blending into one soft diffuse patch —
  // this is doing as much work for the "cut gem" read as the normal
  // faceting itself.
  metalnessFactor = mix(metalnessFactor, 0.55, uGoldMix);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  // Light escaping through the seams, not just gold paint on them — this is
  // an emissive addition (self-lit, independent of scene lighting), not a
  // bloom postprocess pass (the scene budget excludes those): a bright,
  // near-white-hot core exactly on the seam plus a softer, WIDER halo
  // bleeding into the surrounding surface is what sells "glowing" even
  // without a real bloom pass — the halo reuses the same orbVor/orbVorFacet
  // edge distances at a looser threshold, so it's a true soft falloff around
  // the seam, not a uniform-width line with a flat brightness bump.
  float orbGlowHalo = mix(
    1.0 - smoothstep(0.0, 0.22, orbVor.w),
    1.0 - smoothstep(0.0, 0.34, orbVorFacet.w),
    uGoldMix
  );
  vec3 orbGlowColor = mix(uGoldColor, vec3(1.0, 0.95, 0.82), pow(orbEdgeMask, 3.0));
  totalEmissiveRadiance += orbGlowColor * (orbEdgeMask * 2.4 + orbGlowHalo * 0.55) * uGoldMix;`
      );

    materialRef.current.userData.shader = shader;
  }, []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, SPRING.maxDt);
    const mesh = meshRef.current;
    if (!mesh) return;

    // --- 1. lagged progress (shared across Orb/Thread/Camera, see JourneyClock)
    const p = THREE.MathUtils.clamp(scrollState.laggedProgress, 0, 1);

    // --- 2. curve target + cursor offset + project gravity -----------------
    curve.getPointAt(p, state.target);

    if (!reducedMotion) {
      // Cursor influence: a small, clamped nudge toward the pointer. Uses
      // NDC directly rather than a full unproject/raycast — this is meant
      // to read as a hint of attention, not literal pointer tracking.
      const cursorTargetX = pointerState.active ? pointerState.ndcX * SPRING.cursorInfluence : 0;
      const cursorTargetY = pointerState.active ? pointerState.ndcY * SPRING.cursorInfluence : 0;
      state.cursorOffset.x = THREE.MathUtils.damp(state.cursorOffset.x, cursorTargetX, SPRING.cursorLambda, dt);
      state.cursorOffset.y = THREE.MathUtils.damp(state.cursorOffset.y, cursorTargetY, SPRING.cursorLambda, dt);
      state.target.x += state.cursorOffset.x;
      state.target.y += state.cursorOffset.y;
    }

    // Project gravity: within an anchor's radius, pull the target toward
    // the project's exact point on the curve and soften the spring so the
    // orb settles rather than overshoots past it — "discovers", not clicks.
    let gravityWeight = 0;
    if (!reducedMotion) {
      for (let i = 0; i < PROJECT_ANCHORS.length; i++) {
        const anchor = PROJECT_ANCHORS[i];
        const dist = Math.abs(p - anchor.p);
        if (dist < anchor.radius) {
          const w = 1 - dist / anchor.radius;
          gravityWeight = Math.max(gravityWeight, w);
          curve.getPointAt(anchor.p, state.anchorScratch);
          state.target.x += (state.anchorScratch.x - state.target.x) * w * SPRING.gravityStrength;
        }
      }
    }

    if (!state.initialized) {
      // First frame ever: snap instead of animating in from the origin,
      // regardless of motion mode.
      state.pos.copy(state.target);
      state.vel.set(0, 0, 0);
      state.initialized = true;
    } else if (reducedMotion) {
      // No spring bounce/overshoot — a calm, non-oscillating follow. The
      // orb still tracks scroll position (it's part of how the page
      // communicates progress), just without any of the "excessive"
      // motion prefers-reduced-motion asks to avoid.
      state.pos.x = THREE.MathUtils.damp(state.pos.x, state.target.x, 4, dt);
      state.pos.y = THREE.MathUtils.damp(state.pos.y, state.target.y, 4, dt);
      state.pos.z = THREE.MathUtils.damp(state.pos.z, state.target.z, 4, dt);
    } else {
      // --- damped spring toward target ---------------------------------
      const effectiveDamping = SPRING.damping * (1 + gravityWeight * 1.5);
      const dx = state.target.x - state.pos.x;
      const dy = state.target.y - state.pos.y;
      const dz = state.target.z - state.pos.z;
      state.vel.x += (dx * SPRING.stiffness - state.vel.x * effectiveDamping) * dt;
      state.vel.y += (dy * SPRING.stiffness - state.vel.y * effectiveDamping) * dt;
      state.vel.z += (dz * SPRING.stiffness - state.vel.z * effectiveDamping) * dt;
      state.pos.x += state.vel.x * dt;
      state.pos.y += state.vel.y * dt;
      state.pos.z += state.vel.z * dt;
    }

    mesh.position.copy(state.pos);
    orbState.position.copy(state.pos);

    // --- rolling rotation: arc length traveled / radius --------------------
    // A pure function of `p`, exactly like everything else here — scrolling
    // back up un-rolls it precisely, no drift. Deliberately NOT derived from
    // accumulated per-frame position deltas (which would track the spring's
    // transient overshoot too and wouldn't reverse bit-for-bit). Disabled
    // under reduced motion, same as the shape deformation below — a large
    // continuous spin is exactly the kind of motion that setting exists to
    // remove; the crack/gold material story stays active regardless (see
    // below), since that's a slow crossfade, not spatial motion.
    mesh.rotation.x = reducedMotion ? 0 : (p * curveLength) / ORB_RADIUS;

    // The orb recedes further during the signature reveal — on top of the
    // natural perspective shrink from the camera dolly (see
    // CameraController), a deliberate extra shrink so it visibly gives way
    // to the full path rather than just getting smaller from distance.
    const sigWeight = reducedMotion ? 0 : signatureWeight(p);
    const scale = 1 - sigWeight * 0.4;

    // --- entrance: scale in with a small settle, synced to Hero's DOM tl ---
    if (reducedMotion) {
      state.entranceScale = 1;
    } else if (state.entranceScale < 1) {
      if (state.entranceStart === null) state.entranceStart = performance.now();
      const elapsed = (performance.now() - state.entranceStart) / 1000;
      state.entranceScale = elapsed >= ENTRANCE_DURATION ? 1 : easeOutBack(elapsed / ENTRANCE_DURATION);
    }
    mesh.scale.setScalar(scale * state.entranceScale);

    // --- material story: finish drifts toward the nearby discipline --------
    // See DISCIPLINE_PROFILES/getDisciplineWeights in journey.js. A handful
    // of scalar lerps, not a per-vertex cost, so — unlike the shape block
    // below — this stays active under reduced motion too: it's a slow
    // material crossfade, not spatial movement.
    const material = materialRef.current;
    if (material) {
      const weights = getDisciplineWeights(p);
      const baseWeight = Math.max(0, 1 - weights.design - weights.code - weights.motion - weights.creativeTech);
      const totalWeight = baseWeight + weights.design + weights.code + weights.motion + weights.creativeTech;

      let targetRoughness = DISCIPLINE_PROFILES.base.roughness * baseWeight;
      let targetMetalness = DISCIPLINE_PROFILES.base.metalness * baseWeight;
      let targetClearcoat = DISCIPLINE_PROFILES.base.clearcoat * baseWeight;
      state.targetColor.setRGB(
        profileColors.base.r * baseWeight,
        profileColors.base.g * baseWeight,
        profileColors.base.b * baseWeight
      );

      for (const key of ['design', 'code', 'motion', 'creativeTech']) {
        const w = weights[key];
        if (w <= 0) continue;
        const profile = DISCIPLINE_PROFILES[key];
        targetRoughness += profile.roughness * w;
        targetMetalness += profile.metalness * w;
        targetClearcoat += profile.clearcoat * w;
        state.targetColor.r += profileColors[key].r * w;
        state.targetColor.g += profileColors[key].g * w;
        state.targetColor.b += profileColors[key].b * w;
      }

      targetRoughness /= totalWeight;
      targetMetalness /= totalWeight;
      targetClearcoat /= totalWeight;
      state.targetColor.r /= totalWeight;
      state.targetColor.g /= totalWeight;
      state.targetColor.b /= totalWeight;

      // Slow damp, not an instant snap — the material should feel like it's
      // drifting, never visibly "changing".
      const matLambda = 1.8;
      state.roughness = THREE.MathUtils.damp(state.roughness, targetRoughness, matLambda, dt);
      state.metalness = THREE.MathUtils.damp(state.metalness, targetMetalness, matLambda, dt);
      state.clearcoat = THREE.MathUtils.damp(state.clearcoat, targetClearcoat, matLambda, dt);
      state.color.lerp(state.targetColor, 1 - Math.exp(-matLambda * dt));

      material.roughness = state.roughness;
      material.metalness = state.metalness;
      material.clearcoat = state.clearcoat;
      material.color.copy(state.color);

      // --- decay -> beauty: craquelure visibility + gold-fill -------------
      // Cracks build in gradually across the whole pre-reveal journey, then
      // right at the signature reveal (SIGNATURE_START -> SIGNATURE_PEAK,
      // the site's one designated visual climax — reused rather than
      // competing with it) their color crossfades from a muted aged tone
      // into warm gold: a kintsugi read, not a "damaged" one. Stays filled
      // afterward, same as every other post-reveal state. Also a slow
      // crossfade like the discipline blend above, so it stays active under
      // reduced motion — and see the shape block below, which reads these
      // same two values to actually deform the mesh, not just recolor it.
      const shader = material.userData.shader;
      if (shader) {
        const targetCrackVisibility = THREE.MathUtils.smoothstep(p, 0, SIGNATURE_START);
        const targetGoldMix = THREE.MathUtils.smoothstep(p, SIGNATURE_START, SIGNATURE_PEAK);
        state.crackVisibility = THREE.MathUtils.damp(state.crackVisibility, targetCrackVisibility, matLambda, dt);
        state.goldMix = THREE.MathUtils.damp(state.goldMix, targetGoldMix, matLambda, dt);
        shader.uniforms.uCrackVisibility.value = state.crackVisibility;
        shader.uniforms.uGoldMix.value = state.goldMix;
      }
    }

    // --- shape: squash & stretch (dominant) + a whisper of noise (texture) ---
    // Skipped entirely under reduced motion — a still, resting sphere, and
    // it saves the per-vertex loop + computeVertexNormals() every frame.
    if (!reducedMotion) {
      const speed = state.vel.length();

      // Travel direction only updates once the orb is actually moving with
      // some conviction — otherwise it'd jitter direction near zero speed.
      if (speed > 0.06) {
        state.travelDir.set(state.vel.x, state.vel.y, state.vel.z).multiplyScalar(1 / speed);
      }
      // Rotate the (world-space) travel direction into the mesh's current
      // local space — see the invRotation/localTravelDir comment above.
      state.invRotation.copy(mesh.quaternion).invert();
      state.localTravelDir.copy(state.travelDir).applyQuaternion(state.invRotation);
      const dirX = state.localTravelDir.x;
      const dirY = state.localTravelDir.y;
      const dirZ = state.localTravelDir.z;

      const STRETCH_SPEED_MAX = 3.2;
      const MAX_STRETCH = 0.16; // restrained — a hint of inertia, not jelly
      const stretchAmt = Math.min(speed, STRETCH_SPEED_MAX) / STRETCH_SPEED_MAX * MAX_STRETCH;
      const stretch = 1 + stretchAmt;
      const squash = 1 / Math.sqrt(stretch); // volume-preserving-ish

      // Slow, low-frequency wobble — deliberately broad (few oscillations
      // across the whole sphere) so it reads as an irregular SILHOUETTE
      // (a soft pebble/fluid blob), not fine surface noise. ~4.5% of
      // radius, within the 3-6% the brief asks for. Time factors are tiny
      // so the shape drifts continuously but never looks like it "pops".
      const t = performance.now() * 0.00004;
      const noiseAmp = ORB_RADIUS * 0.045;

      // Decay, made physical: a shallow inward groove wherever the
      // precomputed crackEdge is high (pre-reveal aged craquelure), a
      // deeper inward groove along facetEdge plus a per-facet radial
      // offset (facetBulge) once uGoldMix rises — the shader's crack/gold
      // coloring was drawing lines that had no actual depth; this is what
      // makes them read as real fissures and an actually cut, irregular
      // gem surface instead of a decal on a still-perfect sphere. Depths
      // are intentionally asymmetric (shallow fine groove, much deeper
      // facet groove) — see decayGeometry's comment for why the fine
      // scale has to stay shallow at this vertex density.
      const crackGrooveDepth = -ORB_RADIUS * 0.02;
      const facetGrooveDepth = -ORB_RADIUS * 0.065;
      const facetBulgeAmp = ORB_RADIUS * 0.035;
      const crackVisibility = state.crackVisibility;
      const goldMix = state.goldMix;

      const posAttr = mesh.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const vi = i / 3;
        const bx = basePositions[i];
        const by = basePositions[i + 1];
        const bz = basePositions[i + 2];

        // decompose into along-travel-direction + perpendicular remainder
        const along = bx * dirX + by * dirY + bz * dirZ;
        const perpX = bx - along * dirX;
        const perpY = by - along * dirY;
        const perpZ = bz - along * dirZ;
        const sx = dirX * along * stretch + perpX * squash;
        const sy = dirY * along * stretch + perpY * squash;
        const sz = dirZ * along * stretch + perpZ * squash;

        const nx = baseNormals[i];
        const ny = baseNormals[i + 1];
        const nz = baseNormals[i + 2];
        const n =
          0.5 * Math.sin(bx * 0.9 + t * 3 + by * 0.4) +
          0.3 * Math.sin(by * 1.1 - t * 2.1 + bz * 0.6) +
          0.2 * Math.sin(bz * 0.8 + t * 2.6 + bx * 0.5);
        const decayD =
          decayGeometry.crackEdge[vi] * crackVisibility * crackGrooveDepth +
          decayGeometry.facetEdge[vi] * goldMix * facetGrooveDepth +
          decayGeometry.facetBulge[vi] * goldMix * facetBulgeAmp;
        const d = n * noiseAmp + decayD;

        arr[i] = sx + nx * d;
        arr[i + 1] = sy + ny * d;
        arr[i + 2] = sz + nz * d;
      }
      posAttr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  });

  const orbMesh = (
    <mesh ref={meshRef} geometry={geometry}>
      {/* MeshPhysicalMaterial, not MeshStandardMaterial — it's the same
          matte-pearl look at clearcoat=0 (Motion is the only profile that
          ever raises it), and the material story needs clearcoat to make
          the "soft liquid sheen" beat land. One small low-poly mesh, so
          the extra per-pixel cost is negligible — see the "only if it
          demonstrably earns it" note this file has carried since v1. */}
      <meshPhysicalMaterial
        ref={materialRef}
        color="#f4ead8"
        roughness={0.5}
        metalness={0.02}
        clearcoat={0}
        clearcoatRoughness={0.15}
        onBeforeCompile={handleBeforeCompile}
      />
    </mesh>
  );

  return reducedMotion ? orbMesh : <OrbTrail>{orbMesh}</OrbTrail>;
}
