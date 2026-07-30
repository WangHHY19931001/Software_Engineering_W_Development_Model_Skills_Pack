/**
 * 视图记录服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ViewRecordService } from '../../src/services/view-record.service.js';
import { ViewRecordRepository } from '../../src/repositories/view-record.repository.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { ArticleStatus, type Article } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';
import { NotFoundError } from '../../src/utils/errors.js';

describe('ViewRecordService', () => {
  let viewRepo: ViewRecordRepository;
  let articleRepo: ArticleRepository;
  let svc: ViewRecordService;

  beforeEach(() => {
    viewRepo = new ViewRecordRepository();
    articleRepo = new ArticleRepository();
    svc = new ViewRecordService(viewRepo, articleRepo);
  });

  async function seedArticle(): Promise<Article> {
    const a: Article = {
      id: generateId('article'),
      authorId: 'a1',
      title: 't',
      content: 'c',
      summary: '',
      status: ArticleStatus.PUBLISHED,
      tagIds: [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await articleRepo.create(a);
    return a;
  }

  describe('recordView()', () => {
    it('should record view', async () => {
      const a = await seedArticle();
      const r = await svc.recordView({ postId: a.id, userId: 'u1', ip: '1.1.1.1', userAgent: 'ua', referer: 'ref' });
      expect(r.postId).toBe(a.id);
    });

    it('should increment article view count', async () => {
      const a = await seedArticle();
      await svc.recordView({ postId: a.id, userId: 'u1', ip: '1.1.1.1', userAgent: 'ua' });
      const updated = await articleRepo.findById(a.id);
      expect(updated?.viewCount).toBe(1);
    });

    it('should throw NotFoundError on missing article', async () => {
      await expect(
        svc.recordView({ postId: 'm', userId: null, ip: '1.1.1.1', userAgent: '' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should allow null user', async () => {
      const a = await seedArticle();
      const r = await svc.recordView({ postId: a.id, userId: null, ip: '1.1.1.1', userAgent: '' });
      expect(r.userId).toBeNull();
    });
  });

  describe('getByPost/countViews/countUniqueVisitors', () => {
    beforeEach(async () => {
      const a = await seedArticle();
      await svc.recordView({ postId: a.id, userId: 'u1', ip: '1.1.1.1', userAgent: 'ua' });
      await svc.recordView({ postId: a.id, userId: 'u1', ip: '1.1.1.1', userAgent: 'ua' });
      await svc.recordView({ postId: a.id, userId: 'u2', ip: '2.2.2.2', userAgent: 'ua' });
      await svc.recordView({ postId: a.id, userId: null, ip: '3.3.3.3', userAgent: 'ua' });
      await svc.recordView({ postId: a.id, userId: null, ip: '3.3.3.3', userAgent: 'ua' });
    });

    it('getByPost returns all', async () => {
      const a = await articleRepo.findBy((x) => x.authorId === 'a1');
      const r = await svc.getByPost(a[0]!.id);
      expect(r.length).toBe(5);
    });

    it('countViews', async () => {
      const a = await articleRepo.findBy((x) => x.authorId === 'a1');
      const c = await svc.countViews(a[0]!.id);
      expect(c).toBe(5);
    });

    it('countUniqueVisitors', async () => {
      const a = await articleRepo.findBy((x) => x.authorId === 'a1');
      const c = await svc.countUniqueVisitors(a[0]!.id);
      expect(c).toBe(3);
    });
  });
});
