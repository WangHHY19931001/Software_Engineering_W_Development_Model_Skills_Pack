/**
 * 环境变量配置
 * JWT_SECRET 为必填项，缺失时抛错
 */
import { AppError, ErrorCode } from './errors.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new AppError(
      ErrorCode.INTERNAL,
      `Missing required environment variable: ${name}`,
      500,
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : defaultValue;
}

export interface AppEnv {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptCost: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  webhookMaxAttempts: number;
  webhookBaseBackoffMs: number;
  port: number;
  nodeEnv: string;
}

export function loadEnv(): AppEnv {
  return {
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
    bcryptCost: Number.parseInt(optionalEnv('BCRYPT_COST', '10'), 10),
    rateLimitWindowMs: Number.parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    rateLimitMax: Number.parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
    webhookMaxAttempts: Number.parseInt(optionalEnv('WEBHOOK_MAX_ATTEMPTS', '3'), 10),
    webhookBaseBackoffMs: Number.parseInt(optionalEnv('WEBHOOK_BASE_BACKOFF_MS', '1000'), 10),
    port: Number.parseInt(optionalEnv('PORT', '3000'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'test'),
  };
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}

export function resetEnv(): void {
  cachedEnv = null;
}
