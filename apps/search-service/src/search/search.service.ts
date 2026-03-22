import { Injectable, OnModuleInit } from '@nestjs/common';
import { BadRequestError } from '@aluf/shared';

const VALID_TYPES = ['users', 'messages', 'chats'] as const;
type IndexType = (typeof VALID_TYPES)[number];

export interface SearchResult {
  type: string;
  id: string;
  highlights: Array<{ field: string; snippet: string }>;
  score: number;
  data: Record<string, unknown>;
}

/**
 * Поисковый индекс в памяти процесса (данные с NATS / gRPC).
 * Документы наполняются через NATS и gRPC IndexDocument.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly stores = new Map<IndexType, Map<string, Record<string, unknown>>>();

  constructor() {
    for (const t of VALID_TYPES) {
      this.stores.set(t, new Map());
    }
  }

  async onModuleInit() {
    /* no external index setup */
  }

  async search(
    query: string,
    type?: string,
    chatId?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ results: SearchResult[]; total: number; processingTimeMs: number }> {
    if (!query.trim()) {
      throw new BadRequestError('Поисковый запрос не может быть пустым');
    }

    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const q = query.trim();
    const t0 = Date.now();

    if (type && VALID_TYPES.includes(type as IndexType)) {
      return this.searchSingleIndex(q, type as IndexType, chatId, fromDate, toDate, clampedLimit, offset, t0);
    }

    return this.searchAllIndexes(q, chatId, fromDate, toDate, clampedLimit, offset, t0);
  }

  private searchSingleIndex(
    query: string,
    type: IndexType,
    chatId?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 20,
    offset: number = 0,
    t0?: number,
  ): { results: SearchResult[]; total: number; processingTimeMs: number } {
    const store = this.stores.get(type)!;
    const matched: SearchResult[] = [];
    for (const doc of store.values()) {
      if (!this.docMatchesFilters(type, doc, chatId, fromDate, toDate)) continue;
      if (!this.docMatchesQuery(type, doc, query)) continue;
      matched.push(this.toSearchResult(type, doc, query));
    }
    matched.sort((a, b) => b.score - a.score);
    const total = matched.length;
    const results = matched.slice(offset, offset + limit);
    return {
      results,
      total,
      processingTimeMs: Date.now() - (t0 ?? Date.now()),
    };
  }

  private searchAllIndexes(
    query: string,
    chatId?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 20,
    offset: number = 0,
    t0?: number,
  ): { results: SearchResult[]; total: number; processingTimeMs: number } {
    const all: SearchResult[] = [];
    for (const indexType of VALID_TYPES) {
      const store = this.stores.get(indexType)!;
      for (const doc of store.values()) {
        if (!this.docMatchesFilters(indexType, doc, chatId, fromDate, toDate)) continue;
        if (!this.docMatchesQuery(indexType, doc, query)) continue;
        all.push(this.toSearchResult(indexType, doc, query));
      }
    }
    all.sort((a, b) => b.score - a.score);
    const total = all.length;
    const results = all.slice(offset, offset + limit);
    return {
      results,
      total,
      processingTimeMs: Date.now() - (t0 ?? Date.now()),
    };
  }

  private docMatchesFilters(
    type: IndexType,
    doc: Record<string, unknown>,
    chatId?: string,
    fromDate?: Date,
    toDate?: Date,
  ): boolean {
    if (type !== 'messages') return true;
    if (chatId && String(doc.chat_id ?? '') !== chatId) return false;
    const ts = doc.created_at;
    if (typeof ts === 'number') {
      if (fromDate) {
        const fromSec = Math.floor(fromDate.getTime() / 1000);
        if (ts < fromSec) return false;
      }
      if (toDate) {
        const toSec = Math.floor(toDate.getTime() / 1000);
        if (ts > toSec) return false;
      }
    }
    return true;
  }

  private docMatchesQuery(type: IndexType, doc: Record<string, unknown>, q: string): boolean {
    const text = this.getSearchableText(type, doc).toLowerCase();
    return text.includes(q.toLowerCase());
  }

  private getSearchableText(type: IndexType, doc: Record<string, unknown>): string {
    if (type === 'users') {
      return [doc.username, doc.display_name, doc.bio, doc.avatar_url]
        .map((v) => (v != null ? String(v) : ''))
        .join(' ');
    }
    if (type === 'messages') {
      return String(doc.text_content ?? '');
    }
    return [doc.title, doc.description, doc.type, doc.avatar_url]
      .map((v) => (v != null ? String(v) : ''))
      .join(' ');
  }

  private toSearchResult(type: IndexType, doc: Record<string, unknown>, q: string): SearchResult {
    const highlights = this.buildHighlights(type, doc, q);
    const score = highlights.length > 0 ? Math.min(1, 0.5 + highlights.length * 0.1) : 0;
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
      if (!key.startsWith('_')) data[key] = value;
    }
    return {
      type,
      id: String(doc.id ?? ''),
      highlights,
      score,
      data,
    };
  }

  private buildHighlights(
    type: IndexType,
    doc: Record<string, unknown>,
    q: string,
  ): Array<{ field: string; snippet: string }> {
    const fields =
      type === 'users'
        ? (['username', 'display_name', 'bio'] as const)
        : type === 'messages'
          ? (['text_content'] as const)
          : (['title', 'description'] as const);
    const ql = q.toLowerCase();
    const out: Array<{ field: string; snippet: string }> = [];
    for (const f of fields) {
      const v = doc[f];
      if (v == null) continue;
      const s = String(v);
      if (!s.toLowerCase().includes(ql)) continue;
      out.push({ field: f, snippet: this.highlightSnippet(s, q) });
    }
    return out;
  }

  private highlightSnippet(value: string, q: string): string {
    const lower = value.toLowerCase();
    const qi = q.toLowerCase();
    const idx = lower.indexOf(qi);
    if (idx === -1) return value;
    return (
      value.slice(0, idx) +
      '<em>' +
      value.slice(idx, idx + q.length) +
      '</em>' +
      value.slice(idx + q.length)
    );
  }

  async indexDocument(type: string, id: string, data: Record<string, unknown>) {
    if (!VALID_TYPES.includes(type as IndexType)) {
      throw new BadRequestError(`Неизвестный тип индекса: ${type}`);
    }
    const store = this.stores.get(type as IndexType)!;
    const existing = store.get(id) ?? {};
    store.set(id, { ...existing, ...data, id });
  }

  async deleteDocument(type: string, id: string) {
    if (!VALID_TYPES.includes(type as IndexType)) {
      throw new BadRequestError(`Неизвестный тип индекса: ${type}`);
    }
    const store = this.stores.get(type as IndexType)!;
    store.delete(id);
  }
}
