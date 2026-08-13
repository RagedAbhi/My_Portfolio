import { useEffect, useState } from 'react';
import { site } from '../data/site';
import { lenisState } from '../state/lenisState';
import { ScrollProgress, GROUPS } from './ScrollProgress';

// Deliberately not a conventional navbar: just the mark, the "0X / 04"
// progress readout, and a small dot that opens a full-screen overlay with
// the real links. See journey.js / the plan's nav section for why — the
// thread itself is the primary navigation.
export function Navigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    lenisState.instance?.stop();
    return () => {
      window.removeEventListener('keydown', onKey);
      lenisState.instance?.start();
    };
  }, [open]);

  const scrollToId = (id) => {
    setOpen(false);
    const lenis = lenisState.instance;
    const el = document.getElementById(id);
    if (!el) return;
    // lenis.start() BEFORE scrollTo, not just a `force: true` on scrollTo
    // itself, and the ordering matters: the overlay-open effect below calls
    // lenis.stop() while open, and its .start() counterpart only runs once
    // React processes the setOpen(false) above and re-renders (the effect's
    // cleanup) — AFTER this synchronous call. `force: true` alone looked
    // like the fix (it does bypass scrollTo's isStopped guard, so the
    // animation DOES start) but internalStart()'s call to reset() a moment
    // later — when that delayed cleanup finally runs — unconditionally
    // calls animate.stop(), silently cancelling the scrollTo tween that
    // force had just let through. Calling start() here first flips
    // isStopped to false immediately, so that later cleanup call becomes a
    // no-op (internalStart bails out early once already unstopped) instead
    // of a cancellation. Confirmed via direct Lenis-instance testing before
    // landing on this — force alone measured 0 net scroll every time.
    if (lenis) {
      lenis.start();
      lenis.scrollTo(el, { duration: 1.4, force: true });
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav className="nav">
        <button className="nav__mark" onClick={() => scrollToId('hero')} aria-label="Back to top">
          {site.initials}
        </button>
        <button
          className="nav__trigger"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Open navigation"
        >
          <ScrollProgress />
          {/* Always-visible, not hover-only — a bare dot next to a progress
              readout doesn't read as a clickable menu trigger on its own. */}
          <span className="nav__menu-label" aria-hidden="true">
            Menu
          </span>
          <span className="nav__dot" aria-hidden="true" />
        </button>
      </nav>

      {open && (
        <div className="nav-overlay" role="dialog" aria-modal="true" aria-label="Site navigation">
          <button className="nav-overlay__close" onClick={() => setOpen(false)}>
            Close
          </button>
          {GROUPS.map((g) => (
            <button
              key={g.label}
              className="nav-overlay__link"
              onClick={() => scrollToId(g.sections[0])}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
