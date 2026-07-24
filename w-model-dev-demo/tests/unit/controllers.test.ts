// 控制器层单元测试：UT-001~009
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../src/controllers/auth.controller';
import { ArticleController } from '../../src/controllers/article.controller';
import { CommentController } from '../../src/controllers/comment.controller';
import type { AuthService } from '../../src/services/auth.service';
import type { ArticleService } from '../../src/services/article.service';
import type { ReviewService } from '../../src/services/review.service';
import type { CommentService } from '../../src/services/comment.service';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function createMockNext() {
  return vi.fn() as unknown as NextFunction;
}

// 辅助：模拟 wrap 行为——调用 async 控制器并捕获 reject 传递给 next
async function runHandler(
  fn: () => Promise<void>,
  next: NextFunction,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    next(e as Error);
  }
}

// ============ UT-001 ~ UT-004: AuthController ============
describe('UT-001: AuthController.register 正向——返回 201 + userId', () => {
  it('注册请求合法，控制器调用 AuthService.register 成功后返回 201 + userId', async () => {
    const mockAuthService = {
      register: vi.fn().mockResolvedValue({ ok: true, data: { userId: 'u-1' } }),
      login: vi.fn(),
    };
    const controller = new AuthController(mockAuthService as unknown as AuthService);
    const req = { body: { username: 'alice', password: 'secret123' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.register(req, res), next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ userId: 'u-1', username: 'alice' }),
      }),
    );
    expect(mockAuthService.register).toHaveBeenCalledWith('alice', 'secret123');
  });
});

describe('UT-002: AuthController.register 异常——用户名已存在返回 409', () => {
  it('AuthService.register 返回失败，控制器抛 AppError 传递到 next', async () => {
    const mockAuthService = {
      register: vi.fn().mockResolvedValue({ ok: false, code: 60001, message: '用户名已存在' }),
      login: vi.fn(),
    };
    const controller = new AuthController(mockAuthService as unknown as AuthService);
    const req = { body: { username: 'alice', password: 'secret123' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.register(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 60001 }));
    expect(mockAuthService.register).toHaveBeenCalledWith('alice', 'secret123');
  });
});

describe('UT-003: AuthController.login 正向——返回 200 + token', () => {
  it('登录凭证正确，控制器调用 AuthService.login 成功后返回 200 + token', async () => {
    const mockAuthService = {
      register: vi.fn(),
      login: vi.fn().mockResolvedValue({
        ok: true,
        data: { token: 'jwt-xxx', role: 'user' },
      }),
    };
    const controller = new AuthController(mockAuthService as unknown as AuthService);
    const req = { body: { username: 'alice', password: 'secret123' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.login(req, res), next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ token: 'jwt-xxx', role: 'user' }),
      }),
    );
    expect(mockAuthService.login).toHaveBeenCalledWith('alice', 'secret123');
  });
});

describe('UT-004: AuthController.login 异常——凭证错误返回 401', () => {
  it('AuthService.login 返回失败，控制器抛 AppError 传递到 next', async () => {
    const mockAuthService = {
      register: vi.fn(),
      login: vi.fn().mockResolvedValue({
        ok: false,
        code: 40101,
        message: '用户名或密码错误',
      }),
    };
    const controller = new AuthController(mockAuthService as unknown as AuthService);
    const req = { body: { username: 'alice', password: 'wrong' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.login(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
  });
});

// ============ UT-005 ~ UT-007: ArticleController ============
describe('UT-005: ArticleController.publishArticle 正向——返回 201 + articleId', () => {
  it('已登录用户发布文章，控制器调用 ArticleService.publish 成功后返回 201', async () => {
    const mockArticleService = {
      publish: vi.fn().mockReturnValue({
        ok: true,
        data: { articleId: 'a-1', status: 'pending', createdAt: 'ts' },
      }),
      list: vi.fn(),
      getById: vi.fn(),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      body: { title: '我的文章', content: '正文' },
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.publishArticle(req, res), next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ articleId: 'a-1', status: 'pending' }),
      }),
    );
    expect(mockArticleService.publish).toHaveBeenCalledWith('u-1', '我的文章', '正文');
  });

  it('未登录用户发布文章抛 40101', async () => {
    const mockArticleService = {
      publish: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      body: { title: '我的文章', content: '正文' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.publishArticle(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
  });
});

describe('UT-006: ArticleController.listArticles 正向——普通用户过滤 rejected', () => {
  it('普通用户列表查询，控制器调用 ArticleService.list(role=user)', async () => {
    const mockArticleService = {
      publish: vi.fn(),
      list: vi.fn().mockReturnValue({
        ok: true,
        data: [{ id: 'a-2', status: 'approved' }],
      }),
      getById: vi.fn(),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.listArticles(req, res), next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 0 }));
    expect(mockArticleService.list).toHaveBeenCalledWith('user');
  });

  it('无 user 时 role 默认 user', async () => {
    const mockArticleService = {
      publish: vi.fn(),
      list: vi.fn().mockReturnValue({ ok: true, data: [] }),
      getById: vi.fn(),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {} as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.listArticles(req, res), next);
    expect(mockArticleService.list).toHaveBeenCalledWith('user');
  });
});

describe('UT-007: ArticleController.getArticle 异常——rejected 文章对普通用户返回 403', () => {
  it('普通用户查询 rejected 文章，ArticleService.getById 抛 40301', async () => {
    const { AppError } = await import('../../src/utils/errors');
    const mockArticleService = {
      publish: vi.fn(),
      list: vi.fn(),
      getById: vi.fn().mockImplementation(() => {
        throw new AppError(40301, '禁止访问');
      }),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      params: { id: 'a-3' },
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.getArticle(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40301 }));
    expect(mockArticleService.getById).toHaveBeenCalledWith('a-3', 'user');
  });

  it('正向查询返回 200 + 文章详情', async () => {
    const mockArticleService = {
      publish: vi.fn(),
      list: vi.fn(),
      getById: vi.fn().mockReturnValue({
        id: 'a-1',
        title: 't',
        content: 'c',
        status: 'approved',
        authorId: 'u-1',
        createdAt: 'ts',
      }),
    };
    const mockReviewService = { review: vi.fn() };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      params: { id: 'a-1' },
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.getArticle(req, res), next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ articleId: 'a-1', title: 't' }),
      }),
    );
  });
});

describe('ArticleController.reviewArticle', () => {
  it('管理员审核成功返回 200', async () => {
    const mockArticleService = { publish: vi.fn(), list: vi.fn(), getById: vi.fn() };
    const mockReviewService = {
      review: vi.fn().mockReturnValue({ ok: true, data: { status: 'approved' } }),
    };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      params: { id: 'a-1' },
      body: { action: 'approve' },
      user: { userId: 'u-admin', role: 'admin' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.reviewArticle(req, res), next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockReviewService.review).toHaveBeenCalledWith('a-1', 'approve', 'u-admin');
  });

  it('审核失败传递错误到 next', async () => {
    const mockArticleService = { publish: vi.fn(), list: vi.fn(), getById: vi.fn() };
    const mockReviewService = {
      review: vi.fn().mockReturnValue({ ok: false, code: 40401, message: '文章不存在' }),
    };
    const controller = new ArticleController(
      mockArticleService as unknown as ArticleService,
      mockReviewService as unknown as ReviewService,
    );
    const req = {
      params: { id: 'a-999' },
      body: { action: 'approve' },
      user: { userId: 'u-admin', role: 'admin' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.reviewArticle(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40401 }));
  });
});

// ============ UT-008 ~ UT-009: CommentController ============
describe('UT-008: CommentController.addComment 正向——返回 201 + commentId', () => {
  it('已登录用户对文章添加评论，控制器调用 CommentService.add 成功后返回 201', async () => {
    const mockCommentService = {
      add: vi.fn().mockReturnValue({
        ok: true,
        data: { commentId: 'c-1', articleId: 'a-1', createdAt: 'ts' },
      }),
      listByArticle: vi.fn(),
    };
    const controller = new CommentController(mockCommentService as unknown as CommentService);
    const req = {
      params: { id: 'a-1' },
      body: { content: '好文章' },
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.addComment(req, res), next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ commentId: 'c-1' }),
      }),
    );
    expect(mockCommentService.add).toHaveBeenCalledWith('a-1', 'u-1', '好文章');
  });
});

describe('UT-009: CommentController.addComment 异常——文章不存在返回 404', () => {
  it('对不存在文章添加评论，CommentService.add 返回 40401', async () => {
    const mockCommentService = {
      add: vi.fn().mockReturnValue({ ok: false, code: 40401, message: '文章不存在' }),
      listByArticle: vi.fn(),
    };
    const controller = new CommentController(mockCommentService as unknown as CommentService);
    const req = {
      params: { id: 'a-999' },
      body: { content: '好文章' },
      user: { userId: 'u-1', role: 'user' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.addComment(req, res), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40401 }));
  });
});

describe('CommentController.listComments', () => {
  it('查询评论列表返回 200', async () => {
    const mockCommentService = {
      add: vi.fn(),
      listByArticle: vi.fn().mockReturnValue({ ok: true, data: [] }),
    };
    const controller = new CommentController(mockCommentService as unknown as CommentService);
    const req = { params: { id: 'a-1' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    await runHandler(() => controller.listComments(req, res), next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockCommentService.listByArticle).toHaveBeenCalledWith('a-1');
  });
});
