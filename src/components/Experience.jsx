import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { experienceData } from '../data/experience';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*
 * Experience — Section 03: Experience & Education timeline.
 * Clean editorial vertical layout with generous whitespace, large date typography,
 * subtle staggered GSAP reveals, and thin milestone lines.
 */
export function Experience() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(['.experience__kicker', '.experience__heading', '.experience__intro', '.experience__item'], {
          opacity: 1,
          y: 0,
        });
        return;
      }

      gsap.fromTo(
        '.experience__header',
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
        '.experience__item',
        { opacity: 0, y: 25 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.experience__timeline',
            start: 'top 75%',
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="experience" ref={rootRef} className="section section--experience">
      <div className="experience__inner">
        <div className="experience__header">
          <p className="kicker">{experienceData.kicker}</p>
          <h2 className="heading-lg experience__heading">{experienceData.heading}</h2>
          <p className="lead experience__intro">{experienceData.intro}</p>
        </div>

        <div className="experience__timeline">
          <div className="experience__group">
            <span className="experience__group-label">EXPERIENCE</span>
            {experienceData.experience.map((item) => (
              <div key={item.id} className="experience__item">
                <span className="experience__period">{item.period}</span>
                <div className="experience__details">
                  <h3 className="experience__title">
                    {item.role} <span className="experience__company">— {item.company}</span>
                  </h3>
                  <p className="experience__desc">{item.description}</p>
                  <div className="experience__tags">
                    {item.skills.map((skill) => (
                      <span key={skill} className="experience__tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="experience__group">
            <span className="experience__group-label">EDUCATION</span>
            {experienceData.education.map((item) => (
              <div key={item.id} className="experience__item">
                <span className="experience__period">{item.period}</span>
                <div className="experience__details">
                  <h3 className="experience__title">
                    {item.degree} <span className="experience__company">— {item.institution}</span>
                  </h3>
                  <p className="experience__desc">{item.description}</p>
                  <div className="experience__tags">
                    {item.skills.map((skill) => (
                      <span key={skill} className="experience__tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
