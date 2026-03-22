'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES } from '@/lib/emoji-data';
import { useMyCustomEmoji } from '@/hooks/use-custom-emoji';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import { Loader2, Search } from 'lucide-react';

function CustomEmojiThumb({ mediaId, shortcode, onSelect }: { mediaId: string; shortcode: string; onSelect: (s: string) => void }) {
  const { url, mimeType } = useMediaUrlWithType(mediaId);
  if (!url) return <div className="h-9 w-9 rounded-lg bg-secondary/50 animate-pulse" />;
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.8 }}
      onClick={() => onSelect(shortcode)}
      className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary transition-colors overflow-hidden"
    >
      <MediaImageOrVideo url={url} mimeType={mimeType} alt={shortcode} className="w-7 h-7" />
    </motion.button>
  );
}

interface Props {
  onSelect: (emoji: string) => void;
  embedded?: boolean;
}

export function EmojiPicker({ onSelect, embedded }: Props) {
  const [activeCatId, setActiveCatId] = useState(EMOJI_CATEGORIES[0].id);
  const [search, setSearch] = useState('');
  const { data: customEmoji = [], isLoading: customLoading } = useMyCustomEmoji();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allCategories = useMemo(() => [
    ...EMOJI_CATEGORIES,
    { id: 'custom', name: 'Кастомные', icon: '⭐', emojis: [] as string[] },
  ], []);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        if (results.length >= 80) break;
        results.push(e);
      }
    }
    return results;
  }, [search]);

  const handleCategoryClick = useCallback((catId: string) => {
    setActiveCatId(catId);
    setSearch('');
  }, []);

  const currentCat = allCategories.find((c) => c.id === activeCatId) || allCategories[0];

  return (
    <div className={cn(embedded ? 'min-w-0' : 'w-80 rounded-2xl border border-border bg-card p-3 shadow-xl')}>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск эмодзи..."
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-secondary/50 border-0 outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="flex gap-0.5 mb-2 overflow-x-auto pb-1 scrollbar-thin">
        {allCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={cn(
              'relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors',
              activeCatId === cat.id ? 'bg-primary/15' : 'hover:bg-secondary',
            )}
            title={cat.name}
          >
            {cat.icon}
            {activeCatId === cat.id && (
              <motion.div
                layoutId="emoji-cat-indicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="max-h-60 overflow-y-auto">
        {search.trim() ? (
          <div className="grid grid-cols-8 gap-0.5">
            {filteredEmojis?.length ? filteredEmojis.map((e, idx) => (
              <motion.button
                key={`${e}-${idx}`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => onSelect(e)}
                className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary text-xl transition-colors"
              >
                {e}
              </motion.button>
            )) : (
              <p className="col-span-full text-xs text-muted-foreground text-center py-4">Ничего не найдено</p>
            )}
          </div>
        ) : activeCatId === 'custom' ? (
          <div className="grid grid-cols-8 gap-0.5">
            {customLoading ? (
              <div className="col-span-full flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : customEmoji.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground py-4 text-center">Нет кастомных эмодзи</p>
            ) : (
              customEmoji.map((e) => (
                <CustomEmojiThumb key={e.id} mediaId={e.mediaId} shortcode={e.shortcode} onSelect={onSelect} />
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {currentCat.emojis.map((e, idx) => (
              <motion.button
                key={`${e}-${idx}`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => onSelect(e)}
                className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary text-xl transition-colors"
              >
                {e}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
