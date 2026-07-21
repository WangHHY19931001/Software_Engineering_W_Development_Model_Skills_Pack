import type { Comment } from '../types.js';

class CommentStoreImpl {
  private comments = new Map<string, Comment>();

  save(comment: Comment): void {
    this.comments.set(comment.id, comment);
  }

  findById(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  findByArticleId(articleId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter((c) => c.articleId === articleId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  delete(id: string): boolean {
    return this.comments.delete(id);
  }

  clear(): void {
    this.comments.clear();
  }

  size(): number {
    return this.comments.size;
  }
}

export const commentStore = new CommentStoreImpl();
