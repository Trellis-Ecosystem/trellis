import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTypingAnimation } from './useTypingAnimation';

function mockReducedMotion(reduce: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: reduce,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return mql;
}

describe('useTypingAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the full text immediately when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const text = 'Hello world';
    const { result } = renderHook(() => useTypingAnimation(text));

    expect(result.current).toBe(text);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe(text);
  });

  it('types the text character by character when motion is allowed', () => {
    mockReducedMotion(false);
    const text = 'abc';
    const { result } = renderHook(() => useTypingAnimation(text, 10));

    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe('ab');

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe('abc');
  });
});
