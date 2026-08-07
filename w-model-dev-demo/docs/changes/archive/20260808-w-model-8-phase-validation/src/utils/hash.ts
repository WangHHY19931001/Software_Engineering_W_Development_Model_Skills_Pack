/**
 * 密码哈希工具（NFR-002：bcrypt 加盐哈希，全链路不含明文密码）。
 * 默认实现基于 bcryptjs（DD-002/003 属性 bcrypt）。
 */
import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export const bcryptHasher: PasswordHasher = {
  hash: (password: string) => bcrypt.hash(password, 10),
  compare: (password: string, hash: string) => bcrypt.compare(password, hash),
};
