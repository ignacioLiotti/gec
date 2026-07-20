import { useEffect, useRef, useState } from 'react';

/**
 * True once the element is within `rootMargin` of the viewport (then stays
 * true — one-shot). Used to defer thumbnail work until a tile is about to
 * become visible. Falls back to "immediately visible" where
 * IntersectionObserver is unavailable.
 */
export function useNearViewport<T extends HTMLElement>(rootMargin = '360px') {
  const ref = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport) return;
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timeout = setTimeout(() => setIsNearViewport(true), 0);
      return () => clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport, rootMargin]);

  return [ref, isNearViewport] as const;
}
