export type AuthMethod = 'phone' | 'email' | 'anonymous';

export interface RegisterRequest {
  method: AuthMethod;
  phone?: string;
  email?: string;
  username?: string;
  displayName?: string;
}

export interface RegisterResponse {
  verificationId: string;
  expiresAt: Date;
}

export interface VerifyRequest {
  verificationId: string;
  code: string;
}

export interface LoginRequest {
  method: AuthMethod;
  phone?: string;
  email?: string;
  deviceInfo: import('./user').DeviceInfo;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerify {
  userId: string;
  code: string;
}

export interface JwtPayload {
  sub: string;
  alufId: string;
  username: string;
  iat: number;
  exp: number;
  jti: string;
  deviceId: string;
}
