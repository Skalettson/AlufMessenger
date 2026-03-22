/**
 * Cell Component
 * Ячейка списка в стиле iOS/Aluf Design
 */

import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn.js';

export interface CellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  avatar?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  interactive?: boolean;
}

export const Cell = forwardRef<HTMLDivElement, CellProps>(
  (
    {
      title,
      subtitle,
      description,
      icon,
      avatar,
      badge,
      trailing,
      onClick,
      className,
      disabled = false,
      multiline = false,
      interactive = true,
    },
    ref
  ) => {
    const handleClick = () => {
      if (!disabled && interactive && onClick) {
        onClick();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          'bg-white dark:bg-gray-900',
          interactive && !disabled && 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-800',
          disabled && 'opacity-50 cursor-not-allowed',
          'border-b border-gray-100 dark:border-gray-800 last:border-b-0',
          'transition-colors duration-150',
          className
        )}
        onClick={handleClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive && !disabled ? 0 : undefined}
      >
        {/* Icon / Avatar */}
        {(icon || avatar) && (
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
            {avatar || icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-base font-medium text-gray-900 dark:text-white',
                multiline ? 'break-words' : 'truncate'
              )}
            >
              {title}
            </span>
            {badge && (
              <span className="flex-shrink-0">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
          {description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Trailing */}
        {trailing && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {trailing}
          </div>
        )}

        {/* Chevron */}
        {interactive && !disabled && !trailing && (
          <ChevronIcon />
        )}
      </div>
    );
  }
);

Cell.displayName = 'Cell';

// ============================================
// List Component
// ============================================

export interface ListProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  inset?: boolean;
}

export function List({
  children,
  header,
  footer,
  className,
  inset = false,
}: ListProps) {
  return (
    <div
      className={cn(
        inset ? 'p-4' : '',
        className
      )}
    >
      {header && (
        <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {header}
        </div>
      )}
      <div className={cn(
        'rounded-2xl overflow-hidden',
        'bg-white dark:bg-gray-900',
        'shadow-sm border border-gray-100 dark:border-gray-800'
      )}>
        {children}
      </div>
      {footer && (
        <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================
// Icons
// ============================================

function ChevronIcon() {
  return (
    <svg
      className="w-5 h-5 text-gray-300 dark:text-gray-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
