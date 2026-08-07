/**
 * UT-015 未认证评论被拒（CommentController.createComment，DD-015/INTF-012）
 */
import { describe, it, expect, vi } from 'vitest';
import { CommentController } from '../../../src/routes/interaction/commentController';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-015 CommentController.createComment', () => {
  it('无 JWT（req.user 未挂载）发表评论 → 40101，commentService 未被调用', async () => {
    const commentService: any = { createComment: vi.fn() };
    const authService: any = {};
    const controller = new CommentController(commentService, authService);
    const req = makeReq({ user: undefined, body: { content: '不错的文章' } });
    const res = makeRes();

    await controller.createComment(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40101 }) }));
    expect(commentService.createComment).not.toHaveBeenCalled();
  });
});

describe('CommentController 其余方法', () => {
  const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0001', username: 'reader1' }) };

  it('createComment 成功：201 组装 authorName', async () => {
    const commentService: any = {
      createComment: vi.fn().mockResolvedValue({ id: 'cm_1', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: '不错的文章', createdAt: '2026-08-07T10:00:00.000Z' }),
    };
    const controller = new CommentController(commentService, authService);
    const res = makeRes();
    await controller.createComment(makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'a_1001' }, body: { content: '不错的文章' } }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ commentId: 'cm_1', authorName: 'reader1' }) }));
  });

  it('listComments：分页透传；deleteComment：204；replyComment：201', async () => {
    const commentService: any = {
      listComments: vi.fn().mockResolvedValue({ items: [{ id: 'cm_1', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: 'x', createdAt: '2026-08-07T10:00:00.000Z' }], total: 1, page: 1, pageSize: 20 }),
      deleteComment: vi.fn().mockResolvedValue(undefined),
      replyComment: vi.fn().mockResolvedValue({ id: 'cm_2', articleId: 'a_1001', authorId: 'u_0001', parentId: 'cm_1', content: '回复', createdAt: '2026-08-07T10:01:00.000Z' }),
    };
    const controller = new CommentController(commentService, authService);

    const res1 = makeRes();
    await controller.listComments(makeReq({ params: { id: 'a_1001' }, query: { page: '1', pageSize: '20' } }), res1, makeNext());
    expect(commentService.listComments).toHaveBeenCalledWith('a_1001', 1, 20);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total: 1 }) }));

    const res2 = makeRes();
    await controller.deleteComment(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, params: { id: 'a_1001', cid: 'cm_1' } }), res2, makeNext());
    expect(commentService.deleteComment).toHaveBeenCalledWith('a_1001', 'cm_1', 'u_0002');
    expect(res2.status).toHaveBeenCalledWith(204);

    const res3 = makeRes();
    await controller.replyComment(makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'a_1001', cid: 'cm_1' }, body: { content: '回复' } }), res3, makeNext());
    expect(commentService.replyComment).toHaveBeenCalledWith('a_1001', 'cm_1', 'u_0001', '回复');
    expect(res3.status).toHaveBeenCalledWith(201);
  });
});
