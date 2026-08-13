import { useEffect, useRef } from 'react';
import { subscribeScroll, scrollState } from '../state/scrollState';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useJourney } from '../state/JourneyContext';

// Tileable film-grain, generated inline as fractal-noise turbulence
// desaturated to pure luminance — no network asset, no new hue. Raw
// feTurbulence output clusters tightly around mid-gray (verified: sampled
// pixel range was ~118-233 of 255, averaging ~187) which reads as a flat
// haze rather than grain at any reasonable opacity. The feComponentTransfer
// re-centers on that same average but steepens the slope around it, so the
// speckle actually has dark-to-light contrast instead of just being paler
// or darker as a block.
const GRAIN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' " +
  "stitchTiles='stitch' result='noise'/%3E%3CfeColorMatrix in='noise' type='saturate' values='0'/%3E" +
  "%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='3' intercept='-1.46'/%3E" +
  "%3CfeFuncG type='linear' slope='3' intercept='-1.46'/%3E%3CfeFuncB type='linear' slope='3' intercept='-1.46'/%3E" +
  "%3C/feComponentTransfer%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const PARALLAX_RATE = 0.04; // fraction of raw scroll speed — background drifts slower than content, reads as "farther back"

/*
 * BackgroundTexture — a fixed grain layer sitting behind the 3D scene and
 * DOM content (see .bg-texture / --z-texture). Purely decorative depth cue:
 * as the page scrolls, the tile's background-position pans at a fraction of
 * scroll speed, so it visibly lags the foreground content — the standard
 * "distant layer moves slower" parallax read, kept subtle enough to stay
 * in the site's restrained register.
 *
 * Reads window.scrollY directly on each Lenis-driven scroll update (via
 * subscribeScroll) and writes straight to the DOM node, never through React
 * state — same no-per-frame-re-render convention as scrollState.js.
 */
export function BackgroundTexture() {
  const layerRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { sections } = useJourney();
  const lastSectionId = useRef(null);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const el = layerRef.current;
    if (!el) return undefined;

    const onAnimationEnd = () => el.classList.remove('is-pulsing');
    el.addEventListener('animationend', onAnimationEnd);

    // A quiet "breath" — a brief opacity pulse — exactly when progress
    // crosses into a new section, using the same section ranges everything
    // else in the app derives from (see useJourney/computeSections). Reuses
    // this existing grain layer rather than adding a new effect for the
    // sake of one.
    const currentSectionId = (progress) => {
      for (const [id, range] of Object.entries(sections)) {
        if (progress >= range.start && progress < range.end) return id;
      }
      return 'contact';
    };

    const apply = ({ progress }) => {
      el.style.backgroundPosition = `0px ${window.scrollY * PARALLAX_RATE}px`;
      const id = currentSectionId(progress);
      if (lastSectionId.current !== null && id !== lastSectionId.current) {
        el.classList.remove('is-pulsing');
        // eslint-disable-next-line no-void -- force reflow so re-adding the class restarts the CSS animation
        void el.offsetWidth;
        el.classList.add('is-pulsing');
      }
      lastSectionId.current = id;
    };
    apply(scrollState);
    const unsub = subscribeScroll(apply);
    return () => {
      unsub();
      el.removeEventListener('animationend', onAnimationEnd);
    };
  }, [reducedMotion, sections]);

  return (
    <div
      ref={layerRef}
      className="bg-texture"
      style={{ backgroundImage: `url("${GRAIN_URL}")` }}
      aria-hidden="true"
    />
  );
}
