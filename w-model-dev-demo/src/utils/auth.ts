// bcrypt + JWT helpers (with revocation registry for AuthService).

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '../types.js';
import { AppError, ErrorCode } from './errors.js';

const JWT_TTL_SECONDS = 24 * 60 * 60; // 24h

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(ErrorCode.ZodValidation, 'JWT_SECRET is not configured');
  }
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// In-memory revoked JTIs set. AuthService.revokeToken adds; verifyToken checks.
export const revokedJtis: Set<string> = new Set();

export function revokeJti(jti: string): void {
  revokedJtis.add(jti);
}

export function isJtiRevoked(jti: string): boolean {
  return revokedJtis.has(jti);
}

export function clearRevokedJtis(): void {
  revokedJtis.clear();
}

let jtiCounter = 0;
function nextJti(): string {
  jtiCounter += 1;
  return `jti-${jtiCounter}-${Date.now()}`;
}

export function signToken(userId: string, role: UserRole): string {
  const secret = getSecret();
  const payload: JwtPayload = {
    userId,
    role,
    jti: nextJti(),
  };
  return jwt.sign(payload, secret, { expiresIn: JWT_TTL_SECONDS });
}

export interface VerifyResult {
  payload: JwtPayload;
}

export function verifyToken(token: string): VerifyResult {
  if (!token) {
    throw new AppError(ErrorCode.NoUser, '1011');
  }
  const secret = getSecret();
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('expired')) {
      throw new AppError(ErrorCode.ExpiredToken, '1013');
    }
    throw new AppError(ErrorCode.WrongPassword, '1012');
  }
  if (payload.jti && isJtiRevoked(payload.jti)) {
    throw new AppError(ErrorCode.Banned, '1022');
  }
  return { payload };
}

/** Convenience: revoke all issued JTIs for a user. AuthService uses this. */
export function revokeAllJtisForUser(jtis: string[]): void {
  for (const j of jtis) {
    revokedJtis.add(j);
  }
}
