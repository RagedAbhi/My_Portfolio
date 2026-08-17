import { useEffect, useRef, useState } from 'react';
import { subscribeScroll, scrollState } from '../state/scrollState';
import { useJourney } from '../state/JourneyContext';

// Four chapters, not four pages: the indicator only changes at these
// boundaries, and the signature reveal is deliberately folded into WORK
// (it's a transition within the journey, not a destination of its own —
// see the note in journey.js about its timing).
const GROUPS = [
  { label: 'Home', sections: ['hero'] },
  { label: 'About', sections: ['about'] },
  { label: 'Experience & Education', sections: ['experience'] },
  { label: 'Projects', sections: ['work', 'cuerates', 'autotrack', 'apple3d'] },
  { label: 'Skills', sections: ['skills'] },
  { label: 'Beyond the Work', sections: ['beyondWork'] },
  { label: 'Contact', sections: ['contact'] },
];

function groupIndexForProgress(p, sections) {
  const current =
    Object.entries(sections)
      .filter(([, r]) => p >= r.start)
      .pop()?.[0] ?? 'hero';
  const idx = GROUPS.findIndex((g) => g.sections.includes(current));
  return idx === -1 ? 0 : idx;
}

// Re-renders only when the active group actually changes (a handful of
// times per full scroll), not on every progress tick.
export function ScrollProgress() {
  const { sections } = useJourney();
  const [groupIndex, setGroupIndex] = useState(0);
  const lastIndex = useRef(0);

  const updateIndex = (idx) => {
    if (idx !== -1 && idx !== lastIndex.current) {
      lastIndex.current = idx;
      setGroupIndex(idx);
    }
  };

  useEffect(() => {
    // 1. IntersectionObserver for direct DOM viewport accuracy
    const allSectionIds = [
      'hero',
      'about',
      'experience',
      'work',
      'cuerates',
      'autotrack',
      'apple3d',
      'skills',
      'beyondWork',
      'contact',
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          const id = visible.target.id;
          const idx = GROUPS.findIndex((g) => g.sections.includes(id));
          updateIndex(idx);
        }
      },
      { rootMargin: '-30% 0px -30% 0px', threshold: 0.05 }
    );

    allSectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // 2. Scroll state subscription fallback
    const unsub = subscribeScroll(({ progress }) => {
      const idx = groupIndexForProgress(progress, sections);
      updateIndex(idx);
    });

    const initialIdx = groupIndexForProgress(scrollState.progress, sections);
    updateIndex(initialIdx);

    return () => {
      observer.disconnect();
      unsub();
    };
  }, [sections]);

  return (
    <span className="nav__progress">
      {String(groupIndex + 1).padStart(2, '0')} / {String(GROUPS.length).padStart(2, '0')}
    </span>
  );
}

export { GROUPS };
