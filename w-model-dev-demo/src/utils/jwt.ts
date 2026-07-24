/**
 * DD-001 JwtUtil —— JWT 签发/校验/刷新 + bcrypt 密码哈希/比对
 * access token 2h(7200s) + refresh token 7d(604800s)，GAP-004。
 */
import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';
import { hashPassword, comparePassword } from './bcrypt.js';

export interface JwtPayload {
  userId?: string;
  role?: string;
  type?: string;
  [k: string]: unknown;
}

export const ACCESS_EXPIRES = 7200;
export const REFRESH_EXPIRES = 604800;

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'required') {
    throw new AppError(50001, 'JWT_SECRET 未配置');
  }
  return secret;
}

export function sign(payload: JwtPayload, expiresIn: number = ACCESS_EXPIRES): string {
  const secret = getSecret();
  return jwt.sign(payload, secret, { expiresIn });
}

export function verify(token: string): JwtPayload {
  const secret = getSecret();
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(40101, 'token 已过期');
    }
    throw new AppError(40102, 'token 签名无效');
  }
}

export function refresh(refreshToken: string): { accessToken: string } {
  const payload = verify(refreshToken);
  const accessToken = sign(
    { userId: payload.userId, role: payload.role },
    ACCESS_EXPIRES,
  );
  return { accessToken };
}

/**
 * 检查 JWT 是否已过期（对应 TLA+ L2_identity_access.tla ExpireJwt 动作）。
 * 返回 true 表示 token 已过期（即 expiry 已生效）。
 */
export function expireJwt(token: string): boolean {
  try {
    verify(token);
    return false;
  } catch {
    return true;
  }
}

/** JwtUtil 门面对象（聚合 JWT + bcrypt，对应 DD-001 类图） */
export const jwtUtil = {
  sign,
  verify,
  refresh,
  expireJwt,
  hashPassword,
  comparePassword,
  ACCESS_EXPIRES,
  REFRESH_EXPIRES,
};
