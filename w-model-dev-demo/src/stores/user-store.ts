/**
 * DD-004 UserStore —— 内存 Map 用户存储
 *
 * 主索引 users: Map<userId, User>；辅助索引 emailIndex: Map<email, userId>。
 * 原型链污染防护：禁止 __proto__/constructor/prototype 作为键（NFR-003）。
 * 提供 insertOrUpdate 供 WalReplayer 幂等重放使用。
 */
import type { User } from '../types.js';
import { AppError } from '../utils/errors.js';

/** 危险键清单（原型链污染防护，NFR-003） */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeKey(key: string): void {
  if (DANGEROUS_KEYS.has(key)) {
    throw new AppError(40003, `非法键名: ${key}`, { key });
  }
}

export class UserStore {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  /** 插入用户（对应 DD-004 insert） */
  insert(user: User): void {
    assertSafeKey(user.id);
    assertSafeKey(user.email);
    if (this.users.has(user.id)) {
      throw new AppError(40901, `用户 ID 已存在: ${user.id}`, { id: user.id });
    }
    if (this.emailIndex.has(user.email)) {
      throw new AppError(40901, `邮箱已被注册: ${user.email}`, { email: user.email });
    }
    this.users.set(user.id, { ...user });
    this.emailIndex.set(user.email, user.id);
  }

  /** 幂等插入或更新（供 WalReplayer 重放使用，对应 DD-025 replayOne 应用） */
  insertOrUpdate(payload: unknown): void {
    const user = payload as User;
    if (!user || !user.id || !user.email) return;
    assertSafeKey(user.id);
    assertSafeKey(user.email);
    // 移除旧 email 索引（若 email 变更）
    const existing = this.users.get(user.id);
    if (existing && existing.email !== user.email) {
      this.emailIndex.delete(existing.email);
    }
    this.users.set(user.id, { ...user });
    this.emailIndex.set(user.email, user.id);
  }

  /** 按 ID 查询（对应 DD-004 findById） */
  findById(id: string): User | null {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  /** 按 email 查询（对应 DD-004 findByEmail） */
  findByEmail(email: string): User | null {
    const id = this.emailIndex.get(email);
    if (!id) return null;
    return this.findById(id);
  }

  /** 局部更新（对应 DD-004 update） */
  update(id: string, patch: Partial<User>): void {
    const existing = this.users.get(id);
    if (!existing) {
      throw new AppError(40401, `用户不存在: ${id}`, { id });
    }
    // 若 email 变更，同步索引
    if (patch.email && patch.email !== existing.email) {
      assertSafeKey(patch.email);
      if (this.emailIndex.has(patch.email) && this.emailIndex.get(patch.email) !== id) {
        throw new AppError(40901, `邮箱已被注册: ${patch.email}`, { email: patch.email });
      }
      this.emailIndex.delete(existing.email);
      this.emailIndex.set(patch.email, id);
    }
    const now = Math.floor(Date.now() / 1000);
    const updated: User = { ...existing, ...patch, updatedAt: now };
    this.users.set(id, updated);
  }

  /** 删除用户（对应 DD-004 delete） */
  delete(id: string): void {
    const existing = this.users.get(id);
    if (!existing) {
      throw new AppError(40401, `用户不存在: ${id}`, { id });
    }
    this.users.delete(id);
    this.emailIndex.delete(existing.email);
  }

  /** 全量列表（供统计与测试使用） */
  list(): User[] {
    return Array.from(this.users.values()).map(u => ({ ...u }));
  }

  /** 总数 */
  count(): number {
    return this.users.size;
  }

  /** 清空（供测试重置） */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}

/** 单例（供各 service 注入） */
export const userStore = new UserStore();
