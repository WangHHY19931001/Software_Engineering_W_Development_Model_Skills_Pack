/**
 * 统计服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StatsService } from '../../src/services/stats.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { CommentRepository } from '../../src/repositories/comment.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { ViewRecordRepository } from '../../src/repositories/view-record.repository.js';
import { FollowRepository } from '../../src/repositories/follow.repository.js';
import { ArticleStatus, type Article, type User } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';

describe('StatsService', () => {
  let articleRepo: ArticleRepository;
  let userRepo: UserRepository;
  let commentRepo: CommentRepository;
  let tagRepo: TagRepository;
  let viewRecordRepo: ViewRecordRepository;
  let followRepo: FollowRepository;
  let svc: StatsService;

  beforeEach(() => {
    articleRepo = new ArticleRepository();
    userRepo = new UserRepository();
    commentRepo = new CommentRepository();
    tagRepo = new TagRepository();
    viewRecordRepo = new ViewRecordRepository();
    followRepo = new FollowRepository();
    svc = new StatsService(articleRepo, userRepo, commentRepo, tagRepo, viewRecordRepo, followRepo);
  });

  async function seedUser(): Promise<User> {
    const u: User = {
      id: generateId('user'),
      email: `u${Date.now()}_${Math.random()}@e.com`,
      passwordHash: 'h',
      username: `u${Date.now()}_${Math.random()}`,
      nickname: 'U',
      role: 'reader' as never,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await userRepo.create(u);
    return u;
  }

  async function seedArticle(input: Partial<Article> = {}): Promise<Article> {
    const a: Article = {
      id: input.id ?? generateId('article'),
      authorId: input.authorId ?? 'a1',
      title: input.title ?? 't',
      content: 'c',
      summary: '',
      status: input.status ?? ArticleStatus.PUBLISHED,
      tagIds: [],
      viewCount: input.viewCount ?? 0,
      likeCount: input.likeCount ?? 0,
      favoriteCount: input.favoriteCount ?? 0,
      commentCount: input.commentCount ?? 0,
      publishedAt: input.publishedAt ?? Date.now(),
      createdAt: input.createdAt ?? Date.now(),
      updatedAt: input.updatedAt ?? Date.now(),
    };
    await articleRepo.create(a);
    return a;
  }

  describe('getSiteStats()', () => {
    it('returns zero stats when empty', async () => {
      const r = await svc.getSiteStats();
      expect(r.totalUsers).toBe(0);
      expect(r.totalArticles).toBe(0);
    });

    it('aggregates counts', async () => {
      const u = await seedUser();
      await seedArticle({ status: ArticleStatus.PUBLISHED });
      await seedArticle({ status: ArticleStatus.DRAFT });
      const r = await svc.getSiteStats();
      expect(r.totalUsers).toBe(1);
      expect(r.totalArticles).toBe(2);
      expect(r.totalPublished).toBe(1);
      expect(r.totalDrafts).toBe(1);
    });
  });

  describe('getAuthorStats()', () => {
    it('returns author aggregates', async () => {
      const id = 'author-1';
      await seedArticle({ authorId: id, status: ArticleStatus.PUBLISHED, viewCount: 10 });
      await seedArticle({ authorId: id, status: ArticleStatus.DRAFT });
      const r = await svc.getAuthorStats(id);
      expect(r.publishedCount).toBe(1);
      expect(r.draftCount).toBe(1);
      expect(r.totalViews).toBe(10);
    });

    it('empty for unknown author', async () => {
      const r = await svc.getAuthorStats('unknown');
      expect(r.publishedCount).toBe(0);
    });
  });

  describe('getTopArticles()', () => {
    it('returns top by views', async () => {
      await seedArticle({ id: 'a', viewCount: 100 });
      await seedArticle({ id: 'b', viewCount: 200 });
      const r = await svc.getTopArticles(2);
      expect(r[0]!.id).toBe('b');
    });

    it('limits results', async () => {
      await seedArticle({ id: 'a' });
      await seedArticle({ id: 'b' });
      const r = await svc.getTopArticles(1);
      expect(r.length).toBe(1);
    });
  });

  describe('getUserRanking()', () => {
    it('ranks by views', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await seedArticle({ authorId: u1.id, viewCount: 100 });
      await seedArticle({ authorId: u2.id, viewCount: 200 });
      const r = await svc.getUserRanking(2);
      expect(r[0]!.userId).toBe(u2.id);
    });
  });
});
