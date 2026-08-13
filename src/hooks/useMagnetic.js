import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

const DEFAULT_STRENGTH = 0.35;
const DEFAULT_MAX_OFFSET = 10; // px — a lean, not a lurch

/*
 * useMagnetic — the element visually leans a few px toward the cursor while
 * hovered, snapping back on leave. gsap.quickTo (not a fresh .to() per
 * pointermove) is what keeps this cheap: it builds one tween once and just
 * retargets it, so rapid mousemove firing never stacks tweens or reallocates.
 * Off entirely under reduced motion — this is pure flourish, no information
 * is carried by it.
 */
export function useMagnetic({ strength = DEFAULT_STRENGTH, maxOffset = DEFAULT_MAX_OFFSET } = {}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return undefined;

    const quickX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const quickY = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      quickX(gsap.utils.clamp(-maxOffset, maxOffset, dx * strength));
      quickY(gsap.utils.clamp(-maxOffset, maxOffset, dy * strength));
    };
    const onLeave = () => {
      quickX(0);
      quickY(0);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [reducedMotion, strength, maxOffset]);

  return ref;
}
