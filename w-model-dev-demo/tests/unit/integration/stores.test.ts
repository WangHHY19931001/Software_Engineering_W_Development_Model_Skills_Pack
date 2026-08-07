/**
 * UT-039 Webhook 同 url+event 去重（WebhookConfigStore.create，DD-039/INTF-022）
 * UT-040 投递记录状态流转（WebhookDeliveryStore.updateStatus，DD-040/INTF-022）
 */
import { describe, it, expect } from 'vitest';
import { WebhookConfigStore } from '../../../src/stores/webhookConfigStore';
import { WebhookDeliveryStore } from '../../../src/stores/webhookDeliveryStore';

describe('UT-039 WebhookConfigStore.create', () => {
  it('同 owner 同 url 同 event 重复 → 40901；不同事件可共存', () => {
    const store = new WebhookConfigStore();
    store.create({ id: 'wh_1', ownerId: 'u_0002', url: 'http://127.0.0.1:9000/hook', events: ['article.published'], secret: 's1', createdAt: new Date().toISOString() });

    expect(() =>
      store.create({ ownerId: 'u_0002', url: 'http://127.0.0.1:9000/hook', events: ['article.published'], secret: 's2', createdAt: new Date().toISOString() }),
    ).toThrow(expect.objectContaining({ code: 40901, httpStatus: 409 }));

    // 同 url 不同事件（comment.created）不冲突
    const another = store.create({ ownerId: 'u_0002', url: 'http://127.0.0.1:9000/hook', events: ['comment.created'], secret: 's3', createdAt: new Date().toISOString() });
    expect(another.id).toBeDefined();
    expect(store.listByOwner('u_0002')).toHaveLength(2);
  });
});

describe('UT-040 WebhookDeliveryStore.updateStatus', () => {
  it('pending→delivering→failed 状态流转与失败信息落库', () => {
    const store = new WebhookDeliveryStore();
    const delivery = store.create({ id: 'wd_1', webhookId: 'wh_1', event: 'article.published', payload: '{}', status: 'pending', attempts: 0 });

    store.updateStatus('wd_1', 'delivering');
    expect(store.findById('wd_1')!.status).toBe('delivering');

    store.updateStatus('wd_1', 'failed', 3, 'connect refused');
    const after = store.findById('wd_1')!;
    expect(after.status).toBe('failed');
    expect(after.attempts).toBe(3);
    expect(after.lastError).toBe('connect refused');

    expect(() => store.updateStatus('wd_9999', 'failed')).toThrow(expect.objectContaining({ code: 40401 }));
    expect(delivery.id).toBe('wd_1');
  });
});

describe('集成域 store 补充（WebhookConfig/WebhookDelivery）', () => {
  it('WebhookConfigStore：listByOwner / findById / delete / matchByEvent', () => {
    const store = new WebhookConfigStore();
    store.create({ id: 'wh_1', ownerId: 'u_0002', url: 'http://a/hook', events: ['article.published', 'comment.created'], secret: 's1', createdAt: new Date().toISOString() });
    store.create({ id: 'wh_2', ownerId: 'u_0002', url: 'http://b/hook', events: ['comment.created'], secret: 's2', createdAt: new Date().toISOString() });
    store.create({ id: 'wh_3', ownerId: 'u_0003', url: 'http://c/hook', events: ['article.published'], secret: 's3', createdAt: new Date().toISOString() });

    expect(store.listByOwner('u_0002')).toHaveLength(2);
    expect(store.findById('wh_1')?.url).toBe('http://a/hook');
    expect(store.matchByEvent('u_0002', 'article.published')).toHaveLength(1);
    expect(store.matchByEvent('u_0002', 'comment.created')).toHaveLength(2);
    expect(store.delete('wh_3')).toBe(true);
    expect(store.findById('wh_3')).toBeNull();
  });

  it('WebhookDeliveryStore：create / findById / listByWebhook', () => {
    const store = new WebhookDeliveryStore();
    const delivery = store.create({ id: 'wd_1', webhookId: 'wh_1', event: 'article.published', payload: '{}', status: 'pending', attempts: 0 });
    store.create({ id: 'wd_2', webhookId: 'wh_1', event: 'comment.created', payload: '{}', status: 'delivered', attempts: 1 });
    expect(delivery.updatedAt).toBeDefined();
    expect(store.findById('wd_1')?.status).toBe('pending');
    expect(store.listByWebhook('wh_1')).toHaveLength(2);
  });
});
