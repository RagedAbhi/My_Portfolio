import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*
 * About — one pinned 100vh "stage" for the whole (tall) About section.
 *
 * Two layers that never compete for attention:
 *  - .about__content: the actual content (kicker, heading, paragraph) —
 *    a single stable column, left-aligned, that fades in once and stays
 *    put for the whole section. This always wins the eye.
 *  - .about__atmosphere: DESIGN / CODE / MOTION / EXPERIMENTATION, pinned
 *    to the four corners at low, constant-ish opacity, drifting a few
 *    pixels and pulsing gently brighter at their own moment — texture,
 *    not content. They're positioned away from the content column and the
 *    orb's path (see the about x-range in config/journey.js) on purpose.
 *
 * Still one ScrollTrigger for the section (pin + a scrubbed timeline for
 * both layers), per the plan's "one trigger per section" rule.
 */
export function About() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray('.about__word');

      if (reducedMotion) {
        gsap.set('.about__content', { opacity: 1, y: 0 });
        gsap.set(words, { opacity: 0.14 });
        return;
      }

      gsap.set('.about__content', { opacity: 0, y: 18 });
      // The kicker gets its own small settle — a skew that resolves to
      // upright just as the content fades in, rather than moving with it
      // as one flat block. About's differentiated move (Hero masks its
      // name, Work clip-wipes its heading, this skews its kicker).
      gsap.set('.about__content .kicker', { skewY: 8, transformOrigin: 'left center' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          pin: stageRef.current,
        },
      });

      // Content: one lifecycle — in, hold, out. Never re-triggered mid-section.
      tl.to('.about__content .kicker', { skewY: 0, duration: 0.08, ease: 'power4.out' }, 0.02)
        .to('.about__content', { opacity: 1, y: 0, duration: 0.1 }, 0.04)
        .to('.about__content', { opacity: 0, y: -14, duration: 0.1 }, 0.86);

      // Atmosphere: each word gets a slow drift + a gentle brightness pulse
      // at its own offset — texture passing by, never the main event.
      words.forEach((word, i) => {
        const t = 0.1 + i * 0.2;
        const driftY = i % 2 === 0 ? -15 : 15;
        gsap.set(word, { y: -driftY / 2 });
        tl.to(word, { y: driftY / 2, opacity: 0.22, duration: 0.36, ease: 'sine.inOut' }, t)
          .to(word, { y: driftY, opacity: 0.1, duration: 0.36, ease: 'sine.inOut' }, t + 0.36);
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="about" ref={rootRef} className="section section--about">
      <div ref={stageRef} className="about__stage">
        <div className="about__atmosphere" aria-hidden="true">
          {site.about.words.map((word, i) => (
            <p key={word} className={`about__word about__word--${i}`}>
              {word}
            </p>
          ))}
        </div>

        <div className="about__content">
          {/* Split into top/bottom groups so mobile (where the content
              column runs full-width, unlike desktop's fixed-left column)
              can push them apart and leave the screen-centered orb a clear
              band in between — same pattern as Hero's mobile split. */}
          <div className="about__content-top">
            <p className="kicker">02 — {site.about.kicker}</p>
            <h2 className="heading-lg">{site.about.heading}</h2>
          </div>
          <div className="about__content-bottom">
            <p className="lead">{site.about.lead}</p>
            <p className="body-copy">{site.about.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
