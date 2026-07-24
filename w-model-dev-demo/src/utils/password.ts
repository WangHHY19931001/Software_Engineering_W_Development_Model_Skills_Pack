// bcrypt 密码哈希与比对工具
// 对应 detailed-design.md DD-PASSWORD-UTIL：hash cost factor=10；compare 比对明文与哈希
import bcrypt from 'bcrypt';

export class PasswordUtil {
  private costFactor: number;

  constructor(costFactor = 10) {
    this.costFactor = costFactor;
  }

  hash(password: string): string {
    return bcrypt.hashSync(password, this.costFactor);
  }

  compare(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }
}

export const passwordUtil = new PasswordUtil();
