import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useJourney } from '../state/JourneyContext';
import { scrollState } from '../state/scrollState';
import { orbState } from '../state/orbState';
import { CAMERA_DAMPING, CAMERA_ORBIT_INFLUENCE_MAX, CAMERA_LOOKAT_LEAD } from '../config/journey';

// Interpolates {z, xOffset, yOffset} between the two keyframes bracketing p,
// with a smoothstep ease so the camera never changes direction abruptly at
// a keyframe boundary. Writes into `out` rather than returning a new object
// — this runs every frame, so it stays allocation-free like the rest of
// the per-frame path.
function assignFrame(out, frame) {
  out.z = frame.z;
  out.xOffset = frame.xOffset;
  out.yOffset = frame.yOffset;
  return out;
}

function sampleKeyframes(keyframes, p, out) {
  if (p <= keyframes[0].p) return assignFrame(out, keyframes[0]);
  const last = keyframes[keyframes.length - 1];
  if (p >= last.p) return assignFrame(out, last);

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = (p - a.p) / (b.p - a.p);
      const e = t * t * (3 - 2 * t); // smoothstep
      out.z = THREE.MathUtils.lerp(a.z, b.z, e);
      out.xOffset = THREE.MathUtils.lerp(a.xOffset, b.xOffset, e);
      out.yOffset = THREE.MathUtils.lerp(a.yOffset, b.yOffset, e);
      return out;
    }
  }
  return assignFrame(out, last);
}

/*
 * CameraController — the camera OBSERVES the journey; it does not chase
 * the orb. Its position/framing come from CAMERA_KEYFRAMES (config/journey
 * .js), keyed to progress and smoothstep-interpolated, exactly like the
 * Thread's shape: driven by the same timeline, but with its own
 * independent choreography rather than a rigid follow-cam.
 *
 * The orb is allowed a hint of influence (subtle parallax) but it is
 * clamped to CAMERA_ORBIT_INFLUENCE_MAX — small enough that the orb's
 * spring overshoot never reads as camera shake.
 *
 * A second damping pass (CAMERA_DAMPING, slower/calmer than the orb's own
 * spring) is applied to the final position/lookAt so the camera's motion
 * always feels deliberate, never snappy — "calmly travelling through a
 * designed space," per the brief.
 */
// Fixed, unchanging framing used under reduced motion — no dolly, no
// lateral drift, no signature pull-back.
const STATIC_FRAME = { z: 6.5, xOffset: 0, yOffset: 0.35 };

export function CameraController({ reducedMotion = false }) {
  const { curve, cameraKeyframes } = useJourney();

  const scratch = useRef({
    curvePoint: new THREE.Vector3(),
    lookAtPoint: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(),
    kf: { z: 0, xOffset: 0, yOffset: 0 },
    initialized: false,
  }).current;

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const p = THREE.MathUtils.clamp(scrollState.progress, 0, 1);

    curve.getPointAt(p, scratch.curvePoint);
    const kf = reducedMotion ? STATIC_FRAME : sampleKeyframes(cameraKeyframes, p, scratch.kf);

    // Small, hard-clamped nudge toward the orb's actual position — a hint
    // of parallax, never a follow-cam. Skipped under reduced motion (no
    // parallax at all).
    let dx = 0;
    let dy = 0;
    if (!reducedMotion) {
      dx = THREE.MathUtils.clamp(
        orbState.position.x - scratch.curvePoint.x,
        -CAMERA_ORBIT_INFLUENCE_MAX,
        CAMERA_ORBIT_INFLUENCE_MAX
      );
      dy = THREE.MathUtils.clamp(
        orbState.position.y - scratch.curvePoint.y,
        -CAMERA_ORBIT_INFLUENCE_MAX,
        CAMERA_ORBIT_INFLUENCE_MAX
      );
    }

    scratch.targetPos.set(
      scratch.curvePoint.x + kf.xOffset + dx,
      scratch.curvePoint.y + kf.yOffset + dy,
      scratch.curvePoint.z + kf.z
    );

    const lookAtP = reducedMotion ? p : Math.min(p + CAMERA_LOOKAT_LEAD, 1);
    curve.getPointAt(lookAtP, scratch.lookAtPoint);
    scratch.targetLookAt.copy(scratch.lookAtPoint);

    if (!scratch.initialized) {
      camera.position.copy(scratch.targetPos);
      scratch.currentLookAt.copy(scratch.targetLookAt);
      scratch.initialized = true;
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, scratch.targetPos.x, CAMERA_DAMPING, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, scratch.targetPos.y, CAMERA_DAMPING, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, scratch.targetPos.z, CAMERA_DAMPING, dt);
      scratch.currentLookAt.x = THREE.MathUtils.damp(scratch.currentLookAt.x, scratch.targetLookAt.x, CAMERA_DAMPING, dt);
      scratch.currentLookAt.y = THREE.MathUtils.damp(scratch.currentLookAt.y, scratch.targetLookAt.y, CAMERA_DAMPING, dt);
      scratch.currentLookAt.z = THREE.MathUtils.damp(scratch.currentLookAt.z, scratch.targetLookAt.z, CAMERA_DAMPING, dt);
    }

    camera.lookAt(scratch.currentLookAt);
  });

  return null;
}
