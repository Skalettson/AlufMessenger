'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const URL_RE = /https?:\/\/[^\s<>\])}'"]+/gi;

/** Плоский текст с авто-ссылками (http/https). */
function linkifyPlain(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'gi');
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={`${keyBase}-t-${k++}`}>{text.slice(last, m.index)}</span>,
      );
    }
    const href = m[0];
    nodes.push(
      <a
        key={`${keyBase}-a-${k++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {href}
      </a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) {
    nodes.push(<span key={`${keyBase}-t-${k++}`}>{text.slice(last)}</span>);
  }
  return nodes.length ? nodes : [<span key={`${keyBase}-e`}>{text}</span>];
}

function SpoilerInline({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'mx-0.5 rounded px-1 py-0.5 align-baseline transition-all duration-200',
        open
          ? 'bg-muted/80 text-foreground'
          : 'cursor-pointer bg-muted/90 blur-[6px] hover:blur-[3px] active:scale-[0.99]',
      )}
      title={open ? undefined : 'Показать'}
    >
      {children}
    </button>
  );
}

/**
 * Текст с блоками кода ``` ... ``` и инлайн-форматированием.
 */
export function parseFormattedMessage(text: string, keyPrefix = 'f'): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = /```([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={`${keyPrefix}-t${k}`} className="inline">
          {parseFormattedInline(text.slice(last, m.index), `${keyPrefix}-i${k}`)}
        </span>,
      );
    }
    const code = m[1] ?? '';
    nodes.push(
      <pre
        key={`${keyPrefix}-c${k}`}
        className="my-1 max-w-full overflow-x-auto rounded-lg border border-border/60 bg-muted/50 p-2 font-mono text-[0.85em] leading-relaxed"
      >
        <code>{code.replace(/^\n+|\n+$/g, '')}</code>
      </pre>,
    );
    last = re.lastIndex;
    k++;
  }
  if (last < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-tend`} className="inline">
        {parseFormattedInline(text.slice(last), `${keyPrefix}-end`)}
      </span>,
    );
  }
  return nodes.length ? <>{nodes}</> : parseFormattedInline(text, keyPrefix);
}

/**
 * Разбор вложенного форматирования (как в Telegram / Markdown-lite):
 * - **жирный**
 * - __курсив__
 * - ~~зачёркнутый~~
 * - `моноширинный`
 * - ||спойлер||
 * - [текст](https://url)
 * - автоссылки http(s)
 */
export function parseFormattedInline(text: string, keyPrefix = 'f'): ReactNode {
  if (!text) return null;
  return <>{parseInlineRecursive(text, keyPrefix)}</>;
}

function parseInlineRecursive(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    const rest = text.slice(i);

    // `code`
    if (rest[0] === '`') {
      const end = rest.indexOf('`', 1);
      if (end > 0) {
        const code = rest.slice(1, end);
        out.push(
          <code
            key={`${keyPrefix}-${key++}`}
            className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.92em] dark:bg-white/10"
          >
            {code}
          </code>,
        );
        i += end + 1;
        continue;
      }
    }

    // **bold** (рекурсия внутри)
    if (rest.startsWith('**')) {
      const close = text.indexOf('**', i + 2);
      if (close > i + 2) {
        const inner = text.slice(i + 2, close);
        out.push(
          <strong key={`${keyPrefix}-${key++}`} className="font-semibold">
            {parseFormattedInline(inner, `${keyPrefix}-b${key}`)}
          </strong>,
        );
        i = close + 2;
        continue;
      }
    }

    // __italic__
    if (rest.startsWith('__')) {
      const close = text.indexOf('__', i + 2);
      if (close > i + 2) {
        const inner = text.slice(i + 2, close);
        out.push(
          <em key={`${keyPrefix}-${key++}`} className="italic">
            {parseFormattedInline(inner, `${keyPrefix}-i${key}`)}
          </em>,
        );
        i = close + 2;
        continue;
      }
    }

    // ~~strike~~
    if (rest.startsWith('~~')) {
      const close = text.indexOf('~~', i + 2);
      if (close > i + 2) {
        const inner = text.slice(i + 2, close);
        out.push(
          <del key={`${keyPrefix}-${key++}`} className="opacity-80">
            {parseFormattedInline(inner, `${keyPrefix}-s${key}`)}
          </del>,
        );
        i = close + 2;
        continue;
      }
    }

    // ||spoiler||
    if (rest.startsWith('||')) {
      const close = text.indexOf('||', i + 2);
      if (close > i + 2) {
        const inner = text.slice(i + 2, close);
        out.push(
          <SpoilerInline key={`${keyPrefix}-${key++}`}>
            {parseFormattedInline(inner, `${keyPrefix}-sp${key}`)}
          </SpoilerInline>,
        );
        i = close + 2;
        continue;
      }
    }

    // [label](url)
    if (rest[0] === '[') {
      const labelEnd = text.indexOf(']', i + 1);
      if (labelEnd > i && text[labelEnd + 1] === '(') {
        const parenEnd = text.indexOf(')', labelEnd + 2);
        if (parenEnd > labelEnd) {
          const label = text.slice(i + 1, labelEnd);
          const url = text.slice(labelEnd + 2, parenEnd).trim();
          if (/^https?:\/\//i.test(url)) {
            out.push(
              <a
                key={`${keyPrefix}-${key++}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline decoration-primary/40 underline-offset-2"
              >
                {parseFormattedInline(label, `${keyPrefix}-l${key}`)}
              </a>,
            );
            i = parenEnd + 1;
            continue;
          }
        }
      }
    }

    // Обычный фрагмент до следующего спецсимвола или конца
    let j = i + 1;
    while (j < text.length) {
      const c = text[j];
      if (
        c === '`' ||
        c === '*' ||
        c === '_' ||
        c === '~' ||
        c === '|' ||
        c === '['
      ) {
        break;
      }
      j++;
    }
    const plain = text.slice(i, j);
    out.push(...linkifyPlain(plain, `${keyPrefix}-p${key++}`));
    i = j;
  }

  return out;
}
