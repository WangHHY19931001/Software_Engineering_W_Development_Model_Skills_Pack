/**
 * DD-013 CommentService —— 评论服务
 *
 * 评论多级回复（≤3 级楼中楼）、审核、点赞、举报。
 * 依赖：DD-014 SensitiveFilter、DD-015 NotificationService、DD-024 WalWriter、DD-026 AuditLogger。
 *
 * TLA+ 一致性：moderate 对应 L3_comment_moderation.tla Moderate。
 */
import { z } from 'zod';
import type { Comment, CommentStatus, Page } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { SensitiveFilter } from '../../utils/sensitive-filter.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import type { AuditLogger } from '../../infrastructure/audit.js';

export interface CreateCommentInput {
  articleId: string;
  content: string;
  authorId: string;
  parentId?: string;
}

export interface CommentServiceDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
  sensitiveFilter: SensitiveFilter;
  isCommentOpen: () => boolean;
  notifyComment: (articleId: string, commentId: string, parentAuthorId?: string) => Promise<void>;
}

const CreateCommentSchema = z.object({
  articleId: z.string().min(1),
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论内容长度至多 1000 字'),
  authorId: z.string().min(1),
  parentId: z.string().optional(),
});

const commentStore = new GenericStore<Comment>();

function genId(): string {
  return `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class CommentService {
  constructor(private deps: CommentServiceDeps) {}

  /** 创建评论（对应 DD-013 createComment） */
  async createComment(input: CreateCommentInput): Promise<Comment> {
    if (!this.deps.isCommentOpen()) {
      throw new AppError(60003, '评论功能已关闭');
    }
    const parsed = CreateCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    // 敏感词过滤
    const filterResult = this.deps.sensitiveFilter.filter(parsed.data.content);
    const status: CommentStatus = filterResult.hits.length > 0 ? 'pending_review' : 'published';
    const now = Math.floor(Date.now() / 1000);
    const comment: Comment = {
      id: genId(),
      articleId: parsed.data.articleId,
      parentId: parsed.data.parentId,
      depth: parsed.data.parentId ? 1 : 0,
      authorId: parsed.data.authorId,
      content: filterResult.filtered,
      status,
      likes: 0,
      likedBy: [],
      sensitiveHit: filterResult.hits.length > 0 ? filterResult.hits : undefined,
      createdAt: now,
    };
    commentStore.insert(comment);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'comment.create',
      payload: comment,
      timestamp: now,
    });
    if (status === 'pending_review') {
      await this.deps.auditLogger.log('comment.sensitive', comment.authorId, comment.id, {
        hits: filterResult.hits,
      });
    }
    await this.deps.notifyComment(comment.articleId, comment.id, parsed.data.parentId ? undefined : undefined);
    return comment;
  }

  /** 楼中楼回复（对应 DD-013 replyComment，depth+1≤3） */
  async replyComment(parentId: string, input: CreateCommentInput): Promise<Comment> {
    const parent = commentStore.findById(parentId);
    if (!parent) {
      throw new AppError(40401, `父评论不存在: ${parentId}`, { parentId });
    }
    if (parent.depth >= 3) {
      throw new AppError(60004, '评论嵌套深度超限（≤3 级）', { parentId, depth: parent.depth });
    }
    const enriched: CreateCommentInput = { ...input, parentId };
    const comment = await this.createComment(enriched);
    // 修正 depth
    commentStore.update(comment.id, { depth: parent.depth + 1 });
    const updated = commentStore.findById(comment.id);
    if (!updated) throw new AppError(50001, '评论创建后丢失');
    return updated;
  }

  /** 审核（对应 DD-013 moderate + TLA+ Moderate） */
  async moderate(commentId: string, action: 'approve' | 'reject', adminId: string): Promise<Comment> {
    if (action !== 'approve' && action !== 'reject') {
      throw new AppError(40003, 'action 必须 approve/reject', { action });
    }
    const existing = commentStore.findById(commentId);
    if (!existing) {
      throw new AppError(40401, `评论不存在: ${commentId}`, { commentId });
    }
    if (existing.status !== 'pending_review' && existing.status !== 'reported') {
      throw new AppError(60002, '当前状态不允许审核', { status: existing.status });
    }
    const newStatus: CommentStatus = action === 'approve' ? 'approved' : 'rejected';
    commentStore.update(commentId, { status: newStatus });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'comment.moderate',
      payload: { commentId, action, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('comment.moderate', adminId, commentId, { action });
    const updated = commentStore.findById(commentId);
    if (!updated) throw new AppError(50001, '审核后评论丢失');
    return updated;
  }

  /** 点赞（对应 DD-013 like） */
  like(commentId: string, userId: string): void {
    const existing = commentStore.findById(commentId);
    if (!existing) {
      throw new AppError(40401, `评论不存在: ${commentId}`, { commentId });
    }
    if (existing.likedBy.includes(userId)) {
      throw new AppError(40901, '已点赞过', { commentId, userId });
    }
    commentStore.update(commentId, {
      likes: existing.likes + 1,
      likedBy: [...existing.likedBy, userId],
    });
  }

  /** 举报（对应 DD-013 report） */
  async report(commentId: string, reason: string, userId: string): Promise<Comment> {
    if (!reason || reason.length === 0 || reason.length > 200) {
      throw new AppError(40003, '举报原因长度 ∈ [1,200]');
    }
    const existing = commentStore.findById(commentId);
    if (!existing) {
      throw new AppError(40401, `评论不存在: ${commentId}`, { commentId });
    }
    commentStore.update(commentId, { status: 'reported' });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'comment.report',
      payload: { commentId, reason, userId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('comment.report', userId, commentId, { reason });
    const updated = commentStore.findById(commentId);
    if (!updated) throw new AppError(50001, '举报后评论丢失');
    return updated;
  }

  /** 评论列表（对应 DD-013 listComments） */
  listComments(articleId: string, page: number, size: number, sort: 'latest' | 'hottest' = 'latest'): Page<Comment> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const all = commentStore.list().filter(c => c.articleId === articleId);
    if (sort === 'hottest') {
      all.sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
    } else {
      all.sort((a, b) => b.createdAt - a.createdAt);
    }
    const total = all.length;
    const start = (page - 1) * size;
    const list = all.slice(start, start + size);
    return { list, total, page, pageSize: size };
  }

  /** 按 ID 查询 */
  findById(id: string): Comment | null {
    return commentStore.findById(id);
  }

  /** 测试重置 */
  static _reset(): void {
    commentStore.clear();
  }
}
