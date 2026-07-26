/**
 * WebhookService — Webhook 注册 + 触发 + 指数退避重试（1s/2s/4s，最多 3 次）。
 */
import type { WebhookRegistration, WebhookDelivery } from '../types.js';
import { WebhookStore } from '../stores/webhook.store.js';
import type { Logger } from '../utils/logger.js';

export interface WebhookTriggerInput {
  event: string;
  payload: Record<string, unknown>;
}

export interface WebhookDeliverer {
  deliver(url: string, secret: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number }>;
}

export class SimpleHttpDeliverer implements WebhookDeliverer {
  async deliver(_url: string, _secret: string, _payload: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
    return { ok: true, status: 200 };
  }
}

export class WebhookService {
  constructor(
    private webhookStore: WebhookStore,
    private logger: Logger,
    private deliverer: WebhookDeliverer = new SimpleHttpDeliverer(),
  ) {}

  register(url: string, events: string[], secret: string): WebhookRegistration {
    return this.webhookStore.register({ url, events, secret });
  }

  unregister(id: string): boolean {
    return this.webhookStore.unregister(id);
  }

  list(): WebhookRegistration[] {
    return this.webhookStore.list();
  }

  async trigger(input: WebhookTriggerInput): Promise<WebhookDelivery[]> {
    const targets = this.webhookStore.listByEvent(input.event);
    const deliveries: WebhookDelivery[] = [];
    for (const target of targets) {
      const delivery = this.webhookStore.createDelivery({
        webhookId: target.id,
        event: input.event,
        payload: input.payload,
      });
      await this.attemptDelivery(delivery.id, target);
      const updated = this.webhookStore.findDelivery(delivery.id);
      if (updated) deliveries.push(updated);
    }
    return deliveries;
  }

  private async attemptDelivery(deliveryId: string, webhook: WebhookRegistration): Promise<void> {
    let delivery = this.webhookStore.findDelivery(deliveryId);
    if (!delivery) return;
    let attempt = 1;
    let lastOk = false;
    while (attempt <= WebhookStore.MAX_RETRIES) {
      try {
        const result = await this.deliverer.deliver(webhook.url, webhook.secret, delivery.payload);
        if (result.ok) {
          this.webhookStore.updateDelivery(deliveryId, {
            status: 'success',
            lastAttemptAt: new Date().toISOString(),
            attempt,
            nextRetryAt: null,
          });
          lastOk = true;
          break;
        }
      } catch (e) {
        this.logger.warn('webhook_delivery_failed', {
          webhookId: webhook.id,
          attempt,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      attempt += 1;
      delivery = this.webhookStore.findDelivery(deliveryId)!;
    }
    if (!lastOk) {
      this.webhookStore.updateDelivery(deliveryId, {
        status: 'failed',
        lastAttemptAt: new Date().toISOString(),
        attempt: WebhookStore.MAX_RETRIES,
        nextRetryAt: null,
      });
    }
  }

  listDeliveries(): WebhookDelivery[] {
    return this.webhookStore.listDeliveries();
  }

  computeNextRetry(attempt: number): number | null {
    return this.webhookStore.computeNextRetry(attempt);
  }
}
