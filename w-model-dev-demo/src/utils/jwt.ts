/**
 * JwtService：JWT 签发 / 校验（realizes INTF-005 / DD-008）。
 * HS256，exp=iat+3600，密钥来自 process.env.JWT_SECRET，缺失抛 50001。
 */
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types';
import { UnauthorizedError, InternalError, ErrorCode } from './errors';

const DEFAULT_EXPIRES_IN = 3600;
const ALGORITHM = 'HS256';

export class JwtService {
  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalError(ErrorCode.INTERNAL, 'JWT_SECRET 未配置');
    }
    return secret;
  }

  sign(payload: JwtPayload, expiresIn: number = DEFAULT_EXPIRES_IN): string {
    const secret = this.getSecret();
    return jwt.sign(payload, secret, { algorithm: ALGORITHM, expiresIn });
  }

  verify(token: string): JwtPayload {
    const secret = this.getSecret();
    try {
      const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] }) as JwtPayload;
      return payload;
    } catch {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED_TOKEN, 'JWT 已过期或无效');
    }
  }
}
