import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMagnetic } from '../hooks/useMagnetic';

export function Contact() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const ctaRef = useMagnetic({ strength: 0.4, maxOffset: 12 });

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const targets = [
        '.contact__headline .heading-lg',
        '.contact__sub',
        '.contact__cta',
        '.contact__links',
      ];
      if (reducedMotion) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      gsap.from(targets, {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: 'power4.out',
        stagger: 0.1,
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', toggleActions: 'play reverse play reverse' },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="contact" ref={rootRef} className="section section--contact">
      <div className="contact__inner">
        <div>
          <p className="kicker">05 — {site.contact.kicker}</p>
          <div className="contact__headline">
            <h2 className="heading-lg">{site.contact.lineEnd}</h2>
            <h2 className="heading-lg">{site.contact.question}</h2>
          </div>
          <p className="contact__sub lead">{site.contact.sub}</p>
          <a ref={ctaRef} className="contact__cta" href={`mailto:${site.contact.email}`}>
            {site.contact.ctaLabel.toUpperCase()}
            <span className="contact__cta-arrow" aria-hidden="true">
              →
            </span>
          </a>
        </div>
        <nav className="contact__links" aria-label="Social links">
          <a href={site.social.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a href={site.social.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={`mailto:${site.contact.email}`}>Email</a>
        </nav>
      </div>
      <div className="contact__footer">
        <span>© {new Date().getFullYear()} {site.name}</span>
      </div>
    </section>
  );
}
