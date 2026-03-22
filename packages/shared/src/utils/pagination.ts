export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
}

export interface OffsetPaginationParams {
  offset: number;
  limit: number;
}

export interface OffsetPaginationResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampPageSize(size: number): number {
  return Math.max(1, Math.min(size, MAX_PAGE_SIZE));
}
