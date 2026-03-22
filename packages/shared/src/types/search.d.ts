export type SearchResultType = 'user' | 'message' | 'chat' | 'channel';
export interface SearchRequest {
    query: string;
    type?: SearchResultType;
    chatId?: string;
    senderId?: string;
    fromDate?: Date;
    toDate?: Date;
    contentType?: import('./message').ContentType;
    limit?: number;
    offset?: number;
}
export interface SearchResponse {
    results: SearchResult[];
    total: number;
    processingTimeMs: number;
}
export interface SearchResult {
    type: SearchResultType;
    id: string;
    highlights: SearchHighlight[];
    score: number;
    data: Record<string, unknown>;
}
export interface SearchHighlight {
    field: string;
    snippet: string;
}
//# sourceMappingURL=search.d.ts.map