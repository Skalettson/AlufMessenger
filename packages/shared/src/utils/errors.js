"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTooLargeError = exports.RateLimitError = exports.ConflictError = exports.BadRequestError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AlufError = void 0;
class AlufError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AlufError';
    }
}
exports.AlufError = AlufError;
class NotFoundError extends AlufError {
    constructor(resource, id) {
        super('NOT_FOUND', id ? `${resource} с id=${id} не найден` : `${resource} не найден`, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AlufError {
    constructor(message = 'Требуется аутентификация') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AlufError {
    constructor(message = 'Недостаточно прав') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class BadRequestError extends AlufError {
    constructor(message, details) {
        super('BAD_REQUEST', message, 400, details);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class ConflictError extends AlufError {
    constructor(message) {
        super('CONFLICT', message, 409);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AlufError {
    constructor(retryAfterMs) {
        super('RATE_LIMITED', 'Слишком много запросов', 429, { retryAfterMs });
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class FileTooLargeError extends AlufError {
    constructor(maxSize) {
        super('FILE_TOO_LARGE', `Файл превышает максимальный размер ${Math.round(maxSize / (1024 * 1024 * 1024))} ГБ`, 413);
        this.name = 'FileTooLargeError';
    }
}
exports.FileTooLargeError = FileTooLargeError;
//# sourceMappingURL=errors.js.map