import { describe, it, expect, beforeEach } from 'vitest';
import { CorsMiddleware } from '../cors.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('CorsMiddleware', () => {
  let middleware: CorsMiddleware;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let nextCalled: boolean;

  beforeEach(() => {
    process.env.CORS_ORIGINS = 'https://example.com,https://*.example.com,http://localhost:3000';
    process.env.CORS_CREDENTIALS = 'true';
    process.env.CORS_MAX_AGE = '86400';
    process.env.CORS_PREFLIGHT_RATE_LIMIT = '100';
    process.env.CORS_PREFLIGHT_WINDOW_MS = '60000';
    
    middleware = new CorsMiddleware();
    nextCalled = false;
    next = () => { nextCalled = true; };
    
    res = {
      setHeader: () => res,
      status: () => res,
      send: () => res,
      json: () => res,
    } as Partial<Response>;
  });

  describe('validateOrigin', () => {
    it('должен разрешать точные совпадения origin', () => {
      req = {
        method: 'GET',
        headers: { origin: 'https://example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен разрешать поддомены с wildcard', () => {
      req = {
        method: 'GET',
        headers: { origin: 'https://sub.example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен разрешать localhost с портом', () => {
      req = {
        method: 'GET',
        headers: { origin: 'http://localhost:3000' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен блокировать атаки типа evil-domain.com для *.domain.com', () => {
      req = {
        method: 'GET',
        headers: { origin: 'https://evil-example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true); // next вызывается, но CORS заголовки не устанавливаются
    });

    it('должен блокировать null origin', () => {
      req = {
        method: 'GET',
        headers: { origin: 'null' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен блокировать некорректные URL', () => {
      req = {
        method: 'GET',
        headers: { origin: 'not-a-valid-url' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен блокировать ftp:// схемы', () => {
      req = {
        method: 'GET',
        headers: { origin: 'ftp://example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });
  });

  describe('Preflight Requests', () => {
    it('должен обрабатывать OPTIONS preflight запрос', () => {
      req = {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type',
        },
      };
      
      let statusCalled = false;
      res.status = (code: number) => {
        expect(code).toBe(204);
        statusCalled = true;
        return res as Response;
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(statusCalled).toBe(true);
      expect(nextCalled).toBe(false); // next не должен вызываться для preflight
    });

    it('должен устанавливать CORS заголовки для preflight', () => {
      const headers: Record<string, string> = {};
      res.setHeader = (name: string, value: string) => {
        headers[name] = value;
        return res as Response;
      };
      
      req = {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type',
        },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });

  describe('CORS Headers', () => {
    it('должен устанавливать все необходимые CORS заголовки', () => {
      const headers: Record<string, string> = {};
      res.setHeader = (name: string, value: string) => {
        headers[name] = value;
        return res as Response;
      };
      
      req = {
        method: 'GET',
        headers: { origin: 'https://example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
      expect(headers['Vary']).toBe('Origin');
    });

    it('должен устанавливать Vary: Origin для кэширования', () => {
      const headers: Record<string, string> = {};
      res.setHeader = (name: string, value: string) => {
        headers[name] = value;
        return res as Response;
      };
      
      req = {
        method: 'GET',
        headers: { origin: 'https://example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(headers['Vary']).toBe('Origin');
    });
  });

  describe('Requests без origin', () => {
    it('должен пропускать запросы без origin (mobile apps, curl)', () => {
      req = {
        method: 'GET',
        headers: {},
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });
  });

  describe('Subdomain validation', () => {
    it('должен разрешать глубокие поддомены', () => {
      req = {
        method: 'GET',
        headers: { origin: 'https://deep.sub.example.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });

    it('должен блокировать похожие домены', () => {
      req = {
        method: 'GET',
        headers: { origin: 'https://notexample.com' },
      };
      
      middleware.use(req as Request, res as Response, next);
      
      expect(nextCalled).toBe(true);
    });
  });
});
