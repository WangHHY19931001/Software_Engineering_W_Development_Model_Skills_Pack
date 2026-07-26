/**
 * CommentStore（DD-010-003）— 评论存储 + articleId 索引。
 */
import type { Comment } from '../types.js';
import { NotFoundError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';
import { PaginationUtil } from '../utils/pagination.js';

export class CommentStore {
  private comments: Map<string, Comment> = new Map();
  private articleIndex: Map<string, Set<string>> = new Map();

  insert(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Comment {
    const now = new Date().toISOString();
    const record: Comment = {
      id: comment.id ?? generateId('comment'),
      articleId: comment.articleId,
      userId: comment.userId,
      content: comment.content,
      createdAt: now,
      updatedAt: now,
    };
    this.comments.set(record.id, record);
    let set = this.articleIndex.get(record.articleId);
    if (!set) {
      set = new Set();
      this.articleIndex.set(record.articleId, set);
    }
    set.add(record.id);
    return record;
  }

  findById(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  update(id: string, patch: Partial<Pick<Comment, 'content'>>): Comment {
    const comment = this.comments.get(id);
    if (!comment) throw new NotFoundError('评论');
    const updated: Comment = {
      ...comment,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.comments.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    const comment = this.comments.get(id);
    if (!comment) return false;
    const set = this.articleIndex.get(comment.articleId);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.articleIndex.delete(comment.articleId);
    }
    return this.comments.delete(id);
  }

  listByArticle(articleId: string, page: number = 1, limit: number = 10): {
    items: Comment[]; total: number; page: number; limit: number;
  } {
    const ids = this.articleIndex.get(articleId);
    let items: Comment[] = [];
    if (ids) {
      for (const id of ids) {
        const c = this.comments.get(id);
        if (c) items.push(c);
      }
    }
    items = PaginationUtil.sort(items, 'createdAt', 'asc');
    return PaginationUtil.paginate(items, page, limit);
  }

  listByUser(userId: string): Comment[] {
    return [...this.comments.values()].filter((c) => c.userId === userId);
  }

  deleteByArticle(articleId: string): number {
    const ids = this.articleIndex.get(articleId);
    if (!ids) return 0;
    const count = ids.size;
    for (const id of ids) {
      this.comments.delete(id);
    }
    this.articleIndex.delete(articleId);
    return count;
  }

  size(): number {
    return this.comments.size;
  }

  clear(): void {
    this.comments.clear();
    this.articleIndex.clear();
  }
}
