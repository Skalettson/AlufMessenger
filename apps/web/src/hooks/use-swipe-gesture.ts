'use client';

import { useEffect, useState, useRef } from 'react';

interface UseSwipeGestureProps {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onMove?: (deltaY: number, progress: number) => void;
  threshold?: number;
  disabled?: boolean;
}

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  onMove,
  threshold = 100,
  disabled = false,
}: UseSwipeGestureProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      currentY.current = e.touches[0].clientY;
      const deltaY = currentY.current - startY.current;
      const progress = Math.min(Math.abs(deltaY) / threshold, 1);
      onMove?.(deltaY, progress);
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      const deltaY = currentY.current - startY.current;

      if (deltaY < -threshold) {
        onSwipeUp?.();
      } else if (deltaY > threshold) {
        onSwipeDown?.();
      }
      setIsDragging(false);
      onMove?.(0, 0);
    };

    const handleMouseDown = (e: MouseEvent) => {
      startY.current = e.clientY;
      currentY.current = startY.current;
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      currentY.current = e.clientY;
      const deltaY = currentY.current - startY.current;
      const progress = Math.min(Math.abs(deltaY) / threshold, 1);
      onMove?.(deltaY, progress);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      const deltaY = currentY.current - startY.current;

      if (deltaY < -threshold) {
        onSwipeUp?.();
      } else if (deltaY > threshold) {
        onSwipeDown?.();
      }
      setIsDragging(false);
      onMove?.(0, 0);
    };

    const element = elementRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd);
      element.addEventListener('mousedown', handleMouseDown);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('mousedown', handleMouseDown);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onSwipeUp, onSwipeDown, onMove, threshold, disabled]);

  return {
    elementRef,
    isDragging,
  };
}
