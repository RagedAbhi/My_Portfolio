// Holds the live Lenis instance so any component (e.g. Navigation's "back
// to top" / section jumps) can drive scroll correctly. A raw
// window.scrollTo() fights Lenis's own rAF-driven scroll — see useLenis.js
// — so anything that needs to jump the page must go through here instead.
export const lenisState = {
  instance: null,
};
