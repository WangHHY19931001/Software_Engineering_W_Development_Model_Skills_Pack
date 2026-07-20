import { describe, it, expect, beforeEach } from 'vitest';
import { commentService } from '../../src/services/comment-service.js';
import { articleService } from '../../src/services/article-service.js';
import { articleStore } from '../../src/stores/article-store.js';
import { commentStore } from '../../src/stores/comment-store.js';
import { NotFoundError } from '../../src/utils/errors.js';

describe('CommentService', () => {
  beforeEach(() => {
    articleStore.clear();
    commentStore.clear();
  });

  it('UT-014: 文章存在时评论创建成功', async () => {
    const { articleId } = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    const result = await commentService.create(articleId, { content: 'Hi' }, 'u2');
    expect(result.commentId).toBeTypeOf('string');
  });

  it('UT-015: 文章不存在抛 NotFoundError', async () => {
    await expect(
      commentService.create('non-existent', { content: 'Hi' }, 'u1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('UT-016: listByArticle 返回指定文章的评论', async () => {
    const { articleId: a1 } = await articleService.create({ title: 'A1', content: 'C' }, 'u1');
    const { articleId: a2 } = await articleService.create({ title: 'A2', content: 'C' }, 'u1');
    await commentService.create(a1, { content: 'c1' }, 'u2');
    await commentService.create(a1, { content: 'c2' }, 'u2');
    await commentService.create(a2, { content: 'c3' }, 'u2');
    expect(commentService.listByArticle(a1)).toHaveLength(2);
    expect(commentService.listByArticle(a2)).toHaveLength(1);
  });
});
