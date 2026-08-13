import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setScrollProgress } from '../state/scrollState';
import { lenisState } from '../state/lenisState';
import { signatureWeight } from '../config/journey';

gsap.registerPlugin(ScrollTrigger);

// At the signature reveal's visual peak, wheel input scrolls at 40% of its
// normal speed — insurance against flicking straight past the one moment
// in the scene the most work went into. Ramped by signatureWeight — the
// same bell curve already driving the camera dolly and orb transformation —
// so the deepest slowdown lines up exactly with the visual peak.
//
// IMPORTANT: this must mutate lenis.virtualScroll.options.wheelMultiplier,
// NOT lenis.options.wheelMultiplier. Lenis's constructor destructures
// wheelMultiplier into a brand-new plain object it hands to its internal
// VirtualScroll helper (`new VirtualScroll(eventsTarget, { wheelMultiplier,
// ... })` in node_modules/lenis/dist/lenis.mjs) — that object, not
// lenis.options, is what the actual wheel handler reads fresh from on
// every event. Mutating lenis.options here looked plausible (it's the
// obviously-named property) but silently did nothing, since VirtualScroll
// never sees it after construction — verified by reading the Lenis source
// after a first attempt measured ~0% actual damping.
const SIGNATURE_WHEEL_MIN_MULTIPLIER = 0.4;

/*
 * useLenis — wires Lenis smooth scrolling into the GSAP ticker and derives
 * normalized journey progress (0-1) from the full document height.
 *
 * Lenis owns the actual scroll (so momentum/easing feels consistent across
 * browsers); GSAP's ticker drives Lenis's rAF loop so ScrollTrigger and
 * Lenis never fight over frame timing; a single page-spanning ScrollTrigger
 * converts scroll position into `progress` and writes it into the mutable
 * scrollState module (see state/scrollState.js) rather than React state,
 * so nothing here causes a re-render on scroll.
 *
 * Reduced-motion: Lenis is skipped entirely and native scroll drives the
 * same ScrollTrigger, so progress still advances but without smoothing —
 * and without the signature-window wheel damping below, which only makes
 * sense as a wheel-input effect.
 */
export function useLenis({ reducedMotion = false } = {}) {
  const lenisRef = useRef(null);

  useEffect(() => {
    let lenis = null;
    let tickerFn = null;

    if (!reducedMotion) {
      lenis = new Lenis({
        duration: 1.1,
        smoothWheel: true,
        syncTouch: false,
      });
      lenisRef.current = lenis;
      lenisState.instance = lenis;

      // Drive Lenis from GSAP's ticker (not a second rAF loop) so its
      // timing stays in lockstep with ScrollTrigger's own updates.
      tickerFn = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);

      lenis.on('scroll', ScrollTrigger.update);
    }

    const trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        setScrollProgress(self.progress, self.getVelocity() / 10000);
        if (lenis) {
          const weight = signatureWeight(self.progress);
          lenis.virtualScroll.options.wheelMultiplier = 1 - weight * (1 - SIGNATURE_WHEEL_MIN_MULTIPLIER);
        }
      },
    });

    return () => {
      trigger.kill();
      if (tickerFn) gsap.ticker.remove(tickerFn);
      if (lenis) lenis.destroy();
      lenisRef.current = null;
      lenisState.instance = null;
    };
  }, [reducedMotion]);

  return lenisRef;
}
