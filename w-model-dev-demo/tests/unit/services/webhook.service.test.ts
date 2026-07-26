import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookService, SimpleHttpDeliverer } from '../../../src/services/webhook.service.js';
import { WebhookStore } from '../../../src/stores/webhook.store.js';
import { Logger } from '../../../src/utils/logger.js';

describe('WebhookService (REQ-021 / REQ-022)', () => {
  let store: WebhookStore;
  let logger: Logger;
  let svc: WebhookService;

  beforeEach(() => {
    store = new WebhookStore();
    logger = new Logger('debug');
    svc = new WebhookService(store, logger);
  });

  it('register + list 正常往返', () => {
    const w = svc.register('https://x.com', ['a'], 's1234567');
    expect(w.id).toBeTruthy();
    expect(svc.list()).toHaveLength(1);
  });

  it('unregister 删除 webhook', () => {
    const w = svc.register('https://x.com', ['a'], 's1234567');
    expect(svc.unregister(w.id)).toBe(true);
    expect(svc.list()).toHaveLength(0);
  });

  it('trigger 成功投递 (deliverer.ok=true)', async () => {
    svc.register('https://x.com', ['article.created'], 's1234567');
    const deliveries = await svc.trigger({ event: 'article.created', payload: { id: 'a1' } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe('success');
  });

  it('trigger 失败重试 3 次（指数退避）', async () => {
    const failingDeliverer = {
      deliver: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    };
    const s = new WebhookService(store, logger, failingDeliverer);
    s.register('https://x.com', ['article.created'], 's1234567');
    const deliveries = await s.trigger({ event: 'article.created', payload: {} });
    expect(deliveries[0]!.status).toBe('failed');
    expect(failingDeliverer.deliver).toHaveBeenCalledTimes(WebhookStore.MAX_RETRIES);
  });

  it('trigger deliverer 抛异常仍重试', async () => {
    const throwingDeliverer = {
      deliver: vi.fn().mockRejectedValue(new Error('network')),
    };
    const s = new WebhookService(store, logger, throwingDeliverer);
    s.register('https://x.com', ['article.created'], 's1234567');
    const deliveries = await s.trigger({ event: 'article.created', payload: {} });
    expect(deliveries[0]!.status).toBe('failed');
    expect(throwingDeliverer.deliver).toHaveBeenCalled();
  });

  it('trigger 无匹配 webhook 返回空数组', async () => {
    const deliveries = await svc.trigger({ event: 'no.match', payload: {} });
    expect(deliveries).toEqual([]);
  });

  it('computeNextRetry 委托 store', () => {
    expect(svc.computeNextRetry(1)).not.toBeNull();
    expect(svc.computeNextRetry(3)).toBeNull();
  });
});

describe('SimpleHttpDeliverer', () => {
  it('deliver 默认返回 ok=200', async () => {
    const d = new SimpleHttpDeliverer();
    const r = await d.deliver('https://x.com', 'secret', {});
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
  });
});
