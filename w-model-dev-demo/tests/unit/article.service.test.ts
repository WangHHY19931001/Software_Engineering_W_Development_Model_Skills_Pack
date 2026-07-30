/**
 * 文章服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../src/services/article.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { CommentRepository } from '../../src/repositories/comment.repository.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleStatus, UserRole } from '../../src/types/index.js';
import { AppError, ErrorCode, ForbiddenError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('ArticleService', () => {
  let articleRepo: ArticleRepository;
  let userRepo: UserRepository;
  let tagRepo: TagRepository;
  let commentRepo: CommentRepository;
  let bloggerRepo: BloggerRepository;
  let svc: ArticleService;
  let auth: AuthService;

  beforeEach(() => {
    articleRepo = new ArticleRepository();
    userRepo = new UserRepository();
    tagRepo = new TagRepository();
    commentRepo = new CommentRepository();
    bloggerRepo = new BloggerRepository();
    svc = new ArticleService(articleRepo, userRepo, tagRepo, commentRepo);
    auth = new AuthService(userRepo, bloggerRepo);
  });

  let nextUserNum = 0;
  async function makeBlogger(): Promise<string> {
    nextUserNum += 1;
    const r = await auth.register({
      email: `b${nextUserNum}@e.com`,
      username: `blogger${nextUserNum}`,
      password: 'password123',
      role: UserRole.BLOGGER,
    });
    return r.user.id;
  }

  async function makeReader(): Promise<string> {
    nextUserNum += 1;
    const r = await auth.register({
      email: `r${nextUserNum}@e.com`,
      username: `reader${nextUserNum}`,
      password: 'password123',
    });
    return r.user.id;
  }

  describe('create()', () => {
    it('should create a draft article for blogger', async () => {
      const userId = await makeBlogger();
      const article = await svc.create(userId, {
        title: 'Hello',
        content: 'World',
        summary: 'Sum',
        tagIds: [],
      });
      expect(article.status).toBe(ArticleStatus.DRAFT);
      expect(article.title).toBe('Hello');
      expect(article.authorId).toBe(userId);
    });

    it('should throw ValidationError on missing title', async () => {
      const userId = await makeBlogger();
      await expect(svc.create(userId, { title: '', content: 'x' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ForbiddenError for reader', async () => {
      const userId = await makeReader();
      await expect(
        svc.create(userId, { title: 't', content: 'c' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing user', async () => {
      await expect(
        svc.create('missing', { title: 't', content: 'c' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should accept admin role', async () => {
      nextUserNum += 1;
      const r = await auth.register({
        email: `a${nextUserNum}@e.com`, username: `admin${nextUserNum}`, password: 'password123', role: UserRole.ADMIN,
      });
      const article = await svc.create(r.user.id, { title: 't', content: 'c' });
      expect(article.authorId).toBe(r.user.id);
    });

    it('should set viewCount=0 and likeCount=0', async () => {
      const userId = await makeBlogger();
      const article = await svc.create(userId, { title: 't', content: 'c' });
      expect(article.viewCount).toBe(0);
      expect(article.likeCount).toBe(0);
      expect(article.favoriteCount).toBe(0);
      expect(article.commentCount).toBe(0);
    });
  });

  describe('update()', () => {
    it('should update own article', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 'old', content: 'old' });
      const updated = await svc.update(a.id, userId, { title: 'new' });
      expect(updated.title).toBe('new');
    });

    it('should throw ForbiddenError for non-owner', async () => {
      const a = await svc.create(await makeBlogger(), { title: 't', content: 'c' });
      const otherId = await makeBlogger();
      await expect(svc.update(a.id, otherId, { title: 'new' })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing article', async () => {
      const userId = await makeBlogger();
      await expect(svc.update('missing', userId, { title: 't' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw on update of deleted article', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.transition(a.id, userId, 'delete');
      await expect(svc.update(a.id, userId, { title: 'new' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw ValidationError on invalid data', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await expect(svc.update(a.id, userId, { title: '' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('transition()', () => {
    it('should publish draft to published', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      const r = await svc.transition(a.id, userId, 'publish');
      expect(r.status).toBe(ArticleStatus.PUBLISHED);
      expect(r.publishedAt).toBeGreaterThan(0);
    });

    it('should throw on publish empty content', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: '' });
      await expect(svc.transition(a.id, userId, 'publish')).rejects.toBeInstanceOf(AppError);
    });

    it('should unpublish back to draft', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.transition(a.id, userId, 'publish');
      const r = await svc.transition(a.id, userId, 'unpublish');
      expect(r.status).toBe(ArticleStatus.DRAFT);
    });

    it('should archive published', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.transition(a.id, userId, 'publish');
      const r = await svc.transition(a.id, userId, 'archive');
      expect(r.status).toBe(ArticleStatus.ARCHIVED);
    });

    it('should throw on invalid transition', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await expect(svc.transition(a.id, userId, 'archive')).rejects.toBeInstanceOf(AppError);
    });

    it('should throw ForbiddenError for non-owner', async () => {
      const a = await svc.create(await makeBlogger(), { title: 't', content: 'c' });
      const otherId = await makeBlogger();
      await expect(svc.transition(a.id, otherId, 'publish')).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing article', async () => {
      const userId = await makeBlogger();
      await expect(svc.transition('missing', userId, 'publish')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should unarchive archived article to draft', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.transition(a.id, userId, 'publish');
      await svc.transition(a.id, userId, 'archive');
      const r = await svc.transition(a.id, userId, 'unarchive');
      expect(r.status).toBe(ArticleStatus.DRAFT);
    });
  });

  describe('getById()', () => {
    it('should return existing article', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      const r = await svc.getById(a.id);
      expect(r.id).toBe(a.id);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getPublishedById()', () => {
    it('should return published article', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.transition(a.id, userId, 'publish');
      const r = await svc.getPublishedById(a.id);
      expect(r.status).toBe(ArticleStatus.PUBLISHED);
    });

    it('should throw on draft', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await expect(svc.getPublishedById(a.id)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('list*()', () => {
    it('listByAuthor returns paginated', async () => {
      const userId = await makeBlogger();
      await svc.create(userId, { title: 't1', content: 'c' });
      await svc.create(userId, { title: 't2', content: 'c' });
      const r = await svc.listByAuthor(userId, 1, 10);
      expect(r.items.length).toBe(2);
      expect(r.total).toBe(2);
    });

    it('listPublished filters only published', async () => {
      const userId = await makeBlogger();
      const a1 = await svc.create(userId, { title: 't1', content: 'c' });
      const a2 = await svc.create(userId, { title: 't2', content: 'c' });
      await svc.transition(a2.id, userId, 'publish');
      const r = await svc.listPublished(1, 10);
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.id).toBe(a2.id);
      void a1;
    });

    it('listByStatus filters by status', async () => {
      const userId = await makeBlogger();
      await svc.create(userId, { title: 't1', content: 'c' });
      const r = await svc.listByStatus(ArticleStatus.DRAFT, 1, 10);
      expect(r.items.length).toBe(1);
    });

    it('search returns keyword matches', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 'typescript', content: 'static typing' });
      await svc.transition(a.id, userId, 'publish');
      const r = await svc.search({ keyword: 'typescript' });
      expect(r.items.length).toBeGreaterThan(0);
    });

    it('search with empty keyword returns empty', async () => {
      const userId = await makeBlogger();
      await svc.create(userId, { title: 't', content: 'c' });
      const r = await svc.search({ keyword: 'no-match-xyz' });
      expect(r.items.length).toBe(0);
    });

    it('listByTag filters by tag', async () => {
      const userId = await makeBlogger();
      const tag = await tagRepo.create({ id: 'tag_1', name: 't1', slug: 't1', createdAt: Date.now() });
      const a = await svc.create(userId, { title: 't', content: 'c', tagIds: ['tag_1'] });
      await svc.transition(a.id, userId, 'publish');
      const r = await svc.listByTag('tag_1', 1, 10);
      expect(r.items.length).toBe(1);
      expect(tag.id).toBe('tag_1');
    });
  });

  describe('deleteArticle()', () => {
    it('should mark deleted', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.deleteArticle(a.id, userId);
      const r = await svc.getById(a.id);
      expect(r.status).toBe(ArticleStatus.DELETED);
    });

    it('should throw ForbiddenError for non-owner', async () => {
      const a = await svc.create(await makeBlogger(), { title: 't', content: 'c' });
      const other = await makeBlogger();
      await expect(svc.deleteArticle(a.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should be idempotent on already deleted', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.deleteArticle(a.id, userId);
      await svc.deleteArticle(a.id, userId);
    });

    it('should throw NotFoundError on missing', async () => {
      const userId = await makeBlogger();
      await expect(svc.deleteArticle('missing', userId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getStats()', () => {
    it('should aggregate stats', async () => {
      const userId = await makeBlogger();
      const a1 = await svc.create(userId, { title: 't1', content: 'c' });
      await svc.create(userId, { title: 't2', content: 'c' });
      await svc.transition(a1.id, userId, 'publish');
      const stats = await svc.getStats(userId);
      expect(stats.total).toBe(2);
      expect(stats.draft).toBe(1);
      expect(stats.published).toBe(1);
    });
  });

  describe('addTag/removeTag()', () => {
    it('should add tag to article', async () => {
      const userId = await makeBlogger();
      await tagRepo.create({ id: 'tag_1', name: 't1', slug: 't1', createdAt: Date.now() });
      const a = await svc.create(userId, { title: 't', content: 'c' });
      const r = await svc.addTag(a.id, 'tag_1', userId);
      expect(r.tagIds).toContain('tag_1');
    });

    it('should not duplicate existing tag', async () => {
      const userId = await makeBlogger();
      await tagRepo.create({ id: 'tag_1', name: 't1', slug: 't1', createdAt: Date.now() });
      const a = await svc.create(userId, { title: 't', content: 'c', tagIds: ['tag_1'] });
      const r = await svc.addTag(a.id, 'tag_1', userId);
      expect(r.tagIds.filter((t) => t === 'tag_1').length).toBe(1);
    });

    it('should throw NotFoundError on missing tag', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await expect(svc.addTag(a.id, 'missing', userId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ForbiddenError for non-owner addTag', async () => {
      const userId = await makeBlogger();
      await tagRepo.create({ id: 'tag_1', name: 't1', slug: 't1', createdAt: Date.now() });
      const a = await svc.create(userId, { title: 't', content: 'c' });
      const other = await makeBlogger();
      await expect(svc.addTag(a.id, 'tag_1', other)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should remove tag from article', async () => {
      const userId = await makeBlogger();
      await tagRepo.create({ id: 'tag_1', name: 't1', slug: 't1', createdAt: Date.now() });
      const a = await svc.create(userId, { title: 't', content: 'c', tagIds: ['tag_1'] });
      const r = await svc.removeTag(a.id, 'tag_1', userId);
      expect(r.tagIds).not.toContain('tag_1');
    });

    it('should throw NotFoundError on removeTag missing article', async () => {
      const userId = await makeBlogger();
      await expect(svc.removeTag('missing', 'tag_1', userId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('incrementView()', () => {
    it('should increment view count', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      await svc.incrementView(a.id);
      const r = await svc.getById(a.id);
      expect(r.viewCount).toBe(1);
    });

    it('should return null on missing', async () => {
      const r = await svc.incrementView('missing');
      expect(r).toBeNull();
    });
  });

  describe('getByIdAndAuthor()', () => {
    it('should return own article', async () => {
      const userId = await makeBlogger();
      const a = await svc.create(userId, { title: 't', content: 'c' });
      const r = await svc.getByIdAndAuthor(a.id, userId);
      expect(r.id).toBe(a.id);
    });

    it('should throw ForbiddenError for other', async () => {
      const a = await svc.create(await makeBlogger(), { title: 't', content: 'c' });
      const other = await makeBlogger();
      await expect(svc.getByIdAndAuthor(a.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing', async () => {
      const userId = await makeBlogger();
      await expect(svc.getByIdAndAuthor('missing', userId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
