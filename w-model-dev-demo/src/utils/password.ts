import bcrypt from 'bcrypt';
import { AppError } from './errors.js';

/**
 * 密码哈希工具。
 *
 * 设计来源：`docs/detailed-design.md` §3.6 / NFR-001。
 * - 使用 bcrypt，cost = 10（NFR-001）。
 * - `hash` 失败抛 `AppError(50002)`；`compare` 内部捕获 bcrypt 异常并返回 false（不抛错）。
 */
export class PasswordUtils {
  static readonly BCRYPT_COST: number = 10;

  hash(password: string): string {
    try {
      return bcrypt.hashSync(password, PasswordUtils.BCRYPT_COST);
    } catch (err) {
      throw new AppError(50002, `密码哈希失败: ${(err as Error).message}`, 500, true);
    }
  }

  compare(password: string, hash: string): boolean {
    try {
      return bcrypt.compareSync(password, hash);
    } catch {
      // 非法 hash 等异常视作不匹配，不向上抛出（与 §3.6 后置条件一致）
      return false;
    }
  }
}
