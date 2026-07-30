/**
 * Webhook 服务 - 订阅 + 投递 + 重试
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import { WebhookRepository } from '../repositories/webhook.repository.js';
import { generateId } from '../utils/id.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { getEnv } from '../utils/env.js';
import {
  WebhookEventType,
  WebhookDeliveryStatus,
  type Webhook,
  type WebhookDelivery,
} from '../types/index.js';

export const CreateWebhookSchema = z.object({
  ownerId: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).max(20),
});

export const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).max(20).optional(),
  active: z.boolean().optional(),
});

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;

export interface DeliveryRequest {
  url: string;
  body: string;
  signature: string;
  eventType: string;
  deliveryId: string;
}

export type DeliverySender = (req: DeliveryRequest) => Promise<number>;

export class WebhookService {
  private queue: WebhookDelivery[] = [];
  private inflight: Set<string> = new Set();
  private sender: DeliverySender;

  constructor(
    private readonly webhookRepo: WebhookRepository,
    sender?: DeliverySender,
  ) {
    this.sender = sender ?? defaultSender();
  }

  setSender(sender: DeliverySender): void {
    this.sender = sender;
  }

  static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static sign(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  verifySignature(secret: string, body: string, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    const expected = WebhookService.sign(secret, body);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async create(input: CreateWebhookInput): Promise<Webhook> {
    const parsed = CreateWebhookSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid webhook data', { issues: parsed.error.issues });
    }
    const dup = await this.webhookRepo.findByOwnerAndUrl(parsed.data.ownerId, parsed.data.url);
    if (dup) {
      throw new ConflictError('Webhook already exists for this URL');
    }
    const now = Date.now();
    const webhook: Webhook = {
      id: generateId('webhook'),
      ownerId: parsed.data.ownerId,
      url: parsed.data.url,
      secret: WebhookService.generateSecret(),
      events: parsed.data.events,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.webhookRepo.create(webhook);
    return webhook;
  }

  async update(id: string, ownerId: string, input: UpdateWebhookInput): Promise<Webhook> {
    const parsed = UpdateWebhookSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid webhook update', { issues: parsed.error.issues });
    }
    const wh = await this.webhookRepo.findById(id);
    if (!wh) {
      throw new NotFoundError('Webhook');
    }
    if (wh.ownerId !== ownerId) {
      throw new ValidationError('Cannot edit other user webhook');
    }
    const updated = await this.webhookRepo.update(id, {
      ...parsed.data,
      updatedAt: Date.now(),
    } as Partial<Webhook>);
    if (!updated) {
      throw new NotFoundError('Webhook');
    }
    return updated;
  }

  async getById(id: string): Promise<Webhook> {
    const wh = await this.webhookRepo.findById(id);
    if (!wh) {
      throw new NotFoundError('Webhook');
    }
    return wh;
  }

  async listByOwner(ownerId: string): Promise<Webhook[]> {
    return this.webhookRepo.findByOwner(ownerId);
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const wh = await this.webhookRepo.findById(id);
    if (!wh) {
      throw new NotFoundError('Webhook');
    }
    if (wh.ownerId !== ownerId) {
      throw new ValidationError('Cannot delete other user webhook');
    }
    return this.webhookRepo.delete(id);
  }

  async dispatch(eventType: WebhookEventType, payload: Record<string, unknown>): Promise<WebhookDelivery[]> {
    const webhooks = await this.webhookRepo.findActiveByEvent(eventType);
    const deliveries: WebhookDelivery[] = [];
    for (const wh of webhooks) {
      const delivery: WebhookDelivery = {
        id: generateId('delivery'),
        webhookId: wh.id,
        eventType,
        payload,
        status: WebhookDeliveryStatus.PENDING,
        attempts: 0,
        lastStatusCode: null,
        lastError: null,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.queue.push(delivery);
      deliveries.push(delivery);
    }
    return deliveries;
  }

  async processQueue(): Promise<WebhookDelivery[]> {
    const env = getEnv();
    const now = Date.now();
    const processed: WebhookDelivery[] = [];

    for (const delivery of this.queue) {
      if (delivery.status === WebhookDeliveryStatus.DELIVERED || delivery.status === WebhookDeliveryStatus.FAILED) {
        continue;
      }
      if (delivery.nextRetryAt && delivery.nextRetryAt > now) {
        continue;
      }
      if (this.inflight.has(delivery.id)) {
        continue;
      }
      const wh = await this.webhookRepo.findById(delivery.webhookId);
      if (!wh) {
        delivery.status = WebhookDeliveryStatus.FAILED;
        delivery.lastError = 'webhook not found';
        delivery.updatedAt = now;
        processed.push(delivery);
        continue;
      }

      this.inflight.add(delivery.id);
      delivery.status = WebhookDeliveryStatus.INFLIGHT;
      delivery.attempts += 1;
      const body = JSON.stringify({ event: delivery.eventType, data: delivery.payload, deliveryId: delivery.id });
      const signature = WebhookService.sign(wh.secret, body);

      let statusCode = 0;
      try {
        statusCode = await this.sender({
          url: wh.url,
          body,
          signature,
          eventType: delivery.eventType,
          deliveryId: delivery.id,
        });
      } catch (err) {
        delivery.lastError = err instanceof Error ? err.message : 'send error';
      }
      delivery.lastStatusCode = statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        delivery.status = WebhookDeliveryStatus.DELIVERED;
        delivery.nextRetryAt = null;
      } else if (delivery.attempts >= env.webhookMaxAttempts) {
        delivery.status = WebhookDeliveryStatus.FAILED;
        delivery.nextRetryAt = null;
      } else {
        delivery.status = WebhookDeliveryStatus.RETRY;
        const backoff = env.webhookBaseBackoffMs * Math.pow(4, delivery.attempts - 1);
        delivery.nextRetryAt = Date.now() + backoff;
      }
      delivery.updatedAt = Date.now();
      this.inflight.delete(delivery.id);
      processed.push(delivery);
    }
    return processed;
  }

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.queue.find((d) => d.id === deliveryId) ?? null;
  }

  async getDeliveriesByWebhook(webhookId: string): Promise<WebhookDelivery[]> {
    return this.queue.filter((d) => d.webhookId === webhookId);
  }

  resetQueue(): void {
    this.queue = [];
    this.inflight.clear();
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

function defaultSender(): DeliverySender {
  // 单元测试中不发起真实 HTTP。返回 200 占位。
  return async () => 200;
}
