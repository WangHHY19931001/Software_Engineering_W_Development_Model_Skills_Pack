/**
 * WebhookConfigStore（DD-039）：WebhookConfig 实体存储；(ownerId, url, event) 唯一索引（重复 40901）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId } from './base';
import type { WebhookConfig, WebhookEventType } from '../types';

interface WebhookConfigState {
  map: Map<string, WebhookConfig>;
  seq: { n: number };
}

export type WebhookConfigCreateInput = Omit<WebhookConfig, 'id'> & { id?: string };

export class WebhookConfigStore extends SnapshotStore<WebhookConfigState> {
  protected state: WebhookConfigState = { map: new Map(), seq: { n: 0 } };

  create(input: WebhookConfigCreateInput): WebhookConfig {
    for (const existing of this.state.map.values()) {
      if (existing.ownerId !== input.ownerId || existing.url !== input.url) continue;
      const overlap = existing.events.some((e) => input.events.includes(e));
      if (overlap) throw new BizError(40901, '同一 URL 的 Webhook 事件重复');
    }
    const id = input.id ?? nextId('wh', this.state.seq);
    const record: WebhookConfig = {
      id,
      ownerId: input.ownerId,
      url: input.url,
      events: [...input.events],
      secret: input.secret,
      createdAt: input.createdAt,
    };
    this.state.map.set(id, record);
    return record;
  }

  listByOwner(ownerId: string): WebhookConfig[] {
    return [...this.state.map.values()].filter((c) => c.ownerId === ownerId);
  }

  findById(id: string): WebhookConfig | null {
    return this.state.map.get(id) ?? null;
  }

  delete(id: string): boolean {
    return this.state.map.delete(id);
  }

  /** 分发匹配：owner 下订阅了该事件的配置（DD-039 matchByEvent） */
  matchByEvent(ownerId: string, event: WebhookEventType): WebhookConfig[] {
    return this.listByOwner(ownerId).filter((c) => c.events.includes(event));
  }
}
