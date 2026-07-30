/**
 * 密码哈希/校验
 */
import bcrypt from 'bcryptjs';
import { getEnv } from './env.js';

export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const env = getEnv();
  return bcrypt.hash(plain, env.bcryptCost);
}

export function hashPasswordSync(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const env = getEnv();
  return bcrypt.hashSync(plain, env.bcryptCost);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof plain !== 'string' || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function verifyPasswordSync(plain: string, hash: string): boolean {
  if (typeof plain !== 'string' || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}
