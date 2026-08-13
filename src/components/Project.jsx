import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ProjectMedia } from './ProjectMedia';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMagnetic } from '../hooks/useMagnetic';

/*
 * Project — one project as a destination along the thread, not a card in a
 * grid (see the plan: projects exist along the thread; the orb discovers
 * them via the gravity falloff in three/Orb.jsx / PROJECT_ANCHORS). Image
 * and text alternate sides per project so the sequence doesn't feel like a
 * repeated template.
 *
 * Reveal: the image clips up from a slight inset + tiny scale settle,
 * text staggers in underneath — both under ~30px of movement per the
 * brief, one ScrollTrigger owning both.
 */
export function Project({ project, reverse }) {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const linkRef = useMagnetic({ strength: 0.4, maxOffset: 10 });

  // Contextual cursor label on the media itself — NOT a cursor replacement
  // (a generic custom cursor was tried and removed earlier for feeling
  // cliché). This only appears over a specific hover target and names the
  // action, closer to a tooltip that follows the pointer than a cursor
  // skin. Position is written directly to the DOM node (see labelRef) on
  // every pointermove rather than through React state — only the boolean
  // visibility toggle goes through state, matching the rest of the site's
  // no-per-frame-re-render convention.
  const labelRef = useRef(null);
  const [labelVisible, setLabelVisible] = useState(false);

  const handleMediaPointerMove = (e) => {
    if (reducedMotion) return;
    const el = labelRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -140%)`;
  };

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.project__media-frame', { clipPath: 'inset(0% 0 0% 0)' });
        gsap.set('.project__media-frame img', { scale: 1 });
        gsap.set(['.project__index', '.project__title', '.project__desc', '.project__meta', '.project__link'], {
          opacity: 1,
          y: 0,
        });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 65%',
          toggleActions: 'play reverse play reverse',
        },
        defaults: { ease: 'power4.out' },
      });

      tl.fromTo(
        '.project__media-frame',
        { clipPath: 'inset(18% 0 18% 0)' },
        { clipPath: 'inset(0% 0 0% 0)', duration: 0.9 },
        0
      )
        .fromTo('.project__media-frame img', { scale: 1.08 }, { scale: 1.04, duration: 1.1 }, 0)
        .fromTo(
          ['.project__index', '.project__title', '.project__desc', '.project__meta', '.project__link'],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 },
          0.15
        );
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id={project.id} ref={rootRef} className={`section section--${project.id} project`}>
      <div className={`project__inner${reverse ? ' project--reverse' : ''}`}>
        <div
          className="project__media"
          onPointerMove={handleMediaPointerMove}
          onPointerEnter={() => setLabelVisible(true)}
          onPointerLeave={() => setLabelVisible(false)}
        >
          <ProjectMedia src={project.image} alt={`${project.title} preview`} label={project.title} />
          {!reducedMotion && (
            <span ref={labelRef} className={`project__cursor-label${labelVisible ? ' is-visible' : ''}`} aria-hidden="true">
              View
            </span>
          )}
        </div>
        <div className="project__text">
          <p className="project__index">{project.index} — Work</p>
          <h3 className="project__title">{project.title}</h3>
          <p className="project__desc">{project.description}</p>
          <p className="project__meta">
            {project.category} · {project.year}
          </p>
          <a ref={linkRef} className="project__link" href={project.href} target="_blank" rel="noreferrer">
            View project <span className="project__link-arrow">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
