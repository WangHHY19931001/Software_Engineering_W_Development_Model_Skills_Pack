/**
 * 推荐服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendService } from '../../src/services/recommend.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { ArticleStatus, type Article } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';

describe('RecommendService', () => {
  let articleRepo: ArticleRepository;
  let tagRepo: TagRepository;
  let svc: RecommendService;

  beforeEach(() => {
    articleRepo = new ArticleRepository();
    tagRepo = new TagRepository();
    svc = new RecommendService(articleRepo, tagRepo);
  });

  async function seedArticle(input: Partial<Article> = {}): Promise<Article> {
    const a: Article = {
      id: input.id ?? generateId('article'),
      authorId: input.authorId ?? 'a1',
      title: input.title ?? 'title',
      content: input.content ?? 'c',
      summary: input.summary ?? '',
      status: input.status ?? ArticleStatus.PUBLISHED,
      tagIds: input.tagIds ?? [],
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

  describe('recommendByTags()', () => {
    it('returns similar articles by tag', async () => {
      await seedArticle({ id: 'base', tagIds: ['t1', 't2'] });
      await seedArticle({ id: 'sim', tagIds: ['t1'] });
      await seedArticle({ id: 'diff', tagIds: ['t3'] });
      const r = await svc.recommendByTags('base', 5);
      expect(r.map((a) => a.id)).toContain('sim');
      expect(r.map((a) => a.id)).not.toContain('base');
    });

    it('returns empty for missing base', async () => {
      const r = await svc.recommendByTags('missing', 5);
      expect(r.length).toBe(0);
    });

    it('limits results', async () => {
      await seedArticle({ id: 'base', tagIds: ['t1'] });
      for (let i = 0; i < 10; i += 1) {
        await seedArticle({ id: `a${i}`, tagIds: ['t1'] });
      }
      const r = await svc.recommendByTags('base', 3);
      expect(r.length).toBe(3);
    });

    it('returns empty for no overlapping tags', async () => {
      await seedArticle({ id: 'base', tagIds: ['t1'] });
      await seedArticle({ id: 'diff', tagIds: ['t2'] });
      const r = await svc.recommendByTags('base', 5);
      expect(r.length).toBe(0);
    });
  });

  describe('popular()', () => {
    it('returns top by views', async () => {
      await seedArticle({ id: 'a', viewCount: 100 });
      await seedArticle({ id: 'b', viewCount: 200 });
      await seedArticle({ id: 'c', viewCount: 50 });
      const r = await svc.popular(3);
      expect(r[0]!.id).toBe('b');
      expect(r[1]!.id).toBe('a');
    });

    it('limits results', async () => {
      await seedArticle({ id: 'a' });
      await seedArticle({ id: 'b' });
      const r = await svc.popular(1);
      expect(r.length).toBe(1);
    });

    it('skips non-published', async () => {
      await seedArticle({ id: 'a', status: ArticleStatus.DRAFT, viewCount: 100 });
      await seedArticle({ id: 'b', viewCount: 50 });
      const r = await svc.popular(5);
      expect(r.map((a) => a.id)).not.toContain('a');
    });
  });

  describe('recent()', () => {
    it('returns by publishedAt desc', async () => {
      await seedArticle({ id: 'old', publishedAt: 1000 });
      await seedArticle({ id: 'new', publishedAt: 2000 });
      const r = await svc.recent(2);
      expect(r[0]!.id).toBe('new');
    });

    it('limits results', async () => {
      await seedArticle({ id: 'a' });
      await seedArticle({ id: 'b' });
      const r = await svc.recent(1);
      expect(r.length).toBe(1);
    });
  });

  describe('byAuthor()', () => {
    it('returns author published', async () => {
      await seedArticle({ id: 'a1', authorId: 'u1' });
      await seedArticle({ id: 'a2', authorId: 'u1', status: ArticleStatus.DRAFT });
      await seedArticle({ id: 'a3', authorId: 'u2' });
      const r = await svc.byAuthor('u1', null, 10);
      expect(r.length).toBe(1);
    });

    it('excludes given id', async () => {
      await seedArticle({ id: 'a1', authorId: 'u1' });
      await seedArticle({ id: 'a2', authorId: 'u1' });
      const r = await svc.byAuthor('u1', 'a1', 10);
      expect(r.length).toBe(1);
    });
  });

  describe('related()', () => {
    it('returns paginated', async () => {
      await seedArticle({ id: 'base', tagIds: ['t1'] });
      await seedArticle({ id: 'sim', tagIds: ['t1'] });
      const r = await svc.related('base', 1, 5);
      expect(r.items.length).toBe(1);
    });
  });

  describe('getTopTags()', () => {
    it('counts tag usage', async () => {
      await seedArticle({ id: 'a', tagIds: ['t1', 't2'] });
      await seedArticle({ id: 'b', tagIds: ['t1'] });
      const r = await svc.getTopTags();
      expect(r[0]!.tagId).toBe('t1');
      expect(r[0]!.count).toBe(2);
    });
  });

  describe('listAllTags()', () => {
    it('returns tag list', async () => {
      await tagRepo.create({ id: 't1', name: 'Tag 1', slug: 'tag-1', createdAt: Date.now() });
      const r = await svc.listAllTags();
      expect(r.length).toBe(1);
    });
  });
});
