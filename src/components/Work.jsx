import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function Work() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(['.work__intro .kicker', '.work__intro .heading-lg', '.work__intro .lead'], { opacity: 1, y: 0 });
        gsap.set('.work__intro .heading-lg', { clipPath: 'inset(0 0 0% 0)' });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 70%',
          toggleActions: 'play reverse play reverse',
        },
      });

      // The heading wipes up from behind a clip-path mask — the same
      // technique Project's media reveal already uses, so Work's intro
      // rhymes with what's about to follow rather than reusing Hero's or
      // About's move. Kicker/lead stay a plain fade underneath it.
      tl.fromTo(
        '.work__intro .heading-lg',
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'power4.out' },
        0
      ).from(
        ['.work__intro .kicker', '.work__intro .lead'],
        { opacity: 0, y: 24, duration: 0.8, ease: 'power4.out', stagger: 0.1 },
        0.1
      );
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="work" ref={rootRef} className="section section--work">
      <div className="work__intro">
        <p className="kicker">03 — {site.work.kicker}</p>
        <h2 className="heading-lg">{site.work.heading}</h2>
        <p className="lead">{site.work.lead}</p>
      </div>
    </section>
  );
}
