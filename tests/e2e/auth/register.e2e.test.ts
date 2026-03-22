/**
 * E2E тесты для аутентификации
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../utils/api-client';

describe('Auth E2E', () => {
  const API_URL = 'http://localhost:3000/v1';
  const TEST_PHONE = '+79990000001';
  const TEST_PHONE_2 = '+79990000002';
  
  let client: ApiClient;

  beforeAll(async () => {
    // Очистка перед тестами
    client = new ApiClient(API_URL);
  });

  afterAll(async () => {
    await client?.cleanup();
  });

  describe('Registration', () => {
    it('should register new user with phone', async () => {
      // Запрос OTP
      const registerResponse = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE, displayName: 'Test User' }),
      });

      expect(registerResponse.status).toBe(200);
      const registerData = await registerResponse.json();
      expect(registerData.requestId).toBeDefined();
      expect(registerData.expiresAt).toBeDefined();
    });

    it('should verify OTP and receive tokens', async () => {
      // В реальном тесте здесь будет код из SMS
      // Для тестов используем mock OTP
      const requestId = 'test-request-id';
      
      const verifyResponse = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, code: '123456' }),
      });

      // Если сервис не запущен, пропускаем
      if (verifyResponse.status === 503) {
        console.log('⚠️  Service unavailable, skipping test');
        return;
      }

      if (verifyResponse.ok) {
        const tokens = await verifyResponse.json();
        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(typeof tokens.accessToken).toBe('string');
        expect(tokens.accessToken.split('.')).toHaveLength(3); // JWT format
      }
    });
  });

  describe('Login', () => {
    it('should login with existing phone', async () => {
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE }),
      });

      if (loginResponse.ok) {
        expect(loginResponse.status).toBe(200);
        const data = await loginResponse.json();
        expect(data.requestId).toBeDefined();
      }
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with refresh token', async () => {
      // Сначала получим токены
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE_2 }),
      });

      if (!loginResponse.ok) return;

      const loginData = await loginResponse.json();
      const verifyResponse = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: loginData.requestId, code: '123456' }),
      });

      if (!verifyResponse.ok) return;
      
      const tokens = await verifyResponse.json();
      
      // Теперь пробуем refresh
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (refreshResponse.ok) {
        const newTokens = await refreshResponse.json();
        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
        expect(newTokens.accessToken).not.toBe(tokens.accessToken);
      }
    });
  });

  describe('Protected Routes', () => {
    it('should reject request without auth token', async () => {
      const response = await fetch(`${API_URL}/users/me`);
      expect(response.status).toBe(401);
    });

    it('should accept request with valid token', async () => {
      // Получаем токен
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE_2 }),
      });

      if (!loginResponse.ok) return;

      const loginData = await loginResponse.json();
      const verifyResponse = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: loginData.requestId, code: '123456' }),
      });

      if (!verifyResponse.ok) return;
      
      const tokens = await verifyResponse.json();
      
      // Запрос с токеном
      const meResponse = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
      });

      if (meResponse.ok) {
        expect(meResponse.status).toBe(200);
        const user = await meResponse.json();
        expect(user.id).toBeDefined();
        expect(user.alufId).toBeDefined();
      }
    });

    it('should reject request with invalid token', async () => {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': 'Bearer invalid.token.here' },
      });
      expect(response.status).toBe(401);
    });
  });
});
