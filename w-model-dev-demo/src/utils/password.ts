/**
 * PasswordHasher：bcrypt 密码哈希封装（realizes INTF-004 / DD-007）。
 * cost=10，明文不入日志。
 */
import bcrypt from 'bcrypt';
import { InternalError, ErrorCode } from './errors';

const COST = 10;

export class PasswordHasher {
  async hash(plain: string): Promise<string> {
    try {
      return await bcrypt.hash(plain, COST);
    } catch {
      throw new InternalError(ErrorCode.INTERNAL, '密码哈希失败');
    }
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      throw new InternalError(ErrorCode.INTERNAL, '密码校验失败');
    }
  }

  getRounds(hash: string): number {
    return bcrypt.getRounds(hash);
  }
}
