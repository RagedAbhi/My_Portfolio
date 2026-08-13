import { useState } from 'react';

// Real screenshots aren't available yet, so this renders a tasteful
// labeled placeholder until one shows up at the given path — drop a file
// into /public/projects/ using the filename already referenced in
// data/projects.js and it swaps in automatically, no code change needed.
export function ProjectMedia({ src, alt, label }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="project__media-frame">
      {!failed && (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
      {failed && (
        <div className="project__placeholder">
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
