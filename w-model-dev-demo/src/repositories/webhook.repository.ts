/**
 * Webhook 仓储
 */
import { BaseRepository } from './base.repository.js';
import { WebhookEventType, type Webhook } from '../types/index.js';

export class WebhookRepository extends BaseRepository<Webhook> {
  async findByOwner(ownerId: string): Promise<Webhook[]> {
    return this.findBy((w) => w.ownerId === ownerId);
  }

  async findActive(): Promise<Webhook[]> {
    return this.findBy((w) => w.active === true);
  }

  async findActiveByEvent(event: WebhookEventType): Promise<Webhook[]> {
    return this.findBy((w) => w.active === true && w.events.includes(event));
  }

  async findByOwnerAndUrl(ownerId: string, url: string): Promise<Webhook | null> {
    return this.findOne((w) => w.ownerId === ownerId && w.url === url);
  }
}
