export class AlufError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AlufError';
  }
}

export class NotFoundError extends AlufError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} с id=${id} не найден` : `${resource} не найден`,
      404,
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AlufError {
  constructor(message = 'Требуется аутентификация') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AlufError {
  constructor(message = 'Недостаточно прав') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends AlufError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BAD_REQUEST', message, 400, details);
    this.name = 'BadRequestError';
  }
}

export class ConflictError extends AlufError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AlufError {
  constructor(retryAfterMs: number) {
    super('RATE_LIMITED', 'Слишком много запросов', 429, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}

export class FileTooLargeError extends AlufError {
  constructor(maxSize: number) {
    super('FILE_TOO_LARGE', `Файл превышает максимальный размер ${Math.round(maxSize / (1024 * 1024 * 1024))} ГБ`, 413);
    this.name = 'FileTooLargeError';
  }
}
