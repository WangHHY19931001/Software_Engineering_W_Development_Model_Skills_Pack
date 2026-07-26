/**
 * SubscriptionStore — RSS 订阅邮箱存储。
 */
import type { Subscription } from '../types.js';
import { ConflictError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';

export class SubscriptionStore {
  private subscriptions: Map<string, Subscription> = new Map();
  private emailIndex: Map<string, string> = new Map();

  subscribe(email: string): Subscription {
    const emailLower = email.toLowerCase();
    if (this.emailIndex.has(emailLower)) {
      throw new ConflictError('邮箱已订阅');
    }
    const record: Subscription = {
      id: generateId('sub'),
      email,
      createdAt: new Date().toISOString(),
    };
    this.subscriptions.set(record.id, record);
    this.emailIndex.set(emailLower, record.id);
    return record;
  }

  unsubscribe(email: string): boolean {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return false;
    this.emailIndex.delete(email.toLowerCase());
    return this.subscriptions.delete(id);
  }

  list(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  size(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
    this.emailIndex.clear();
  }
}
