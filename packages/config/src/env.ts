import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(20),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z.string().min(1),
});

export const natsEnvSchema = z.object({
  NATS_URL: z.string().min(1),
});

export const minioEnvSchema = z.object({
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default("aluf-media"),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
});

export const jwtEnvSchema = z.object({
  JWT_PRIVATE_KEY_PATH: z.string().min(1),
  JWT_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(2592000),
});

export const twilioEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
});

export const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@example.com"),
});

export const pushEnvSchema = z.object({
  FCM_PROJECT_ID: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_PATH: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
});

export const livekitEnvSchema = z.object({
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
});

export const apiGatewayEnvSchema = z.object({
  API_GATEWAY_PORT: z.coerce.number().int().positive().default(3000),
  API_GATEWAY_HOST: z.string().default("0.0.0.0"),
});

export const wsGatewayEnvSchema = z.object({
  WS_GATEWAY_PORT: z.coerce.number().int().positive().default(3001),
  WS_GATEWAY_HOST: z.string().default("0.0.0.0"),
});

export const grpcPortsEnvSchema = z.object({
  AUTH_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50051),
  USER_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50052),
  CHAT_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50053),
  MESSAGE_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50054),
  MEDIA_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50055),
  NOTIFICATION_SERVICE_GRPC_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(50056),
  CALL_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50057),
  SEARCH_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50058),
  STORY_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50059),
  BOT_SERVICE_PORT: z.coerce.number().int().positive().default(3002),
});

export const rateLimitEnvSchema = z.object({
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

export const fileUploadEnvSchema = z.object({
  MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(4294967296),
  MAX_FILE_SIZE_PREMIUM_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8589934592),
});

export const fullEnvSchema = baseEnvSchema
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .merge(natsEnvSchema)
  .merge(minioEnvSchema)
  .merge(jwtEnvSchema)
  .merge(twilioEnvSchema)
  .merge(emailEnvSchema)
  .merge(pushEnvSchema)
  .merge(livekitEnvSchema)
  .merge(apiGatewayEnvSchema)
  .merge(wsGatewayEnvSchema)
  .merge(grpcPortsEnvSchema)
  .merge(rateLimitEnvSchema)
  .merge(fileUploadEnvSchema);

export type FullEnv = z.infer<typeof fullEnvSchema>;

export function loadEnv(options?: { path?: string }): FullEnv {
  dotenvConfig(options);
  return fullEnvSchema.parse(process.env);
}

export function loadBaseConfig() {
  dotenvConfig();
  return baseEnvSchema.parse(process.env);
}

export function loadDatabaseConfig() {
  dotenvConfig();
  return databaseEnvSchema.parse(process.env);
}

export function loadRedisConfig() {
  dotenvConfig();
  return redisEnvSchema.parse(process.env);
}

export function loadNatsConfig() {
  dotenvConfig();
  return natsEnvSchema.parse(process.env);
}

export function loadMinioConfig() {
  dotenvConfig();
  return minioEnvSchema.parse(process.env);
}

export function loadJwtConfig() {
  dotenvConfig();
  return jwtEnvSchema.parse(process.env);
}

export function loadTwilioConfig() {
  dotenvConfig();
  return twilioEnvSchema.parse(process.env);
}

export function loadEmailConfig() {
  dotenvConfig();
  return emailEnvSchema.parse(process.env);
}

export function loadPushConfig() {
  dotenvConfig();
  return pushEnvSchema.parse(process.env);
}

export function loadLivekitConfig() {
  dotenvConfig();
  return livekitEnvSchema.parse(process.env);
}

export function loadApiGatewayConfig() {
  dotenvConfig();
  return apiGatewayEnvSchema.parse(process.env);
}

export function loadWsGatewayConfig() {
  dotenvConfig();
  return wsGatewayEnvSchema.parse(process.env);
}

export function loadGrpcPortsConfig() {
  dotenvConfig();
  return grpcPortsEnvSchema.parse(process.env);
}

export function loadRateLimitConfig() {
  dotenvConfig();
  return rateLimitEnvSchema.parse(process.env);
}

export function loadFileUploadConfig() {
  dotenvConfig();
  return fileUploadEnvSchema.parse(process.env);
}
