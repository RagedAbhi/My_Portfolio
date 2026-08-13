import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

const DEFAULT_MAX_TILT = 3; // degrees — kept small on purpose, a hint of depth, not a showcase effect

/*
 * useTilt — the returned element tilts a few degrees toward wherever the
 * cursor currently is in the viewport, like it's a slightly loose card
 * catching the light. Tracks window-wide pointermove (not just hover over
 * the element itself) since this is meant to read as "the whole hero
 * responds to you being here", not a narrow hover trick on one element.
 * gsap.quickTo again (see useMagnetic.js for the same reasoning) so rapid
 * mousemove firing retargets one tween instead of stacking new ones. Off
 * entirely under reduced motion.
 */
export function useTilt({ maxTilt = DEFAULT_MAX_TILT } = {}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return undefined;

    gsap.set(el, { transformPerspective: 900, transformOrigin: 'center' });
    const quickRotateX = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const quickRotateY = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      // Inverted on X: the top edge should tilt toward a cursor above it.
      quickRotateX(-py * 2 * maxTilt);
      quickRotateY(px * 2 * maxTilt);
    };

    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      gsap.set(el, { rotationX: 0, rotationY: 0 });
    };
  }, [reducedMotion, maxTilt]);

  return ref;
}
