/**
 * UT-030 统计面板非博主被拒（StatsController.getBloggerStats，DD-030/INTF-019）
 */
import { describe, it, expect, vi } from 'vitest';
import { StatsController } from '../../../src/routes/stats/statsController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-030 StatsController.getBloggerStats', () => {
  it('reader 访问统计面板 → 40301（requireBlogger 守卫）', async () => {
    const bloggerStatsService: any = { getBloggerStats: vi.fn() };
    const notificationService: any = {};
    const controller = new StatsController(bloggerStatsService, notificationService);
    const req = makeReq({ user: { userId: 'u_0001', role: 'reader' } });
    const res = makeRes();

    await controller.getBloggerStats(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40301 }) }));
    expect(bloggerStatsService.getBloggerStats).not.toHaveBeenCalled();
  });
});

describe('StatsController 其余方法', () => {
  it('getBloggerStats 博主成功；listNotifications 分页+unreadOnly；markNotificationRead 成功/他人 40401', async () => {
    const bloggerStatsService: any = {
      getBloggerStats: vi.fn().mockResolvedValue({ articleCount: 5, totalViews: 100, totalComments: 12, trend: [] }),
    };
    const notificationService: any = {
      listNotifications: vi.fn().mockReturnValue({
        items: [{ id: 'n_1', type: 'REPLY', articleId: 'a_1', actorId: 'u_2', actorName: 'x', content: 'c', read: false, createdAt: '2026-08-07T10:00:00.000Z' }],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      markNotificationRead: vi.fn().mockResolvedValue({ id: 'n_1', read: true }),
    };
    const controller = new StatsController(bloggerStatsService, notificationService);

    const res1 = makeRes();
    await controller.getBloggerStats(makeReq({ user: { userId: 'u_0002', role: 'blogger' } }), res1, makeNext());
    expect(bloggerStatsService.getBloggerStats).toHaveBeenCalledWith('u_0002');
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ articleCount: 5 }) }));

    const res2 = makeRes();
    await controller.listNotifications(makeReq({ user: { userId: 'u_0001', role: 'reader' }, query: { unreadOnly: 'true', page: '1', pageSize: '20' } }), res2, makeNext());
    expect(notificationService.listNotifications).toHaveBeenCalledWith('u_0001', 1, 20, true);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total: 1 }) }));

    const res3 = makeRes();
    await controller.markNotificationRead(makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'n_1' } }), res3, makeNext());
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationId: 'n_1', read: true }) }));

    notificationService.markNotificationRead.mockRejectedValue(new BizError(40401));
    const res4 = makeRes();
    await controller.markNotificationRead(makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'n_other' } }), res4, makeNext());
    expect(res4.status).toHaveBeenCalledWith(404);
  });
});
