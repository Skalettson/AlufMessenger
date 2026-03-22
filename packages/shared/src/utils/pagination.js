"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = void 0;
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
exports.clampPageSize = clampPageSize;
function encodeCursor(data) {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
}
function decodeCursor(cursor) {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
}
exports.DEFAULT_PAGE_SIZE = 50;
exports.MAX_PAGE_SIZE = 200;
function clampPageSize(size) {
    return Math.max(1, Math.min(size, exports.MAX_PAGE_SIZE));
}
//# sourceMappingURL=pagination.js.map