/**
 * DD-013/014/015/017/018/020/022/023 通用内存存储基类
 *
 * 为简化单测，comment/tag/category/notification/ad/announcement/site 等领域对象
 * 共用此通用 Map 存储；不直接对应单一 DD，而是各 service 的存储底层。
 * 提供 insertOrUpdate 供 WalReplayer 幂等重放使用。
 */
import { AppError } from '../utils/errors.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeKey(key: string): void {
  if (DANGEROUS_KEYS.has(key)) {
    throw new AppError(40003, `非法键名: ${key}`, { key });
  }
}

export interface Identifiable {
  id: string;
}

export class GenericStore<T extends Identifiable> {
  protected items: Map<string, T> = new Map();

  insert(item: T): void {
    assertSafeKey(item.id);
    if (this.items.has(item.id)) {
      throw new AppError(40901, `ID 已存在: ${item.id}`, { id: item.id });
    }
    this.items.set(item.id, { ...item });
  }

  insertOrUpdate(payload: unknown): void {
    const item = payload as T;
    if (!item || !item.id) return;
    assertSafeKey(item.id);
    this.items.set(item.id, { ...item });
  }

  findById(id: string): T | null {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  update(id: string, patch: Partial<T>): void {
    const existing = this.items.get(id);
    if (!existing) {
      throw new AppError(40401, `记录不存在: ${id}`, { id });
    }
    this.items.set(id, { ...existing, ...patch });
  }

  delete(id: string): void {
    if (!this.items.has(id)) {
      throw new AppError(40401, `记录不存在: ${id}`, { id });
    }
    this.items.delete(id);
  }

  list(): T[] {
    return Array.from(this.items.values()).map(i => ({ ...i }));
  }

  count(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  has(id: string): boolean {
    return this.items.has(id);
  }
}
