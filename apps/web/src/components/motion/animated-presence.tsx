'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  show: boolean;
  className?: string;
  mode?: 'fade' | 'slide-up' | 'scale';
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  'slide-up': {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
  },
};

export function AnimatedPresenceWrapper({ children, show, className, mode = 'fade' }: Props) {
  const v = variants[mode];
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={v.initial}
          animate={v.animate}
          exit={v.exit}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
