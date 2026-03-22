/**
 * useAnimation Hook
 * Хук для анимаций
 */

import { useRef, useCallback } from 'react';

export interface AnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  onComplete?: () => void;
}

export function useAnimation() {
  const rafRef = useRef<number | undefined>(undefined);

  const animate = useCallback(
    (
      from: number,
      to: number,
      onUpdate: (value: number) => void,
      options: AnimationOptions = {}
    ) => {
      const {
        duration = 300,
        easing = 'ease-out',
        delay = 0,
        onComplete,
      } = options;

      const startTime = performance.now() + delay;
      const change = to - from;

      const easeFunction = (t: number): number => {
        switch (easing) {
          case 'linear':
            return t;
          case 'ease-in':
            return t * t;
          case 'ease-out':
            return t * (2 - t);
          case 'ease-in-out':
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          default:
            return t;
        }
      };

      const tick = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeFunction(progress);
        const currentValue = from + change * easedProgress;

        onUpdate(currentValue);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onComplete?.();
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  const cancel = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return { animate, cancel };
}
