// 评论内存存储封装：Map 读写
// 对应 detailed-design.md DD-COMMENT-STORE：store Map<commentId,Comment>；findByArticle 遍历过滤
import type { Comment } from '../types';

export class CommentStore {
  private store = new Map<string, Comment>();

  save(comment: Comment): void {
    this.store.set(comment.id, comment);
  }

  findByArticle(articleId: string | null | undefined): Comment[] {
    if (articleId == null) return [];
    return Array.from(this.store.values()).filter(c => c.articleId === articleId);
  }
}

export const commentStore = new CommentStore();
