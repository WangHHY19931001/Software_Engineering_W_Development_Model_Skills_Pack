/**
 * ArticleService（DD-005-002 / DD-006-002 / DD-007-002 / DD-008-002 / DD-009-002）。
 */
import type { Article, ArticleQuery, PaginatedResult } from '../types.js';
import type { ArticleStore } from '../stores/article.store.js';
import type { CommentStore } from '../stores/comment.store.js';
import type { TagStore } from '../stores/tag.store.js';
import type { CategoryStore } from '../stores/category.store.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { OwnershipChecker } from '../utils/article-helpers.js';

export interface ArticleCreateInput {
  title: string;
  content: string;
  authorId: string;
  tagIds: string[];
  categoryId: string | null;
  status?: 'draft' | 'published';
}

export interface ArticleUpdateInput {
  title?: string;
  content?: string;
  tagIds?: string[];
  categoryId?: string | null;
}

export class ArticleService {
  private ownershipChecker = new OwnershipChecker();

  constructor(
    private articleStore: ArticleStore,
    private commentStore: CommentStore,
    private tagStore: TagStore,
    private categoryStore: CategoryStore,
  ) {}

  create(input: ArticleCreateInput): Article {
    if (!input.title.trim()) throw new ValidationError('标题必填');
    if (!input.content.trim()) throw new ValidationError('正文必填');
    for (const tagId of input.tagIds) {
      if (!this.tagStore.findById(tagId)) {
        throw new ValidationError(`标签 ${tagId} 不存在`);
      }
    }
    if (input.categoryId !== null) {
      if (!this.categoryStore.findById(input.categoryId)) {
        throw new ValidationError(`分类 ${input.categoryId} 不存在`);
      }
    }
    const status = input.status ?? 'draft';
    return this.articleStore.insert({
      title: input.title,
      content: input.content,
      authorId: input.authorId,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      status,
      publishedAt: status === 'published' ? new Date().toISOString() : null,
    });
  }

  list(query: ArticleQuery): PaginatedResult<Article> {
    return this.articleStore.query(query);
  }

  getById(id: string, incrementView: boolean = false): Article {
    const article = this.articleStore.findById(id);
    if (!article) throw new NotFoundError('文章');
    if (incrementView) {
      this.articleStore.incrementView(id);
    }
    return article;
  }

  update(id: string, patch: ArticleUpdateInput, userId: string, userRole: string): Article {
    const article = this.articleStore.findById(id);
    if (!article) throw new NotFoundError('文章');
    this.ownershipChecker.assertOwner(article.authorId, userId, userRole);
    if (patch.tagIds !== undefined) {
      for (const tagId of patch.tagIds) {
        if (!this.tagStore.findById(tagId)) {
          throw new ValidationError(`标签 ${tagId} 不存在`);
        }
      }
    }
    if (patch.categoryId !== undefined && patch.categoryId !== null) {
      if (!this.categoryStore.findById(patch.categoryId)) {
        throw new ValidationError(`分类 ${patch.categoryId} 不存在`);
      }
    }
    return this.articleStore.update(id, patch);
  }

  remove(id: string, userId: string, userRole: string): void {
    const article = this.articleStore.findById(id);
    if (!article) throw new NotFoundError('文章');
    this.ownershipChecker.assertOwner(article.authorId, userId, userRole);
    this.commentStore.deleteByArticle(id);
    this.articleStore.delete(id);
  }
}
