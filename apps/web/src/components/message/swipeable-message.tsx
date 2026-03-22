'use client';

import { useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Message } from '@/stores/message-store';
import { useMessageStore } from '@/stores/message-store';

const SWIPE_REVEAL = 72;

interface Props {
  message: Message;
  children: React.ReactNode;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export function SwipeableMessage({ message, children, onDoubleClick }: Props) {
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const x = useMotionValue(0);
  const isMine = message.isMine;

  const replyOpacity = useTransform(
    x,
    isMine ? [0, -SWIPE_REVEAL * 0.5] : [0, SWIPE_REVEAL * 0.5],
    [0, 1],
  );

  const handleReplyClick = useCallback(() => {
    setReplyingTo(message);
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });
  }, [message, setReplyingTo, x]);

  const constraints = isMine
    ? { left: -SWIPE_REVEAL, right: 0 }
    : { left: 0, right: SWIPE_REVEAL };

  return (
    <div className="relative overflow-hidden">
      <div
        className={cn(
          'absolute top-0 bottom-0 z-0 flex items-center',
          isMine ? 'right-0 justify-end pr-3' : 'left-0 justify-start pl-3',
        )}
        style={{ width: SWIPE_REVEAL }}
        aria-hidden
      >
        <motion.button
          type="button"
          onClick={handleReplyClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
          style={{ opacity: replyOpacity }}
        >
          <Reply className="h-5 w-5" />
        </motion.button>
      </div>
      <motion.div
        className="relative z-10"
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragConstraints={constraints}
        dragElastic={0.1}
        dragMomentum={false}
        onDoubleClick={onDoubleClick}
        onDragEnd={(_, info) => {
          const offset = info.offset.x;
          const velocity = info.velocity.x;
          const threshold = SWIPE_REVEAL * 0.5;
          if (isMine) {
            if (offset < -threshold || velocity < -200) {
              animate(x, -SWIPE_REVEAL, { type: 'spring', stiffness: 300, damping: 30 });
            } else {
              animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });
            }
          } else {
            if (offset > threshold || velocity > 200) {
              animate(x, SWIPE_REVEAL, { type: 'spring', stiffness: 300, damping: 30 });
            } else {
              animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });
            }
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
