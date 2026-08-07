/**
 * JWT 工具（DD-046 / CON-003）：HS256、24h 有效期、密钥仅从环境变量 JWT_SECRET 读取（禁止硬编码）。
 *
 * reworkHint（阶段 4 V/R3）统一方案：令牌角色声明一致——
 * DD-002 issueToken 签 {sub, role}，DD-046 verify 返回 {sub, role, iat, exp}，
 * 二者使用同一载荷结构（含 role 声明），签名侧与验签侧完全一致。
 */
import jwt, { type SignOptions } from 'jsonwebtoken';
import { BizError } from './errors';
import { invariant } from './invariant';
import type { TokenPayload, Role } from '../types';

const DEFAULT_EXPIRES_IN = '24h';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 密钥缺失属装配/环境配置错误 → 50001（DD-046 sign 前置：JWT_SECRET 已注入）
    throw new BizError(50001, 'JWT_SECRET 未配置');
  }
  return secret;
}

export class JwtUtil {
  /** 签发令牌（HS256，有效期 24h；payload 统一 {sub, role}，与 verify 返回一致） */
  sign(payload: { sub: string; role: Role }): string {
    const options: SignOptions = { algorithm: 'HS256', expiresIn: DEFAULT_EXPIRES_IN };
    return jwt.sign(payload, getSecret(), options);
  }

  /** 验签 + exp 判定：签名非法/伪造 → 40101；过期 → 40102（令牌状态 active→expired，RH-02） */
  verify(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub || typeof payload.exp !== 'number') {
        throw new BizError(40101);
      }
      // TLA+ BusinessInvariant 锚点（L2_BlogSystemAuth / L3_BlogSystemAuthFlow / CON-003）：
      // JWT 有效期不变量——exp − iat ≤ 86400s（24h，CON-003）
      invariant(
        typeof payload.iat === 'number' && payload.exp - payload.iat <= 86400,
        'JWT 有效期不变量违反：exp − iat ≤ 86400s（24h）',
      );
      return {
        sub: payload.sub as string,
        role: (payload.role as Role) ?? 'reader',
        iat: payload.iat as number,
        exp: payload.exp,
      };
    } catch (err) {
      if (err instanceof BizError) throw err;
      if (err instanceof jwt.TokenExpiredError) {
        throw new BizError(40102);
      }
      throw new BizError(40101);
    }
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemAuth "TokenExpire" / L2_BlogSystemInfrastructure "ExpireToken"） ============ */

  /** TLA+ L2_BlogSystemAuth "TokenExpire" 动作对应：判定令牌是否已过期（§0.2 active→expired，40102 语义） */
  tokenExpire(token: string): boolean {
    try {
      this.verify(token);
      return false;
    } catch (err) {
      return err instanceof BizError && err.code === 40102;
    }
  }

  /** TLA+ L2_BlogSystemInfrastructure "ExpireToken" 动作对应：令牌过期判定（与 tokenExpire 等价语义） */
  expireToken(token: string): boolean {
    return this.tokenExpire(token);
  }
}
