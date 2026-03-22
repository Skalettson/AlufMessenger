'use client';

import { useMemo } from 'react';
import { CustomEmojiInline } from '@/components/shared/custom-emoji-inline';
import { parseFormattedMessage } from '@/lib/message-format';
import { cn } from '@/lib/utils';

const CUSTOM_EMOJI_REGEX = /:[\w+_-]+:/g;

/** Splits text by :shortcode: and renders custom emoji as images. */
export function MessageTextWithEmoji({
  text,
  className,
  emojiSize = 20,
  /** В поле ввода с прозрачным textarea: ширина картинки < ширины строки `:code:` — резервируем ~длину shortcode в `ch`, чтобы не было «дыр» и лишних пробелов. */
  reserveShortcodeWidth = false,
  emojiInlineClassName,
}: {
  text: string;
  className?: string;
  emojiSize?: number;
  reserveShortcodeWidth?: boolean;
  /** Доп. классы на инлайн-эмодзи (по умолчанию в пузырях — `mx-0.5`, в композере лучше не задавать). */
  emojiInlineClassName?: string;
}) {
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'emoji'; value: string }> = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(CUSTOM_EMOJI_REGEX.source, 'g');
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        result.push({ type: 'text', value: text.slice(lastIndex, m.index) });
      }
      result.push({ type: 'emoji', value: m[0] });
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  if (parts.length === 0 && text) {
    return <span className={cn('whitespace-pre-wrap break-words', className)}>{parseFormattedMessage(text, 'm0')}</span>;
  }
  if (parts.length === 0) return null;

  const defaultEmojiMargin = reserveShortcodeWidth ? 'mx-0' : 'mx-0.5';

  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{parseFormattedMessage(part.value, `m${i}`)}</span>
        ) : reserveShortcodeWidth ? (
          <span
            key={i}
            className="inline-block shrink-0 overflow-visible align-middle"
            style={{
              width: `max(${emojiSize}px, ${part.value.length}ch)`,
              verticalAlign: 'middle',
            }}
          >
            <span className="inline-flex items-center justify-center">
              <CustomEmojiInline
                shortcode={part.value}
                size={emojiSize}
                className={cn('mx-0', emojiInlineClassName)}
              />
            </span>
          </span>
        ) : (
          <CustomEmojiInline
            key={i}
            shortcode={part.value}
            size={emojiSize}
            className={cn(defaultEmojiMargin, emojiInlineClassName)}
          />
        ),
      )}
    </span>
  );
}
