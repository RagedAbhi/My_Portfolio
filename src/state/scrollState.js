/*
 * scrollState — a mutable, module-level object updated once per scroll
 * event/frame by useLenis. Deliberately NOT React state: everything that
 * reads it does so inside useFrame or a GSAP callback, so writing here
 * never triggers a React re-render. This is what keeps scroll at 60fps
 * with a Canvas mounted behind eight-plus DOM sections.
 */
export const scrollState = {
  progress: 0, // 0-1 normalized journey progress, raw from ScrollTrigger
  velocity: 0, // progress units per second, signed
  direction: 1, // 1 = scrolling down/forward, -1 = up/backward
  // Damped trailing value of `progress`, updated once per frame by
  // three/JourneyClock. Orb, Thread and CameraController all read this
  // SAME value rather than each computing their own lag — otherwise three
  // independent damp() calls would drift out of sync with each other for
  // no visual benefit. This is what produces "orb lags behind fast
  // scrolling"; the orb's own spring adds acceleration/overshoot on top.
  laggedProgress: 0,
};

const listeners = new Set();

// Discrete-state consumers (e.g. the active-section nav indicator) can
// subscribe instead of polling every frame. Called only when progress
// actually changes, still outside React's render cycle.
export function subscribeScroll(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setScrollProgress(progress, velocity) {
  const prevProgress = scrollState.progress;
  scrollState.progress = progress;
  scrollState.velocity = velocity;
  if (Math.abs(velocity) > 0.00001) {
    scrollState.direction = velocity > 0 ? 1 : -1;
  }
  if (progress !== prevProgress) {
    listeners.forEach((fn) => fn(scrollState));
  }
}
