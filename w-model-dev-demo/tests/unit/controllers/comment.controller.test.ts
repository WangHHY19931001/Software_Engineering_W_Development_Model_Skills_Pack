/**
 * CommentController 单元测试（UT-053）。
 * mock CommentService，验证 HTTP 适配 + DTO 映射（commentId）。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { CommentController } from '../../../src/controllers/comment.controller';
import type { CommentService } from '../../../src/services/comment.service';

function makeRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const end = vi.fn().mockReturnThis();
  return { res: { status, json, end } as unknown as Response, status, json, end };
}

describe('CommentController', () => {
  it('UT-053 create 201 / remove 204', async () => {
    const mockService = {
      create: vi.fn().mockResolvedValue({
        id: 'c1',
        articleId: 'a1',
        authorId: 'u1',
        content: 'Nice',
        createdAt: '2026-07-23T02:00:00.000Z',
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      listByArticle: vi.fn(),
    } as unknown as CommentService;
    const controller = new CommentController(mockService);

    // create 201
    const rc = makeRes();
    await controller.create(
      {
        params: { id: 'a1' },
        body: { content: 'Nice' },
        user: { userId: 'u1', username: 'alice' },
      } as unknown as Request,
      rc.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rc.status).toHaveBeenCalledWith(201);
    expect((rc.json.mock.calls[0][0] as { commentId: string }).commentId).toBeDefined();

    // remove 204
    const rr = makeRes();
    await controller.remove(
      {
        params: { commentId: 'c1' },
        user: { userId: 'u1', username: 'alice' },
      } as unknown as Request,
      rr.res,
      vi.fn() as unknown as NextFunction,
    );
    expect(rr.status).toHaveBeenCalledWith(204);
    expect(rr.end).toHaveBeenCalled();
  });
});
