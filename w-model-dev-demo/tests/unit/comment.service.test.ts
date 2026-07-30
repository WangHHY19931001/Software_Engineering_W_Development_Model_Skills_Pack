/**
 * 评论服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommentService } from '../../src/services/comment.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { CommentRepository } from '../../src/repositories/comment.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { AuthService } from '../../src/services/auth.service.js';
import { UserRole } from '../../src/types/index.js';
import { AppError, ErrorCode, ForbiddenError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('CommentService', () => {
  let commentRepo: CommentRepository;
  let articleRepo: ArticleRepository;
  let userRepo: UserRepository;
  let bloggerRepo: BloggerRepository;
  let tagRepo: TagRepository;
  let svc: CommentService;
  let articleSvc: ArticleService;
  let auth: AuthService;
  let nextUserNum = 0;

  beforeEach(() => {
    commentRepo = new CommentRepository();
    articleRepo = new ArticleRepository();
    userRepo = new UserRepository();
    bloggerRepo = new BloggerRepository();
    tagRepo = new TagRepository();
    svc = new CommentService(commentRepo, articleRepo, userRepo);
    articleSvc = new ArticleService(articleRepo, userRepo, tagRepo, commentRepo);
    auth = new AuthService(userRepo, bloggerRepo);
    nextUserNum = 0;
  });

  async function makeUser(role: UserRole = UserRole.BLOGGER): Promise<string> {
    nextUserNum += 1;
    const r = await auth.register({
      email: `u${nextUserNum}@e.com`,
      username: `user${nextUserNum}`,
      password: 'password123',
      role,
    });
    return r.user.id;
  }

  async function makeArticle(authorId: string, status: 'draft' | 'published' = 'published'): Promise<string> {
    const a = await articleSvc.create(authorId, { title: 't', content: 'c' });
    if (status === 'published') {
      await articleSvc.transition(a.id, authorId, 'publish');
    }
    return a.id;
  }

  describe('create()', () => {
    it('should create a top-level comment', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'hello' });
      expect(c.content).toBe('hello');
      expect(c.parentId).toBeNull();
    });

    it('should create a reply', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const parent = await svc.create({ postId, authorId: userId, content: 'parent' });
      const reply = await svc.create({ postId, authorId: userId, content: 'reply', parentId: parent.id });
      expect(reply.parentId).toBe(parent.id);
    });

    it('should throw NotFoundError on missing article', async () => {
      const userId = await makeUser();
      await expect(
        svc.create({ postId: 'missing', authorId: userId, content: 'x' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ValidationError on unpublished article', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId, 'draft');
      await expect(
        svc.create({ postId, authorId: userId, content: 'x' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw NotFoundError on missing user', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await expect(
        svc.create({ postId, authorId: 'missing', content: 'x' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw NotFoundError on missing parent', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await expect(
        svc.create({ postId, authorId: userId, parentId: 'missing', content: 'x' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw on parent comment from different post', async () => {
      const u1 = await makeUser();
      const u2 = await makeUser();
      const postA = await makeArticle(u1);
      const postB = await makeArticle(u1);
      const parent = await svc.create({ postId: postA, authorId: u1, content: 'x' });
      await expect(
        svc.create({ postId: postB, authorId: u2, parentId: parent.id, content: 'y' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on empty content', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await expect(
        svc.create({ postId, authorId: userId, content: '' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should increment article comment count', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await svc.create({ postId, authorId: userId, content: 'x' });
      const a = await articleSvc.getById(postId);
      expect(a.commentCount).toBe(1);
    });
  });

  describe('update()', () => {
    it('should update own comment', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'old' });
      const r = await svc.update(c.id, userId, { content: 'new' });
      expect(r.content).toBe('new');
    });

    it('should throw ForbiddenError for other user', async () => {
      const u1 = await makeUser();
      const u2 = await makeUser();
      const postId = await makeArticle(u1);
      const c = await svc.create({ postId, authorId: u1, content: 'x' });
      await expect(svc.update(c.id, u2, { content: 'new' })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing comment', async () => {
      const userId = await makeUser();
      await expect(
        svc.update('missing', userId, { content: 'x' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ValidationError on empty content', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'x' });
      await expect(svc.update(c.id, userId, { content: '' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('delete()', () => {
    it('should soft-delete own comment', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'x' });
      await svc.delete(c.id, userId);
      const r = await svc.getById(c.id);
      expect(r.status).toBe('deleted');
    });

    it('should decrement article comment count', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'x' });
      await svc.delete(c.id, userId);
      const a = await articleSvc.getById(postId);
      expect(a.commentCount).toBe(0);
    });

    it('should throw ForbiddenError for non-owner non-admin', async () => {
      const u1 = await makeUser();
      const u2 = await makeUser();
      const postId = await makeArticle(u1);
      const c = await svc.create({ postId, authorId: u1, content: 'x' });
      await expect(svc.delete(c.id, u2)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should allow admin to delete any comment', async () => {
      const u1 = await makeUser();
      const adminId = await makeUser(UserRole.ADMIN);
      const postId = await makeArticle(u1);
      const c = await svc.create({ postId, authorId: u1, content: 'x' });
      await svc.delete(c.id, adminId, true);
    });

    it('should throw NotFoundError on missing', async () => {
      const userId = await makeUser();
      await expect(svc.delete('missing', userId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getTreeByPost()', () => {
    it('should build tree', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const p = await svc.create({ postId, authorId: userId, content: 'parent' });
      await svc.create({ postId, authorId: userId, content: 'child1', parentId: p.id });
      await svc.create({ postId, authorId: userId, content: 'child2', parentId: p.id });
      const tree = await svc.getTreeByPost(postId);
      expect(tree.length).toBe(1);
      expect(tree[0]!.id).toBe(p.id);
      expect(tree[0]!.children.length).toBe(2);
    });

    it('should throw NotFoundError on missing post', async () => {
      await expect(svc.getTreeByPost('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should not include deleted comments', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'x' });
      await svc.delete(c.id, userId);
      const tree = await svc.getTreeByPost(postId);
      expect(tree.length).toBe(0);
    });
  });

  describe('list*()', () => {
    it('listByPost returns visible comments', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await svc.create({ postId, authorId: userId, content: 'x' });
      const r = await svc.listByPost(postId);
      expect(r.length).toBe(1);
    });

    it('listByAuthor returns comments by user', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await svc.create({ postId, authorId: userId, content: 'x' });
      const r = await svc.listByAuthor(userId);
      expect(r.length).toBe(1);
    });

    it('countByPost returns count', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      await svc.create({ postId, authorId: userId, content: 'x' });
      const c = await svc.countByPost(postId);
      expect(c).toBe(1);
    });
  });

  describe('getById()', () => {
    it('should return comment', async () => {
      const userId = await makeUser();
      const postId = await makeArticle(userId);
      const c = await svc.create({ postId, authorId: userId, content: 'x' });
      const r = await svc.getById(c.id);
      expect(r.id).toBe(c.id);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('error codes', () => {
    it('AppError code for ValidationError', async () => {
      try {
        await svc.create({ postId: 'x', authorId: 'y', content: '' });
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });
  });
});
