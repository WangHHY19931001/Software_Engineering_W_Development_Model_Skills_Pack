// Controllers unit tests (TC-UNIT-081 ~ TC-UNIT-100).
// Tests all 17 SD controllers as thin HTTP wrappers using mock services.
// Verifies: (1) service method invocation with correct args,
// (2) correct HTTP status code + JSON body, (3) error propagation via next().

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import { SiteController } from '../../src/controllers/site.controller.js';
import { UserController } from '../../src/controllers/user.controller.js';
import { BloggerController } from '../../src/controllers/blogger.controller.js';
import { ArticleController } from '../../src/controllers/article.controller.js';
import { RecommendController } from '../../src/controllers/recommend.controller.js';
import { StatsController } from '../../src/controllers/stats.controller.js';
import { SearchController } from '../../src/controllers/search.controller.js';
import { TagController } from '../../src/controllers/tag.controller.js';
import { CategoryController } from '../../src/controllers/category.controller.js';
import { CommentController } from '../../src/controllers/comment.controller.js';
import { NotificationController } from '../../src/controllers/notification.controller.js';
import { CrossReferenceController } from '../../src/controllers/crossref.controller.js';
import { FileController } from '../../src/controllers/file.controller.js';
import { PushController } from '../../src/controllers/push.controller.js';
import { SubscriptionController } from '../../src/controllers/subscription.controller.js';
import { AdController } from '../../src/controllers/ad.controller.js';
import { BackupController } from '../../src/controllers/backup.controller.js';

import { ArticleStatus, BackupType, SubscriptionTarget, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

// ---------- mock helpers ----------

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function mockRes(): MockRes {
  const res: MockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function mockReq(opts: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown> | unknown;
} = {}): Request {
  const req = {
    headers: opts.headers ?? {},
    params: opts.params ?? {},
    query: opts.query ?? {},
    body: opts.body ?? {},
  } as unknown as Request;
  return req;
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

/** Creates a mock authService whose verifyToken returns a fixed context for non-empty tokens
 *  and throws for empty tokens (simulating anonymous requests). */
function mockAuthService(userId = 'u-1', role = UserRole.Admin) {
  return {
    verifyToken: vi.fn().mockImplementation((token: string) => {
      if (!token) {
        throw new AppError(1013, 'no token');
      }
      return { userId, role };
    }),
    register: vi.fn().mockResolvedValue({ id: userId, email: 'x@x.com' }),
    login: vi.fn().mockResolvedValue({ token: 'tok', user: { id: userId } }),
    userLogout: vi.fn(),
  };
}

const AUTH_HEADER = { authorization: 'Bearer test-token' };

// =================================================================
// SD-001 SiteController
// =================================================================

describe('SD-001 SiteController (TC-UNIT-081)', () => {
  let controller: SiteController;
  let siteService: ReturnType<typeof buildSiteServiceMock>;

  function buildSiteServiceMock() {
    return {
      getConfig: vi.fn().mockReturnValue({ siteName: 'demo' }),
      updateConfig: vi.fn().mockReturnValue({ siteName: 'updated' }),
      setMaintenanceMode: vi.fn(),
      scheduleAnnouncement: vi.fn(),
      getStatsOverview: vi.fn().mockReturnValue({ articleCount: 1 }),
    };
  }

  beforeEach(() => {
    siteService = buildSiteServiceMock();
    controller = new SiteController(siteService as never, mockAuthService() as never);
  });

  it('TC-UNIT-081a: getConfig returns config json', () => {
    const req = mockReq();
    const res = mockRes();
    controller.getConfig(req, res as unknown as Response, mockNext());
    expect(siteService.getConfig).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ siteName: 'demo' });
  });

  it('TC-UNIT-081b: updateConfig calls service with auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { siteName: 'x' } });
    const res = mockRes();
    controller.updateConfig(req, res as unknown as Response, mockNext());
    expect(siteService.updateConfig).toHaveBeenCalledWith('u-1', UserRole.Admin, { siteName: 'x' });
    expect(res.json).toHaveBeenCalledWith({ siteName: 'updated' });
  });

  it('TC-UNIT-081c: setMaintenanceMode passes boolean enabled', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { enabled: true } });
    const res = mockRes();
    controller.setMaintenanceMode(req, res as unknown as Response, mockNext());
    expect(siteService.setMaintenanceMode).toHaveBeenCalledWith('u-1', UserRole.Admin, true);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-081d: scheduleAnnouncement parses date and delegates', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const req = mockReq({ headers: AUTH_HEADER, body: { text: 'hi', at: future } });
    const res = mockRes();
    controller.scheduleAnnouncement(req, res as unknown as Response, mockNext());
    expect(siteService.scheduleAnnouncement).toHaveBeenCalledWith(
      'u-1',
      UserRole.Admin,
      'hi',
      expect.any(Date),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-081e: getStatsOverview returns overview', () => {
    const req = mockReq();
    const res = mockRes();
    controller.getStatsOverview(req, res as unknown as Response, mockNext());
    expect(siteService.getStatsOverview).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ articleCount: 1 });
  });

  it('TC-UNIT-081f: error in updateConfig is forwarded to next', () => {
    siteService.updateConfig.mockImplementation(() => {
      throw new AppError(1021, 'rbac');
    });
    const req = mockReq({ headers: AUTH_HEADER, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.updateConfig(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-003 UserController
// =================================================================

describe('SD-003 UserController (TC-UNIT-082)', () => {
  let controller: UserController;
  let authService: ReturnType<typeof mockAuthService>;
  let userService: { ban: ReturnType<typeof vi.fn>; unbanUser: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = mockAuthService();
    userService = {
      ban: vi.fn(),
      unbanUser: vi.fn(),
      getById: vi.fn().mockReturnValue({ id: 'u-1' }),
    };
    controller = new UserController(authService as never, userService as never);
  });

  it('TC-UNIT-082a: register returns 201 with user', async () => {
    authService.register.mockResolvedValue({ id: 'u-1', email: 'a@b.com' });
    const req = mockReq({ body: { email: 'a@b.com', password: 'p', displayName: 'd' } });
    const res = mockRes();
    await controller.register(req, res as unknown as Response, mockNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'u-1', email: 'a@b.com' });
  });

  it('TC-UNIT-082b: login returns token+user', async () => {
    authService.login.mockResolvedValue({ token: 'tok', user: { id: 'u-1' } });
    const req = mockReq({ body: { email: 'a@b.com', password: 'p' } });
    const res = mockRes();
    await controller.login(req, res as unknown as Response, mockNext());
    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'p');
    expect(res.json).toHaveBeenCalledWith({ token: 'tok', user: { id: 'u-1' } });
  });

  it('TC-UNIT-082c: logout extracts Bearer token and calls userLogout', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.logout(req, res as unknown as Response, mockNext());
    expect(authService.userLogout).toHaveBeenCalledWith('test-token');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-082d: ban calls userService.ban with operator + target + reason', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { userId: 'u-2' }, body: { reason: 'spam' } });
    const res = mockRes();
    controller.ban(req, res as unknown as Response, mockNext());
    expect(userService.ban).toHaveBeenCalledWith('u-1', UserRole.Admin, 'u-2', 'spam');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-082e: unban calls userService.unbanUser', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { userId: 'u-2' } });
    const res = mockRes();
    controller.unban(req, res as unknown as Response, mockNext());
    expect(userService.unbanUser).toHaveBeenCalledWith('u-1', UserRole.Admin, 'u-2');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-082f: me returns current user by id', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.me(req, res as unknown as Response, mockNext());
    expect(userService.getById).toHaveBeenCalledWith('u-1');
    expect(res.json).toHaveBeenCalledWith({ id: 'u-1' });
  });

  it('TC-UNIT-082g: error in login is forwarded to next', async () => {
    authService.login.mockRejectedValue(new AppError(1012, 'wrong'));
    const req = mockReq({ body: { email: 'a@b.com', password: 'p' } });
    const res = mockRes();
    const next = mockNext();
    await controller.login(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-002 BloggerController
// =================================================================

describe('SD-002 BloggerController (TC-UNIT-083)', () => {
  let controller: BloggerController;
  let bloggerService: ReturnType<typeof buildBloggerMock>;

  function buildBloggerMock() {
    return {
      register: vi.fn().mockReturnValue({ id: 'b-1' }),
      getBySlug: vi.fn().mockReturnValue({ id: 'b-1', slug: 's' }),
      follow: vi.fn(),
      unfollow: vi.fn(),
      listByFollower: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
    };
  }

  beforeEach(() => {
    bloggerService = buildBloggerMock();
    controller = new BloggerController(bloggerService as never, mockAuthService() as never);
  });

  it('TC-UNIT-083a: register returns 201', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { slug: 's', bio: 'b' } });
    const res = mockRes();
    controller.register(req, res as unknown as Response, mockNext());
    expect(bloggerService.register).toHaveBeenCalledWith('u-1', 's', 'b');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-083b: getBySlug delegates', () => {
    const req = mockReq({ params: { slug: 's' } });
    const res = mockRes();
    controller.getBySlug(req, res as unknown as Response, mockNext());
    expect(bloggerService.getBySlug).toHaveBeenCalledWith('s');
  });

  it('TC-UNIT-083c: follow + unfollow use auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { bloggerId: 'b-1' } });
    const res = mockRes();
    controller.follow(req, res as unknown as Response, mockNext());
    expect(bloggerService.follow).toHaveBeenCalledWith('u-1', 'b-1');
    controller.unfollow(req, res as unknown as Response, mockNext());
    expect(bloggerService.unfollow).toHaveBeenCalledWith('u-1', 'b-1');
  });

  it('TC-UNIT-083d: listByFollower uses pagination query', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: { page: 2, pageSize: 5 } });
    const res = mockRes();
    controller.listByFollower(req, res as unknown as Response, mockNext());
    expect(bloggerService.listByFollower).toHaveBeenCalledWith('u-1', 2, 5);
  });

  it('TC-UNIT-083e: error forwarded to next', () => {
    bloggerService.register.mockImplementation(() => {
      throw new AppError(1005, 'conflict');
    });
    const req = mockReq({ headers: AUTH_HEADER, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.register(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-012 ArticleController
// =================================================================

describe('SD-012 ArticleController (TC-UNIT-084)', () => {
  let controller: ArticleController;
  let articleService: ReturnType<typeof buildArticleMock>;

  function buildArticleMock() {
    return {
      createArticle: vi.fn().mockReturnValue({ id: 'a-1' }),
      getById: vi.fn().mockReturnValue({ id: 'a-1' }),
      submitForReview: vi.fn(),
      publishArticle: vi.fn(),
      approveArticle: vi.fn(),
      offlineArticle: vi.fn(),
      archiveArticle: vi.fn(),
      republishArticle: vi.fn(),
      schedule: vi.fn(),
      fireScheduledPublish: vi.fn(),
      batchOffline: vi.fn(),
      listByAuthor: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      transition: vi.fn(),
    };
  }

  beforeEach(() => {
    articleService = buildArticleMock();
    controller = new ArticleController(articleService as never, mockAuthService() as never);
  });

  it('TC-UNIT-084a: create returns 201', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { title: 't', content: 'c' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(articleService.createArticle).toHaveBeenCalledWith('u-1', { title: 't', content: 'c' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-084b: getById no auth needed', () => {
    const req = mockReq({ params: { articleId: 'a-1' } });
    const res = mockRes();
    controller.getById(req, res as unknown as Response, mockNext());
    expect(articleService.getById).toHaveBeenCalledWith('a-1');
  });

  it('TC-UNIT-084c: state transitions delegate with auth', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' } });
    const res = mockRes();
    controller.submitForReview(req, res as unknown as Response, mockNext());
    expect(articleService.submitForReview).toHaveBeenCalledWith('u-1', 'a-1');
    controller.publish(req, res as unknown as Response, mockNext());
    expect(articleService.publishArticle).toHaveBeenCalledWith('u-1', 'a-1');
    controller.approve(req, res as unknown as Response, mockNext());
    expect(articleService.approveArticle).toHaveBeenCalledWith('u-1', UserRole.Admin, 'a-1');
    controller.offline(req, res as unknown as Response, mockNext());
    expect(articleService.offlineArticle).toHaveBeenCalledWith('u-1', UserRole.Admin, 'a-1');
    controller.archive(req, res as unknown as Response, mockNext());
    expect(articleService.archiveArticle).toHaveBeenCalledWith('u-1', UserRole.Admin, 'a-1');
    controller.republish(req, res as unknown as Response, mockNext());
    expect(articleService.republishArticle).toHaveBeenCalledWith('u-1', UserRole.Admin, 'a-1');
  });

  it('TC-UNIT-084d: schedule parses date', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' }, body: { scheduledAt: future } });
    const res = mockRes();
    controller.schedule(req, res as unknown as Response, mockNext());
    expect(articleService.schedule).toHaveBeenCalledWith('u-1', 'a-1', expect.any(Date));
  });

  it('TC-UNIT-084e: fireScheduledPublish + batchOffline + listByAuthor + transition', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' } });
    const res = mockRes();
    controller.fireScheduledPublish(req, res as unknown as Response, mockNext());
    expect(articleService.fireScheduledPublish).toHaveBeenCalledWith('a-1');

    const batchReq = mockReq({ headers: AUTH_HEADER, body: { articleIds: ['a-1', 'a-2'] } });
    controller.batchOffline(batchReq, res as unknown as Response, mockNext());
    expect(articleService.batchOffline).toHaveBeenCalledWith('u-1', UserRole.Admin, ['a-1', 'a-2']);

    const listReq = mockReq({ params: { authorId: 'u-2' }, query: { page: 1, pageSize: 10 } });
    controller.listByAuthor(listReq, res as unknown as Response, mockNext());
    expect(articleService.listByAuthor).toHaveBeenCalledWith('u-2', 1, 10);

    const transReq = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' }, body: { to: ArticleStatus.Published } });
    controller.transition(transReq, res as unknown as Response, mockNext());
    expect(articleService.transition).toHaveBeenCalledWith('u-1', 'a-1', ArticleStatus.Published);
  });

  it('TC-UNIT-084f: error forwarded to next', () => {
    articleService.getById.mockImplementation(() => {
      throw new AppError(1031, 'not found');
    });
    const req = mockReq({ params: { articleId: 'no' } });
    const res = mockRes();
    const next = mockNext();
    controller.getById(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-004 RecommendController
// =================================================================

describe('SD-004 RecommendController (TC-UNIT-085)', () => {
  let controller: RecommendController;
  let recommendService: ReturnType<typeof buildRecommendMock>;

  function buildRecommendMock() {
    return {
      hot: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      personalized: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      latest: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      setSlot: vi.fn(),
    };
  }

  beforeEach(() => {
    recommendService = buildRecommendMock();
    controller = new RecommendController(recommendService as never, mockAuthService() as never);
  });

  it('TC-UNIT-085a: hot uses query pagination', () => {
    const req = mockReq({ query: { page: 2, pageSize: 5 } });
    const res = mockRes();
    controller.hot(req, res as unknown as Response, mockNext());
    expect(recommendService.hot).toHaveBeenCalledWith(2, 5);
  });

  it('TC-UNIT-085b: personalized uses auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: { page: 1, pageSize: 10 } });
    const res = mockRes();
    controller.personalized(req, res as unknown as Response, mockNext());
    expect(recommendService.personalized).toHaveBeenCalledWith('u-1', 1, 10);
  });

  it('TC-UNIT-085c: latest + setSlot', () => {
    const req1 = mockReq({ query: {} });
    const res = mockRes();
    controller.latest(req1, res as unknown as Response, mockNext());
    expect(recommendService.latest).toHaveBeenCalledWith(1, 10);

    const req2 = mockReq({ headers: AUTH_HEADER, body: { slotName: 's', articleId: 'a-1', priority: 1 } });
    controller.setSlot(req2, res as unknown as Response, mockNext());
    expect(recommendService.setSlot).toHaveBeenCalledWith('u-1', UserRole.Admin, 's', 'a-1', 1);
  });

  it('TC-UNIT-085d: error forwarded to next', () => {
    recommendService.hot.mockImplementation(() => {
      throw new AppError(1023, 'maintenance');
    });
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    controller.hot(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-006 StatsController
// =================================================================

describe('SD-006 StatsController (TC-UNIT-086)', () => {
  let controller: StatsController;
  let statsService: ReturnType<typeof buildStatsMock>;

  function buildStatsMock() {
    return {
      articleStats: vi.fn().mockReturnValue({ total: 1 }),
      userStats: vi.fn().mockReturnValue({ total: 1 }),
      bloggerStats: vi.fn().mockReturnValue({ total: 1 }),
      siteTrend: vi.fn().mockReturnValue([{ day: 'd', count: 1 }]),
    };
  }

  beforeEach(() => {
    statsService = buildStatsMock();
    controller = new StatsController(statsService as never, mockAuthService() as never);
  });

  it('TC-UNIT-086a: articleStats + userStats + bloggerStats use auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.articleStats(req, res as unknown as Response, mockNext());
    expect(statsService.articleStats).toHaveBeenCalledWith(UserRole.Admin);
    controller.userStats(req, res as unknown as Response, mockNext());
    expect(statsService.userStats).toHaveBeenCalledWith(UserRole.Admin);
    controller.bloggerStats(req, res as unknown as Response, mockNext());
    expect(statsService.bloggerStats).toHaveBeenCalledWith(UserRole.Admin);
  });

  it('TC-UNIT-086b: siteTrend uses days query param', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: { days: 30 } });
    const res = mockRes();
    controller.siteTrend(req, res as unknown as Response, mockNext());
    expect(statsService.siteTrend).toHaveBeenCalledWith(UserRole.Admin, 30);
  });

  it('TC-UNIT-086c: error forwarded to next', () => {
    statsService.articleStats.mockImplementation(() => {
      throw new AppError(1021, 'rbac');
    });
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    const next = mockNext();
    controller.articleStats(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-007 SearchController
// =================================================================

describe('SD-007 SearchController (TC-UNIT-087)', () => {
  let controller: SearchController;
  let searchService: ReturnType<typeof buildSearchMock>;

  function buildSearchMock() {
    return {
      search: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      suggest: vi.fn().mockReturnValue(['a', 'b']),
      history: vi.fn().mockReturnValue([]),
      clearSearchHistory: vi.fn(),
    };
  }

  beforeEach(() => {
    searchService = buildSearchMock();
    controller = new SearchController(searchService as never, mockAuthService() as never);
  });

  it('TC-UNIT-087a: search with auth header records userId', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: { q: 'hello', sort: 'newest', page: 1, pageSize: 10 } });
    const res = mockRes();
    controller.search(req, res as unknown as Response, mockNext());
    expect(searchService.search).toHaveBeenCalledWith('u-1', 'hello', 'newest', 1, 10);
  });

  it('TC-UNIT-087b: search without auth header allows anonymous (userId null)', () => {
    const req = mockReq({ query: { q: 'hello' } });
    const res = mockRes();
    controller.search(req, res as unknown as Response, mockNext());
    expect(searchService.search).toHaveBeenCalledWith(null, 'hello', 'relevance', 1, 10);
  });

  it('TC-UNIT-087c: suggest + history + clearHistory', () => {
    const req1 = mockReq({ query: { prefix: 'ab' } });
    const res = mockRes();
    controller.suggest(req1, res as unknown as Response, mockNext());
    expect(searchService.suggest).toHaveBeenCalledWith('ab');

    const req2 = mockReq({ headers: AUTH_HEADER });
    controller.history(req2, res as unknown as Response, mockNext());
    expect(searchService.history).toHaveBeenCalledWith('u-1');

    controller.clearHistory(req2, res as unknown as Response, mockNext());
    expect(searchService.clearSearchHistory).toHaveBeenCalledWith('u-1');
  });

  it('TC-UNIT-087d: error forwarded to next', () => {
    searchService.suggest.mockImplementation(() => {
      throw new AppError(1001, 'bad');
    });
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    controller.suggest(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-008 TagController
// =================================================================

describe('SD-008 TagController (TC-UNIT-088)', () => {
  let controller: TagController;
  let tagService: ReturnType<typeof buildTagMock>;

  function buildTagMock() {
    return {
      createTag: vi.fn().mockReturnValue({ id: 't-1' }),
      approveTag: vi.fn().mockReturnValue({ id: 't-1', status: 'approved' }),
      rejectTag: vi.fn().mockReturnValue({ id: 't-1', status: 'rejected' }),
      bind: vi.fn(),
      unbind: vi.fn(),
      cloud: vi.fn().mockReturnValue([]),
      merge: vi.fn(),
    };
  }

  beforeEach(() => {
    tagService = buildTagMock();
    controller = new TagController(tagService as never, mockAuthService() as never);
  });

  it('TC-UNIT-088a: create returns 201', () => {
    const req = mockReq({ body: { name: 't', slug: 's' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(tagService.createTag).toHaveBeenCalledWith('t', 's');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-088b: approve + reject use auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { tagId: 't-1' } });
    const res = mockRes();
    controller.approve(req, res as unknown as Response, mockNext());
    expect(tagService.approveTag).toHaveBeenCalledWith('u-1', UserRole.Admin, 't-1');
    controller.reject(req, res as unknown as Response, mockNext());
    expect(tagService.rejectTag).toHaveBeenCalledWith('u-1', UserRole.Admin, 't-1');
  });

  it('TC-UNIT-088c: bind + unbind + cloud + merge', () => {
    const bindReq = mockReq({ params: { articleId: 'a-1' }, body: { tagIds: ['t-1'] } });
    const res = mockRes();
    controller.bind(bindReq, res as unknown as Response, mockNext());
    expect(tagService.bind).toHaveBeenCalledWith('a-1', ['t-1']);
    controller.unbind(bindReq, res as unknown as Response, mockNext());
    expect(tagService.unbind).toHaveBeenCalledWith('a-1', ['t-1']);

    const cloudReq = mockReq({ query: { topN: 50 } });
    controller.cloud(cloudReq, res as unknown as Response, mockNext());
    expect(tagService.cloud).toHaveBeenCalledWith(50);

    const mergeReq = mockReq({ headers: AUTH_HEADER, body: { sourceId: 't-1', targetId: 't-2' } });
    controller.merge(mergeReq, res as unknown as Response, mockNext());
    expect(tagService.merge).toHaveBeenCalledWith('u-1', UserRole.Admin, 't-1', 't-2');
  });

  it('TC-UNIT-088d: error forwarded to next', () => {
    tagService.createTag.mockImplementation(() => {
      throw new AppError(1001, 'bad');
    });
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.create(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-009 CategoryController
// =================================================================

describe('SD-009 CategoryController (TC-UNIT-089)', () => {
  let controller: CategoryController;
  let categoryService: ReturnType<typeof buildCategoryMock>;

  function buildCategoryMock() {
    return {
      createCategory: vi.fn().mockReturnValue({ id: 'c-1' }),
      tree: vi.fn().mockReturnValue([]),
      breadcrumb: vi.fn().mockReturnValue([]),
      cascadeDelete: vi.fn(),
      bindCategory: vi.fn(),
    };
  }

  beforeEach(() => {
    categoryService = buildCategoryMock();
    controller = new CategoryController(categoryService as never, mockAuthService() as never);
  });

  it('TC-UNIT-089a: create with parentId returns 201', () => {
    const req = mockReq({ body: { name: 'cat', parentId: 'c-0' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(categoryService.createCategory).toHaveBeenCalledWith('cat', 'c-0');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-089b: create without parentId defaults to null', () => {
    const req = mockReq({ body: { name: 'root' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(categoryService.createCategory).toHaveBeenCalledWith('root', null);
  });

  it('TC-UNIT-089c: tree + breadcrumb + cascadeDelete + bindCategory', () => {
    const treeReq = mockReq();
    const res = mockRes();
    controller.tree(treeReq, res as unknown as Response, mockNext());
    expect(categoryService.tree).toHaveBeenCalledOnce();

    const bcReq = mockReq({ params: { categoryId: 'c-1' } });
    controller.breadcrumb(bcReq, res as unknown as Response, mockNext());
    expect(categoryService.breadcrumb).toHaveBeenCalledWith('c-1');

    const delReq = mockReq({ headers: AUTH_HEADER, params: { categoryId: 'c-1' } });
    controller.cascadeDelete(delReq, res as unknown as Response, mockNext());
    expect(categoryService.cascadeDelete).toHaveBeenCalledWith('u-1', UserRole.Admin, 'c-1');

    const bindReq = mockReq({ params: { articleId: 'a-1' }, body: { categoryId: 'c-1' } });
    controller.bindCategory(bindReq, res as unknown as Response, mockNext());
    expect(categoryService.bindCategory).toHaveBeenCalledWith('a-1', 'c-1');
  });

  it('TC-UNIT-089d: error forwarded to next', () => {
    categoryService.tree.mockImplementation(() => {
      throw new AppError(1023, 'maint');
    });
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    controller.tree(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-010 CommentController
// =================================================================

describe('SD-010 CommentController (TC-UNIT-090)', () => {
  let controller: CommentController;
  let commentService: ReturnType<typeof buildCommentMock>;

  function buildCommentMock() {
    return {
      createComment: vi.fn().mockReturnValue({ id: 'cm-1' }),
      audit: vi.fn(),
      like: vi.fn(),
      reportComment: vi.fn(),
      listByArticle: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
    };
  }

  beforeEach(() => {
    commentService = buildCommentMock();
    controller = new CommentController(commentService as never, mockAuthService() as never);
  });

  it('TC-UNIT-090a: create returns 201 with parentId null default', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' }, body: { content: 'hi' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(commentService.createComment).toHaveBeenCalledWith('a-1', 'u-1', null, 'hi');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-090b: create with parentId passes through', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' }, body: { content: 'hi', parentId: 'cm-0' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(commentService.createComment).toHaveBeenCalledWith('a-1', 'u-1', 'cm-0', 'hi');
  });

  it('TC-UNIT-090c: audit + like + report use auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { commentId: 'cm-1' }, body: { decision: 'approve', reason: 'spam' } });
    const res = mockRes();
    controller.audit(req, res as unknown as Response, mockNext());
    expect(commentService.audit).toHaveBeenCalledWith('u-1', UserRole.Admin, 'cm-1', 'approve');

    controller.like(req, res as unknown as Response, mockNext());
    expect(commentService.like).toHaveBeenCalledWith('u-1', 'cm-1');

    controller.report(req, res as unknown as Response, mockNext());
    expect(commentService.reportComment).toHaveBeenCalledWith('u-1', 'cm-1', 'spam');
  });

  it('TC-UNIT-090d: listByArticle parses sort param (oldest + popular + default newest)', () => {
    const req1 = mockReq({ params: { articleId: 'a-1' }, query: { sort: 'oldest' } });
    const res = mockRes();
    controller.listByArticle(req1, res as unknown as Response, mockNext());
    expect(commentService.listByArticle).toHaveBeenCalledWith('a-1', 1, 10, 'oldest');

    const req2 = mockReq({ params: { articleId: 'a-1' }, query: { sort: 'popular' } });
    controller.listByArticle(req2, res as unknown as Response, mockNext());
    expect(commentService.listByArticle).toHaveBeenCalledWith('a-1', 1, 10, 'popular');

    const req3 = mockReq({ params: { articleId: 'a-1' } });
    controller.listByArticle(req3, res as unknown as Response, mockNext());
    expect(commentService.listByArticle).toHaveBeenCalledWith('a-1', 1, 10, 'newest');
  });

  it('TC-UNIT-090e: error forwarded to next', () => {
    commentService.createComment.mockImplementation(() => {
      throw new AppError(1025, 'closed');
    });
    const req = mockReq({ headers: AUTH_HEADER, params: { articleId: 'a-1' }, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.create(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-011 NotificationController
// =================================================================

describe('SD-011 NotificationController (TC-UNIT-091)', () => {
  let controller: NotificationController;
  let notificationService: ReturnType<typeof buildNotifMock>;

  function buildNotifMock() {
    return {
      listByUser: vi.fn().mockReturnValue([]),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      updateNotificationSetting: vi.fn().mockReturnValue({ comment: true }),
      unreadSize: vi.fn().mockReturnValue(3),
    };
  }

  beforeEach(() => {
    notificationService = buildNotifMock();
    controller = new NotificationController(notificationService as never, mockAuthService() as never);
  });

  it('TC-UNIT-091a: list returns user notifications', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.list(req, res as unknown as Response, mockNext());
    expect(notificationService.listByUser).toHaveBeenCalledWith('u-1');
  });

  it('TC-UNIT-091b: markRead + markAllRead', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { notificationId: 'n-1' } });
    const res = mockRes();
    controller.markRead(req, res as unknown as Response, mockNext());
    expect(notificationService.markRead).toHaveBeenCalledWith('u-1', 'n-1');

    controller.markAllRead(req, res as unknown as Response, mockNext());
    expect(notificationService.markAllRead).toHaveBeenCalledWith('u-1');
  });

  it('TC-UNIT-091c: updateSettings returns updated settings', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { comment: true } });
    const res = mockRes();
    controller.updateSettings(req, res as unknown as Response, mockNext());
    expect(notificationService.updateNotificationSetting).toHaveBeenCalledWith('u-1', { comment: true });
  });

  it('TC-UNIT-091d: unreadSize returns count object', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.unreadSize(req, res as unknown as Response, mockNext());
    expect(notificationService.unreadSize).toHaveBeenCalledWith('u-1');
    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });

  it('TC-UNIT-091e: error forwarded to next', () => {
    notificationService.markRead.mockImplementation(() => {
      throw new AppError(1031, 'not found');
    });
    const req = mockReq({ headers: AUTH_HEADER, params: { notificationId: 'no' } });
    const res = mockRes();
    const next = mockNext();
    controller.markRead(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-013 CrossReferenceController
// =================================================================

describe('SD-013 CrossReferenceController (TC-UNIT-092)', () => {
  let controller: CrossReferenceController;
  let crossRefService: ReturnType<typeof buildCrossRefMock>;

  function buildCrossRefMock() {
    return {
      addCitation: vi.fn(),
      removeCitation: vi.fn(),
      backlinks: vi.fn().mockReturnValue([]),
      related: vi.fn().mockReturnValue([]),
      graph: vi.fn().mockReturnValue([]),
    };
  }

  beforeEach(() => {
    crossRefService = buildCrossRefMock();
    controller = new CrossReferenceController(crossRefService as never);
  });

  it('TC-UNIT-092a: addCitation returns 201', () => {
    const req = mockReq({ params: { articleId: 'a-1' }, body: { toArticleId: 'a-2' } });
    const res = mockRes();
    controller.addCitation(req, res as unknown as Response, mockNext());
    expect(crossRefService.addCitation).toHaveBeenCalledWith('a-1', 'a-2');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-092b: removeCitation returns ok', () => {
    const req = mockReq({ params: { articleId: 'a-1' }, body: { toArticleId: 'a-2' } });
    const res = mockRes();
    controller.removeCitation(req, res as unknown as Response, mockNext());
    expect(crossRefService.removeCitation).toHaveBeenCalledWith('a-1', 'a-2');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-092c: backlinks + related + graph', () => {
    const req1 = mockReq({ params: { articleId: 'a-1' } });
    const res = mockRes();
    controller.backlinks(req1, res as unknown as Response, mockNext());
    expect(crossRefService.backlinks).toHaveBeenCalledWith('a-1');

    const req2 = mockReq({ params: { articleId: 'a-1' }, query: { topN: 10 } });
    controller.related(req2, res as unknown as Response, mockNext());
    expect(crossRefService.related).toHaveBeenCalledWith('a-1', 10);

    const req3 = mockReq({ params: { articleId: 'a-1' }, query: { depth: 3 } });
    controller.graph(req3, res as unknown as Response, mockNext());
    expect(crossRefService.graph).toHaveBeenCalledWith('a-1', 3);
  });

  it('TC-UNIT-092d: error forwarded to next', () => {
    crossRefService.backlinks.mockImplementation(() => {
      throw new AppError(1031, 'not found');
    });
    const req = mockReq({ params: { articleId: 'no' } });
    const res = mockRes();
    const next = mockNext();
    controller.backlinks(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-015 FileController
// =================================================================

describe('SD-015 FileController (TC-UNIT-093)', () => {
  let controller: FileController;
  let fileService: ReturnType<typeof buildFileMock>;

  function buildFileMock() {
    return {
      upload: vi.fn().mockReturnValue({ id: 'f-1' }),
      getQuota: vi.fn().mockReturnValue({ used: 0, limit: 100 }),
      getById: vi.fn().mockReturnValue({ id: 'f-1' }),
      listByUser: vi.fn().mockReturnValue([]),
      delete: vi.fn(),
    };
  }

  beforeEach(() => {
    fileService = buildFileMock();
    controller = new FileController(fileService as never, mockAuthService() as never);
  });

  it('TC-UNIT-093a: upload decodes base64 content and returns 201', () => {
    const req = mockReq({
      headers: AUTH_HEADER,
      body: { filename: 'a.png', mimeType: 'image/png', content: Buffer.from('hi').toString('base64') },
    });
    const res = mockRes();
    controller.upload(req, res as unknown as Response, mockNext());
    expect(fileService.upload).toHaveBeenCalledWith('u-1', {
      filename: 'a.png',
      mimeType: 'image/png',
      content: expect.any(Buffer),
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-093b: getQuota + getById + listByUser', () => {
    const req1 = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.getQuota(req1, res as unknown as Response, mockNext());
    expect(fileService.getQuota).toHaveBeenCalledWith('u-1');

    const req2 = mockReq({ params: { fileId: 'f-1' } });
    controller.getById(req2, res as unknown as Response, mockNext());
    expect(fileService.getById).toHaveBeenCalledWith('f-1');

    controller.listByUser(req1, res as unknown as Response, mockNext());
    expect(fileService.listByUser).toHaveBeenCalledWith('u-1');
  });

  it('TC-UNIT-093c: delete uses auth + role', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { fileId: 'f-1' } });
    const res = mockRes();
    controller.delete(req, res as unknown as Response, mockNext());
    expect(fileService.delete).toHaveBeenCalledWith('u-1', UserRole.Admin, 'f-1');
  });

  it('TC-UNIT-093d: error forwarded to next', () => {
    fileService.upload.mockImplementation(() => {
      throw new AppError(1041, 'too large');
    });
    const req = mockReq({ headers: AUTH_HEADER, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.upload(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-014 PushController
// =================================================================

describe('SD-014 PushController (TC-UNIT-094)', () => {
  let controller: PushController;
  let pushService: ReturnType<typeof buildPushMock>;

  function buildPushMock() {
    return {
      push: vi.fn().mockReturnValue({ pushed: 1, queued: 0 }),
      broadcast: vi.fn().mockReturnValue(5),
      flushOffline: vi.fn().mockReturnValue({ flushed: 0 }),
    };
  }

  beforeEach(() => {
    pushService = buildPushMock();
    controller = new PushController(pushService as never, mockAuthService() as never);
  });

  it('TC-UNIT-094a: push delegates to service with userId + channel + message', () => {
    const req = mockReq({ params: { userId: 'u-2' }, body: { channel: 'ws', message: 'hi' } });
    const res = mockRes();
    controller.push(req, res as unknown as Response, mockNext());
    expect(pushService.push).toHaveBeenCalledWith('u-2', 'ws', 'hi');
    expect(res.json).toHaveBeenCalledWith({ pushed: 1, queued: 0 });
  });

  it('TC-UNIT-094b: broadcast returns pushed count', () => {
    const req = mockReq({ body: { channel: 'ws', message: 'hi' } });
    const res = mockRes();
    controller.broadcast(req, res as unknown as Response, mockNext());
    expect(pushService.broadcast).toHaveBeenCalledWith('ws', 'hi');
    expect(res.json).toHaveBeenCalledWith({ pushed: 5 });
  });

  it('TC-UNIT-094c: flushOffline uses auth context', () => {
    const req = mockReq({ headers: AUTH_HEADER });
    const res = mockRes();
    controller.flushOffline(req, res as unknown as Response, mockNext());
    expect(pushService.flushOffline).toHaveBeenCalledWith('u-1');
  });

  it('TC-UNIT-094d: error forwarded to next', () => {
    pushService.push.mockImplementation(() => {
      throw new AppError(1031, 'not found');
    });
    const req = mockReq({ params: { userId: 'no' }, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.push(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-016 SubscriptionController
// =================================================================

describe('SD-016 SubscriptionController (TC-UNIT-095)', () => {
  let controller: SubscriptionController;
  let subscriptionService: ReturnType<typeof buildSubMock>;

  function buildSubMock() {
    return {
      subscribe: vi.fn().mockReturnValue({ id: 's-1' }),
      unsubscribe: vi.fn(),
      listByUser: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      permission: vi.fn().mockReturnValue('basic'),
    };
  }

  beforeEach(() => {
    subscriptionService = buildSubMock();
    controller = new SubscriptionController(subscriptionService as never, mockAuthService() as never);
  });

  it('TC-UNIT-095a: subscribe returns 201 with target from body', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { target: SubscriptionTarget.Blogger, targetId: 'b-1' } });
    const res = mockRes();
    controller.subscribe(req, res as unknown as Response, mockNext());
    expect(subscriptionService.subscribe).toHaveBeenCalledWith('u-1', SubscriptionTarget.Blogger, 'b-1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-095b: unsubscribe returns ok', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { target: SubscriptionTarget.Tag, targetId: 't-1' } });
    const res = mockRes();
    controller.unsubscribe(req, res as unknown as Response, mockNext());
    expect(subscriptionService.unsubscribe).toHaveBeenCalledWith('u-1', SubscriptionTarget.Tag, 't-1');
  });

  it('TC-UNIT-095c: list with target filter + pagination', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: { target: SubscriptionTarget.Category, page: 2, pageSize: 5 } });
    const res = mockRes();
    controller.list(req, res as unknown as Response, mockNext());
    expect(subscriptionService.listByUser).toHaveBeenCalledWith('u-1', SubscriptionTarget.Category, 2, 5);
  });

  it('TC-UNIT-095d: list without target passes undefined', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: {} });
    const res = mockRes();
    controller.list(req, res as unknown as Response, mockNext());
    expect(subscriptionService.listByUser).toHaveBeenCalledWith('u-1', undefined, 1, 10);
  });

  it('TC-UNIT-095e: permission defaults to Blogger when no target query', () => {
    const req = mockReq({ headers: AUTH_HEADER, query: {} });
    const res = mockRes();
    controller.permission(req, res as unknown as Response, mockNext());
    expect(subscriptionService.permission).toHaveBeenCalledWith('u-1', SubscriptionTarget.Blogger);
    expect(res.json).toHaveBeenCalledWith({ level: 'basic' });
  });

  it('TC-UNIT-095f: error forwarded to next', () => {
    subscriptionService.subscribe.mockImplementation(() => {
      throw new AppError(1031, 'not found');
    });
    const req = mockReq({ headers: AUTH_HEADER, body: { target: SubscriptionTarget.Blogger, targetId: 'no' } });
    const res = mockRes();
    const next = mockNext();
    controller.subscribe(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-005 AdController
// =================================================================

describe('SD-005 AdController (TC-UNIT-096)', () => {
  let controller: AdController;
  let adService: ReturnType<typeof buildAdMock>;

  function buildAdMock() {
    return {
      create: vi.fn().mockReturnValue({ id: 'ad-1' }),
      audit: vi.fn(),
      recordClick: vi.fn(),
      listBySlot: vi.fn().mockReturnValue({ items: [], total: 0, page: 1, pageSize: 10 }),
    };
  }

  beforeEach(() => {
    adService = buildAdMock();
    controller = new AdController(adService as never, mockAuthService() as never);
  });

  it('TC-UNIT-096a: create returns 201 with auth', () => {
    const req = mockReq({ headers: AUTH_HEADER, body: { slotId: 's1', title: 't' } });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(adService.create).toHaveBeenCalledWith('u-1', UserRole.Admin, { slotId: 's1', title: 't' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-096b: audit passes decision', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { adId: 'ad-1' }, body: { decision: 'approve' } });
    const res = mockRes();
    controller.audit(req, res as unknown as Response, mockNext());
    expect(adService.audit).toHaveBeenCalledWith('u-1', UserRole.Admin, 'ad-1', 'approve');
  });

  it('TC-UNIT-096c: recordClick no auth needed', () => {
    const req = mockReq({ params: { adId: 'ad-1' } });
    const res = mockRes();
    controller.recordClick(req, res as unknown as Response, mockNext());
    expect(adService.recordClick).toHaveBeenCalledWith('ad-1');
  });

  it('TC-UNIT-096d: listBySlot uses pagination', () => {
    const req = mockReq({ params: { slotId: 's1' }, query: { page: 2, pageSize: 5 } });
    const res = mockRes();
    controller.listBySlot(req, res as unknown as Response, mockNext());
    expect(adService.listBySlot).toHaveBeenCalledWith('s1', 2, 5);
  });

  it('TC-UNIT-096e: error forwarded to next', () => {
    adService.audit.mockImplementation(() => {
      throw new AppError(1021, 'rbac');
    });
    const req = mockReq({ headers: AUTH_HEADER, params: { adId: 'ad-1' }, body: {} });
    const res = mockRes();
    const next = mockNext();
    controller.audit(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

// =================================================================
// SD-017 BackupController
// =================================================================

describe('SD-017 BackupController (TC-UNIT-097)', () => {
  let controller: BackupController;
  let backupService: ReturnType<typeof buildBackupMock>;

  function buildBackupMock() {
    return {
      createBackup: vi.fn().mockReturnValue({ id: 'bk-1', sha256: 'abc' }),
      exportUserData: vi.fn().mockReturnValue(Buffer.from('data')),
      restore: vi.fn(),
      incremental: vi.fn().mockReturnValue(Buffer.from('inc')),
      verifyIntegrity: vi.fn().mockReturnValue(true),
    };
  }

  beforeEach(() => {
    backupService = buildBackupMock();
    controller = new BackupController(backupService as never, mockAuthService() as never);
  });

  it('TC-UNIT-097a: create decodes base64 payload and returns 201', () => {
    const req = mockReq({
      headers: AUTH_HEADER,
      body: { type: BackupType.Full, payload: Buffer.from('x').toString('base64') },
    });
    const res = mockRes();
    controller.create(req, res as unknown as Response, mockNext());
    expect(backupService.createBackup).toHaveBeenCalledWith('u-1', UserRole.Admin, BackupType.Full, expect.any(Buffer));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('TC-UNIT-097b: exportUserData returns base64 + size', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { userId: 'u-2' } });
    const res = mockRes();
    controller.exportUserData(req, res as unknown as Response, mockNext());
    expect(backupService.exportUserData).toHaveBeenCalledWith('u-2');
    expect(res.json).toHaveBeenCalledWith({ data: expect.any(String), size: 4 });
  });

  it('TC-UNIT-097c: restore uses auth + role', () => {
    const req = mockReq({ headers: AUTH_HEADER, params: { backupId: 'bk-1' } });
    const res = mockRes();
    controller.restore(req, res as unknown as Response, mockNext());
    expect(backupService.restore).toHaveBeenCalledWith('u-1', UserRole.Admin, 'bk-1');
  });

  it('TC-UNIT-097d: incremental parses since query', () => {
    const since = new Date().toISOString();
    const req = mockReq({ headers: AUTH_HEADER, query: { since } });
    const res = mockRes();
    controller.incremental(req, res as unknown as Response, mockNext());
    expect(backupService.incremental).toHaveBeenCalledWith('u-1', UserRole.Admin, expect.any(Date));
  });

  it('TC-UNIT-097e: verifyIntegrity returns valid boolean', () => {
    const req = mockReq({ params: { backupId: 'bk-1' } });
    const res = mockRes();
    controller.verifyIntegrity(req, res as unknown as Response, mockNext());
    expect(backupService.verifyIntegrity).toHaveBeenCalledWith('bk-1');
    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });

  it('TC-UNIT-097f: error forwarded to next', () => {
    backupService.restore.mockImplementation(() => {
      throw new AppError(1021, 'rbac');
    });
    const req = mockReq({ headers: AUTH_HEADER, params: { backupId: 'bk-1' } });
    const res = mockRes();
    const next = mockNext();
    controller.restore(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});
