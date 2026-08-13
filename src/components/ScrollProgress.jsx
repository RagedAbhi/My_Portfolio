import { useEffect, useRef, useState } from 'react';
import { subscribeScroll, scrollState } from '../state/scrollState';
import { useJourney } from '../state/JourneyContext';

// Four chapters, not four pages: the indicator only changes at these
// boundaries, and the signature reveal is deliberately folded into WORK
// (it's a transition within the journey, not a destination of its own —
// see the note in journey.js about its timing).
const GROUPS = [
  { label: 'Intro', sections: ['hero'] },
  { label: 'About', sections: ['about'] },
  { label: 'Work', sections: ['work', 'cuerates', 'autotrack', 'apple3d', 'signature', 'skills'] },
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

  useEffect(() => {
    const unsub = subscribeScroll(({ progress }) => {
      const idx = groupIndexForProgress(progress, sections);
      if (idx !== lastIndex.current) {
        lastIndex.current = idx;
        setGroupIndex(idx);
      }
    });
    // Sync once on mount/section-set change in case progress was already > 0.
    const idx = groupIndexForProgress(scrollState.progress, sections);
    lastIndex.current = idx;
    setGroupIndex(idx);
    return unsub;
  }, [sections]);

  return (
    <span className="nav__progress">
      {String(groupIndex + 1).padStart(2, '0')} / {String(GROUPS.length).padStart(2, '0')}
    </span>
  );
}

export { GROUPS };
