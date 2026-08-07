/**
 * commentService（DD-018 / SD-003）：评论创建/列表/删除/回复。
 * 发表即自动审核通过（REQ-018）；删除授权上下文（RH-03 §0.3）：
 * deletionAuthorized := (actorId === article.authorId)，经 articleService（SD-002）读取文章作者；
 * 触发 comment.created 事件（SD-005 通知 / SD-006 Webhook 消费）。
 */
import { BizError } from '../../utils/errors';
import { invariant } from '../../utils/invariant';
import type { CommentStore } from '../../stores/commentStore';
import type { ArticleService } from '../content/articleService';
import type { AuthService } from '../identity/authService';
import type { EventBus } from '../../utils/eventBus';
import type { Comment, Page } from '../../types';

export class CommentService {
  constructor(
    private readonly commentStore: CommentStore,
    private readonly articleService: ArticleService,
    private readonly authService: AuthService,
    private readonly eventBus: EventBus,
  ) {}

  /** 创建评论：文章已发布（40401/40402）→ parentId 属于同一文章（40002）→ 写入 → comment.created */
  async createComment(articleId: string, authorId: string, content: string, parentId?: string): Promise<Comment> {
    const article = await this.articleService.getPublishedArticleById(articleId);
    if (!article) {
      throw new BizError(40402, '文章不存在或不可见');
    }
    // TLA+ BusinessInvariant 锚点（L2_BlogSystemInteraction / L3_BlogSystemCommentFlow）：
    // 评论前置不变量——文章必须已发布（createComment 仅对 published 文章开放）
    invariant(article.status === 'published', '评论前置不变量违反：文章必须已发布');
    if (parentId) {
      const parent = await this.commentStore.findById(parentId);
      if (!parent || parent.articleId !== articleId) {
        throw new BizError(40002, 'parentId 不属于该文章');
      }
    }
    const comment = await this.commentStore.create({
      articleId,
      authorId,
      parentId: parentId ?? null,
      content,
      createdAt: new Date().toISOString(),
    });
    const author = await this.authService.getUserById(authorId);
    this.eventBus.emit('comment.created', {
      type: 'comment.created',
      articleId,
      commentId: comment.id,
      authorId,
      authorName: author?.username ?? '',
      articleAuthorId: article.authorId,
      parentId: parentId ?? null,
      content,
    });
    return comment;
  }

  /** 公开评论分页列表（createdAt 降序） */
  async listComments(articleId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    const article = await this.articleService.getArticleById(articleId);
    if (!article) {
      throw new BizError(40401, '文章不存在');
    }
    return this.commentStore.listByArticle(articleId, page, pageSize);
  }

  /**
   * 删除评论（RH-03 授权上下文）：
   * 前置 = 文章存在（经 articleService，数据源 article store）∧ actorId 已认证 ∧ deletionAuthorized；
   * 授权（actorId === article.authorId）→ 删除（含回复级联）；未授权 → 40301。
   */
  async deleteComment(articleId: string, commentId: string, actorId: string): Promise<void> {
    const article = await this.articleService.getPublishedArticleById(articleId);
    if (!article) {
      throw new BizError(40401, '文章不存在');
    }
    const comment = await this.commentStore.findById(commentId);
    if (!comment || comment.articleId !== articleId) {
      throw new BizError(40401, '评论不存在');
    }
    const deletionAuthorized = actorId === article.authorId;
    if (!deletionAuthorized) {
      throw new BizError(40301, '仅文章作者可删除评论');
    }
    await this.commentStore.delete(commentId);
  }

  /** 回复评论：parentId 属于该文章（40002）→ 写回复 → comment.created（REPLY 通知由 SD-005 消费） */
  async replyComment(articleId: string, parentId: string, authorId: string, content: string): Promise<Comment> {
    const article = await this.articleService.getPublishedArticleById(articleId);
    if (!article) {
      throw new BizError(40402, '文章不存在或不可见');
    }
    const parent = await this.commentStore.findById(parentId);
    if (!parent || parent.articleId !== articleId) {
      throw new BizError(40002, 'parentId 不属于该文章');
    }
    const comment = await this.commentStore.create({
      articleId,
      authorId,
      parentId,
      content,
      createdAt: new Date().toISOString(),
    });
    const author = await this.authService.getUserById(authorId);
    this.eventBus.emit('comment.created', {
      type: 'comment.created',
      articleId,
      commentId: comment.id,
      authorId,
      authorName: author?.username ?? '',
      articleAuthorId: article.authorId,
      parentId,
      content,
    });
    return comment;
  }

  /** 评论数聚合（博主面板统计，SD-005→SD-003） */
  async countByArticleIds(articleIds: string[]): Promise<number> {
    const map = await this.commentStore.countByArticleIds(articleIds);
    let total = 0;
    for (const count of map.values()) total += count;
    return total;
  }

  /** TLA+ L2_BlogSystemInteraction "PostComment" 动作对应：发表评论（createComment 薄封装） */
  async postComment(articleId: string, authorId: string, content: string, parentId?: string): Promise<Comment> {
    return this.createComment(articleId, authorId, content, parentId);
  }
}
