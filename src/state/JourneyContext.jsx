import { createContext, useContext, useEffect, useMemo } from 'react';
import {
  SECTION_VH_DESKTOP,
  SECTION_VH_MOBILE,
  computeSections,
  buildJourneyCurve,
  CAMERA_KEYFRAMES_DESKTOP,
  CAMERA_KEYFRAMES_MOBILE,
} from '../config/journey';
import { useIsMobile } from '../hooks/useIsMobile';

const JourneyCtx = createContext(null);

/*
 * JourneyProvider — computes the journey curve, section progress ranges and
 * camera keyframes once (per breakpoint) and shares them with both the
 * Three.js layer and the DOM sections. This is the "exactly one place"
 * where DOM and 3D agree: section heights are pushed onto :root as CSS
 * custom properties here, and sections.css reads them via var(--vh-*), so
 * the numbers in config/journey.js are the only thing anyone has to tune.
 */
export function JourneyProvider({ children }) {
  const isMobile = useIsMobile();

  const value = useMemo(() => {
    const { sections, totalVh } = computeSections(isMobile);
    const curve = buildJourneyCurve(isMobile);
    const cameraKeyframes = isMobile ? CAMERA_KEYFRAMES_MOBILE : CAMERA_KEYFRAMES_DESKTOP;
    return { isMobile, sections, totalVh, curve, cameraKeyframes };
  }, [isMobile]);

  useEffect(() => {
    const heights = isMobile ? SECTION_VH_MOBILE : SECTION_VH_DESKTOP;
    const root = document.documentElement;
    Object.entries(heights).forEach(([id, vh]) => {
      root.style.setProperty(`--vh-${id}`, `${vh}vh`);
    });
    root.style.setProperty('--journey-total-vh', `${value.totalVh}vh`);
  }, [isMobile, value.totalVh]);

  return <JourneyCtx.Provider value={value}>{children}</JourneyCtx.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyCtx);
  if (!ctx) throw new Error('useJourney must be used within JourneyProvider');
  return ctx;
}
