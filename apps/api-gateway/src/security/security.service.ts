import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Сервис безопасности для защиты от различных атак
 * 
 * Функции:
 * - CSRF токены
 * - XSS защита (санитизация)
 * - SQL injection prevention
 * - NoSQL injection prevention
 * - Command injection prevention
 * - Path traversal prevention
 */
@Injectable()
export class SecurityService {
  private readonly csrfTokens: Map<string, number>;
  private readonly csrfTTL: number;

  constructor() {
    this.csrfTokens = new Map();
    this.csrfTTL = parseInt(process.env.CSRF_TOKEN_TTL || '3600', 10) * 1000;

    // Очистка устаревших CSRF токенов
    setInterval(() => {
      const now = Date.now();
      for (const [token, expires] of this.csrfTokens.entries()) {
        if (now > expires) {
          this.csrfTokens.delete(token);
        }
      }
    }, 60000).unref();
  }

  /**
   * Генерация CSRF токена
   */
  generateCsrfToken(sessionId: string): string {
    const token = randomBytes(32).toString('base64url');
    const expires = Date.now() + this.csrfTTL;
    
    const key = this.getCsrfKey(sessionId, token);
    this.csrfTokens.set(key, expires);

    return token;
  }

  /**
   * Валидация CSRF токена
   */
  validateCsrfToken(sessionId: string, token: string): boolean {
    const key = this.getCsrfKey(sessionId, token);
    const expires = this.csrfTokens.get(key);

    if (!expires) {
      return false;
    }

    if (Date.now() > expires) {
      this.csrfTokens.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Санитизация строки для защиты от XSS
   */
  sanitizeString(input: string | undefined | null): string {
    if (!input) {
      return '';
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/\(/g, '&#x28;')
      .replace(/\)/g, '&#x29;');
  }

  /**
   * Проверка на XSS паттерны
   */
  hasXssPattern(input: string): boolean {
    const xssPatterns = [
      /<script\b/i,
      /<\/script>/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i, // onclick=, onerror=, etc.
      /<\s*img[^>]+onerror/i,
      /<\s*svg[^>]+onload/i,
      /expression\s*\(/i,
      /url\s*\(\s*['"]?\s*javascript:/i,
      /<\s*iframe/i,
      /<\s*object/i,
      /<\s*embed/i,
      /<\s*meta[^>]+http-equiv/i,
      /document\./i,
      /window\./i,
      /eval\s*\(/i,
      /alert\s*\(/i,
      /confirm\s*\(/i,
      /prompt\s*\(/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка на SQL injection паттерны
   */
  hasSqlInjectionPattern(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/i,
      /(--|\#|\/\*|\*\/)/, // SQL комментарии
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i, // OR 1=1
      /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i, // OR 'a'='a'
      /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)/i,
      /'\s*(OR|AND)\s*'/i,
      /'\s*;\s*--/i,
      /'\s*(DROP|DELETE|TRUNCATE)\s/i,
      /WAITFOR\s+DELAY/i,
      /BENCHMARK\s*\(/i,
      /SLEEP\s*\(/i,
      /INFORMATION_SCHEMA/i,
      /SYS\./i,
      /CHAR\s*\(\s*\d+\s*\)/i,
      /CONCAT\s*\(/i,
      /0x[0-9a-fA-F]+/i, // Hex encoding
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка на NoSQL injection паттерны
   */
  hasNoSqlInjectionPattern(input: string): boolean {
    const nosqlPatterns = [
      /\{\s*\$where\s*:/i,
      /\{\s*\$ne\s*:/i,
      /\{\s*\$gt\s*:/i,
      /\{\s*\$lt\s*:/i,
      /\{\s*\$regex\s*:/i,
      /\{\s*\$or\s*:/i,
      /\{\s*\$and\s*:/i,
      /\{\s*\$in\s*:/i,
      /\{\s*\$nin\s*:/i,
      /\{\s*\$exists\s*:/i,
      /\{\s*\$type\s*:/i,
      /\[\s*\{\s*\$or/i,
      /function\s*\(\s*\)\s*\{/i,
      /this\.\w+\s*==/i,
    ];

    for (const pattern of nosqlPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка на Command injection паттерны
   */
  hasCommandInjectionPattern(input: string): boolean {
    const cmdPatterns = [
      /[;&|`$()]/, // Shell metacharacters
      /\$\(/, // Command substitution
      /`[^`]+`/, // Backtick command substitution
      /\|\s*\w+/, // Pipe to command
      />\s*\/dev/, // Redirect to /dev
      /<\s*\/dev/, // Read from /dev
      /\/bin\/sh/,
      /\/bin\/bash/,
      /\/usr\/bin/,
      /\bwget\b/i,
      /\bcurl\b/i,
      /\bnc\b\s+-/i,
      /\bnetcat\b/i,
      /\bchmod\b/i,
      /\bchown\b/i,
      /\brm\s+-rf/i,
    ];

    for (const pattern of cmdPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка на Path traversal паттерны
   */
  hasPathTraversalPattern(input: string): boolean {
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e\//i,
      /\.\.%2f/i,
      /%2e%2e%5c/i,
      /%252e%252e%252f/i,
      /%c0%ae%c0%ae/i,
      /%c1%9c/i,
      /\.\.;\//i,
      /\.\.\:\//i,
    ];

    for (const pattern of pathPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Валидация входных данных
   */
  validateInput(
    input: string,
    options: {
      checkXss?: boolean;
      checkSqlInjection?: boolean;
      checkNoSqlInjection?: boolean;
      checkCommandInjection?: boolean;
      checkPathTraversal?: boolean;
      maxLength?: number;
    } = {}
  ): { valid: boolean; error?: string } {
    const {
      checkXss = true,
      checkSqlInjection = true,
      checkNoSqlInjection = true,
      checkCommandInjection = true,
      checkPathTraversal = true,
      maxLength = 10000,
    } = options;

    // Проверка длины
    if (input.length > maxLength) {
      return {
        valid: false,
        error: `Input exceeds maximum length of ${maxLength} characters`,
      };
    }

    // Проверка на XSS
    if (checkXss && this.hasXssPattern(input)) {
      return {
        valid: false,
        error: 'Potentially malicious XSS pattern detected',
      };
    }

    // Проверка на SQL injection
    if (checkSqlInjection && this.hasSqlInjectionPattern(input)) {
      return {
        valid: false,
        error: 'Potentially malicious SQL injection pattern detected',
      };
    }

    // Проверка на NoSQL injection
    if (checkNoSqlInjection && this.hasNoSqlInjectionPattern(input)) {
      return {
        valid: false,
        error: 'Potentially malicious NoSQL injection pattern detected',
      };
    }

    // Проверка на Command injection
    if (checkCommandInjection && this.hasCommandInjectionPattern(input)) {
      return {
        valid: false,
        error: 'Potentially malicious command injection pattern detected',
      };
    }

    // Проверка на Path traversal
    if (checkPathTraversal && this.hasPathTraversalPattern(input)) {
      return {
        valid: false,
        error: 'Potentially malicious path traversal pattern detected',
      };
    }

    return { valid: true };
  }

  /**
   * Хэширование чувствительных данных для логирования
   */
  hashSensitiveData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Маскирование чувствительных данных
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) {
      return '*'.repeat(data.length);
    }
    return '*'.repeat(data.length - visibleChars) + data.slice(-visibleChars);
  }

  /**
   * Генерация ключа для CSRF токена
   */
  private getCsrfKey(sessionId: string, token: string): string {
    return createHash('sha256').update(`${sessionId}:${token}`).digest('hex');
  }
}
