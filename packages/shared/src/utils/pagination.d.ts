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
export declare function encodeCursor(data: Record<string, unknown>): string;
export declare function decodeCursor<T = Record<string, unknown>>(cursor: string): T;
export declare const DEFAULT_PAGE_SIZE = 50;
export declare const MAX_PAGE_SIZE = 200;
export declare function clampPageSize(size: number): number;
//# sourceMappingURL=pagination.d.ts.map