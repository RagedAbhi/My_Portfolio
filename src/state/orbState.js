import * as THREE from 'three';

// Orb's current world position, written once per frame by Orb.jsx and read
// by CameraController for its (deliberately small, clamped) parallax hint.
// Same mutable-module pattern as scrollState/pointerState — no re-renders.
export const orbState = {
  position: new THREE.Vector3(),
};
