'use client';

import { useRef, useEffect, forwardRef } from 'react';
import { MessageTextWithEmoji } from '@/components/message/message-text-with-emoji';
import { cn } from '@/lib/utils';

/** Поле ввода с отображением кастомных эмодзи (:shortcode:) как картинок в реальном времени. */
export const MessageInputField = forwardRef<HTMLTextAreaElement | null, {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}>(function MessageInputField({
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  disabled,
  className,
  inputClassName,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const setRef = (el: HTMLTextAreaElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const syncHeight = () => {
      const ol = overlayRef.current;
      if (ol) ol.style.minHeight = `${ta.scrollHeight}px`;
    };
    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(ta);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div className={cn('relative flex min-h-[44px] flex-1 items-center rounded-xl overflow-hidden', className)}>
      <div
        ref={overlayRef}
        className="absolute inset-0 overflow-hidden pointer-events-none py-2.5 text-base md:text-sm whitespace-pre-wrap break-words leading-relaxed"
        aria-hidden
      >
        <MessageTextWithEmoji
          text={value || '\u00A0'}
          emojiSize={18}
          className="inline align-baseline"
          reserveShortcodeWidth
        />
      </div>
      <textarea
        ref={setRef}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          /* text-base на тач-устройствах: iOS не зумит при фокусе (<16px вызывает zoom) */
          'relative z-10 min-h-[44px] w-full resize-none border-0 bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground max-h-[150px] py-2.5 leading-relaxed',
          'text-transparent caret-foreground selection:bg-primary/20',
          inputClassName,
        )}
      />
    </div>
  );
});
