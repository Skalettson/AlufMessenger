import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().email('Некорректный email'),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/, {
    message: 'Имя пользователя должно начинаться с буквы и содержать только буквы, цифры и символ подчёркивания (3-32 символа)',
  }),
  displayName: z.string().min(1).max(64),
});
export type RegisterDto = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email('Некорректный email'),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const VerifyDto = z.object({
  verificationId: z.string().uuid(),
  code: z.string().length(6),
  type: z.enum(['register', 'login']).default('register'),
  twoFactorCode: z.string().optional(),
});
export type VerifyDto = z.infer<typeof VerifyDto>;

export const RefreshDto = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshDto>;

export const Setup2FADto = z.object({
  password: z.string().min(6).max(128),
  hint: z.string().max(128).optional(),
});
export type Setup2FADto = z.infer<typeof Setup2FADto>;

export const Verify2FADto = z.object({
  code: z.string().min(1),
});
export type Verify2FADto = z.infer<typeof Verify2FADto>;
