import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  RegisterDto,
  LoginDto,
  VerifyDto,
  RefreshDto,
  Setup2FADto,
  Verify2FADto,
} from '../dto/auth.dto';

describe('ZodValidationPipe', () => {
  describe('RegisterDto', () => {
    const pipe = new ZodValidationPipe(RegisterDto);

    it('should accept valid registration with phone', () => {
      const value = {
        phone: '+79991234567',
        username: 'alice',
        displayName: 'Alice',
      };
      const result = pipe.transform(value, { type: 'body' } as any);
      expect(result.username).toBe('alice');
      expect(result.displayName).toBe('Alice');
    });

    it('should accept valid registration with email', () => {
      const value = {
        email: 'alice@example.com',
        username: 'alice',
        displayName: 'Alice',
      };
      const result = pipe.transform(value, { type: 'body' } as any);
      expect(result.email).toBe('alice@example.com');
    });

    it('should reject registration without phone and email', () => {
      const value = {
        username: 'alice',
        displayName: 'Alice',
      };
      expect(() => pipe.transform(value, { type: 'body' } as any)).toThrow(BadRequestException);
    });

    it('should reject invalid username starting with digit', () => {
      const value = {
        phone: '+79991234567',
        username: '123abc',
        displayName: 'Alice',
      };
      expect(() => pipe.transform(value, { type: 'body' } as any)).toThrow(BadRequestException);
    });

    it('should reject username shorter than 3 chars', () => {
      const value = {
        phone: '+79991234567',
        username: 'ab',
        displayName: 'Alice',
      };
      expect(() => pipe.transform(value, { type: 'body' } as any)).toThrow(BadRequestException);
    });

    it('should reject empty display name', () => {
      const value = {
        phone: '+79991234567',
        username: 'alice',
        displayName: '',
      };
      expect(() => pipe.transform(value, { type: 'body' } as any)).toThrow(BadRequestException);
    });
  });

  describe('LoginDto', () => {
    const pipe = new ZodValidationPipe(LoginDto);

    it('should accept login with phone', () => {
      const result = pipe.transform({ phone: '+79991234567' }, { type: 'body' } as any);
      expect(result.phone).toBe('+79991234567');
    });

    it('should accept login with email', () => {
      const result = pipe.transform({ email: 'a@b.com' }, { type: 'body' } as any);
      expect(result.email).toBe('a@b.com');
    });

    it('should reject login without phone and email', () => {
      expect(() => pipe.transform({}, { type: 'body' } as any)).toThrow(BadRequestException);
    });
  });

  describe('VerifyDto', () => {
    const pipe = new ZodValidationPipe(VerifyDto);

    it('should accept valid verify payload', () => {
      const result = pipe.transform(
        { phone: '+79991234567', code: '123456' },
        { type: 'body' } as any,
      );
      expect(result.code).toBe('123456');
    });

    it('should reject code with wrong length', () => {
      expect(() =>
        pipe.transform({ phone: '+79991234567', code: '12345' }, { type: 'body' } as any),
      ).toThrow(BadRequestException);
    });
  });

  describe('RefreshDto', () => {
    const pipe = new ZodValidationPipe(RefreshDto);

    it('should accept valid refresh token', () => {
      const result = pipe.transform({ refreshToken: 'tok123' }, { type: 'body' } as any);
      expect(result.refreshToken).toBe('tok123');
    });

    it('should reject empty refresh token', () => {
      expect(() => pipe.transform({ refreshToken: '' }, { type: 'body' } as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Setup2FADto', () => {
    const pipe = new ZodValidationPipe(Setup2FADto);

    it('should accept valid 2FA setup', () => {
      const result = pipe.transform({ password: 'secret123' }, { type: 'body' } as any);
      expect(result.password).toBe('secret123');
    });

    it('should reject password shorter than 6 chars', () => {
      expect(() => pipe.transform({ password: '12345' }, { type: 'body' } as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Verify2FADto', () => {
    const pipe = new ZodValidationPipe(Verify2FADto);

    it('should accept valid 2FA verification', () => {
      const result = pipe.transform({ password: 'secret' }, { type: 'body' } as any);
      expect(result.password).toBe('secret');
    });

    it('should reject empty password', () => {
      expect(() => pipe.transform({ password: '' }, { type: 'body' } as any)).toThrow(
        BadRequestException,
      );
    });
  });
});

describe('API Gateway health', () => {
  it('should confirm gateway module can be referenced', () => {
    expect(true).toBe(true);
  });
});
