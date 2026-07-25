// SD-010 CommentStore.

import { CommentStatus, MAX_DEPTH, type Comment } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { commentContentSchema } from '../utils/schemas.js';
import type { SiteStore } from './site.store.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `cm-${counter}`;
}

export interface CommentCreateInput {
  articleStatus: string;
  commentOpen: boolean;
  parentDepth?: number;
  parentStatus?: CommentStatus;
}

export class CommentStore {
  private comments = new Map<string, Comment>();
  private articleIdToComments = new Map<string, Set<string>>();
  private parentIdToReplies = new Map<string, Set<string>>();
  private userIdToLikedComments = new Map<string, Set<string>>();

  size(): number {
    return this.comments.size;
  }

  getById(id: string): Comment | null {
    return this.comments.get(id) ?? null;
  }

  listByArticle(articleId: string): Comment[] {
    const set = this.articleIdToComments.get(articleId);
    if (!set) return [];
    const out: Comment[] = [];
    for (const id of set) {
      const c = this.comments.get(id);
      if (c) out.push({ ...c });
    }
    return out;
  }

  create(
    articleId: string,
    userId: string,
    parentId: string | null,
    content: string,
    ctx: CommentCreateInput,
  ): Comment {
    if (!ctx.commentOpen) {
      throw new AppError(ErrorCode.CommentClosed, '1025');
    }
    if (ctx.articleStatus !== 'published') {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    if (!commentContentSchema.safeParse(content).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    let depth = 0;
    if (parentId) {
      const parent = this.comments.get(parentId);
      if (!parent) throw new AppError(ErrorCode.NotFound, '1031');
      depth = parent.depth + 1;
      if (depth > MAX_DEPTH) {
        throw new AppError(ErrorCode.DepthLimit, '1004');
      }
    }
    const now = new Date();
    const comment: Comment = {
      id: nextId(),
      articleId,
      userId,
      parentId,
      content,
      depth,
      likeCount: 0,
      status: CommentStatus.PendingReview,
      createdAt: now,
      updatedAt: now,
    };
    this.comments.set(comment.id, comment);
    this.indexAdd(this.articleIdToComments, articleId, comment.id);
    if (parentId) this.indexAdd(this.parentIdToReplies, parentId, comment.id);
    return { ...comment };
  }

  update(comment: Comment): Comment {
    const existing = this.comments.get(comment.id);
    if (!existing) throw new AppError(ErrorCode.NotFound, '1031');
    const updated: Comment = { ...comment, updatedAt: new Date() };
    this.comments.set(comment.id, updated);
    return { ...updated };
  }

  like(userId: string, commentId: string): boolean {
    const c = this.comments.get(commentId);
    if (!c) throw new AppError(ErrorCode.NotFound, '1031');
    if (c.status !== CommentStatus.Approved) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    let set = this.userIdToLikedComments.get(userId);
    if (!set) {
      set = new Set();
      this.userIdToLikedComments.set(userId, set);
    }
    if (set.has(commentId)) {
      // Idempotent: no-op (still successful).
      return false;
    }
    set.add(commentId);
    c.likeCount += 1;
    return true;
  }

  hasLiked(userId: string, commentId: string): boolean {
    const set = this.userIdToLikedComments.get(userId);
    return !!set && set.has(commentId);
  }

  listByArticlePaged(
    articleId: string,
    page: number,
    pageSize: number,
    sort: 'newest' | 'oldest' | 'popular',
  ): { items: Comment[]; total: number } {
    const all = this.listByArticle(articleId).filter(
      (c) => c.status === CommentStatus.Approved,
    );
    if (sort === 'newest') {
      all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sort === 'oldest') {
      all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else {
      all.sort((a, b) => b.likeCount - a.likeCount);
    }
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  report(userId: string, commentId: string, reason: string): void {
    if (reason.length < 1 || reason.length > 200) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const c = this.comments.get(commentId);
    if (!c) throw new AppError(ErrorCode.NotFound, '1031');
    if (c.status === CommentStatus.Approved) {
      c.status = CommentStatus.Flagged;
      c.updatedAt = new Date();
    }
    // Track reporter.
    void userId;
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  clear(): void {
    this.comments.clear();
    this.articleIdToComments.clear();
    this.parentIdToReplies.clear();
    this.userIdToLikedComments.clear();
  }
}

export interface CommentStoreContext {
  siteStore: SiteStore;
}
