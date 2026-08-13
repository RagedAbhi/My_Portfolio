import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { site } from '../data/site';
import { skillGroups } from '../data/skills';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { subscribeScroll, scrollState } from '../state/scrollState';
import { getActiveSkillsGroup } from '../config/journey';

export function Skills() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const [activeGroup, setActiveGroup] = useState(null);
  const lastActive = useRef(null);

  // Echoes the orb's material story (see getDisciplineWeights in
  // journey.js) back into the DOM: as the orb's finish drifts toward each
  // discipline's profile, the matching group here gets a quiet emphasis —
  // same moment, told twice. Discrete state, so this only re-renders on
  // the handful of times the active group actually changes, not per frame.
  useEffect(() => {
    const unsub = subscribeScroll(({ progress }) => {
      const next = getActiveSkillsGroup(progress);
      if (next !== lastActive.current) {
        lastActive.current = next;
        setActiveGroup(next);
      }
    });
    const initial = getActiveSkillsGroup(scrollState.progress);
    lastActive.current = initial;
    setActiveGroup(initial);
    return unsub;
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(['.skills__inner .kicker', '.skills__inner .heading-lg', '.skills__group'], {
          opacity: 1,
          y: 0,
        });
        return;
      }
      gsap.from(['.skills__inner .kicker', '.skills__inner .heading-lg'], {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: 'power4.out',
        stagger: 0.1,
        scrollTrigger: { trigger: rootRef.current, start: 'top 65%', toggleActions: 'play reverse play reverse' },
      });
      gsap.from('.skills__group', {
        opacity: 0,
        y: 24,
        duration: 0.7,
        ease: 'power4.out',
        stagger: 0.1,
        scrollTrigger: { trigger: '.skills__groups', start: 'top 75%', toggleActions: 'play reverse play reverse' },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="skills" ref={rootRef} className="section section--skills">
      <div className="skills__inner">
        <div>
          <p className="kicker">04 — {site.skills.kicker}</p>
          <h2 className="heading-lg">{site.skills.heading}</h2>
        </div>
        <div className="skills__groups">
          {skillGroups.map((group) => (
            <div
              key={group.id}
              className={`skills__group${group.id === activeGroup ? ' is-active' : ''}`}
            >
              <p className="skills__group-title">{group.title}</p>
              <ul className="skills__group-list">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
