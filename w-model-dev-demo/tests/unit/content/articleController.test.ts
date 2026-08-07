/**
 * UT-005 非博主创建文章被拒（ArticleController.createArticle，DD-005/INTF-005）
 */
import { describe, it, expect, vi } from 'vitest';
import { ArticleController } from '../../../src/routes/content/articleController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

function makeController(overrides: Record<string, unknown> = {}) {
  const articleService: any = {
    publishArticle: vi.fn().mockResolvedValue({ id: 'a_1', status: 'published', publishedAt: '2026-08-07T10:00:00.000Z' }),
    archiveArticle: vi.fn().mockResolvedValue({ id: 'a_1', status: 'archived' }),
    unarchiveArticle: vi.fn().mockResolvedValue({ id: 'a_1', status: 'draft' }),
    updateArticle: vi.fn().mockResolvedValue({ id: 'a_1', title: 't', status: 'draft', updatedAt: '2026-08-07T10:00:00.000Z' }),
    deleteArticle: vi.fn().mockResolvedValue(undefined),
    listMyArticles: vi.fn().mockResolvedValue({ items: [{ id: 'a_1', title: 't', status: 'draft' }], total: 1, page: 1, pageSize: 20 }),
    ...overrides,
  };
  const controller = new ArticleController(articleService);
  return { articleService, controller };
}

describe('UT-005 ArticleController.createArticle', () => {
  it('reader 角色携带 JWT 创建文章 → 40301，service 未被调用', async () => {
    const articleService: any = { createArticle: vi.fn() };
    const controller = new ArticleController(articleService);
    const req = makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { title: 't', body: 'b' } });
    const res = makeRes();
    const next = makeNext();

    await controller.createArticle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40301 }) }));
    expect(articleService.createArticle).not.toHaveBeenCalled();
  });

  it('博主可正常创建（201）', async () => {
    const articleService: any = {
      createArticle: vi.fn().mockResolvedValue({ id: 'a_0001', title: 't', summary: '', status: 'draft', tags: [], categoryId: null, createdAt: '2026-08-07T10:00:00.000Z' }),
    };
    const controller = new ArticleController(articleService);
    const req = makeReq({ user: { userId: 'u_0002', role: 'blogger' }, body: { title: 't', body: 'b' } });
    const res = makeRes();
    await controller.createArticle(req, res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(articleService.createArticle).toHaveBeenCalledTimes(1);
  });
});

describe('ArticleController 其余方法', () => {
  it('publish/archive/unarchive：成功响应与参数透传', async () => {
    const { articleService, controller } = makeController();
    const req = makeReq({ user: { userId: 'u_0002', role: 'blogger' }, params: { id: 'a_1' } });

    const res1 = makeRes();
    await controller.publishArticle(req, res1, makeNext());
    expect(articleService.publishArticle).toHaveBeenCalledWith('a_1', 'u_0002');
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ articleId: 'a_1', status: 'published' }) }));

    const res2 = makeRes();
    await controller.archiveArticle(req, res2, makeNext());
    expect(articleService.archiveArticle).toHaveBeenCalledWith('a_1', 'u_0002');

    const res3 = makeRes();
    await controller.unarchiveArticle(req, res3, makeNext());
    expect(articleService.unarchiveArticle).toHaveBeenCalledWith('a_1', 'u_0002');
  });

  it('updateArticle：内容字段校验后透传；deleteArticle：204 无 body', async () => {
    const { articleService, controller } = makeController();
    const req = makeReq({ user: { userId: 'u_0002', role: 'blogger' }, params: { id: 'a_1' }, body: { title: '新标题' } });

    const res1 = makeRes();
    await controller.updateArticle(req, res1, makeNext());
    expect(articleService.updateArticle).toHaveBeenCalledWith('a_1', 'u_0002', { title: '新标题' });

    const res2 = makeRes();
    await controller.deleteArticle(req, res2, makeNext());
    expect(articleService.deleteArticle).toHaveBeenCalledWith('a_1', 'u_0002');
    expect(res2.status).toHaveBeenCalledWith(204);
  });

  it('listMyArticles：status 枚举非法 → 40002；正常分页透传', async () => {
    const { articleService, controller } = makeController();

    const res1 = makeRes();
    await controller.listMyArticles(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, query: { status: 'invalid' } }), res1, makeNext());
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = makeRes();
    await controller.listMyArticles(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, query: { status: 'draft', page: '1', pageSize: '20' } }), res2, makeNext());
    expect(articleService.listMyArticles).toHaveBeenCalledWith('u_0002', 'draft', 1, 20);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total: 1 }) }));
  });

  it('服务层抛 BizError → 统一错误响应（60001 示例）', async () => {
    const { controller } = makeController({ archiveArticle: vi.fn().mockRejectedValue(new BizError(60001)) });
    const res = makeRes();
    await controller.archiveArticle(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, params: { id: 'a_1' } }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 60001 }) }));
  });
});
