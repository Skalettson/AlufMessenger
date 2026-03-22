import {
  USERNAME_REGEX,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  BIO_MAX_LENGTH,
  MAX_MESSAGE_TEXT_LENGTH,
  OTP_LENGTH,
} from '../constants';

export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_REGEX.test(username)
  );
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidDisplayName(name: string): boolean {
  return name.trim().length > 0 && name.length <= DISPLAY_NAME_MAX_LENGTH;
}

export function isValidBio(bio: string): boolean {
  return bio.length <= BIO_MAX_LENGTH;
}

export function isValidMessageText(text: string): boolean {
  return text.length > 0 && text.length <= MAX_MESSAGE_TEXT_LENGTH;
}

export function isValidOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

export function sanitizeUsername(username: string): string {
  return username.toLowerCase().trim();
}
