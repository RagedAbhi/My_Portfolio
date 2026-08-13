import { useMemo } from 'react';

function probeWebGL() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// The WebGL scene is an enhancement, not a dependency — all content lives
// in the DOM regardless of this result. See components/FallbackVisual.jsx.
export function useWebGLSupport() {
  return useMemo(probeWebGL, []);
}
