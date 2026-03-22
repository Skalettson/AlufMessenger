import { describe, it, expect } from 'vitest';
import { isValidUsername, isValidPhone, isValidEmail, isValidDisplayName, isValidBio, isValidMessageText, isValidOtp, sanitizePhone, sanitizeUsername } from '../validation';

describe('Validation Utilities', () => {
  describe('isValidUsername', () => {
    it('accepts valid usernames', () => {
      expect(isValidUsername('alice')).toBe(true);
      expect(isValidUsername('bob_123')).toBe(true);
      expect(isValidUsername('User_name_test')).toBe(true);
    });
    it('rejects invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('123abc')).toBe(false); // starts with number
      expect(isValidUsername('a'.repeat(33))).toBe(false); // too long
      expect(isValidUsername('user name')).toBe(false); // spaces
      expect(isValidUsername('user@name')).toBe(false); // special chars
    });
  });

  describe('isValidPhone', () => {
    it('accepts valid phones', () => {
      expect(isValidPhone('+79001234567')).toBe(true);
      expect(isValidPhone('+1 234 567 8901')).toBe(true);
    });
    it('rejects invalid phones', () => {
      expect(isValidPhone('79001234567')).toBe(false); // no +
      expect(isValidPhone('+0123')).toBe(false); // starts with 0
      expect(isValidPhone('abc')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('accepts valid emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.name@domain.co')).toBe(true);
    });
    it('rejects invalid emails', () => {
      expect(isValidEmail('no-at-sign')).toBe(false);
      expect(isValidEmail('@no-local.com')).toBe(false);
      expect(isValidEmail('no-domain@')).toBe(false);
    });
  });

  describe('isValidDisplayName', () => {
    it('accepts valid names', () => { expect(isValidDisplayName('Alice')).toBe(true); });
    it('rejects empty', () => { expect(isValidDisplayName('')).toBe(false); });
    it('rejects whitespace only', () => { expect(isValidDisplayName('   ')).toBe(false); });
    it('rejects too long', () => { expect(isValidDisplayName('a'.repeat(65))).toBe(false); });
  });

  describe('isValidBio', () => {
    it('accepts valid bio', () => { expect(isValidBio('Hello world')).toBe(true); });
    it('rejects too long', () => { expect(isValidBio('a'.repeat(501))).toBe(false); });
  });

  describe('isValidMessageText', () => {
    it('accepts valid text', () => { expect(isValidMessageText('Hello')).toBe(true); });
    it('rejects empty', () => { expect(isValidMessageText('')).toBe(false); });
    it('rejects too long', () => { expect(isValidMessageText('a'.repeat(4097))).toBe(false); });
  });

  describe('isValidOtp', () => {
    it('accepts 6-digit OTP', () => { expect(isValidOtp('123456')).toBe(true); });
    it('rejects non-numeric', () => { expect(isValidOtp('abc123')).toBe(false); });
    it('rejects wrong length', () => { expect(isValidOtp('12345')).toBe(false); });
  });

  describe('sanitizePhone', () => {
    it('removes formatting', () => { expect(sanitizePhone('+1 (234) 567-8901')).toBe('+12345678901'); });
  });

  describe('sanitizeUsername', () => {
    it('lowercases and trims', () => { expect(sanitizeUsername(' Alice ')).toBe('alice'); });
  });
});
