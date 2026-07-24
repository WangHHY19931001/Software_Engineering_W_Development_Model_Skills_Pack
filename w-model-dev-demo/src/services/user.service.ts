// 用户服务：用户存储、用户名唯一性校验、用户查找
// 对应 detailed-design.md DD-USER-SVC：依赖 UserStore
import type { User, Result } from '../types';
import { userStore } from '../stores/user.store';
import type { UserStore } from '../stores/user.store';

export class UserService {
  constructor(private userStore: UserStore) {}

  saveUser(user: User): Result<void> {
    if (this.userStore.findByUsername(user.username)) {
      return { ok: false, code: 60001, message: '用户名已存在' };
    }
    this.userStore.save(user);
    return { ok: true, data: undefined };
  }

  findById(userId: string): Result<User | null> {
    return { ok: true, data: this.userStore.findById(userId) };
  }

  findByUsername(username: string): Result<User | null> {
    return { ok: true, data: this.userStore.findByUsername(username) };
  }
}

export const userService = new UserService(userStore);
