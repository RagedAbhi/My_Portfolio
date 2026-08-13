import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTilt } from '../hooks/useTilt';

/*
 * Hero — the only section with a non-scroll-linked entrance: a staggered
 * timeline that plays once on load (background is already visible via the
 * page's own CSS, so it isn't a separate step). Timing follows the brief's
 * cinematic stagger: name -> roles -> supporting copy -> scroll hint.
 * A second, scroll-linked timeline fades the content out as the user
 * scrolls past it, so the hero recedes rather than cutting off abruptly.
 */
const ROLES = site.roles.split(' · ');

export function Hero() {
  const rootRef = useRef(null);
  const rolesTrackRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const tiltRef = useTilt({ maxTilt: 3 });

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(['.hero__greeting', '.hero__roles', '.hero__supporting', '.hero__scroll-hint'], {
          opacity: 1,
          y: 0,
        });
        gsap.set('.hero__name .line', { yPercent: 0 });
        gsap.set('.hero__numeral', { opacity: 0.07 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      // A single huge, near-invisible numeral bleeding off the top-right
      // corner — same atmosphere-layer idea as About's background words
      // (see About.jsx), so the large empty region to the right of the
      // name reads as composed negative space rather than unfinished. Fades
      // in slowly and quietly; it's texture, never competing for the eye.
      tl.fromTo('.hero__numeral', { opacity: 0 }, { opacity: 0.07, duration: 1.8, ease: 'sine.out' }, 0)
        .fromTo('.hero__greeting', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8 }, 0.2)
        // The name rises up from behind its own mask rather than fading —
        // .line-mask clips (overflow: hidden) while .line (the actual text)
        // is what moves, so it reads as the words being revealed, not
        // materializing. The one differentiated "signature move" for the
        // first thing a visitor sees.
        .fromTo(
          '.hero__name .line',
          { yPercent: 110 },
          { yPercent: 0, duration: 1.1, stagger: 0.12 },
          0.2
        )
        .fromTo('.hero__roles', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 0.45)
        .fromTo('.hero__supporting', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 1.0)
        .fromTo('.hero__scroll-hint', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.3);

      // Roles cycle through one at a time (rolodex-style, reusing the same
      // masked-line idea the name reveal uses above) rather than sitting as
      // a static comma-separated row — the "many disciplines, one person"
      // idea About/Skills already carry, told here as motion instead of a
      // flat list. Starts once the row has finished fading in, loops
      // forever (this is idle/ambient, unlike the one-time entrance tl).
      if (rolesTrackRef.current) {
        gsap.timeline({ repeat: -1, delay: 2.3 })
          .to(rolesTrackRef.current, { yPercent: -33.333, duration: 0.7, ease: 'power4.out' }, '+=1.8')
          .to(rolesTrackRef.current, { yPercent: -66.667, duration: 0.7, ease: 'power4.out' }, '+=1.8')
          .to(rolesTrackRef.current, { yPercent: 0, duration: 0.7, ease: 'power4.out' }, '+=1.8');
      }

      gsap.to(['.hero__content', '.hero__numeral'], {
        opacity: 0,
        y: -28,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="hero" ref={rootRef} className="section section--hero">
      <p className="hero__numeral js-reveal" aria-hidden="true">
        01
      </p>
      <div className="hero__content" ref={tiltRef}>
        <div className="hero__top">
          <p className="hero__greeting js-reveal">{site.hero.greeting}</p>
          <h1 className="heading-xl hero__name">
            <span className="line-mask">
              <span className="line">{site.hero.line1}</span>
            </span>
            <span className="line-mask">
              <span className="line">{site.hero.line2}</span>
            </span>
          </h1>
        </div>
        <div className="hero__bottom">
          {reducedMotion ? (
            <p className="hero__roles js-reveal">{site.roles}</p>
          ) : (
            // Full flat text stays in aria-label for screen readers — only
            // one role is ever visually legible at a time, but nothing is
            // actually hidden from assistive tech.
            <div className="hero__roles hero__roles--cycle js-reveal" aria-label={site.roles}>
              <div className="hero__roles-track" ref={rolesTrackRef} aria-hidden="true">
                {ROLES.map((role) => (
                  <span key={role} className="hero__roles-item">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="hero__supporting js-reveal">{site.hero.supporting}</p>
        </div>
      </div>
      <div className="hero__scroll-hint js-reveal">
        <span>{site.hero.scrollHint}</span>
        <span className="hero__scroll-hint-arrow" aria-hidden="true">
          ↓
        </span>
      </div>
    </section>
  );
}
