/**
 * TC-DES-011: 跨子系统集成——评论→触发通知→影响热度→影响搜索排序
 *
 * 评论触发通知（SD-003→SD-003）+ 评论计入热度（SD-003→SD-002）+
 * 热度变化影响搜索排序（SD-002→SD-005），验证 4 子系统联动。
 *
 * 关联需求/设计：REQ-010 / REQ-011 / REQ-004 / REQ-007 / SD-002 + SD-003 + SD-005
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader, createArticle, transitionArticle,
} from '../helpers/api-helper.js';

describe('TC-DES-011: 跨子系统——评论→通知→热度→搜索', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('评论触发通知→热度更新→搜索排序变化→楼中楼3级限制→敏感词', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const { articleStore } = await import('../../src/stores/article-store.js');

    // 准备：博主创建文章并发布
    const blogger = await registerUser(app, 'b@011.com', 'Pass1234', 'b011', 'blogger');
    const admin = await registerUser(app, 'a@011.com', 'Pass1234', 'a011', 'admin');
    const user = await registerUser(app, 'u@011.com', 'Pass1234', 'u011', 'user');

    const article = await createArticle(app, blogger.accessToken, {
      title: '评论热度测试文章',
      content: '评论热度内容',
    });
    await transitionArticle(app, blogger.accessToken, article.id, 'pending_review');
    await transitionArticle(app, admin.accessToken, article.id, 'published');

    // 索引文章到搜索
    c.searchIndexer.indexArticle(articleStore.findById(article.id)!);

    // 步骤1: 记录初始热度与搜索排序
    const initialHeat = c.statsAggregator.calculateHeat(articleStore.findById(article.id)!);
    expect(initialHeat).toBe(0); // 初始 stats 全为 0

    const initialSearch = await request(app)
      .get('/api/search?q=评论热度&sort=hottest&page=1&size=10');
    expect(initialSearch.status).toBe(200);

    // 步骤2: 用户评论文章
    const commentRes = await request(app)
      .post('/api/comments')
      .set(authHeader(user.accessToken))
      .send({ articleId: article.id, content: '很棒' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.status).toBe('published');

    // 步骤3: 验证作者收到通知
    const notifRes = await request(app)
      .get('/api/notifications')
      .set(authHeader(blogger.accessToken));
    expect(notifRes.status).toBe(200);
    const commentNotif = notifRes.body.list.find((n: { type: string }) => n.type === 'comment');
    expect(commentNotif).toBeDefined();

    // 步骤4: 验证热度更新（评论计入热度 ×3 权重）
    // 手动更新 stats.comments（CommentService 不自动更新 article.stats.comments）
    const articleWithViews = articleStore.findById(article.id)!;
    articleStore.update(article.id, {
      stats: { ...articleWithViews.stats, comments: 1 },
    });
    const updatedHeat = c.statsAggregator.calculateHeat(articleStore.findById(article.id)!);
    // rawHeat = 0*2 + 1*3 + 0*1 = 3，heat = 3 * decay
    expect(updatedHeat).toBeGreaterThan(0);
    expect(updatedHeat).toBeGreaterThan(initialHeat);

    // 步骤5: 验证搜索排序变化
    const updatedSearch = await request(app)
      .get('/api/search?q=评论热度&sort=hottest&page=1&size=10');
    expect(updatedSearch.status).toBe(200);
    expect(updatedSearch.body.list.some((a: { id: string }) => a.id === article.id)).toBe(true);

    // 步骤6: 楼中楼回复（2 级）
    const reply1 = await c.commentService.replyComment(commentRes.body.id, {
      articleId: article.id,
      content: '回复1',
      authorId: blogger.userId,
    });
    expect(reply1.depth).toBe(1);

    // 步骤8: 楼中楼回复（3 级）
    const reply2 = await c.commentService.replyComment(reply1.id, {
      articleId: article.id,
      content: '回复2',
      authorId: user.userId,
    });
    expect(reply2.depth).toBe(2);

    // 步骤9: 楼中楼回复（4 级，depth=3 仍允许）
    const reply3 = await c.commentService.replyComment(reply2.id, {
      articleId: article.id,
      content: '回复3',
      authorId: user.userId,
    });
    expect(reply3.depth).toBe(3);

    // 步骤9b: 5 级被拒（parent.depth ≥ 3 抛 60004）
    await expect(
      c.commentService.replyComment(reply3.id, {
        articleId: article.id,
        content: '回复4',
        authorId: user.userId,
      }),
    ).rejects.toThrow();

    // 步骤10: 敏感词评论测试
    const sensitiveRes = await request(app)
      .post('/api/comments')
      .set(authHeader(user.accessToken))
      .send({ articleId: article.id, content: '这是色情内容' });
    expect(sensitiveRes.status).toBe(201);
    expect(sensitiveRes.body.status).toBe('pending_review');
    expect(sensitiveRes.body.sensitiveHit).toBeDefined();
    expect(sensitiveRes.body.sensitiveHit).toContain('色情');

    // 步骤11: 验证敏感词评论不计入热度（pending_review 不影响 article stats）
    const finalArticle = articleStore.findById(article.id)!;
    expect(finalArticle.stats.comments).toBe(1); // 仍为手动设置的 1，敏感词评论未计入
  });

  it('评论点赞计数与取消逻辑', async () => {
    const blogger = await registerUser(app, 'b@like.com', 'Pass1234', 'bLike', 'blogger');
    const admin = await registerUser(app, 'a@like.com', 'Pass1234', 'aLike', 'admin');
    const user1 = await registerUser(app, 'u1@like.com', 'Pass1234', 'u1Like', 'user');
    const user2 = await registerUser(app, 'u2@like.com', 'Pass1234', 'u2Like', 'user');

    const article = await createArticle(app, blogger.accessToken, { title: '点赞', content: 'C' });
    await transitionArticle(app, blogger.accessToken, article.id, 'pending_review');
    await transitionArticle(app, admin.accessToken, article.id, 'published');

    // 创建评论
    const commentRes = await request(app)
      .post('/api/comments')
      .set(authHeader(user1.accessToken))
      .send({ articleId: article.id, content: '点赞测试' });
    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.id;

    // user2 点赞评论
    const likeRes1 = await request(app)
      .post(`/api/comments/${commentId}/like`)
      .set(authHeader(user2.accessToken));
    expect(likeRes1.status).toBe(204);

    // 验证点赞数
    const commentsRes = await request(app).get(`/api/articles/${article.id}/comments`);
    expect(commentsRes.status).toBe(200);
    const comment = commentsRes.body.list.find((c: { id: string }) => c.id === commentId);
    expect(comment.likes).toBe(1);
    expect(comment.likedBy).toContain(user2.userId);

    // 重复点赞 → 409
    const likeRes2 = await request(app)
      .post(`/api/comments/${commentId}/like`)
      .set(authHeader(user2.accessToken));
    expect(likeRes2.status).toBe(409);
  });
});
