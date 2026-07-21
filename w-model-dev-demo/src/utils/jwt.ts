import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';

export interface JwtPayload {
  userId: string;
  username: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 未配置');
  return secret;
}

export function signToken(payload: JwtPayload, expiresIn: number = 3600): string {
  return jwt.sign(payload, getSecret(), { expiresIn } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    throw new UnauthorizedError(40102, 'JWT 已过期或无效');
  }
}
