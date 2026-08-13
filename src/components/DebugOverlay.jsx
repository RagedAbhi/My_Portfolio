import { useEffect, useRef } from 'react';
import { scrollState } from '../state/scrollState';
import { useJourney } from '../state/JourneyContext';

// ?debug=1 only — a tiny live readout of progress + nearest section, used
// to tune SECTION_VH/journey milestones against what's actually on screen.
export function DebugOverlay() {
  const ref = useRef(null);
  const { sections } = useJourney();

  useEffect(() => {
    let raf;
    const tick = () => {
      if (ref.current) {
        const p = scrollState.progress;
        const current =
          Object.entries(sections)
            .filter(([, r]) => p >= r.start)
            .pop()?.[0] ?? '—';
        ref.current.textContent = `progress ${p.toFixed(3)}  |  vel ${scrollState.velocity.toFixed(3)}  |  section: ${current}`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sections]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 999,
        font: '11px/1.4 monospace',
        background: 'rgba(17,17,17,0.85)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 4,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    />
  );
}
