import { useMemo } from 'react';
import { JourneyProvider } from './state/JourneyContext';
import { useLenis } from './hooks/useLenis';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useWebGLSupport } from './hooks/useWebGLSupport';
import { Scene } from './three/Scene';
import { BackgroundTexture } from './components/BackgroundTexture';
import { DebugOverlay } from './components/DebugOverlay';
import { Loader } from './components/Loader';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Work } from './components/Work';
import { Project } from './components/Project';
import { Signature } from './components/Signature';
import { Skills } from './components/Skills';
import { Contact } from './components/Contact';
import { FallbackVisual } from './components/FallbackVisual';
import { projects } from './data/projects';
import { PROJECT_ANCHORS } from './config/journey';
import './styles/global.css';
import './styles/sections.css';

function Journey() {
  const reducedMotion = useReducedMotion();
  const webglSupported = useWebGLSupport();
  useLenis({ reducedMotion });

  const showDebug = useMemo(() => new URLSearchParams(window.location.search).has('debug'), []);

  return (
    <>
      <BackgroundTexture />
      {webglSupported ? <Scene /> : <FallbackVisual />}
      <Navigation />
      <div className="content-layer">
        <Hero />
        <About />
        <Work />
        {projects.map((project) => {
          const anchor = PROJECT_ANCHORS.find((a) => a.id === project.id);
          return <Project key={project.id} project={project} reverse={anchor?.side === 1} />;
        })}
        <Signature />
        <Skills />
        <Contact />
      </div>
      {showDebug && <DebugOverlay />}
    </>
  );
}

export default function App() {
  return (
    <JourneyProvider>
      <Loader />
      <Journey />
    </JourneyProvider>
  );
}
