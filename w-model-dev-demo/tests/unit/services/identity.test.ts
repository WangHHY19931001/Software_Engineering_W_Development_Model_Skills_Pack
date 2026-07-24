/**
 * UT-DD-003 ~ UT-DD-006 —— 身份访问层单元测试
 * UserService (8) + UserStore (5) + BloggerService (3) + FollowService (4) = 20 用例
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../../src/services/identity/user-service.js';
import { BloggerService } from '../../../src/services/identity/blogger-service.js';
import { FollowService } from '../../../src/services/identity/follow-service.js';
import { userStore } from '../../../src/stores/user-store.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';
import { EmailSender } from '../../../src/utils/email.js';
import { SiteService } from '../../../src/services/operation/site-service.js';
import { AppError } from '../../../src/utils/errors.js';
import { BloggerService as BloggerServiceClass } from '../../../src/services/identity/blogger-service.js';
import { TagService } from '../../../src/services/content/tag-service.js';
import { CategoryService } from '../../../src/services/content/category-service.js';
import { CommentService } from '../../../src/services/interaction/comment-service.js';

function makeDeps() {
  const walWriter = new WalWriter('./test.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  const siteService = new SiteService({ walWriter, auditLogger });
  const notificationService = new NotificationService({ emailSender, walWriter });
  return { walWriter, auditLogger, emailSender, siteService, notificationService };
}

describe('DD-003 UserService', () => {
  let svc: UserService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
    userStore.clear();
    articleStore.clear();
    TagService._reset();
    CategoryService._reset();
    CommentService._reset();
    NotificationService._reset();
    deps = makeDeps();
    svc = new UserService({
      walWriter: deps.walWriter,
      auditLogger: deps.auditLogger,
      isRegistrationOpen: () => deps.siteService.isRegistrationOpen(),
    });
  });

  it('UT-DD-003-011: register 正常注册', async () => {
    const result = await svc.register({
      email: 'a@b.com', password: 'Pass1234', nickname: 'alice',
    });
    expect(result.userId).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(userStore.findByEmail('a@b.com')).toBeDefined();
  });

  it('UT-DD-003-012: register 重复 email 抛 40901', async () => {
    await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'a' });
    await expect(svc.register({
      email: 'a@b.com', password: 'Pass1234', nickname: 'b',
    })).rejects.toThrow(AppError);
    try {
      await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'b' });
    } catch (e) {
      expect((e as AppError).code).toBe(40901);
    }
  });

  it('UT-DD-003-013: register 维护模式抛 60006', async () => {
    await deps.siteService.setSwitch('registration', false, 'admin');
    await expect(svc.register({
      email: 'b@b.com', password: 'Pass1234', nickname: 'b',
    })).rejects.toThrow(AppError);
    try {
      await svc.register({ email: 'b@b.com', password: 'Pass1234', nickname: 'b' });
    } catch (e) {
      expect((e as AppError).code).toBe(60006);
    }
  });

  it('UT-DD-003-014: register 密码强度不足抛 40003', async () => {
    await expect(svc.register({
      email: 'c@b.com', password: 'short', nickname: 'c',
    })).rejects.toThrow(AppError);
    try {
      await svc.register({ email: 'c@b.com', password: 'short', nickname: 'c' });
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('UT-DD-003-015: login 正常登录', async () => {
    await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'a' });
    const result = await svc.login('a@b.com', 'Pass1234');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(7200);
  });

  it('UT-DD-003-016: login 密码错误抛 40101', async () => {
    await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'a' });
    await expect(svc.login('a@b.com', 'WrongPass')).rejects.toThrow(AppError);
    try {
      await svc.login('a@b.com', 'WrongPass');
    } catch (e) {
      expect((e as AppError).code).toBe(40101);
    }
  });

  it('UT-DD-003-017: login 封禁用户抛 60002', async () => {
    const { userId } = await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'a' });
    await svc.banUser(userId, '违规', 'admin');
    await expect(svc.login('a@b.com', 'Pass1234')).rejects.toThrow(AppError);
    try {
      await svc.login('a@b.com', 'Pass1234');
    } catch (e) {
      expect((e as AppError).code).toBe(60002);
    }
  });

  it('UT-DD-003-018: banUser 管理员封禁用户并写审计', async () => {
    const { userId } = await svc.register({ email: 'a@b.com', password: 'Pass1234', nickname: 'a' });
    const result = await svc.banUser(userId, '违规内容', 'adminId');
    expect(result.status).toBe('banned');
    expect(result.banReason).toBe('违规内容');
  });
});

describe('DD-004 UserStore', () => {
  beforeEach(() => {
    userStore.clear();
  });

  it('UT-DD-004-019: insert 正常插入', () => {
    const now = Math.floor(Date.now() / 1000);
    const user = {
      id: 'u1', email: 'a@b.com', passwordHash: 'h', nickname: 'a',
      role: 'user' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    };
    userStore.insert(user);
    expect(userStore.findById('u1')).toEqual(user);
    expect(userStore.findByEmail('a@b.com')).toEqual(user);
  });

  it('UT-DD-004-020: insert 重复 id 抛 40901', () => {
    const now = Math.floor(Date.now() / 1000);
    const u = { id: 'u1', email: 'a@b.com', passwordHash: 'h', nickname: 'a', role: 'user' as const, status: 'active' as const, createdAt: now, updatedAt: now, lastLoginAt: 0 };
    userStore.insert(u);
    expect(() => userStore.insert({ ...u, email: 'b@b.com' })).toThrow(AppError);
    try {
      userStore.insert({ ...u, email: 'b@b.com' });
    } catch (e) {
      expect((e as AppError).code).toBe(40901);
    }
  });

  it('UT-DD-004-021: insert 含 __proto__ 键被拒绝', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(() => userStore.insert({
      id: '__proto__', email: 'a@b.com', passwordHash: 'h', nickname: 'a',
      role: 'user' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    } as never)).toThrow();
    // 原型链未被污染
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('UT-DD-004-022: update 局部更新', () => {
    const now = Math.floor(Date.now() / 1000);
    const u = { id: 'u1', email: 'a@b.com', passwordHash: 'h', nickname: 'a', role: 'user' as const, status: 'active' as const, createdAt: now, updatedAt: now, lastLoginAt: 0 };
    userStore.insert(u);
    userStore.update('u1', { nickname: 'b' });
    expect(userStore.findById('u1')?.nickname).toBe('b');
  });

  it('UT-DD-004-023: update 不存在 id 抛 40401', () => {
    expect(() => userStore.update('nonexistent', {})).toThrow(AppError);
    try {
      userStore.update('nonexistent', {});
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });
});

describe('DD-005 BloggerService', () => {
  let svc: BloggerService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
    userStore.clear();
    articleStore.clear();
    TagService._reset();
    CategoryService._reset();
    CommentService._reset();
    NotificationService._reset();
    BloggerServiceClass._profileStore().clear();
    deps = makeDeps();
    svc = new BloggerService({ walWriter: deps.walWriter, auditLogger: deps.auditLogger });
  });

  it('UT-DD-005-024: registerBlogger 正常注册博主', async () => {
    const result = await svc.registerBlogger({
      email: 'blogger@b.com', password: 'Pass1234', nickname: 'blogger', intro: '...',
    });
    expect(result.userId).toBeDefined();
    expect(userStore.findById(result.userId)?.role).toBe('blogger');
  });

  it('UT-DD-005-025: getBloggerHome 返回资料+文章分页', () => {
    // 先插入博主与文章
    const now = Math.floor(Date.now() / 1000);
    const user = {
      id: 'bloggerId', email: 'b@b.com', passwordHash: 'h', nickname: 'blogger',
      role: 'blogger' as const, bloggerLevel: 'normal' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    };
    userStore.insert(user);
    BloggerServiceClass._profileStore().insert({ id: 'bloggerId', userId: 'bloggerId', intro: '...' });
    articleStore.insert({
      id: 'a1', authorId: 'bloggerId', title: 'T', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const home = svc.getBloggerHome('bloggerId', 1, 10);
    expect(home.bloggerId).toBe('bloggerId');
    expect(home.articles.list).toBeInstanceOf(Array);
    expect(home.articles.pageSize).toBe(10);
  });

  it('UT-DD-005-026: upgradeBloggerLevel 升级为认证博主', async () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'bloggerId', email: 'b@b.com', passwordHash: 'h', nickname: 'blogger',
      role: 'blogger' as const, bloggerLevel: 'normal' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    const result = await svc.upgradeBloggerLevel('bloggerId', 'verified', 'adminId');
    expect(result.bloggerLevel).toBe('verified');
  });
});

describe('DD-006 FollowService', () => {
  let svc: FollowService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
    userStore.clear();
    articleStore.clear();
    TagService._reset();
    CategoryService._reset();
    CommentService._reset();
    NotificationService._reset();
    deps = makeDeps();
    svc = new FollowService({
      walWriter: deps.walWriter,
      notifyFollow: async () => { await deps.notificationService.notify({ userId: 'blogger1', type: 'follow', title: 'T', body: 'B' }); },
    });
    const now = Math.floor(Date.now() / 1000);
    // 插入博主与用户
    userStore.insert({
      id: 'blogger1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    userStore.insert({
      id: 'u2', email: 'u2@b.com', passwordHash: 'h', nickname: 'u2',
      role: 'user' as const, status: 'active' as const,
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
  });

  it('UT-DD-006-027: follow 正常关注', async () => {
    await svc.follow('u1', 'blogger1');
    expect(svc.isFollowing('u1', 'blogger1')).toBe(true);
  });

  it('UT-DD-006-028: follow 自己抛 60002', async () => {
    await expect(svc.follow('u1', 'u1')).rejects.toThrow(AppError);
    try {
      await svc.follow('u1', 'u1');
    } catch (e) {
      expect((e as AppError).code).toBe(60002);
    }
  });

  it('UT-DD-006-029: follow 重复关注抛 40901', async () => {
    await svc.follow('u1', 'blogger1');
    await expect(svc.follow('u1', 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.follow('u1', 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(40901);
    }
  });

  it('UT-DD-006-030: getFollowers 分页返回粉丝列表', async () => {
    await svc.follow('u1', 'blogger1');
    await svc.follow('u2', 'blogger1');
    const page = svc.getFollowers('blogger1', 1, 10);
    expect(page.list.length).toBe(2);
    expect(page.total).toBe(2);
  });
});

// bcrypt 补充测试（覆盖率提升）
import { hashPassword, comparePassword } from '../../../src/utils/bcrypt.js';

describe('bcrypt 补充', () => {
  it('hashPassword + comparePassword 正确密码匹配', () => {
    const hash = hashPassword('mypassword');
    expect(comparePassword('mypassword', hash)).toBe(true);
    expect(comparePassword('wrongpassword', hash)).toBe(false);
  });

  it('comparePassword 无效 hash 返回 false', () => {
    expect(comparePassword('password', 'invalid-hash')).toBe(false);
  });

  it('hashPassword 使用 BCRYPT_COST 环境变量', () => {
    const oldCost = process.env.BCRYPT_COST;
    process.env.BCRYPT_COST = '12';
    const hash = hashPassword('test');
    expect(hash).toBeDefined();
    expect(comparePassword('test', hash)).toBe(true);
    process.env.BCRYPT_COST = oldCost;
  });

  it('hashPassword BCRYPT_COST 非法值回退默认 10', () => {
    const oldCost = process.env.BCRYPT_COST;
    process.env.BCRYPT_COST = 'invalid';
    const hash = hashPassword('test');
    expect(hash).toBeDefined();
    process.env.BCRYPT_COST = oldCost;
  });
});
