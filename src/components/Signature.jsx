import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*
 * Signature — the reward moment, and NOT a content section. The event is
 * the camera pulling back and the full thread becoming visible (see
 * CameraController's dolly + Thread's signatureWeight-driven reveal, both
 * tied to the exact same global progress window as this section — see the
 * note by SIGNATURE_START in journey.js). Text here is a small, secondary
 * caption that only appears in the second half of the section, once the
 * visual peak has already happened and the camera is on its way back —
 * the user should see the whole path before they see any words about it.
 */
export function Signature() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.signature__content', { opacity: 1 });
        return;
      }

      gsap.set('.signature__content', { opacity: 0, y: 10 });

      gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
        },
      })
        .to('.signature__content', { opacity: 1, y: 0, duration: 0.16 }, 0.58)
        .to('.signature__content', { opacity: 0, y: -8, duration: 0.12 }, 0.9);
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="signature" ref={rootRef} className="section section--signature">
      <div className="signature__content">
        <p className="signature__kicker">{site.reveal.kicker}</p>
        <p className="signature__line">{site.reveal.body}</p>
      </div>
    </section>
  );
}
