/**
 * JWT 签发/验证 + bcrypt 哈希（DD-003-002 AuthService / DD-004-003 JwtUtil / CON-002）。
 * 与 L4_auth_token_lifecycle.tla 一致：TokenNotRevoked / TokenNotExpired 不变式。
 */
import bcrypt from 'bcrypt';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { AuthenticationError } from './errors.js';

const BCRYPT_ROUNDS = 10;
const TOKEN_ALGORITHM = 'HS256';
const TOKEN_EXPIRES_IN = '1h';

export interface JwtUtilPayload {
  sub: string;
  email: string;
  role: string;
}

export class JwtUtil {
  private readonly secret: string;
  private readonly expiresIn: string;
  private revoked: Set<string> = new Set();

  constructor(secret: string, expiresIn: string = TOKEN_EXPIRES_IN) {
    // NFR-002: HS256 密钥长度 ≥ 256 位（32 字节）。TC-SEC-001 验证 31/32/64 字节边界。
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET 长度须 ≥ 32 字节（256 位，NFR-002 / CON-002 安全约束）');
    }
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload: JwtUtilPayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: TOKEN_ALGORITHM,
      expiresIn: this.expiresIn as unknown as number,
    });
  }

  verify(token: string): JwtPayload & JwtUtilPayload {
    if (this.revoked.has(token)) {
      throw new AuthenticationError('令牌已撤销');
    }
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [TOKEN_ALGORITHM],
      }) as JwtPayload & JwtUtilPayload;
      return decoded;
    } catch {
      throw new AuthenticationError('令牌无效或已过期');
    }
  }

  revoke(token: string): void {
    this.revoked.add(token);
  }

  isRevoked(token: string): boolean {
    return this.revoked.has(token);
  }

  clearRevoked(): void {
    this.revoked.clear();
  }
}

export class PasswordHasher {
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export function generateRandomToken(bytes: number = 32): string {
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(arr).toString('hex');
}
