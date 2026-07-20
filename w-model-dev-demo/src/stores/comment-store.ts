import type { Comment } from '../types.js';

class CommentStore {
  private byId = new Map<string, Comment>();
  private byArticle = new Map<string, Comment[]>();

  insert(comment: Comment): void {
    this.byId.set(comment.id, comment);
    const list = this.byArticle.get(comment.articleId) ?? [];
    list.push(comment);
    this.byArticle.set(comment.articleId, list);
  }

  listByArticle(articleId: string): Comment[] {
    return this.byArticle.get(articleId) ?? [];
  }

  clear(): void {
    this.byId.clear();
    this.byArticle.clear();
  }
}

export const commentStore = new CommentStore();
