import * as THREE from 'three';

/*
 * journey.js — the single source of truth for the scroll journey.
 *
 * SECTION_VH defines how tall each section is (in viewport heights). Every
 * other number in this file — section progress ranges, project anchors,
 * camera keyframes — is DERIVED from those heights, never hand-typed
 * separately. That's deliberate: if milestone fractions and DOM section
 * heights were tuned independently they would drift apart over edits. By
 * computing progress ranges from the same heights that drive the CSS
 * (via the --vh-* custom properties set in useSectionHeights), the DOM and
 * the 3D world can never disagree about where a section is.
 *
 * The curve itself lives in world space and has no knowledge of pixels.
 * Progress (0→1) is the only thing connecting scroll, DOM and 3D.
 */

// ---- Section heights (vh units) -------------------------------------------
// Desktop. About was 320 and signature was 100 originally; About alone plus
// Hero was 4+ screens of scrolling before any project appeared, and the
// signature reveal — the single most work-intensive moment in the whole
// scene — lived in a window narrow enough to blow past on one fast scroll.
// Trimmed the former, widened the latter. See LEGACY_SECTION_VH_DESKTOP
// below for why changing these two numbers is safe: every curve/camera/
// anchor keyframe hand-tuned against the OLD proportions gets reinterpreted
// against these new ones automatically, rather than silently drifting.
export const SECTION_VH_DESKTOP = {
  hero: 100,
  about: 180,
  experience: 160,
  work: 90,
  cuerates: 140,
  autotrack: 140,
  apple3d: 140,
  skills: 110,
  beyondWork: 130,
  contact: 120,
};

export const SECTION_VH_MOBILE = {
  hero: 90,
  about: 160,
  experience: 160,
  work: 80,
  cuerates: 130,
  autotrack: 130,
  apple3d: 130,
  skills: 130,
  beyondWork: 130,
  contact: 110,
};

const SECTION_ORDER = [
  'hero',
  'about',
  'experience',
  'work',
  'cuerates',
  'autotrack',
  'apple3d',
  'skills',
  'beyondWork',
  'contact',
];

// Derive {start, end} progress (0-1) for every section from its vh height.
export function computeSections(isMobile) {
  const heights = isMobile ? SECTION_VH_MOBILE : SECTION_VH_DESKTOP;
  const total = SECTION_ORDER.reduce((sum, id) => sum + heights[id], 0);
  let cursor = 0;
  const sections = {};
  for (const id of SECTION_ORDER) {
    const start = cursor / total;
    cursor += heights[id];
    const end = cursor / total;
    sections[id] = { start, end, mid: (start + end) / 2 };
  }
  return { sections, totalVh: total };
}

// ---- Legacy-p remapping -----------------------------------------------------
// The curve/camera/anchor/signature tables below were all hand-tuned as
// ABSOLUTE progress fractions (p: 0.12, p: 0.48, ...) while SECTION_VH_*
// held these frozen values (about=320, signature=100). That's exactly the
// trap the file's own opening comment warns against: those numbers were
// never actually DERIVED from SECTION_VH, just hand-copied to match it once
// — so changing a section's height (as about's and signature's just did
// above) would silently leave the curve shape, camera framing and project
// anchors pointing at the wrong place, unless something reinterprets them.
//
// remapLegacyP does that: it figures out which section an old p fell inside
// (against these frozen legacy heights) and what fraction of that section
// it represented, then resolves the same (section, fraction) pair against
// whatever computeSections() says NOW. Every table below is still written
// as the exact same literal p values that were visually tuned by hand —
// only wrapped in remapLegacyP() — so this is a reinterpretation layer, not
// a rewrite of the tuning itself. If a section's height changes again in
// the future, everything downstream moves with it automatically.
const LEGACY_SECTION_VH_DESKTOP = {
  hero: 100,
  about: 320,
  experience: 160,
  work: 90,
  cuerates: 140,
  autotrack: 140,
  apple3d: 140,
  skills: 110,
  beyondWork: 130,
  contact: 120,
};
const LEGACY_SECTION_VH_MOBILE = {
  hero: 90,
  about: 280,
  experience: 160,
  work: 80,
  cuerates: 130,
  autotrack: 130,
  apple3d: 130,
  skills: 130,
  beyondWork: 130,
  contact: 110,
};

function legacySections(isMobile) {
  const heights = isMobile ? LEGACY_SECTION_VH_MOBILE : LEGACY_SECTION_VH_DESKTOP;
  const total = SECTION_ORDER.reduce((sum, id) => sum + heights[id], 0);
  let cursor = 0;
  const sections = {};
  for (const id of SECTION_ORDER) {
    const start = cursor / total;
    cursor += heights[id];
    sections[id] = { start, end: cursor / total };
  }
  return sections;
}

function remapLegacyP(oldP, isMobile) {
  const legacy = legacySections(isMobile);
  const current = computeSections(isMobile).sections;
  let ownerId = SECTION_ORDER[SECTION_ORDER.length - 1];
  for (const id of SECTION_ORDER) {
    if (oldP < legacy[id].end) {
      ownerId = id;
      break;
    }
  }
  const legacyRange = legacy[ownerId];
  const frac = (oldP - legacyRange.start) / (legacyRange.end - legacyRange.start);
  const currentRange = current[ownerId];
  return currentRange.start + frac * (currentRange.end - currentRange.start);
}

// ---- Journey curve control points ------------------------------------------
// A single flowing thread — descending steadily (y = -p * DEPTH, strictly
// monotonic) with elegant sideways sweeps (x, below). Not a letterform: an
// earlier version forced the whole curve into a stylized "A", but the
// crossbar (a loop-back stroke through the interior) read as a bulging
// balloon under CatmullRomCurve3's smoothing rather than a clean bar, and
// chasing letter-recognition kept fighting the organic/restrained brief.
// This is closer to the site's original curve, refined: mostly downward,
// never far from center, with a soft flourish at the signature reveal
// instead of a forced shape.
const CURVE_KEYS_DESKTOP_LEGACY = [
  { p: 0.0, x: 0.9 }, // Hero — orb right of center
  { p: 0.12, x: 0.0 }, // About starts
  { p: 0.18, x: 1.6 }, // About weave — stays right of the fixed-left column
  { p: 0.26, x: 0.4 },
  { p: 0.34, x: 1.3 },
  { p: 0.38, x: 0.0 }, // Work intro
  { p: 0.48, x: -1.8 }, // Cuerates
  { p: 0.6, x: 1.8 }, // AutoTrack
  { p: 0.72, x: -1.8 }, // Apple 3D
  { p: 0.78, x: -0.6 }, // Signature starts
  { p: 0.82, x: 0.8 }, // signature peak — a soft flourish, not a straight drop
  { p: 0.86, x: 0.2 }, // Skills starts
  { p: 0.94, x: 0.0 },
  { p: 1.0, x: 0.0 }, // Contact / end
];

// Same shape, ~0.4x lateral amplitude and shorter depth — mobile's
// narrower viewport needs less lateral/vertical travel per the responsive
// plan.
const CURVE_KEYS_MOBILE_LEGACY = [
  { p: 0.0, x: 0.35 },
  { p: 0.12, x: 0.0 },
  { p: 0.18, x: 0.6 },
  { p: 0.26, x: 0.15 },
  { p: 0.34, x: 0.5 },
  { p: 0.38, x: 0.0 },
  { p: 0.48, x: -0.7 },
  { p: 0.6, x: 0.7 },
  { p: 0.72, x: -0.7 },
  { p: 0.78, x: -0.24 },
  { p: 0.82, x: 0.3 },
  { p: 0.86, x: 0.08 },
  { p: 0.94, x: 0.0 },
  { p: 1.0, x: 0.0 },
];

// Resolved against CURRENT section heights — see the remapLegacyP note above.
const CURVE_KEYS_DESKTOP = CURVE_KEYS_DESKTOP_LEGACY.map(({ p, x }) => ({ p: remapLegacyP(p, false), x }));
const CURVE_KEYS_MOBILE = CURVE_KEYS_MOBILE_LEGACY.map(({ p, x }) => ({ p: remapLegacyP(p, true), x }));

export const DEPTH_DESKTOP = 30;
export const DEPTH_MOBILE = 22;

export function buildJourneyCurve(isMobile) {
  const keys = isMobile ? CURVE_KEYS_MOBILE : CURVE_KEYS_DESKTOP;
  const depth = isMobile ? DEPTH_MOBILE : DEPTH_DESKTOP;
  const points = keys.map(({ p, x }) => new THREE.Vector3(x, -p * depth, 0));
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  curve.arcLengthDivisions = 200;
  return curve;
}

// ---- Project anchors --------------------------------------------------------
// Progress position + influence radius (in progress-space) used by the
// orb's gravity falloff. Side alternates so projects don't stack visually.
// p resolved via remapLegacyP — see the note above computeSections(). radius
// is left as a flat progress-space tolerance rather than also remapped: it's
// a small gravity-catch window, not a position, and the total document
// length only shifted by a few percent, so the drift in its absolute vh
// size isn't perceptible.
export const PROJECT_ANCHORS = [
  { id: 'cuerates', p: remapLegacyP(0.48, false), radius: 0.07, side: -1 },
  { id: 'autotrack', p: remapLegacyP(0.6, false), radius: 0.07, side: 1 },
  { id: 'apple3d', p: remapLegacyP(0.72, false), radius: 0.07, side: -1 },
];

// ---- Orb spring physics ------------------------------------------------------
export const SPRING = {
  stiffness: 70,
  damping: 10,
  maxDt: 1 / 30, // clamp so a tab-switch/frame-drop can't explode the integrator
  lagRate: 4.5, // how quickly laggedProgress chases raw scroll progress
  cursorInfluence: 0.15, // max world-unit offset toward the pointer
  cursorLambda: 5, // damp() rate for the cursor offset chasing the pointer
  gravityStrength: 0.55, // max lateral pull (world units) toward a project anchor
};

// ---- Camera choreography -----------------------------------------------------
// {p, z, xOffset, yOffset} — offsets are added to the curve point at the
// same progress to get the camera's target position. lookAt is always the
// curve point itself (optionally leading slightly). The camera interpolates
// between these keyframes with smoothstep + damping — it is NOT a rigid
// follow of the orb, so its motion stays calm even while the orb springs
// around under fast scrolling.
//
// IMPORTANT: because camera.lookAt() always re-centers its target, xOffset/
// yOffset change the VIEWING ANGLE (parallax) only — they do NOT move the
// orb's on-screen position, since whatever the camera looks at ends up
// centered regardless of where the camera physically sits. If a project's
// orb needs to sit clear of the DOM text at a given milestone, that's a
// layout concern (see .project__inner's gap in sections.css), not a camera
// tuning one — don't try to "push" the orb off-center from here again.
// p values below are the exact literals this was hand-tuned against
// (legacy about=320/signature=100), each wrapped in remapLegacyP so they
// stay aligned with the Signature DOM section's CURRENT global progress
// range instead of the old one — see the remapLegacyP note above
// computeSections() and the matching note on SIGNATURE_START below.
const CAMERA_KEYFRAMES_DESKTOP_LEGACY = [
  { p: 0.0, z: 6.5, xOffset: -0.6, yOffset: 0.4 },
  { p: 0.12, z: 6.5, xOffset: 0.3, yOffset: 0.3 },
  { p: 0.26, z: 6.5, xOffset: -0.4, yOffset: 0.3 },
  { p: 0.38, z: 7.0, xOffset: 0, yOffset: 0.4 },
  { p: 0.48, z: 6.5, xOffset: 0.9, yOffset: 0.3 },
  { p: 0.6, z: 6.5, xOffset: -0.9, yOffset: 0.3 },
  { p: 0.72, z: 6.5, xOffset: 0.9, yOffset: 0.3 },
  { p: 0.817, z: 6.5, xOffset: 0, yOffset: 0.4 },
  { p: 0.94, z: 6.0, xOffset: -0.3, yOffset: 0.3 },
  { p: 1.0, z: 6.0, xOffset: 0, yOffset: 0.3 },
];

const CAMERA_KEYFRAMES_MOBILE_LEGACY = [
  { p: 0.0, z: 8.5, xOffset: -0.2, yOffset: 0.3 },
  { p: 0.12, z: 8.0, xOffset: 0.1, yOffset: 0.3 },
  { p: 0.38, z: 8.5, xOffset: 0, yOffset: 0.3 },
  { p: 0.6, z: 8.5, xOffset: 0, yOffset: 0.3 },
  { p: 0.77, z: 8.5, xOffset: 0, yOffset: 0.3 },
  { p: 1.0, z: 8.0, xOffset: 0, yOffset: 0.3 },
];

export const CAMERA_KEYFRAMES_DESKTOP = CAMERA_KEYFRAMES_DESKTOP_LEGACY.map((k) => ({
  ...k,
  p: remapLegacyP(k.p, false),
}));
export const CAMERA_KEYFRAMES_MOBILE = CAMERA_KEYFRAMES_MOBILE_LEGACY.map((k) => ({
  ...k,
  p: remapLegacyP(k.p, true),
}));

// Lambda passed to THREE.MathUtils.damp for the camera's own position/lookAt
// smoothing (separate from, and calmer than, the orb's spring). Lower =
// slower to converge = more lag/calm; higher = snappier.
export const CAMERA_DAMPING = 3.2;
export const CAMERA_ORBIT_INFLUENCE_MAX = 0.18; // hard clamp on orb-parallax nudge, world units
export const CAMERA_LOOKAT_LEAD = 0.012; // small forward lead on progress for lookAt

// Bell-shaped weight (0-1) for how "revealed" the ghost thread + signature
// framing should be. Matches the Signature DOM section's own global range
// (see CAMERA_KEYFRAMES_DESKTOP above) so the visual peak happens while
// the user is actually inside that section. Same legacy literals as
// before (0.738/0.778/0.817), remapped — see the note above
// computeSections(). Widening signature's own SECTION_VH_DESKTOP (100->140)
// means this window is now proportionally wider too: more real scroll
// distance for the reveal to be on screen, so it's harder to blow past on
// a fast scroll. useLenis.js also reads these two to damp scroll speed
// through this exact window as extra insurance.
export const SIGNATURE_START = remapLegacyP(0.738, false);
export const SIGNATURE_PEAK = remapLegacyP(0.778, false);
export const SIGNATURE_END = remapLegacyP(0.817, false);

export function signatureWeight() {
  return 0;
}

// ---- Discipline "material story" -------------------------------------------
// The orb's material is a second, quieter storyteller: its finish drifts
// toward a distinct profile as the journey passes each discipline's
// mention — once early, in About's environmental words (DESIGN / CODE /
// MOTION / EXPERIMENTATION), and once late, in Skills' concrete list
// (Design / Development / Creative Technology). Same idea, said twice, so
// the two moments read as a callback rather than two unrelated effects.
// EXPERIMENTATION has no Skills counterpart, so it folds into creativeTech
// — same spirit (pushing tools further), one fewer profile to blend.
//
// Windows are derived from computeSections(), never hand-typed, for the
// same reason the rest of this file derives from SECTION_VH: two numbers
// tuned independently drift apart over edits. Desktop's section ranges are
// used for both breakpoints — like signatureWeight, this is an ambient
// effect, not a hard sync, so reusing one set of windows for mobile too is
// an acceptable simplification (see the SIGNATURE_* precedent above).
const { sections: DISCIPLINE_SECTIONS } = computeSections(false);

function splitRange(range, index, count) {
  const span = (range.end - range.start) / count;
  return { start: range.start + span * index, end: range.start + span * (index + 1) };
}

function smoothstep01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

// 0 outside [start, end]; smoothly ramps up/plateaus/ramps down inside —
// same shape as signatureWeight but reusable for an arbitrary window.
function windowWeight(p, { start, end }, fadeFrac = 0.35) {
  if (p <= start || p >= end) return 0;
  const fade = (end - start) * fadeFrac;
  return Math.min(smoothstep01((p - start) / fade), smoothstep01((end - p) / fade));
}

export const DISCIPLINE_WINDOWS = {
  design: [splitRange(DISCIPLINE_SECTIONS.about, 0, 4), splitRange(DISCIPLINE_SECTIONS.skills, 0, 3)],
  code: [splitRange(DISCIPLINE_SECTIONS.about, 1, 4), splitRange(DISCIPLINE_SECTIONS.skills, 1, 3)],
  motion: [splitRange(DISCIPLINE_SECTIONS.about, 2, 4)],
  creativeTech: [splitRange(DISCIPLINE_SECTIONS.about, 3, 4), splitRange(DISCIPLINE_SECTIONS.skills, 2, 3)],
};

// Material deltas per discipline. First pass at these values was tuned so
// conservatively (roughness 0.32-0.66, clearcoat 0-0.4, color nudges of a
// few RGB units) that it read as no change at all rather than restraint —
// under the scene's single key light + dim hemisphere fill, a difference
// has to be this large just to register as "the orb looks different here",
// let alone read clearly. Color still stays in the same warm-neutral family
// (no new hue — the site's one accent color is still cobalt), just with a
// wider swing in value/temperature so the shift is actually legible.
export const DISCIPLINE_PROFILES = {
  base: { roughness: 0.5, metalness: 0.02, clearcoat: 0, color: '#f4ead8' },
  design: { roughness: 0.85, metalness: 0.0, clearcoat: 0, color: '#f9f2e3' }, // chalky matte, lighter — product/UX
  code: { roughness: 0.12, metalness: 0.12, clearcoat: 0.3, color: '#e8e1cf' }, // crisp, glossy, denser — precision
  motion: { roughness: 0.22, metalness: 0.05, clearcoat: 0.85, color: '#f6ecda' }, // pronounced liquid sheen
  creativeTech: { roughness: 0.38, metalness: 0.08, clearcoat: 0.45, color: '#ece3d2' }, // cooler stone + rim light
};

// {design, code, motion, creativeTech} each 0-1 — how strongly the journey
// is currently "near" that discipline's mention. Consumed by Orb.jsx (material
// blend) and Lighting.jsx (rim light), and Skills.jsx derives its own
// active-group state from the same DISCIPLINE_WINDOWS.skills thirds so the
// UI and the orb's material are always talking about the same moment.
export function getDisciplineWeights(p) {
  const weights = { design: 0, code: 0, motion: 0, creativeTech: 0 };
  for (const key of Object.keys(DISCIPLINE_WINDOWS)) {
    for (const win of DISCIPLINE_WINDOWS[key]) {
      weights[key] = Math.max(weights[key], windowWeight(p, win));
    }
  }
  return weights;
}

// Discrete "which Skills group is active right now" — for the UI echo in
// Skills.jsx. A fuzzy blend doesn't make sense for a list item (it's either
// highlighted or it isn't), so this reads the exact same skills-section
// thirds as hard cutoffs instead of the smoothed windows above. Matches
// data/skills.js's group order (design, development, creative-tech).
const SKILLS_GROUP_IDS = ['design', 'development', 'creative-tech'];

export function getActiveSkillsGroup(p) {
  const range = DISCIPLINE_SECTIONS.skills;
  if (p < range.start || p >= range.end) return null;
  const index = Math.min(2, Math.floor(((p - range.start) / (range.end - range.start)) * 3));
  return SKILLS_GROUP_IDS[index];
}
