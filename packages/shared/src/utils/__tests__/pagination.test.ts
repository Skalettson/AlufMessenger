import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, clampPageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../pagination';

describe('Pagination Utilities', () => {
  it('encodes and decodes cursor', () => {
    const data = { id: '123', createdAt: '2025-01-01' };
    const cursor = encodeCursor(data);
    expect(typeof cursor).toBe('string');
    expect(decodeCursor(cursor)).toEqual(data);
  });

  it('clamps page size', () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(50)).toBe(50);
    expect(clampPageSize(1000)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(-1)).toBe(1);
  });

  it('has correct defaults', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
    expect(MAX_PAGE_SIZE).toBe(200);
  });
});
