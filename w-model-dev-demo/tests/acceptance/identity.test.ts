// 验收测试 - 身份认证 (UAT-004 ~ UAT-009).
// 覆盖 REQ-002/REQ-003：博主注册/重复邮箱/权限隔离/用户登录/JWT/封禁/角色越权.
// 真实实例化 Store/Service 三层，从用户场景出发；禁止 mock 内部模块.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { AuthService, UserService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  UserRole,
  UserStatus,
} from '../../src/types.js';
import { clearRevokedJtis, signToken, verifyToken } from '../../src/utils/auth.js';

describe('UAT-004~009 身份认证验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let bloggerStore: BloggerStore;
  let subscriptionStore: SubscriptionStore;
  let siteStore: SiteStore;
  let authService: AuthService;
  let userService: UserService;
  let articleService: ArticleService;
  let bloggerService: BloggerService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    bloggerStore = new BloggerStore();
    subscriptionStore = new SubscriptionStore();
    siteStore = new SiteStore();
    const commentStore = new CommentStore();
    const fileStore = new FileStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    userService = new UserService(userStore, authService);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    clearRevokedJtis();
  });

  it('UAT-004: 博主注册正常流程', async () => {
    // 博主通过邮箱+密码注册，密码 bcrypt 哈希存储.
    const blogger = await authService.userRegister({
      email: 'blogger@test.com',
      password: 'passwordpassword',
      displayName: '博主A',
      role: UserRole.Blogger,
    });
    expect(blogger.id).toBeTruthy();
    expect(blogger.email).toBe('blogger@test.com');
    // 密码以 bcrypt 哈希存储（$2b$ 开头）.
    expect(blogger.passwordHash.startsWith('$2b$')).toBe(true);
    expect(blogger.passwordHash).not.toBe('passwordpassword');
    // 注册博主档案.
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-a', 'bio');
    expect(bloggerEntity.userId).toBe(blogger.id);
    // 登录获取 JWT.
    const { token, user } = await authService.userLogin('blogger@test.com', 'passwordpassword');
    expect(token).toBeTruthy();
    expect(user.id).toBe(blogger.id);
    // JWT 有效可验证.
    const verified = authService.verifyToken(token);
    expect(verified.userId).toBe(blogger.id);
    expect(verified.role).toBe(UserRole.Blogger);
  });

  it('UAT-005: 重复邮箱注册异常', async () => {
    await authService.userRegister({
      email: 'blogger@test.com',
      password: 'passwordpassword',
      displayName: '博主A',
      role: UserRole.Blogger,
    });
    // 使用已注册邮箱再次注册 → 409 BusinessConflict (1005).
    expect(() => authService.userRegister({
      email: 'blogger@test.com',
      password: 'passwordpassword',
      displayName: '博主B',
      role: UserRole.Blogger,
    })).rejects.toThrow(AppError);
    await expect(authService.userRegister({
      email: 'blogger@test.com',
      password: 'passwordpassword',
      displayName: '博主B',
      role: UserRole.Blogger,
    })).rejects.toMatchObject({ code: ErrorCode.BusinessConflict, httpStatus: 409 });
  });

  it('UAT-006: 权限隔离边界（跨博主编辑）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const bloggerA = await authService.userRegister({
      email: 'a@x.com',
      password: 'passwordpassword',
      displayName: 'bloggerA',
      role: UserRole.Blogger,
    });
    const bloggerB = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'bloggerB',
      role: UserRole.Blogger,
    });
    // 博主 B 创建文章.
    const article = articleService.createArticle(bloggerB.id, { title: 'B 的文章', content: '内容' });
    expect(article.authorId).toBe(bloggerB.id);
    // 博主 A 尝试操作博主 B 的文章 → 1021 Rbac.
    expect(() => articleService.transition(bloggerA.id, article.id, ArticleStatus.PendingReview))
      .toThrow(AppError);
    try {
      articleService.transition(bloggerA.id, article.id, ArticleStatus.PendingReview);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
      expect((e as AppError).httpStatus).toBe(403);
    }
    // 文章作者本人可流转.
    articleService.submitForReview(bloggerB.id, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.PendingReview);
    // 管理员可审核.
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Published);
  });

  it('UAT-007: 用户登录 JWT 正常', async () => {
    await authService.userRegister({
      email: 'user@test.com',
      password: 'passwordpassword',
      displayName: 'user',
    });
    // 登录获取 JWT.
    const { token, user } = await authService.userLogin('user@test.com', 'passwordpassword');
    expect(token).toBeTruthy();
    expect(user.email).toBe('user@test.com');
    // JWT 可被 verifyToken 验证.
    const { payload } = verifyToken(token);
    expect(payload.userId).toBe(user.id);
    expect(payload.role).toBe(UserRole.Reader);
    // 后续请求携带 token 鉴权 — verifyToken 返回 userId/role.
    const verified = authService.verifyToken(token);
    expect(verified.userId).toBe(user.id);
    expect(verified.role).toBe(UserRole.Reader);
    // 错误密码登录失败 → 1012 WrongPassword.
    await expect(authService.userLogin('user@test.com', 'wrong-password'))
      .rejects.toMatchObject({ code: ErrorCode.WrongPassword });
  });

  it('UAT-008: 封禁用户 token 失效', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'reader',
    });
    // reader 登录获取 token.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(token).toBeTruthy();
    // admin 封禁 reader.
    userService.banUser(admin.id, 'admin', reader.id, '违规操作');
    expect(userStore.getById(reader.id)?.status).toBe(UserStatus.Banned);
    // 封禁后旧 token 失效（jti 已撤销 → 1022 Banned）.
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Banned);
      expect((e as AppError).httpStatus).toBe(403);
    }
    // 被封禁用户登录被拒.
    await expect(authService.userLogin('r@x.com', 'passwordpassword'))
      .rejects.toMatchObject({ code: ErrorCode.Banned });
    // 解禁后可重新登录.
    userService.unbanUser(admin.id, 'admin', reader.id);
    expect(userStore.getById(reader.id)?.status).toBe(UserStatus.Active);
    const relogin = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(relogin.token).toBeTruthy();
  });

  it('UAT-009: 角色权限越权异常', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'reader',
    });
    // reader 登录获取 token.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    // JWT 角色为 reader，访问管理员接口需被 service 层 Rbac 拒绝.
    const verified = authService.verifyToken(token);
    expect(verified.role).toBe(UserRole.Reader);
    // reader 尝试审核文章 → 1021.
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
    const article = articleService.createArticle(blogger.id, { title: '审核测试', content: '内容' });
    articleService.submitForReview(blogger.id, article.id);
    // reader 真实角色调用 → 1021.
    expect(() => articleService.approveArticle(reader.id, UserRole.Reader, article.id))
      .toThrow(AppError);
    try {
      articleService.approveArticle(reader.id, UserRole.Reader, article.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
      expect((e as AppError).httpStatus).toBe(403);
    }
    // reader 尝试封禁他人 → 1021.
    expect(() => userService.banUser(reader.id, UserRole.Reader, blogger.id, '越权'))
      .toThrow(AppError);
    // reader 用 signToken 伪造 admin token — 但 verifyToken 仍按 token 中的 role 返回，
    // 真正鉴权在 service 层：即使 token role=admin，approveArticle 也会按 role=admin 通过。
    // 这反映 RBAC 信任 JWT payload；伪造 JWT 需要密钥（UAT-054 覆盖）.
    const forgedToken = signToken(reader.id, UserRole.Admin);
    const forgedVerified = authService.verifyToken(forgedToken);
    expect(forgedVerified.role).toBe(UserRole.Admin);
    // admin 正常审核通过.
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Published);
  });
});
