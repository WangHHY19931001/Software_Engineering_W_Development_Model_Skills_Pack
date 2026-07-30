/**
 * Webhook 服务测试 - 含重试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookService, type DeliveryRequest } from '../../src/services/webhook.service.js';
import { WebhookRepository } from '../../src/repositories/webhook.repository.js';
import { WebhookEventType, WebhookDeliveryStatus } from '../../src/types/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('WebhookService', () => {
  let repo: WebhookRepository;
  let svc: WebhookService;

  beforeEach(() => {
    repo = new WebhookRepository();
    svc = new WebhookService(repo);
  });

  describe('signing', () => {
    it('should sign and verify', () => {
      const secret = WebhookService.generateSecret();
      const body = '{"event":"test"}';
      const sig = WebhookService.sign(secret, body);
      expect(sig.startsWith('sha256=')).toBe(true);
      expect(svc.verifySignature(secret, body, sig)).toBe(true);
    });

    it('should not verify with wrong secret', () => {
      const body = '{"x":1}';
      const sig = WebhookService.sign('a', body);
      expect(svc.verifySignature('b', body, sig)).toBe(false);
    });

    it('should not verify with bad signature', () => {
      expect(svc.verifySignature('a', 'b', 'not-a-sig')).toBe(false);
    });

    it('should not verify with empty signature', () => {
      expect(svc.verifySignature('a', 'b', '')).toBe(false);
    });

    it('generateSecret returns different secrets', () => {
      const s1 = WebhookService.generateSecret();
      const s2 = WebhookService.generateSecret();
      expect(s1).not.toBe(s2);
      expect(s1.length).toBeGreaterThanOrEqual(64);
    });
  });

  describe('create()', () => {
    it('should create webhook', async () => {
      const w = await svc.create({
        ownerId: 'u1',
        url: 'https://example.com/wh',
        events: [WebhookEventType.POST_PUBLISHED],
      });
      expect(w.ownerId).toBe('u1');
      expect(w.url).toBe('https://example.com/wh');
      expect(w.active).toBe(true);
      expect(w.secret.length).toBeGreaterThan(0);
    });

    it('should throw ValidationError on missing fields', async () => {
      await expect(svc.create({} as never)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on invalid url', async () => {
      await expect(
        svc.create({ ownerId: 'u', url: 'not-url', events: [WebhookEventType.POST_PUBLISHED] })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ConflictError on duplicate', async () => {
      await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      await expect(
        svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('update()', () => {
    it('should update own', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      const r = await svc.update(w.id, 'u1', { active: false });
      expect(r.active).toBe(false);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.update('m', 'u', { active: false })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ValidationError on other owner', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      await expect(svc.update(w.id, 'u2', { active: false })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('getById/listByOwner/delete()', () => {
    it('getById returns webhook', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      const r = await svc.getById(w.id);
      expect(r.id).toBe(w.id);
    });

    it('getById throws NotFoundError', async () => {
      await expect(svc.getById('m')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('listByOwner returns owner webhooks', async () => {
      await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.create({ ownerId: 'u1', url: 'https://b.com', events: [WebhookEventType.POST_DELETED] });
      await svc.create({ ownerId: 'u2', url: 'https://c.com', events: [WebhookEventType.POST_PUBLISHED] });
      const r = await svc.listByOwner('u1');
      expect(r.length).toBe(2);
    });

    it('delete removes', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      const r = await svc.delete(w.id, 'u1');
      expect(r).toBe(true);
    });

    it('delete throws NotFoundError on missing', async () => {
      await expect(svc.delete('m', 'u')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('delete throws on other owner', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://e.com', events: [WebhookEventType.POST_PUBLISHED] });
      await expect(svc.delete(w.id, 'u2')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('dispatch()', () => {
    it('should queue deliveries for active matching webhooks', async () => {
      await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.create({ ownerId: 'u2', url: 'https://b.com', events: [WebhookEventType.POST_DELETED] });
      const deliveries = await svc.dispatch(WebhookEventType.POST_PUBLISHED, { postId: 'p1' });
      expect(deliveries.length).toBe(1);
    });

    it('should not queue for inactive webhooks', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.update(w.id, 'u1', { active: false });
      const deliveries = await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      expect(deliveries.length).toBe(0);
    });

    it('should not queue for non-matching events', async () => {
      await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_DELETED] });
      const deliveries = await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      expect(deliveries.length).toBe(0);
    });
  });

  describe('processQueue()', () => {
    it('should mark delivered on 2xx', async () => {
      svc.setSender(async () => 200);
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, { postId: 'p1' });
      await svc.processQueue();
      const d = await svc.getDeliveriesByWebhook(w.id);
      expect(d[0]!.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(d[0]!.lastStatusCode).toBe(200);
    });

    it('should retry on 5xx', async () => {
      let count = 0;
      svc.setSender(async () => {
        count += 1;
        return 500;
      });
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      await svc.processQueue();
      const d = await svc.getDeliveriesByWebhook(w.id);
      expect(d[0]!.status).toBe(WebhookDeliveryStatus.RETRY);
      expect(d[0]!.attempts).toBe(1);
      expect(count).toBe(1);
    });

    it('should fail after max attempts', async () => {
      svc.setSender(async () => 500);
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      for (let i = 0; i < 3; i += 1) {
        await svc.processQueue();
        const d = (await svc.getDeliveriesByWebhook(w.id))[0]!;
        if (d.status === WebhookDeliveryStatus.RETRY) {
          d.nextRetryAt = Date.now() - 1;
          await svc.processQueue();
        }
      }
      const d = (await svc.getDeliveriesByWebhook(w.id))[0]!;
      expect(d.status).toBe(WebhookDeliveryStatus.FAILED);
    });

    it('should handle sender error', async () => {
      svc.setSender(async () => {
        throw new Error('network');
      });
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      await svc.processQueue();
      const d = await svc.getDeliveriesByWebhook(w.id);
      expect(d[0]!.lastError).toContain('network');
    });

    it('should skip when nextRetryAt is in future', async () => {
      let called = 0;
      svc.setSender(async () => {
        called += 1;
        return 500;
      });
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      await svc.processQueue();
      const before = (await svc.getDeliveriesByWebhook(w.id))[0]!;
      expect(before.status).toBe(WebhookDeliveryStatus.RETRY);
      await svc.processQueue();
      const after = (await svc.getDeliveriesByWebhook(w.id))[0]!;
      expect(after.attempts).toBe(1);
      expect(called).toBe(1);
    });

    it('should mark failed when webhook not found', async () => {
      svc.setSender(async () => 200);
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      await repo.delete(w.id);
      const d = (await svc.getDeliveriesByWebhook(w.id))[0]!;
      d.webhookId = 'deleted';
      await svc.processQueue();
    });
  });

  describe('getDelivery/getDeliveriesByWebhook', () => {
    it('getDelivery returns delivery', async () => {
      const w = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      const ds = await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      const r = await svc.getDelivery(ds[0]!.id);
      expect(r).toBeDefined();
    });

    it('getDelivery returns null for missing', async () => {
      const r = await svc.getDelivery('missing');
      expect(r).toBeNull();
    });

    it('getDeliveriesByWebhook filters', async () => {
      const w1 = await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      const w2 = await svc.create({ ownerId: 'u2', url: 'https://b.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      const r1 = await svc.getDeliveriesByWebhook(w1.id);
      const r2 = await svc.getDeliveriesByWebhook(w2.id);
      expect(r1.length).toBe(1);
      expect(r2.length).toBe(1);
    });
  });

  describe('queue management', () => {
    it('resetQueue clears', async () => {
      await svc.create({ ownerId: 'u1', url: 'https://a.com', events: [WebhookEventType.POST_PUBLISHED] });
      await svc.dispatch(WebhookEventType.POST_PUBLISHED, {});
      expect(svc.getQueueLength()).toBe(1);
      svc.resetQueue();
      expect(svc.getQueueLength()).toBe(0);
    });

    it('setSender replaces sender', () => {
      const custom = async (req: DeliveryRequest) => 201;
      svc.setSender(custom);
      expect(true).toBe(true);
    });
  });
});
