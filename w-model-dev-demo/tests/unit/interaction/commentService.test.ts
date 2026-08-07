/**
 * UT-018 文章作者删除评论成功（commentService.deleteComment，RH-03 授权上下文，DD-018/INTF-012）
 * UT-053 非文章作者删除评论被拒（40301，RH-03 未授权分支）
 */
import { describe, it, expect, vi } from 'vitest';
import { CommentStore } from '../../../src/stores/commentStore';
import { CommentService } from '../../../src/services/interaction/commentService';
import { EventBus } from '../../../src/utils/eventBus';

function setup(): { commentStore: CommentStore; commentService: CommentService; articleService: any } {
  const commentStore = new CommentStore();
  commentStore.create({ id: 'c_9001', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: '不错的文章', createdAt: '2026-08-07T10:00:00.000Z' });
  const articleService: any = {
    getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
  };
  const authService: any = { getUserById: vi.fn().mockResolvedValue(null) };
  const commentService = new CommentService(commentStore, articleService, authService, new EventBus());
  return { commentStore, commentService, articleService };
}

describe('UT-018 commentService.deleteComment 授权成功', () => {
  it('actorId === article.authorId → 删除可达（RH-03 AuthorizeDeletion 上下文），评论（含回复）删除', async () => {
    const { commentStore, commentService, articleService } = setup();
    commentStore.create({ id: 'c_9002', articleId: 'a_1001', authorId: 'u_0001', parentId: 'c_9001', content: '回复', createdAt: '2026-08-07T10:01:00.000Z' });

    await expect(commentService.deleteComment('a_1001', 'c_9001', 'u_0002')).resolves.toBeUndefined();
    expect(articleService.getPublishedArticleById).toHaveBeenCalledWith('a_1001');
    expect(commentStore.findById('c_9001')).toBeNull();
    expect(commentStore.findById('c_9002')).toBeNull(); // 回复级联删除
  });
});

describe('UT-053 commentService.deleteComment 越权拒绝', () => {
  it('actorId !== article.authorId → 40301，评论保留', async () => {
    const { commentStore, commentService } = setup();
    let error: any;
    try {
      await commentService.deleteComment('a_1001', 'c_9001', 'u_0001');
    } catch (err) {
      error = err;
    }
    expect(error.code).toBe(40301);
    expect(error.httpStatus).toBe(403);
    expect(commentStore.findById('c_9001')).not.toBeNull();
  });
});

describe('commentService 其余方法', () => {
  it('createComment：文章已发布 → 评论落库 + comment.created 事件（articleAuthorId 注入）', async () => {
    const commentStore = new CommentStore();
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
    };
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0001', username: 'reader1' }) };
    const eventBus = new EventBus();
    const emit = vi.spyOn(eventBus, 'emit');
    const service = new CommentService(commentStore, articleService, authService, eventBus);

    const comment = await service.createComment('a_1001', 'u_0001', '不错的文章');

    expect(comment.articleId).toBe('a_1001');
    expect(comment.parentId).toBeNull();
    expect(emit).toHaveBeenCalledWith('comment.created', expect.objectContaining({ articleId: 'a_1001', articleAuthorId: 'u_0002', authorName: 'reader1' }));
  });

  it('createComment：文章不存在/未发布 → 40402；parentId 不属于该文章 → 40002', async () => {
    const articleService: any = { getPublishedArticleById: vi.fn().mockResolvedValue(null) };
    const service = new CommentService(new CommentStore(), articleService, {} as any, new EventBus());
    expect((await service.createComment('a_x', 'u_0001', 'c').catch((e) => e)).code).toBe(40402);

    const commentStore = new CommentStore();
    commentStore.create({ id: 'cm_1', articleId: 'a_other', authorId: 'u_0001', parentId: null, content: 'x', createdAt: '2026-08-07T10:00:00.000Z' });
    const articleService2: any = { getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }) };
    const service2 = new CommentService(commentStore, articleService2, {} as any, new EventBus());
    expect((await service2.createComment('a_1001', 'u_0001', 'c', 'cm_1').catch((e) => e)).code).toBe(40002);
  });

  it('listComments：文章不存在 → 40401；正常返回分页', async () => {
    const commentStore = new CommentStore();
    commentStore.create({ id: 'cm_1', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: 'x', createdAt: '2026-08-07T10:00:00.000Z' });
    const articleService: any = { getArticleById: vi.fn().mockResolvedValue({ id: 'a_1001' }) };
    const service = new CommentService(commentStore, articleService, {} as any, new EventBus());
    const page = await service.listComments('a_1001', 1, 20);
    expect(page.total).toBe(1);

    const missing: any = { getArticleById: vi.fn().mockResolvedValue(null) };
    const service2 = new CommentService(commentStore, missing, {} as any, new EventBus());
    expect((await service2.listComments('a_9999', 1, 20).catch((e) => e)).code).toBe(40401);
  });

  it('replyComment：写回复 + comment.created；parentId 非本文章 → 40002', async () => {
    const commentStore = new CommentStore();
    commentStore.create({ id: 'cm_1', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: '原评论', createdAt: '2026-08-07T10:00:00.000Z' });
    const articleService: any = { getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }) };
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0003', username: 'reader3' }) };
    const service = new CommentService(commentStore, articleService, authService, new EventBus());

    const reply = await service.replyComment('a_1001', 'cm_1', 'u_0003', '谢谢');
    expect(reply.parentId).toBe('cm_1');

    const articleService2: any = { getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }) };
    const service2 = new CommentService(new CommentStore(), articleService2, {} as any, new EventBus());
    expect((await service2.replyComment('a_1001', 'cm_9999', 'u_0003', 'x').catch((e) => e)).code).toBe(40002);
  });

  it('countByArticleIds：评论数聚合', async () => {
    const commentStore = new CommentStore();
    commentStore.create({ id: 'cm_1', articleId: 'a_1', authorId: 'u_1', parentId: null, content: 'x', createdAt: '2026-08-07T10:00:00.000Z' });
    commentStore.create({ id: 'cm_2', articleId: 'a_1', authorId: 'u_2', parentId: null, content: 'y', createdAt: '2026-08-07T10:01:00.000Z' });
    const service = new CommentService(commentStore, {} as any, {} as any, new EventBus());
    expect(await service.countByArticleIds(['a_1', 'a_2'])).toBe(2);
  });
});
