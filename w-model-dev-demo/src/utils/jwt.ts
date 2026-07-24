// JWT 签发与验证工具
// 对应 detailed-design.md DD-JWT-UTIL：sign 用 JWT_SECRET 签发 1h token；verify 校验签名与有效期
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types';

export class JwtUtil {
  private secret: string;
  private expiresInSec: number;

  constructor(secret?: string, expiresInSec = 3600) {
    this.secret = secret ?? process.env.JWT_SECRET ?? '';
    this.expiresInSec = expiresInSec;
  }

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresInSec });
  }

  verify(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }
}

export const jwtUtil = new JwtUtil();
