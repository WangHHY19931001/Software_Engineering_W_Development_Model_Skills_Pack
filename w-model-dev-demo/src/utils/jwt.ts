/**
 * JWT 签发/验证
 */
import jwt from 'jsonwebtoken';
import { getEnv } from './env.js';
import { AppError, AuthError } from './errors.js';
import { ErrorCode, UserRole, type JwtPayload } from '../types/index.js';

const DEFAULT_EXPIRES_SECONDS = 24 * 60 * 60;

export interface SignOptions {
  expiresInSeconds?: number;
}

export function signToken(payload: { sub: string; role: UserRole }, options: SignOptions = {}): {
  token: string;
  expiresIn: number;
} {
  const env = getEnv();
  const expiresIn = options.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS;
  const token = jwt.sign(
    { sub: payload.sub, role: payload.role },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn },
  );
  return { token, expiresIn };
}

export function verifyToken(token: string): JwtPayload {
  if (!token || token.trim() === '') {
    throw new AuthError('Token is empty', ErrorCode.TOKEN_INVALID);
  }
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      throw new AuthError('Token payload invalid', ErrorCode.TOKEN_INVALID);
    }
    const sub = (decoded as Record<string, unknown>).sub;
    const role = (decoded as Record<string, unknown>).role;
    if (typeof sub !== 'string' || typeof role !== 'string') {
      throw new AuthError('Token payload missing fields', ErrorCode.TOKEN_INVALID);
    }
    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new AuthError('Token role invalid', ErrorCode.TOKEN_INVALID);
    }
    return decoded as JwtPayload;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Token verification failed';
    if (message.toLowerCase().includes('expired')) {
      throw new AuthError('Token expired', ErrorCode.TOKEN_EXPIRED);
    }
    throw new AuthError('Token invalid', ErrorCode.TOKEN_INVALID);
  }
}

export function decodeTokenUnsafe(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}
