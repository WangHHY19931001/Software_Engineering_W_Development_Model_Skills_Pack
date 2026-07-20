export const JWT_SECRET = process.env.JWT_SECRET
  ?? (() => { throw new Error('JWT_SECRET environment variable is required'); })();

export const PORT = Number(process.env.PORT ?? 3000);

export const JWT_EXPIRES_IN = 3600; // 秒，对应 NFR-001 ≤ 3600s

export const BCRYPT_COST = 10; // 对应 NFR-001 ≥ 10
