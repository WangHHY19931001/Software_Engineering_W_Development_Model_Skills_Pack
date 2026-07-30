/**
 * Vitest 全局测试环境初始化
 * 在所有测试运行前设置必需的环境变量（如 JWT_SECRET）
 */
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '24h';
process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? '60000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '100';
process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS ?? '3';
process.env.WEBHOOK_BASE_BACKOFF_MS = process.env.WEBHOOK_BASE_BACKOFF_MS ?? '10';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
