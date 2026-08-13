/*
 * pointerState — mirrors scrollState's pattern: a mutable module-level
 * object updated by one window-level listener, read by whoever needs it
 * (Orb for its cursor-attraction offset, Cursor for the custom cursor dot)
 * without causing React re-renders. A single listener because the 3D
 * canvas is `pointer-events: none` (the DOM must stay clickable), so R3F's
 * own pointer tracking never fires — we track the raw window pointer
 * instead and let each consumer project it however it needs.
 */
export const pointerState = {
  clientX: 0,
  clientY: 0,
  ndcX: 0, // -1..1, left to right
  ndcY: 0, // -1..1, bottom to top (matches WebGL NDC convention)
  active: false, // false until the first real pointer event (avoids a (0,0) snap)
};

let initialized = false;

export function initPointerTracking() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const onMove = (e) => {
    pointerState.clientX = e.clientX;
    pointerState.clientY = e.clientY;
    pointerState.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerState.ndcY = -((e.clientY / window.innerHeight) * 2 - 1);
    pointerState.active = true;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
}
