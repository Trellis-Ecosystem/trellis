import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useTypingAnimation(text: string, speed = 50): string {
  const [displayed, setDisplayed] = useState(() =>
    prefersReducedMotion() ? text : ''
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayed(text);
      return;
    }

    setDisplayed('');
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}
