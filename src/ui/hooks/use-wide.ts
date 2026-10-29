import { useEffect, useState } from 'react';

/** True while the window is at least `px` wide. */
export function useWide(px: number) {
  const query = `(min-width: ${px}px)`;
  const [wide, setWide] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}
