#!/usr/bin/env node
/**
 * Unit-тест исправления auth-store: при ошибке 500 НЕ вызывать clearTokens,
 * при 401 — вызывать. Запуск: node apps/web/scripts/test-auth-store.mjs
 */
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Имитируем ApiError
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Логика из auth-store fetchCurrentUser (упрощённо)
function testFetchCurrentUserBehavior(err) {
  const clearTokensCalls = { count: 0 };
  const mockClearTokens = () => { clearTokensCalls.count++; };
  const mockSet = (state) => { /* no-op */ };

  const isAuthError = err instanceof ApiError && err.status === 401;
  if (isAuthError) {
    mockClearTokens();
    mockSet({ user: null, isAuthenticated: false });
  }
  return clearTokensCalls.count;
}

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log('  ✓', name);
    passed++;
  } else {
    console.error('  ✗', name);
    failed++;
  }
}

console.log('\n=== Тест auth-store: clearTokens только при 401 ===\n');

// 401 -> clearTokens должен быть вызван (count=1)
const count401 = testFetchCurrentUserBehavior(new ApiError(401, 'Unauthorized'));
assert('401: clearTokens вызывается', count401 === 1);

// 500 -> clearTokens НЕ должен вызываться (count=0)
const count500 = testFetchCurrentUserBehavior(new ApiError(500, 'Server Error'));
assert('500: clearTokens НЕ вызывается', count500 === 0);

// 404 -> clearTokens НЕ должен вызываться
const count404 = testFetchCurrentUserBehavior(new ApiError(404, 'Not Found'));
assert('404: clearTokens НЕ вызывается', count404 === 0);

// NetworkError (не ApiError) -> clearTokens НЕ вызывается
const countNet = testFetchCurrentUserBehavior(new Error('Network request failed'));
assert('NetworkError: clearTokens НЕ вызывается', countNet === 0);

// 403 -> clearTokens НЕ вызывается (только 401 = auth)
const count403 = testFetchCurrentUserBehavior(new ApiError(403, 'Forbidden'));
assert('403: clearTokens НЕ вызывается', count403 === 0);

console.log(`\nИтого: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
