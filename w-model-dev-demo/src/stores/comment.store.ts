import type { Comment } from '../types.js';

/**
 * 内存评论存储。
 *
 * 设计来源：`docs/detailed-design.md` §1.1 / §2.3 / §3.3 / CON-002。
 * - 主键 `id` 作为 Map key（O(1) 查找）。
 * - `findByArticleId` 按 `createdAt` 升序排列（与文章详情聚合一致）。
 */
export class CommentStore {
  private readonly comments: Map<string, Comment> = new Map();

  save(comment: Comment): Comment {
    this.comments.set(comment.id, comment);
    return comment;
  }

  findById(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  findByArticleId(articleId: string): Comment[] {
    const list = Array.from(this.comments.values()).filter(c => c.articleId === articleId);
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return list;
  }

  delete(id: string): boolean {
    return this.comments.delete(id);
  }

  clear(): void {
    this.comments.clear();
  }
}
