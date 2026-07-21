import jwt, { type JwtPayload as LibJwtPayload } from 'jsonwebtoken';
import { AppError, AuthError } from './errors.js';
import type { JwtPayload } from '../types.js';

/**
 * JWT 签发 / 校验工具。
 *
 * 设计来源：`docs/detailed-design.md` §3.7 / NFR-001。
 * - HS256；密钥来自构造参数（生产环境由 `process.env.JWT_SECRET` 注入）。
 * - `expiresIn` 默认 3600s（NFR-001）；`sign` 失败抛 `AppError(50001)`。
 * - `verify` 在 token 过期 / 签名无效 / 格式错误时抛 `AuthError(40102)`。
 */
export class JwtUtils {
  private readonly secret: string;
  private readonly expiresIn: number;

  constructor(secret: string, expiresIn: number = 3600) {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload: JwtPayload): string {
    if (!this.secret) {
      throw new AppError(50001, 'JWT_SECRET 未配置', 500, true);
    }
    try {
      return jwt.sign({ userId: payload.userId, username: payload.username }, this.secret, {
        expiresIn: this.expiresIn,
      });
    } catch (err) {
      throw new AppError(50001, `JWT 签发失败: ${(err as Error).message}`, 500, true);
    }
  }

  verify(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as LibJwtPayload;
      if (typeof decoded.userId !== 'string' || typeof decoded.username !== 'string') {
        throw new AuthError(40102, 'JWT 已过期或无效');
      }
      return {
        userId: decoded.userId,
        username: decoded.username,
        iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
        exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
      };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(40102, 'JWT 已过期或无效');
    }
  }
}
