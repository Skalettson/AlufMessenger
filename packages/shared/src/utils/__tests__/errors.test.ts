import { describe, it, expect } from 'vitest';
import { AlufError, NotFoundError, UnauthorizedError, ForbiddenError, BadRequestError, ConflictError, RateLimitError, FileTooLargeError } from '../errors';

describe('Error Classes', () => {
  it('AlufError has correct properties', () => {
    const err = new AlufError('TEST', 'test message', 400, { key: 'val' });
    expect(err.code).toBe('TEST');
    expect(err.message).toBe('test message');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ key: 'val' });
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError', () => {
    const err = new NotFoundError('User', '123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('123');
  });

  it('UnauthorizedError', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('ForbiddenError', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('BadRequestError', () => {
    const err = new BadRequestError('invalid input');
    expect(err.statusCode).toBe(400);
  });

  it('ConflictError', () => {
    expect(new ConflictError('duplicate').statusCode).toBe(409);
  });

  it('RateLimitError', () => {
    const err = new RateLimitError(5000);
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ retryAfterMs: 5000 });
  });

  it('FileTooLargeError', () => {
    expect(new FileTooLargeError(4 * 1024 * 1024 * 1024).statusCode).toBe(413);
  });
});
