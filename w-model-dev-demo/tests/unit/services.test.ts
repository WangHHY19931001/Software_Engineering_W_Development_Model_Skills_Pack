// 服务层单元测试：UT-010~016, UT-026, UT-030
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service';
import { ArticleService } from '../../src/services/article.service';
import { CommentService } from '../../src/services/comment.service';
import { UserService } from '../../src/services/user.service';
import { ReviewService } from '../../src/services/review.service';
import { AppError } from '../../src/utils/errors';
import type { User, Article } from '../../src/types';

// ============ UT-010 / UT-011: AuthService ============
describe('UT-010: AuthService.register 正向——bcrypt 哈希存储', () => {
  it('注册新用户，bcrypt 哈希密码后存入，返回 userId', async () => {
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: null }),
      saveUser: vi.fn().mockReturnValue({ ok: true, data: undefined }),
    };
    const mockJwtUtil = { sign: vi.fn(), verify: vi.fn() };
    const mockPasswordUtil = {
      hash: vi.fn().mockReturnValue('$2b$10$hashmock'),
      compare: vi.fn(),
    };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.register('alice', 'secret123');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBeDefined();
    }
    expect(mockPasswordUtil.hash).toHaveBeenCalledWith('secret123');
    expect(mockUserService.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        passwordHash: expect.stringMatching(/^\$2/),
      }),
    );
  });

  it('注册已存在用户名返回 60001', async () => {
    const existingUser: User = {
      id: 'u-old',
      username: 'alice',
      passwordHash: '$2b$10$old',
      role: 'user',
      createdAt: 'ts',
    };
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: existingUser }),
      saveUser: vi.fn(),
    };
    const mockJwtUtil = { sign: vi.fn(), verify: vi.fn() };
    const mockPasswordUtil = { hash: vi.fn(), compare: vi.fn() };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.register('alice', 'secret123');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(60001);
    }
    expect(mockPasswordUtil.hash).not.toHaveBeenCalled();
  });

  it('注册用户名 admin 自动获得管理员角色', async () => {
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: null }),
      saveUser: vi.fn().mockReturnValue({ ok: true, data: undefined }),
    };
    const mockJwtUtil = { sign: vi.fn(), verify: vi.fn() };
    const mockPasswordUtil = {
      hash: vi.fn().mockReturnValue('$2b$10$hashmock'),
      compare: vi.fn(),
    };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.register('admin', 'secret123');
    expect(result.ok).toBe(true);
    expect(mockUserService.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
    );
  });
});

describe('UT-011: AuthService.login 正向——JWT 签发', () => {
  it('已注册用户登录，bcrypt 比对密码成功后签发 JWT', async () => {
    const user: User = {
      id: 'u-1',
      username: 'alice',
      passwordHash: '$2b$10$hash',
      role: 'user',
      createdAt: 'ts',
    };
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: user }),
      saveUser: vi.fn(),
    };
    const mockJwtUtil = { sign: vi.fn().mockReturnValue('jwt-token-xxx'), verify: vi.fn() };
    const mockPasswordUtil = {
      hash: vi.fn(),
      compare: vi.fn().mockReturnValue(true),
    };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.login('alice', 'secret123');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.token).toBe('jwt-token-xxx');
      expect(result.data.role).toBe('user');
    }
    expect(mockPasswordUtil.compare).toHaveBeenCalledWith('secret123', '$2b$10$hash');
    expect(mockJwtUtil.sign).toHaveBeenCalledWith({ userId: 'u-1', role: 'user' });
  });

  it('用户不存在返回 40101', async () => {
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: null }),
      saveUser: vi.fn(),
    };
    const mockJwtUtil = { sign: vi.fn(), verify: vi.fn() };
    const mockPasswordUtil = { hash: vi.fn(), compare: vi.fn() };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.login('ghost', 'secret123');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(40101);
    }
  });

  it('密码错误返回 40101', async () => {
    const user: User = {
      id: 'u-1',
      username: 'alice',
      passwordHash: '$2b$10$hash',
      role: 'user',
      createdAt: 'ts',
    };
    const mockUserService = {
      findByUsername: vi.fn().mockReturnValue({ ok: true, data: user }),
      saveUser: vi.fn(),
    };
    const mockJwtUtil = { sign: vi.fn(), verify: vi.fn() };
    const mockPasswordUtil = {
      hash: vi.fn(),
      compare: vi.fn().mockReturnValue(false),
    };

    const authService = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtUtil as never,
      mockPasswordUtil as never,
    );

    const result = await authService.login('alice', 'wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(40101);
    }
  });
});

// ============ UT-012 / UT-013 / UT-026: ArticleService ============
describe('UT-012: ArticleService.publish 正向——status=pending', () => {
  it('发布新文章，初始状态为 pending，存入 ArticleStore', () => {
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    const result = articleService.publish('u-1', '标题', '正文');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('pending');
      expect(result.data.articleId).toBeDefined();
    }
    expect(mockArticleStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 'u-1',
        title: '标题',
        status: 'pending',
      }),
    );
  });
});

describe('UT-013: ArticleService.list 过滤——user 角色不含 rejected', () => {
  it('普通用户列表不含 rejected 文章', () => {
    const articles: Article[] = [
      { id: 'a1', title: 't1', content: 'c1', status: 'pending', authorId: 'u-1', createdAt: 'ts' },
      { id: 'a2', title: 't2', content: 'c2', status: 'approved', authorId: 'u-1', createdAt: 'ts' },
      { id: 'a3', title: 't3', content: 'c3', status: 'rejected', authorId: 'u-1', createdAt: 'ts' },
    ];
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn().mockReturnValue(articles),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    const userResult = articleService.list('user');
    expect(userResult.ok).toBe(true);
    if (userResult.ok) {
      expect(userResult.data.map(a => a.id)).toEqual(['a1', 'a2']);
      expect(userResult.data.find(a => a.status === 'rejected')).toBeUndefined();
    }

    const adminResult = articleService.list('admin');
    expect(adminResult.ok).toBe(true);
    if (adminResult.ok) {
      expect(adminResult.data).toHaveLength(3);
    }
  });
});

describe('ArticleService.getById', () => {
  it('文章不存在抛 40401', () => {
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(null),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    expect(() => articleService.getById('a-999', 'admin')).toThrow(AppError);
  });

  it('普通用户访问 rejected 文章抛 40301', () => {
    const article: Article = {
      id: 'a-3',
      title: 't',
      content: 'c',
      status: 'rejected',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    expect(() => articleService.getById('a-3', 'user')).toThrow(AppError);
  });

  it('管理员可访问 rejected 文章', () => {
    const article: Article = {
      id: 'a-3',
      title: 't',
      content: 'c',
      status: 'rejected',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    expect(articleService.getById('a-3', 'admin').id).toBe('a-3');
  });
});

describe('UT-026: ArticleService.publish 空 title/content 边界', () => {
  it('title 空返回失败 40001', () => {
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    const r1 = articleService.publish('u-1', '', '正文');
    expect(r1.ok).toBe(false);
  });

  it('content 空返回失败 40001', () => {
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const articleService = new ArticleService(mockArticleStore as never);

    const r2 = articleService.publish('u-1', '标题', '');
    expect(r2.ok).toBe(false);
  });
});

// ============ UT-014: CommentService ============
describe('UT-014: CommentService.add 校验——文章状态 rejected 返回 60002', () => {
  it('对 rejected 文章添加评论返回 60002，CommentStore.save 未被调用', () => {
    const mockArticleService = {
      getById: vi.fn().mockImplementation(() => {
        throw new AppError(40301, '禁止访问');
      }),
      publish: vi.fn(),
      list: vi.fn(),
    };
    const mockCommentStore = {
      save: vi.fn(),
      findByArticle: vi.fn(),
    };
    const commentService = new CommentService(
      mockArticleService as unknown as ArticleService,
      mockCommentStore as never,
    );

    const result = commentService.add('a-3', 'u-1', '评论');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(60002);
    }
    expect(mockCommentStore.save).not.toHaveBeenCalled();
  });

  it('文章不存在返回 40401', () => {
    const mockArticleService = {
      getById: vi.fn().mockImplementation(() => {
        throw new AppError(40401, '文章不存在');
      }),
      publish: vi.fn(),
      list: vi.fn(),
    };
    const mockCommentStore = {
      save: vi.fn(),
      findByArticle: vi.fn(),
    };
    const commentService = new CommentService(
      mockArticleService as unknown as ArticleService,
      mockCommentStore as never,
    );

    const result = commentService.add('a-999', 'u-1', '评论');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(40401);
    }
  });

  it('评论内容为空返回 40001', () => {
    const mockArticleService = {
      getById: vi.fn(),
      publish: vi.fn(),
      list: vi.fn(),
    };
    const mockCommentStore = {
      save: vi.fn(),
      findByArticle: vi.fn(),
    };
    const commentService = new CommentService(
      mockArticleService as unknown as ArticleService,
      mockCommentStore as never,
    );

    const result = commentService.add('a-1', 'u-1', '');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(40001);
    }
  });

  it('正向添加评论返回 commentId', () => {
    const article: Article = {
      id: 'a-1',
      title: 't',
      content: 'c',
      status: 'approved',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleService = {
      getById: vi.fn().mockReturnValue(article),
      publish: vi.fn(),
      list: vi.fn(),
    };
    const mockCommentStore = {
      save: vi.fn(),
      findByArticle: vi.fn(),
    };
    const commentService = new CommentService(
      mockArticleService as unknown as ArticleService,
      mockCommentStore as never,
    );

    const result = commentService.add('a-1', 'u-1', '好文章');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.commentId).toBeDefined();
    }
    expect(mockCommentStore.save).toHaveBeenCalled();
  });

  it('listByArticle 文章不存在返回失败', () => {
    const mockArticleService = {
      getById: vi.fn().mockImplementation(() => {
        throw new AppError(40401, '文章不存在');
      }),
      publish: vi.fn(),
      list: vi.fn(),
    };
    const mockCommentStore = {
      save: vi.fn(),
      findByArticle: vi.fn(),
    };
    const commentService = new CommentService(
      mockArticleService as unknown as ArticleService,
      mockCommentStore as never,
    );

    const result = commentService.listByArticle('a-999');
    expect(result.ok).toBe(false);
  });
});

// ============ UT-015: UserService ============
describe('UT-015: UserService.saveUser 用户名唯一性校验', () => {
  it('保存新用户成功', () => {
    const mockUserStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findByUsername: vi.fn().mockReturnValue(null),
    };
    const userService = new UserService(mockUserStore as never);

    const ok = userService.saveUser({
      id: 'u-1',
      username: 'alice',
      passwordHash: 'h',
      role: 'user',
      createdAt: 'ts',
    });
    expect(ok.ok).toBe(true);
    expect(mockUserStore.save).toHaveBeenCalled();
  });

  it('重复用户名返回 60001', () => {
    const existing: User = {
      id: 'u-1',
      username: 'alice',
      passwordHash: 'h',
      role: 'user',
      createdAt: 'ts',
    };
    const mockUserStore = {
      save: vi.fn(),
      findById: vi.fn(),
      findByUsername: vi.fn().mockReturnValue(existing),
    };
    const userService = new UserService(mockUserStore as never);

    const dup = userService.saveUser({
      id: 'u-2',
      username: 'alice',
      passwordHash: 'h',
      role: 'user',
      createdAt: 'ts',
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.code).toBe(60001);
    }
    expect(mockUserStore.save).not.toHaveBeenCalled();
  });

  it('findById / findByUsername 透传 store 结果', () => {
    const user: User = {
      id: 'u-1',
      username: 'alice',
      passwordHash: 'h',
      role: 'user',
      createdAt: 'ts',
    };
    const mockUserStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(user),
      findByUsername: vi.fn().mockReturnValue(user),
    };
    const userService = new UserService(mockUserStore as never);

    const findByIdResult = userService.findById('u-1');
    expect(findByIdResult.ok).toBe(true);
    if (findByIdResult.ok) {
      expect(findByIdResult.data?.username).toBe('alice');
    }

    const findByUsernameResult = userService.findByUsername('alice');
    expect(findByUsernameResult.ok).toBe(true);
    if (findByUsernameResult.ok) {
      expect(findByUsernameResult.data?.id).toBe('u-1');
    }
  });
});

// ============ UT-016 / UT-030: ReviewService ============
describe('UT-016: ReviewService.review 正向——pending→approved', () => {
  it('管理员审核 pending 文章为 approved', () => {
    const article: Article = {
      id: 'a-1',
      title: 't',
      content: 'c',
      status: 'pending',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const reviewService = new ReviewService(mockArticleStore as never);

    const result = reviewService.review('a-1', 'approve', 'u-admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('approved');
    }
    expect(mockArticleStore.updateStatus).toHaveBeenCalledWith('a-1', 'approved');
  });

  it('审核 pending 文章为 rejected', () => {
    const article: Article = {
      id: 'a-1',
      title: 't',
      content: 'c',
      status: 'pending',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const reviewService = new ReviewService(mockArticleStore as never);

    const result = reviewService.review('a-1', 'reject', 'u-admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('rejected');
    }
    expect(mockArticleStore.updateStatus).toHaveBeenCalledWith('a-1', 'rejected');
  });

  it('文章不存在返回 40401', () => {
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(null),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const reviewService = new ReviewService(mockArticleStore as never);

    const result = reviewService.review('a-999', 'approve', 'u-admin');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(40401);
    }
    expect(mockArticleStore.updateStatus).not.toHaveBeenCalled();
  });

  it('文章状态非 pending 返回 60002', () => {
    const article: Article = {
      id: 'a-1',
      title: 't',
      content: 'c',
      status: 'approved',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const reviewService = new ReviewService(mockArticleStore as never);

    const result = reviewService.review('a-1', 'approve', 'u-admin');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(60002);
    }
  });
});

describe('UT-030: ReviewService.review 非法 action 值', () => {
  it('action 非 approve/reject 返回 60002', () => {
    const article: Article = {
      id: 'a-1',
      title: 't',
      content: 'c',
      status: 'pending',
      authorId: 'u-1',
      createdAt: 'ts',
    };
    const mockArticleStore = {
      save: vi.fn(),
      findById: vi.fn().mockReturnValue(article),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };
    const reviewService = new ReviewService(mockArticleStore as never);

    // 使用类型断言绕过 TS 检查以测试运行时边界
    const result = reviewService.review('a-1', 'delete' as 'approve', 'u-admin');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(60002);
    }
    expect(mockArticleStore.updateStatus).not.toHaveBeenCalled();
  });
});
