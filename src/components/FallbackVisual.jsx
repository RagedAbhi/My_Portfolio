// Used when WebGL is unavailable (or ?nowebgl=1) — a CSS-only stand-in for
// the orb + thread so the site still has its visual identity. All real
// content lives in the DOM regardless, so nothing here is load-bearing;
// this is purely the ambient visual the brief calls for as a fallback.
export function FallbackVisual() {
  return (
    <div className="fallback-visual" aria-hidden="true">
      <div className="fallback-visual__thread" />
      <div className="fallback-visual__orb" />
    </div>
  );
}
