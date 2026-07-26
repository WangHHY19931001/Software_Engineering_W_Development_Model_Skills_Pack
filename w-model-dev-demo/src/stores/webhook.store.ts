/**
 * WebhookStore — Webhook 注册存储（指数退避重试支持）。
 */
import type { WebhookRegistration, WebhookDelivery } from '../types.js';
import { generateId } from '../utils/id.js';

export class WebhookStore {
  private webhooks: Map<string, WebhookRegistration> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  static readonly MAX_RETRIES = 3;
  static readonly BACKOFF_MS = [1000, 2000, 4000];

  register(webhook: Omit<WebhookRegistration, 'id' | 'createdAt' | 'active'> & {
    id?: string; active?: boolean;
  }): WebhookRegistration {
    const record: WebhookRegistration = {
      id: webhook.id ?? generateId('webhook'),
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      createdAt: new Date().toISOString(),
      active: webhook.active ?? true,
    };
    this.webhooks.set(record.id, record);
    return record;
  }

  findById(id: string): WebhookRegistration | undefined {
    return this.webhooks.get(id);
  }

  list(): WebhookRegistration[] {
    return [...this.webhooks.values()];
  }

  listByEvent(event: string): WebhookRegistration[] {
    return this.list().filter((w) => w.active && w.events.includes(event));
  }

  unregister(id: string): boolean {
    return this.webhooks.delete(id);
  }

  createDelivery(delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'attempt' | 'status' | 'lastAttemptAt' | 'nextRetryAt'> & {
    id?: string; attempt?: number; status?: WebhookDelivery['status'];
    lastAttemptAt?: string | null; nextRetryAt?: string | null;
  }): WebhookDelivery {
    const record: WebhookDelivery = {
      id: delivery.id ?? generateId('delivery'),
      webhookId: delivery.webhookId,
      event: delivery.event,
      payload: delivery.payload,
      attempt: delivery.attempt ?? 1,
      status: delivery.status ?? 'pending',
      lastAttemptAt: delivery.lastAttemptAt ?? null,
      nextRetryAt: delivery.nextRetryAt ?? null,
      createdAt: new Date().toISOString(),
    };
    this.deliveries.set(record.id, record);
    return record;
  }

  findDelivery(id: string): WebhookDelivery | undefined {
    return this.deliveries.get(id);
  }

  updateDelivery(id: string, patch: Partial<WebhookDelivery>): WebhookDelivery {
    const delivery = this.deliveries.get(id);
    if (!delivery) throw new Error('delivery not found');
    const updated = { ...delivery, ...patch };
    this.deliveries.set(id, updated);
    return updated;
  }

  computeNextRetry(attempt: number): number | null {
    if (attempt >= WebhookStore.MAX_RETRIES) return null;
    const backoff = WebhookStore.BACKOFF_MS[Math.min(attempt - 1, WebhookStore.BACKOFF_MS.length - 1)];
    if (backoff === undefined) return null;
    return Date.now() + backoff;
  }

  listDeliveries(): WebhookDelivery[] {
    return [...this.deliveries.values()];
  }

  clear(): void {
    this.webhooks.clear();
    this.deliveries.clear();
  }
}
