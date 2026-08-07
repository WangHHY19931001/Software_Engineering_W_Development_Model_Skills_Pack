/**
 * WebhookDeliveryStore（DD-040）：WebhookDelivery 实体存储（pending→delivering→delivered/failed，attempts，lastError）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId } from './base';
import type { DeliveryStatus, WebhookDelivery } from '../types';

interface WebhookDeliveryState {
  map: Map<string, WebhookDelivery>;
  seq: { n: number };
}

export type WebhookDeliveryCreateInput = Omit<WebhookDelivery, 'id' | 'lastError' | 'updatedAt' | 'createdAt'> & {
  id?: string;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export class WebhookDeliveryStore extends SnapshotStore<WebhookDeliveryState> {
  protected state: WebhookDeliveryState = { map: new Map(), seq: { n: 0 } };

  create(input: WebhookDeliveryCreateInput): WebhookDelivery {
    const id = input.id ?? nextId('wd', this.state.seq);
    const now = new Date().toISOString();
    const record: WebhookDelivery = {
      id,
      webhookId: input.webhookId,
      event: input.event,
      payload: input.payload,
      status: input.status,
      attempts: input.attempts,
      lastError: input.lastError ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    this.state.map.set(id, record);
    return record;
  }

  findById(id: string): WebhookDelivery | null {
    return this.state.map.get(id) ?? null;
  }

  listByWebhook(webhookId: string): WebhookDelivery[] {
    return [...this.state.map.values()].filter((d) => d.webhookId === webhookId);
  }

  updateStatus(id: string, status: DeliveryStatus, attempts?: number, lastError?: string): WebhookDelivery {
    const record = this.state.map.get(id);
    if (!record) throw new BizError(40401, '投递记录不存在');
    const next: WebhookDelivery = {
      ...record,
      status,
      attempts: attempts ?? record.attempts,
      lastError: lastError ?? record.lastError,
      updatedAt: new Date().toISOString(),
    };
    this.state.map.set(id, next);
    return next;
  }
}
