/**
 * 搜索服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from '../../src/services/search.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { ArticleStatus, type User } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';

describe('SearchService', () => {
  let articleRepo: ArticleRepository;
  let tagRepo: TagRepository;
  let userRepo: UserRepository;
  let svc: SearchService;

  beforeEach(() => {
    articleRepo = new ArticleRepository();
    tagRepo = new TagRepository();
    userRepo = new UserRepository();
    svc = new SearchService(articleRepo, tagRepo, userRepo);
  });

  async function seedArticle(authorId: string, title: string, status: ArticleStatus = ArticleStatus.PUBLISHED) {
    await articleRepo.create({
      id: generateId('article'),
      authorId,
      title,
      content: 'content',
      summary: '',
      status,
      tagIds: [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: status === ArticleStatus.PUBLISHED ? Date.now() : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  async function seedUser(): Promise<User> {
    const u: User = {
      id: generateId('user'),
      email: 'u@e.com',
      passwordHash: 'h',
      username: 'tester',
      nickname: 'Tester',
      role: 'reader' as never,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await userRepo.create(u);
    return u;
  }

  describe('searchArticles()', () => {
    it('returns matching articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id, 'typescript intro');
      const r = await svc.searchArticles('typescript');
      expect(r.items.length).toBe(1);
    });

    it('skips draft articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id, 'typescript draft', ArticleStatus.DRAFT);
      const r = await svc.searchArticles('typescript');
      expect(r.items.length).toBe(0);
    });

    it('returns empty for no match', async () => {
      const u = await seedUser();
      await seedArticle(u.id, 'title');
      const r = await svc.searchArticles('xyz123');
      expect(r.items.length).toBe(0);
    });

    it('paginate', async () => {
      const u = await seedUser();
      for (let i = 0; i < 5; i += 1) {
        await seedArticle(u.id, `ts article ${i}`);
      }
      const r = await svc.searchArticles('ts', 1, 2);
      expect(r.items.length).toBe(2);
      expect(r.total).toBe(5);
    });
  });

  describe('searchAll()', () => {
    it('returns mixed results', async () => {
      const u = await seedUser();
      await seedArticle(u.id, 'typescript intro');
      await tagRepo.create({ id: 'tag_1', name: 'typescript', slug: 'typescript', createdAt: Date.now() });
      const r = await svc.searchAll('typescript');
      expect(r.length).toBeGreaterThan(0);
    });

    it('empty for empty keyword', async () => {
      const r = await svc.searchAll('');
      expect(r.length).toBe(0);
    });

    it('matches by tag slug', async () => {
      await tagRepo.create({ id: 'tag_1', name: 'Tag Name', slug: 'special-slug', createdAt: Date.now() });
      const r = await svc.searchAll('special-slug');
      expect(r.length).toBe(1);
    });

    it('matches by username/nickname', async () => {
      await userRepo.create({
        id: 'u1', email: 'a@b.com', passwordHash: 'h', username: 'specialname', nickname: 'Special',
        role: 'reader' as never, createdAt: Date.now(), updatedAt: Date.now(),
      });
      const r = await svc.searchAll('specialname');
      expect(r.length).toBe(1);
    });
  });

  describe('searchByTag()', () => {
    it('returns tagged articles', async () => {
      const u = await seedUser();
      await articleRepo.create({
        id: 'a1',
        authorId: u.id,
        title: 't',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: ['tag_1'],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const r = await svc.searchByTag('tag_1');
      expect(r.items.length).toBe(1);
    });
  });

  describe('searchByAuthor()', () => {
    it('returns author articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id, 't1');
      await seedArticle(u.id, 't2');
      const r = await svc.searchByAuthor(u.id);
      expect(r.items.length).toBe(2);
    });
  });
});
