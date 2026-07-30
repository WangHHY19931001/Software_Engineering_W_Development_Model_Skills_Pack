/**
 * 博文生命周期服务
 */
import { z } from 'zod';
import { ArticleRepository } from '../repositories/article.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { generateId } from '../utils/id.js';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import {
  ArticleStateMachine,
  type ArticleTransition,
} from '../state-machines/article-state-machine.js';
import {
  ArticleStatus,
  UserRole,
  type Article,
  type PaginatedResult,
} from '../types/index.js';

export const CreateArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000),
  summary: z.string().max(500).optional().default(''),
  tagIds: z.array(z.string()).max(20).optional().default([]),
});

export const UpdateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000).optional(),
  summary: z.string().max(500).optional(),
  tagIds: z.array(z.string()).max(20).optional(),
});

export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;

export class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
    private readonly tagRepo: TagRepository,
    private readonly commentRepo: CommentRepository,
  ) {}

  async create(authorId: string, input: CreateArticleInput): Promise<Article> {
    const parsed = CreateArticleSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid article data', { issues: parsed.error.issues });
    }
    const user = await this.userRepo.findById(authorId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.role !== UserRole.BLOGGER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Only bloggers can create articles');
    }
    const now = Date.now();
    const article: Article = {
      id: generateId('article'),
      authorId,
      title: parsed.data.title,
      content: parsed.data.content,
      summary: parsed.data.summary,
      status: ArticleStateMachine.initial(),
      tagIds: parsed.data.tagIds ?? [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.articleRepo.create(article);
    return article;
  }

  async update(id: string, actorId: string, input: UpdateArticleInput): Promise<Article> {
    const parsed = UpdateArticleSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid article update', { issues: parsed.error.issues });
    }
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== actorId) {
      throw new ForbiddenError('Cannot edit other author articles');
    }
    if (article.status === ArticleStatus.DELETED) {
      throw new AppError(ErrorCode.INVALID_STATE, 'Cannot edit deleted article', 400);
    }
    const updated = await this.articleRepo.update(id, {
      ...parsed.data,
      updatedAt: Date.now(),
    } as Partial<Article>);
    if (!updated) {
      throw new NotFoundError('Article');
    }
    return updated;
  }

  async transition(
    id: string,
    actorId: string,
    transition: ArticleTransition,
  ): Promise<Article> {
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== actorId) {
      throw new ForbiddenError('Cannot transition other author articles');
    }
    if (!ArticleStateMachine.canTransition(article.status, transition)) {
      throw new AppError(
        ErrorCode.INVALID_STATE,
        `Cannot ${transition} from ${article.status}`,
        400,
      );
    }
    if (transition === 'publish') {
      ArticleStateMachine.assertContentNotEmpty(article.content);
    }
    const next = ArticleStateMachine.next(article.status, transition);
    const now = Date.now();
    const updates: Partial<Article> = {
      status: next,
      updatedAt: now,
    };
    if (transition === 'publish') {
      updates.publishedAt = now;
    }
    const updated = await this.articleRepo.update(id, updates);
    if (!updated) {
      throw new NotFoundError('Article');
    }
    return updated;
  }

  async getById(id: string): Promise<Article> {
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    return article;
  }

  async getPublishedById(id: string): Promise<Article> {
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.status !== ArticleStatus.PUBLISHED) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Article not published', 404);
    }
    return article;
  }

  async listByAuthor(authorId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
    const all = await this.articleRepo.findByAuthor(authorId);
    return this.paginate(all, page, pageSize);
  }

  async listPublished(page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
    const all = await this.articleRepo.findPublished();
    return this.paginate(all, page, pageSize);
  }

  async listByStatus(status: ArticleStatus, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
    const all = await this.articleRepo.findByStatus(status);
    return this.paginate(all, page, pageSize);
  }

  async search(query: {
    keyword?: string;
    tagId?: string;
    authorId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<Article>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.articleRepo.search({
      keyword: query.keyword,
      tagId: query.tagId,
      authorId: query.authorId,
      status: ArticleStatus.PUBLISHED,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async listByTag(tagId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
    const { items, total } = await this.articleRepo.search({
      tagId,
      status: ArticleStatus.PUBLISHED,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async deleteArticle(id: string, actorId: string): Promise<void> {
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== actorId) {
      throw new ForbiddenError('Cannot delete other author articles');
    }
    if (article.status === ArticleStatus.DELETED) {
      return;
    }
    await this.articleRepo.update(id, {
      status: ArticleStatus.DELETED,
      updatedAt: Date.now(),
    } as Partial<Article>);
  }

  async getStats(authorId: string): Promise<{
    total: number;
    draft: number;
    published: number;
    archived: number;
    deleted: number;
    totalViews: number;
    totalLikes: number;
  }> {
    const all = await this.articleRepo.findByAuthor(authorId);
    return {
      total: all.length,
      draft: all.filter((a) => a.status === ArticleStatus.DRAFT).length,
      published: all.filter((a) => a.status === ArticleStatus.PUBLISHED).length,
      archived: all.filter((a) => a.status === ArticleStatus.ARCHIVED).length,
      deleted: all.filter((a) => a.status === ArticleStatus.DELETED).length,
      totalViews: all.reduce((acc, a) => acc + a.viewCount, 0),
      totalLikes: all.reduce((acc, a) => acc + a.likeCount, 0),
    };
  }

  async incrementView(id: string): Promise<Article | null> {
    return this.articleRepo.incrementView(id);
  }

  async addTag(articleId: string, tagId: string, actorId: string): Promise<Article> {
    const article = await this.articleRepo.findById(articleId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== actorId) {
      throw new ForbiddenError('Cannot edit other author articles');
    }
    const tag = await this.tagRepo.findById(tagId);
    if (!tag) {
      throw new NotFoundError('Tag');
    }
    if (article.tagIds.includes(tagId)) {
      return article;
    }
    const updated = await this.articleRepo.update(articleId, {
      tagIds: [...article.tagIds, tagId],
      updatedAt: Date.now(),
    } as Partial<Article>);
    if (!updated) {
      throw new NotFoundError('Article');
    }
    return updated;
  }

  async removeTag(articleId: string, tagId: string, actorId: string): Promise<Article> {
    const article = await this.articleRepo.findById(articleId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== actorId) {
      throw new ForbiddenError('Cannot edit other author articles');
    }
    const updated = await this.articleRepo.update(articleId, {
      tagIds: article.tagIds.filter((t) => t !== tagId),
      updatedAt: Date.now(),
    } as Partial<Article>);
    if (!updated) {
      throw new NotFoundError('Article');
    }
    return updated;
  }

  private async paginate(
    all: Article[],
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<Article>> {
    all.sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getByIdAndAuthor(id: string, authorId: string): Promise<Article> {
    const article = await this.articleRepo.findById(id);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.authorId !== authorId) {
      throw new ForbiddenError('Cannot access other author articles');
    }
    return article;
  }
}
