/**
 * UT-038 Webhook 失败重试 ≤3 次并留失败记录（webhookService.deliverWebhook，DD-038/INTF-022/NFR-003）
 * UT-055 Webhook 回调 HMAC 签名正确（webhookService.deliverWebhook，DD-038/INTF-022）
 */
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookConfigStore } from '../../../src/stores/webhookConfigStore';
import { WebhookDeliveryStore } from '../../../src/stores/webhookDeliveryStore';
import { WebhookService } from '../../../src/services/integration/webhookService';

function setup(configOverrides: Record<string, unknown> = {}) {
  const configStore = new WebhookConfigStore();
  const deliveryStore = new WebhookDeliveryStore();
  const config = configStore.create({
    id: 'wh_1',
    ownerId: 'u_0002',
    url: 'http://127.0.0.1:9000/hook',
    events: ['article.published'],
    secret: 's3cret',
    createdAt: new Date().toISOString(),
    ...configOverrides,
  });
  const payload = JSON.stringify({ event: 'article.published', articleId: 'a_1001', title: 't' });
  const delivery = deliveryStore.create({
    id: 'wd_1',
    webhookId: config.id,
    event: 'article.published',
    payload,
    status: 'pending',
    attempts: 0,
  });
  return { configStore, deliveryStore, config, delivery, payload };
}

describe('UT-038 webhookService.deliverWebhook 失败重试', () => {
  it('回调持续失败：指数退避重试 ≤3 次，最终 failed 并记 lastError', async () => {
    const { configStore, deliveryStore, delivery } = setup();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connect refused'));
    const service = new WebhookService(configStore, deliveryStore, fetchImpl as any, { sleep: async () => {} });

    await service.deliverWebhook(delivery.id);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const after = deliveryStore.findById(delivery.id)!;
    expect(after.attempts).toBeLessThanOrEqual(3);
    expect(after.status).toBe('failed');
    expect(after.lastError).toBeDefined();
    expect(after.lastError).toBe('connect refused');
  });
});

describe('UT-055 webhookService.deliverWebhook 签名', () => {
  it('请求头 X-Blog-Signature=HMAC-SHA256(body,secret)、X-Blog-Event、X-Blog-Timestamp 正确', async () => {
    const { configStore, deliveryStore, delivery, payload } = setup();
    let captured: { url: string; headers?: Record<string, string>; body?: string } = {};
    const fetchImpl = vi.fn(async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
      captured = { url, headers: init?.headers, body: init?.body };
      return { ok: true, status: 200 };
    });
    const service = new WebhookService(configStore, deliveryStore, fetchImpl as any, { sleep: async () => {} });

    await service.deliverWebhook(delivery.id);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(captured.url).toBe('http://127.0.0.1:9000/hook');
    const expectedSignature = createHmac('sha256', 's3cret').update(payload).digest('hex');
    expect(captured.headers!['X-Blog-Signature']).toBe(expectedSignature);
    expect(captured.headers!['X-Blog-Event']).toBe('article.published');
    expect(captured.headers!['X-Blog-Timestamp']).toBeDefined();
    const after = deliveryStore.findById(delivery.id)!;
    expect(after.status).toBe('delivered');
  });
});

describe('webhookService 配置管理（createWebhook/listWebhooks/deleteWebhook）', () => {
  it('createWebhook：http(s) 校验通过 + secret 默认服务端生成', () => {
    const configStore = new WebhookConfigStore();
    const service = new WebhookService(configStore, new WebhookDeliveryStore());
    const config = service.createWebhook('u_0002', 'http://127.0.0.1:9000/hook', ['article.published']);
    expect(config.id).toBeDefined();
    expect(config.secret).toMatch(/^[0-9a-f]{32}$/); // 服务端生成 secret

    const custom = service.createWebhook('u_0002', 'https://example.com/hook', ['comment.created'], 'my-secret');
    expect(custom.secret).toBe('my-secret');
    expect(service.listWebhooks('u_0002')).toHaveLength(2);
  });

  it('createWebhook：非 http(s) url → 40002；非法事件 → 40002；重复 url+event → 40901', () => {
    const configStore = new WebhookConfigStore();
    const service = new WebhookService(configStore, new WebhookDeliveryStore());
    expect(() => service.createWebhook('u_0002', 'ftp://x/hook', ['article.published'])).toThrow(expect.objectContaining({ code: 40002 }));
    expect(() => service.createWebhook('u_0002', 'http://a/hook', ['article.deleted'])).toThrow(expect.objectContaining({ code: 40002 }));
    service.createWebhook('u_0002', 'http://a/hook', ['article.published']);
    expect(() => service.createWebhook('u_0002', 'http://a/hook', ['article.published'])).toThrow(expect.objectContaining({ code: 40901 }));
  });

  it('deleteWebhook：归属校验删除；他人配置 → 40401', () => {
    const configStore = new WebhookConfigStore();
    const config = configStore.create({ id: 'wh_1', ownerId: 'u_0002', url: 'http://a/hook', events: ['article.published'], secret: 's', createdAt: new Date().toISOString() });
    const service = new WebhookService(configStore, new WebhookDeliveryStore());
    expect(() => service.deleteWebhook('u_0003', config.id)).toThrow(expect.objectContaining({ code: 40401 }));
    service.deleteWebhook('u_0002', config.id);
    expect(configStore.findById(config.id)).toBeNull();
    expect(() => service.deleteWebhook('u_0002', config.id)).toThrow(expect.objectContaining({ code: 40401 }));
  });
});

describe('webhookService 事件订阅（onArticlePublished/onCommentCreated）', () => {
  it('article.published → 匹配配置创建投递记录并触发 deliverWebhook', async () => {
    const configStore = new WebhookConfigStore();
    const deliveryStore = new WebhookDeliveryStore();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const service = new WebhookService(configStore, deliveryStore, fetchImpl as any, { sleep: async () => {} });
    const config = service.createWebhook('u_0002', 'http://127.0.0.1:9000/hook', ['article.published']);

    service.onArticlePublished({
      type: 'article.published',
      articleId: 'a_1001',
      authorId: 'u_0002',
      authorName: '博主',
      title: '新文章',
      publishedAt: '2026-08-07T10:00:00.000Z',
    });

    await vi.waitFor(() => {
      expect(deliveryStore.listByWebhook(config.id)).toHaveLength(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
    const delivery = deliveryStore.listByWebhook(config.id)[0];
    expect(delivery.event).toBe('article.published');
    expect(delivery.status).toBe('delivered');
    expect(JSON.parse(delivery.payload).articleId).toBe('a_1001');
  });

  it('comment.created → 匹配配置创建投递记录（事件头正确）', async () => {
    const configStore = new WebhookConfigStore();
    const deliveryStore = new WebhookDeliveryStore();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const service = new WebhookService(configStore, deliveryStore, fetchImpl as any, { sleep: async () => {} });
    const config = service.createWebhook('u_0002', 'http://127.0.0.1:9000/hook', ['comment.created']);

    service.onCommentCreated({
      type: 'comment.created',
      articleId: 'a_1001',
      commentId: 'cm_1',
      authorId: 'u_0001',
      authorName: 'reader1',
      articleAuthorId: 'u_0002',
      parentId: null,
      content: '好文',
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(deliveryStore.listByWebhook(config.id)).toHaveLength(1);
    const init = fetchImpl.mock.calls[0][1];
    expect(init.headers['X-Blog-Event']).toBe('comment.created');
  });
});
