// 文章内存存储封装：Map 读写 + 状态更新
// 对应 detailed-design.md DD-ARTICLE-STORE：store Map<articleId,Article>
import type { Article, ArticleStatus } from '../types';
import { AppError } from '../utils/errors';

export class ArticleStore {
  private store = new Map<string, Article>();

  save(article: Article): void {
    this.store.set(article.id, article);
  }

  findById(id: string | null): Article | null {
    if (id == null) return null;
    return this.store.get(id) ?? null;
  }

  findAll(): Article[] {
    return Array.from(this.store.values());
  }

  updateStatus(id: string, status: ArticleStatus): void {
    const article = this.store.get(id);
    if (!article) {
      throw new AppError(40401, '文章不存在');
    }
    article.status = status;
  }
}

export const articleStore = new ArticleStore();
