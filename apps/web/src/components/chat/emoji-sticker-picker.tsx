'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/components/shared/emoji-picker';
import { StickerPicker } from '@/components/chat/sticker-picker';

/** Единый пикер: вкладки «Эмодзи» и «Стикеры» (без GIF). Только использование, без создания. */
interface EmojiStickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (mediaId: string) => void;
}

export function EmojiStickerPicker({ onSelectEmoji, onSelectSticker }: EmojiStickerPickerProps) {
  const [tab, setTab] = useState<'emoji' | 'stickers'>('emoji');

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden w-80">
      <div className="flex border-b border-border bg-secondary/30">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={cn(
            'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
            tab === 'emoji' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Эмодзи
          {tab === 'emoji' && (
            <motion.div
              layoutId="emoji-sticker-tab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('stickers')}
          className={cn(
            'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
            tab === 'stickers' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Стикеры
          {tab === 'stickers' && (
            <motion.div
              layoutId="emoji-sticker-tab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      </div>
      <div className="p-3">
        {tab === 'emoji' && (
          <EmojiPicker onSelect={onSelectEmoji} embedded />
        )}
        {tab === 'stickers' && (
          <StickerPicker onSelectSticker={onSelectSticker} embedded />
        )}
      </div>
    </div>
  );
}
