'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useChatStore } from '@/stores/chat-store';
import { formatMessageTime } from '@/lib/utils';

interface SearchHit {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
  highlights?: Array<{ field: string; snippet: string }>;
}

interface Props {
  chatId: string;
  title?: string;
  open: boolean;
  onClose: () => void;
}

export function ChatSearchDialog({ chatId, title = 'Чат', open, onClose }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const setPendingScrollToMessageId = useChatStore((s) => s.setPendingScrollToMessageId);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        results?: SearchHit[];
      }>(
        `/search?q=${encodeURIComponent(query)}&type=messages&chatId=${encodeURIComponent(chatId)}&limit=30&offset=0`,
      );
      setResults(Array.isArray(res?.results) ? res.results : []);
    } catch {
      setError('Не удалось выполнить поиск');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, chatId]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  const pickSnippet = (hit: SearchHit) => {
    const h = hit.highlights?.[0]?.snippet;
    if (h) return h.replace(/<em>/g, '').replace(/<\/em>/g, '');
    const d = hit.data ?? {};
    const text = (d.text_content ?? d.textContent ?? '') as string;
    return text.slice(0, 200) || hit.id;
  };

  const pickTime = (hit: SearchHit) => {
    const d = hit.data ?? {};
    const raw = (d.created_at ?? d.createdAt ?? '') as string;
    return raw ? formatMessageTime(raw) : '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Поиск в «{title}»
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Текст сообщения…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
          />
          <Button type="button" onClick={() => void runSearch()} disabled={loading || q.trim().length < 1}>
            {loading ? '…' : 'Найти'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 border border-border rounded-lg divide-y divide-border">
          {results.length === 0 && !loading && q.trim().length >= 1 && !error && (
            <li className="p-4 text-sm text-muted-foreground text-center">Ничего не найдено</li>
          )}
          {results.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors"
                onClick={() => {
                  setPendingScrollToMessageId(hit.id);
                  onClose();
                }}
              >
                <p className="text-xs text-muted-foreground mb-0.5">{pickTime(hit)}</p>
                <p className="text-sm line-clamp-3">{pickSnippet(hit)}</p>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
