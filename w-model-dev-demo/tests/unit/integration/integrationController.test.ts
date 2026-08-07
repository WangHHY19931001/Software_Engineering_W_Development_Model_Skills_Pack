/**
 * UT-036 Webhook url 非 http(s) 被拒（IntegrationController.createWebhook，DD-036/INTF-022）
 */
import { describe, it, expect, vi } from 'vitest';
import { IntegrationController } from '../../../src/routes/integration/integrationController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-036 IntegrationController.createWebhook', () => {
  it('非 http(s) url → 40002（SSRF 防护范围声明）', async () => {
    const webhookService: any = { createWebhook: vi.fn().mockRejectedValue(new BizError(40002)) };
    const controller = new IntegrationController({} as any, webhookService);
    const req = makeReq({
      user: { userId: 'u_0002', role: 'blogger' },
      body: { url: 'ftp://x/hook', events: ['article.published'] },
    });
    const res = makeRes();

    await controller.createWebhook(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40002 }) }));
    expect(webhookService.createWebhook).toHaveBeenCalledWith('u_0002', 'ftp://x/hook', ['article.published'], undefined);
  });
});

describe('IntegrationController 其余方法', () => {
  it('getBloggerRss：application/rss+xml 响应', async () => {
    const rssService: any = { getBloggerRss: vi.fn().mockResolvedValue('<?xml version="1.0"?><rss/>') };
    const controller = new IntegrationController(rssService, {} as any);
    const res = makeRes();
    await controller.getBloggerRss(makeReq({ params: { id: 'u_0002' } }), res, makeNext());
    expect(rssService.getBloggerRss).toHaveBeenCalledWith('u_0002');
    expect(res.type).toHaveBeenCalledWith(expect.stringContaining('application/rss+xml'));
  });

  it('createWebhook 成功 201；listWebhooks；deleteWebhook 204；非博主 40301', async () => {
    const webhookService: any = {
      createWebhook: vi.fn().mockResolvedValue({ id: 'wh_1', url: 'http://a/hook', events: ['article.published'], secret: 's', createdAt: '2026-08-07T10:00:00.000Z' }),
      listWebhooks: vi.fn().mockResolvedValue([{ id: 'wh_1', url: 'http://a/hook', events: ['article.published'], createdAt: '2026-08-07T10:00:00.000Z' }]),
      deleteWebhook: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new IntegrationController({} as any, webhookService);

    const res1 = makeRes();
    await controller.createWebhook(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, body: { url: 'http://a/hook', events: ['article.published'] } }), res1, makeNext());
    expect(res1.status).toHaveBeenCalledWith(201);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ webhookId: 'wh_1' }) }));

    const res2 = makeRes();
    await controller.listWebhooks(makeReq({ user: { userId: 'u_0002', role: 'blogger' } }), res2, makeNext());
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ items: [expect.objectContaining({ webhookId: 'wh_1', url: 'http://a/hook' })] }) }),
    );

    const res3 = makeRes();
    await controller.deleteWebhook(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, params: { webhookId: 'wh_1' } }), res3, makeNext());
    expect(webhookService.deleteWebhook).toHaveBeenCalledWith('u_0002', 'wh_1');
    expect(res3.status).toHaveBeenCalledWith(204);

    const res4 = makeRes();
    await controller.createWebhook(makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { url: 'http://a/hook', events: ['article.published'] } }), res4, makeNext());
    expect(res4.status).toHaveBeenCalledWith(403);
  });
});
