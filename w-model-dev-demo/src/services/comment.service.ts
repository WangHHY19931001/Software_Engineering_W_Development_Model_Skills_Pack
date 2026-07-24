// 评论服务：评论添加（含文章存在性校验）、评论列表查询
// 对应 detailed-design.md DD-COMMENT-SVC：依赖 ArticleService / CommentStore
import type { Comment, Result } from '../types';
import { commentStore } from '../stores/comment.store';
import type { CommentStore } from '../stores/comment.store';
import { articleService } from './article.service';
import type { ArticleService } from './article.service';
import { AppError } from '../utils/errors';

export class CommentService {
  constructor(
    private articleService: ArticleService,
    private commentStore: CommentStore,
  ) {}

  add(
    articleId: string,
    authorId: string,
    content: string,
  ): Result<{ commentId: string; articleId: string; createdAt: string }> {
    if (!content) {
      return { ok: false, code: 40001, message: '评论内容不能为空' };
    }
    // 校验文章存在且非 rejected（对普通用户不可见的文章不允许评论）
    try {
      this.articleService.getById(articleId, 'user');
    } catch (err) {
      const e = err as AppError;
      if (e.code === 40301) {
        // rejected 文章对普通用户不可见 → 转换为 60002 状态不允许评论
        return { ok: false, code: 60002, message: '文章状态不允许评论' };
      }
      // 40401 文章不存在直接透传
      return { ok: false, code: e.code, message: e.message };
    }
    const comment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      articleId,
      authorId,
      content,
      createdAt: new Date().toISOString(),
    };
    this.commentStore.save(comment);
    return {
      ok: true,
      data: {
        commentId: comment.id,
        articleId: comment.articleId,
        createdAt: comment.createdAt,
      },
    };
  }

  listByArticle(articleId: string): Result<Comment[]> {
    // 校验文章存在性（admin 视角，可见所有状态）
    try {
      this.articleService.getById(articleId, 'admin');
    } catch (err) {
      const e = err as AppError;
      return { ok: false, code: e.code, message: e.message };
    }
    return { ok: true, data: this.commentStore.findByArticle(articleId) };
  }
}

export const commentService = new CommentService(articleService, commentStore);
