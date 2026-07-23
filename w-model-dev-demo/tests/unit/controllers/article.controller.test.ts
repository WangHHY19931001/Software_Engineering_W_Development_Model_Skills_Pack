/**
 * ArticleController 单元测试（UT-052）。
 * mock ArticleService，验证 HTTP 适配 + DTO 映射（articleId/commentId）。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ArticleController } from '../../../src/controllers/article.controller';
import type { ArticleService } from '../../../src/services/article.service';
import type { Article, ArticleDetail, Page } from '../../../src/types';

function makeRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const end = vi.fn().mockReturnThis();
  return { res: { status, json, end } as unknown as Response, status, json, end };
}

const article: Article = {
  id: 'a1',
  authorId: 'u1',
  title: 'Hello',
  content: 'Body',
  tags: ['intro'],
  createdAt: '2026-07-23T01:00:00.000Z',
  updatedAt: '2026-07-23T01:00:00.000Z',
};

describe('ArticleController', () => {
  it('UT-052 create 201 / update 200 / delete 204 / getById 200+comments / list 200+分页', async () => {
    const detail: ArticleDetail = {
      ...article,
      comments: [
        {
          id: 'c1',
          articleId: 'a1',
          authorId: 'u1',
          content: 'Nice',
          createdAt: '2026-07-23T02:00:00.000Z',
        },
      ],
    };
    const page: Page = {
      items: [article],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    const mockService = {
      create: vi.fn().mockResolvedValue(article),
      update: vi.fn().mockResolvedValue({ ...article, title: 'v2' }),
      delete: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(detail),
      list: vi.fn().mockResolvedValue(page),
    } as unknown as ArticleService;
    const controller = new ArticleController(mockService);

    // create 201
    const rc = makeRes();
    await controller.create(
      { body: { title: 'Hello', content: 'Body' }, user: { userId: 'u1', username: 'alice' } } as Request,
      rc.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rc.status).toHaveBeenCalledWith(201);
    expect((rc.json.mock.calls[0][0] as { articleId: string }).articleId).toBe('a1');

    // update 200
    const ru = makeRes();
    await controller.update(
      { params: { id: 'a1' }, body: { title: 'v2' }, user: { userId: 'u1', username: 'alice' } } as unknown as Request,
      ru.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(ru.status).toHaveBeenCalledWith(200);

    // delete 204
    const rd = makeRes();
    await controller.remove(
      { params: { id: 'a1' }, user: { userId: 'u1', username: 'alice' } } as unknown as Request,
      rd.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rd.status).toHaveBeenCalledWith(204);
    expect(rd.end).toHaveBeenCalled();

    // getById 200 + comments
    const rg = makeRes();
    await controller.getById(
      { params: { id: 'a1' } } as unknown as Request,
      rg.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rg.status).toHaveBeenCalledWith(200);
    const gotBody = rg.json.mock.calls[0][0] as { comments: unknown[]; articleId: string };
    expect(gotBody.comments).toBeDefined();
    expect(gotBody.articleId).toBe('a1');

    // list 200 + 分页
    const rl = makeRes();
    await controller.list(
      { query: { page: '1', pageSize: '10' } } as unknown as Request,
      rl.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rl.status).toHaveBeenCalledWith(200);
    const listBody = rl.json.mock.calls[0][0] as { items: unknown[]; pageSize: number };
    expect(listBody.items).toBeDefined();
    expect(listBody.pageSize).toBeDefined();
  });
});
