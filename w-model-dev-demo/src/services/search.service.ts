/**
 * 搜索服务
 */
import { ArticleRepository } from '../repositories/article.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ArticleStatus, type Article, type PaginatedResult } from '../types/index.js';

export interface SearchHit {
  type: 'article' | 'tag' | 'user';
  id: string;
  title: string;
  excerpt: string;
}

export class SearchService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly tagRepo: TagRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async searchArticles(
    keyword: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResult<Article>> {
    const { items, total } = await this.articleRepo.search({
      keyword,
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

  async searchAll(keyword: string): Promise<SearchHit[]> {
    if (!keyword || keyword.trim() === '') {
      return [];
    }
    const kw = keyword.toLowerCase();
    const results: SearchHit[] = [];

    const articleResults = await this.articleRepo.search({
      keyword,
      status: ArticleStatus.PUBLISHED,
      limit: 20,
    });
    for (const a of articleResults.items) {
      results.push({
        type: 'article',
        id: a.id,
        title: a.title,
        excerpt: a.summary || a.content.slice(0, 100),
      });
    }

    const tags = await this.tagRepo.findAll();
    for (const t of tags) {
      if (t.name.toLowerCase().includes(kw) || t.slug.toLowerCase().includes(kw)) {
        results.push({
          type: 'tag',
          id: t.id,
          title: t.name,
          excerpt: t.description ?? '',
        });
      }
    }

    const users = await this.userRepo.findAll();
    for (const u of users) {
      if (
        u.username.toLowerCase().includes(kw) ||
        u.nickname.toLowerCase().includes(kw)
      ) {
        results.push({
          type: 'user',
          id: u.id,
          title: u.nickname,
          excerpt: u.bio ?? '',
        });
      }
    }

    return results;
  }

  async searchByTag(tagId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
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

  async searchByAuthor(authorId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Article>> {
    const { items, total } = await this.articleRepo.search({
      authorId,
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
}
