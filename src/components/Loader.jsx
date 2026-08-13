import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Deliberately brief — there are no heavy assets gating first paint (project
// images lazy-load later), so this is a short branded beat rather than a
// real loading gate, per the brief: "if assets load quickly, skip an
// elaborate loader."
export function Loader({ onDone }) {
  const [visible, setVisible] = useState(true);
  const rootRef = useRef(null);
  const lineRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (reducedMotion) {
      setVisible(false);
      onDone?.();
      return undefined;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false);
        onDone?.();
      },
    });
    tl.set(lineRef.current, { scaleX: 0 })
      .to(lineRef.current, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' })
      .to(rootRef.current, { opacity: 0, duration: 0.5, ease: 'power2.out' }, '+=0.15');

    return () => tl.kill();
  }, [reducedMotion, onDone]);

  if (!visible) return null;

  return (
    <div ref={rootRef} className="loader" aria-hidden="true">
      <span className="loader__label">{site.initials}</span>
      <span ref={lineRef} className="loader__line" />
    </div>
  );
}
