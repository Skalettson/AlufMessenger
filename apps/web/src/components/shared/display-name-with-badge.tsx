'use client';

import { Sparkles, Bot, BadgeCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomEmojiInline } from '@/components/shared/custom-emoji-inline';

/** Normalize stored badge emoji to a shortcode fragment (API may use `:name:` or `name`). */
function normalizeBadgeShortcode(raw: string): string {
  return raw.trim().replace(/^:+|:+$/g, '');
}

function isCustomEmojiShortcode(s: string): boolean {
  const core = normalizeBadgeShortcode(s);
  return /^[a-zA-Z0-9_]+$/.test(core) && core.length > 0;
}

export interface DisplayNameWithBadgeProps {
  name: string;
  isPremium?: boolean;
  badgeEmoji?: string | null;
  isBot?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export function DisplayNameWithBadge({
  name,
  isPremium,
  badgeEmoji,
  isBot,
  isVerified,
  isOfficial,
  className,
  size = 'default',
}: DisplayNameWithBadgeProps) {
  const displayName = (name || '').trim() || '—';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3';
  const badgeClass =
    size === 'sm'
      ? 'inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0'
      : 'inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0';
  const customEmoji = normalizeBadgeShortcode(badgeEmoji ?? '');
  const showCustomEmoji = isPremium && customEmoji.length > 0;
  const isCustom = showCustomEmoji && isCustomEmojiShortcode(customEmoji);
  const badgeSize = size === 'sm' ? 14 : 18;

  return (
    <span className={cn('inline-flex items-center gap-1 flex-wrap min-w-0', className)}>
      <span className="truncate">{displayName}</span>
      {isOfficial && (
        <span
          className="inline-flex items-center shrink-0 text-amber-500"
          title="Официальный аккаунт"
        >
          <Shield className={cn(iconSize)} strokeWidth={2.5} aria-hidden />
        </span>
      )}
      {isVerified && !isOfficial && (
        <span
          className="inline-flex items-center shrink-0 text-blue-500"
          title="Подтверждённый аккаунт"
        >
          <BadgeCheck className={cn(iconSize)} strokeWidth={2.5} aria-hidden />
        </span>
      )}
      {isPremium && (
        <span className={badgeClass} title="Premium">
          {showCustomEmoji ? (
            isCustom ? (
              <CustomEmojiInline shortcode={`:${customEmoji}:`} size={badgeSize} className="shrink-0" />
            ) : (
              <span className="leading-none">{customEmoji}</span>
            )
          ) : (
            <>
              <Sparkles className={iconSize} /> Premium
            </>
          )}
        </span>
      )}
      {isBot && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0"
          title="Бот"
        >
          <Bot className={iconSize} /> Бот
        </span>
      )}
    </span>
  );
}
