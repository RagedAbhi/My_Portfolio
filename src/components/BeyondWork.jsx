import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { beyondWorkData } from '../data/beyondWork';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*
 * BeyondWork — Section 06: Reflective, ultra-minimal editorial typography.
 * Large typography, huge negative space, and quiet scroll-triggered reveals
 * showing personality and intellectual influences.
 */
export function BeyondWork() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(['.beyondWork__kicker', '.beyondWork__heading', '.beyondWork__interest'], {
          opacity: 1,
          y: 0,
        });
        return;
      }

      gsap.fromTo(
        '.beyondWork__header',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 75%',
          },
        }
      );

      gsap.fromTo(
        '.beyondWork__interest',
        { opacity: 0.15, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.beyondWork__grid',
            start: 'top 75%',
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="beyondWork" ref={rootRef} className="section section--beyondWork">
      <div className="beyondWork__inner">
        <div className="beyondWork__header">
          <p className="kicker">{beyondWorkData.kicker}</p>
          <h2 className="heading-lg beyondWork__heading">{beyondWorkData.heading}</h2>
          <p className="lead beyondWork__sub">{beyondWorkData.subheading}</p>
        </div>

        <div className="beyondWork__grid">
          {beyondWorkData.interests.map((item, idx) => (
            <div key={item.id} className={`beyondWork__interest beyondWork__interest--${idx}`}>
              <h3 className="beyondWork__interest-title">{item.title}</h3>
              <p className="beyondWork__interest-desc">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
