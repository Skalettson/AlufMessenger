export declare class AlufError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, statusCode?: number, details?: Record<string, unknown> | undefined);
}
export declare class NotFoundError extends AlufError {
    constructor(resource: string, id?: string);
}
export declare class UnauthorizedError extends AlufError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AlufError {
    constructor(message?: string);
}
export declare class BadRequestError extends AlufError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ConflictError extends AlufError {
    constructor(message: string);
}
export declare class RateLimitError extends AlufError {
    constructor(retryAfterMs: number);
}
export declare class FileTooLargeError extends AlufError {
    constructor(maxSize: number);
}
//# sourceMappingURL=errors.d.ts.map