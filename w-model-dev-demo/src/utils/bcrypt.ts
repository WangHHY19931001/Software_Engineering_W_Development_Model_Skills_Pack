/**
 * bcrypt 密码哈希/比对（DD-001 GAP-001，cost ≥ 10）
 */
import bcrypt from 'bcrypt';
import { AppError } from './errors.js';

function getCost(): number {
  const raw = process.env.BCRYPT_COST;
  const cost = raw ? parseInt(raw, 10) : 10;
  return Number.isFinite(cost) && cost >= 10 ? cost : 10;
}

export function hashPassword(plain: string): string {
  try {
    return bcrypt.hashSync(plain, getCost());
  } catch (err) {
    throw new AppError(50001, '密码哈希失败', { cause: String(err) });
  }
}

export function comparePassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}
