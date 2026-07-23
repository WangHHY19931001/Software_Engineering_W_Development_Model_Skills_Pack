/**
 * CommentStore：评论内存存储（realizes INTF-012 / DD-003）。
 * findByArticleId 按 createdAt 升序。
 */
import type { Comment } from '../types';

export class CommentStore {
  private readonly comments = new Map<string, Comment>();

  insert(comment: Comment): void {
    this.comments.set(comment.id, comment);
  }

  findById(id: string): Comment | null {
    return this.comments.get(id) ?? null;
  }

  delete(id: string): boolean {
    return this.comments.delete(id);
  }

  findByArticleId(articleId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter((c) => c.articleId === articleId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  clear(): void {
    this.comments.clear();
  }

  size(): number {
    return this.comments.size;
  }
}
