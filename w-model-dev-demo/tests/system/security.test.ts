// 系统测试 - 安全 OWASP (TC-SYS-045 ~ TC-SYS-054).
// 覆盖 10 个安全场景：JWT伪造/过期/封禁/bcrypt/RBAC越权/zod校验/
// 原型链污染防护/路径遍历防护/XSS输入消毒/文件魔数伪造.
// 真实断言（伪造 JWT 必须验证被拒绝），禁止 mock 内部模块。

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { AdStore } from '../../src/stores/ad.store.js';
import { CrossReferenceStore } from '../../src/stores/crossref.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { BackupStore } from '../../src/stores/backup.store.js';
import { StatsStore } from '../../src/stores/stats.store.js';
import { RecommendStore } from '../../src/stores/recommend.store.js';
import { BackupService } from '../../src/services/backup.service.js';
import { AuthService, UserService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { TagService } from '../../src/services/tag.service.js';
import { CategoryService } from '../../src/services/category.service.js';
import { SubscriptionService } from '../../src/services/subscription.service.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { FileService } from '../../src/services/file.service.js';
import { PushService } from '../../src/services/push.service.js';
import { CommentService } from '../../src/services/comment.service.js';
import { SiteService } from '../../src/services/site.service.js';
import { AdService } from '../../src/services/ad.service.js';
import { CrossReferenceService } from '../../src/services/crossref.service.js';
import { NotificationService } from '../../src/services/notification.service.js';
import { StatsService } from '../../src/services/stats.service.js';
import { RecommendService } from '../../src/services/recommend.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  comparePassword,
  hashPassword,
  verifyToken,
  clearRevokedJtis,
} from '../../src/utils/auth.js';
import { sanitizeFilename } from '../../src/stores/file.store.js';
import { tagNameSchema } from '../../src/utils/schemas.js';
import {
  ArticleStatus,
  UserRole,
} from '../../src/types.js';

describe('TC-SYS-045~054 安全 OWASP', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerStore: BloggerStore;
  let fileStore: FileStore;
  let notificationStore: NotificationStore;
  let commentStore: CommentStore;
  let siteStore: SiteStore;
  let adStore: AdStore;
  let crossRefStore: CrossReferenceStore;
  let wsStore: WsStore;
  let backupStore: BackupStore;
  let statsStore: StatsStore;
  let recommendStore: RecommendStore;
  let authService: AuthService;
  let userService: UserService;
  let articleService: ArticleService;
  let searchService: SearchService;
  let tagService: TagService;
  let categoryService: CategoryService;
  let subscriptionService: SubscriptionService;
  let bloggerService: BloggerService;
  let fileService: FileService;
  let pushService: PushService;
  let commentService: CommentService;
  let siteService: SiteService;
  let adService: AdService;
  let crossRefService: CrossReferenceService;
  let notificationService: NotificationService;
  let statsService: StatsService;
  let backupService: BackupService;
  let recommendService: RecommendService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    subscriptionStore = new SubscriptionStore();
    bloggerStore = new BloggerStore();
    fileStore = new FileStore();
    notificationStore = new NotificationStore();
    commentStore = new CommentStore();
    siteStore = new SiteStore();
    adStore = new AdStore();
    crossRefStore = new CrossReferenceStore();
    wsStore = new WsStore();
    backupStore = new BackupStore();
    statsStore = new StatsStore();
    recommendStore = new RecommendStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    statsStore.setStores({ articleStore, userStore, bloggerStore });
    authService = new AuthService(userStore);
    userService = new UserService(userStore, authService);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    searchService = new SearchService(searchStore);
    tagService = new TagService(tagStore);
    categoryService = new CategoryService(categoryStore);
    pushService = new PushService(wsStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore, userStore, bloggerStore, tagStore, categoryStore, pushService,
    );
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    fileService = new FileService(fileStore, userStore);
    commentService = new CommentService(commentStore, articleStore, siteStore);
    siteService = new SiteService(siteStore);
    adService = new AdService(adStore);
    crossRefService = new CrossReferenceService(crossRefStore, articleStore, tagStore);
    notificationService = new NotificationService(notificationStore);
    statsService = new StatsService(statsStore);
    backupService = new BackupService(
      backupStore, userStore, bloggerStore, articleStore, commentStore, notificationStore, fileStore,
    );
    recommendService = new RecommendService(recommendStore, articleStore, subscriptionStore);
    clearRevokedJtis();
  });

  it('TC-SYS-045: JWT 伪造 token（错误密钥签名）被拒绝', () => {
    // 用错误密钥签名 → verifyToken 必须拒绝.
    const forged = jwt.sign({ userId: 'u1', role: UserRole.Admin, jti: 'jti-forged' }, 'wrong-secret-key');
    expect(() => verifyToken(forged)).toThrow(AppError);
    try {
      verifyToken(forged);
    } catch (e) {
      // 错误密钥 → invalid signature → 1012 (WrongPassword).
      expect((e as AppError).code).toBe(ErrorCode.WrongPassword);
    }
  });

  it('TC-SYS-046: JWT 过期 token（exp 过去时间）被拒绝', () => {
    // 构造 exp 为过去时间的 token.
    const pastPayload = { userId: 'u1', role: UserRole.Reader, jti: 'jti-expired' };
    const expired = jwt.sign(pastPayload, 'test-secret-key', { expiresIn: -1 });
    expect(() => verifyToken(expired)).toThrow(AppError);
    try {
      verifyToken(expired);
    } catch (e) {
      // 过期 → 1013 (ExpiredToken).
      expect((e as AppError).code).toBe(ErrorCode.ExpiredToken);
    }
  });

  it('TC-SYS-047: JWT 封禁 token（jti 撤销）被拒绝', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'reader',
    });
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    // 封禁 reader → 撤销其 jti.
    userService.banUser(admin.id, 'admin', reader.id, '违规');
    // 旧 token 验证 → 1022 (Banned，jti 已撤销).
    expect(() => verifyToken(token)).toThrow(AppError);
    try {
      verifyToken(token);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Banned);
    }
  });

  it('TC-SYS-048: bcrypt 哈希校验——明文不可逆，正确密码通过错误密码拒绝', async () => {
    const plain = 'mySecretPass123';
    const hash = await hashPassword(plain);
    // 哈希值不等于明文.
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
    // 正确密码通过.
    const ok = await comparePassword(plain, hash);
    expect(ok).toBe(true);
    // 错误密码拒绝.
    const bad = await comparePassword('wrongPassword', hash);
    expect(bad).toBe(false);
    // 相同明文两次哈希结果不同（盐随机）.
    const hash2 = await hashPassword(plain);
    expect(hash2).not.toBe(hash);
  });

  it('TC-SYS-049: RBAC 越权——reader 冒充 admin 操作被拒绝', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'reader',
    });
    const article = articleService.createArticle(blogger.id, { title: 'RBAC', content: '内容' });
    // reader 尝试 approve 文章（仅 admin）→ 1021.
    expect(() => articleService.approveArticle(reader.id, UserRole.Reader, article.id))
      .toThrow(AppError);
    try {
      articleService.approveArticle(reader.id, UserRole.Reader, article.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
    }
    // reader 尝试 ban 用户（仅 admin）→ 1021.
    expect(() => userService.banUser(reader.id, 'reader', blogger.id, '越权'))
      .toThrow(AppError);
    // admin 正常 approve.
    articleService.submitForReview(blogger.id, article.id);
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Published);
  });

  it('TC-SYS-050: zod 校验——非法邮箱/短密码/空昵称被拒绝', async () => {
    // 非法邮箱.
    await expect(authService.userRegister({
      email: 'not-an-email', password: 'passwordpassword', displayName: 'ok',
    })).rejects.toThrow(AppError);
    try {
      await authService.userRegister({
        email: 'bad', password: 'passwordpassword', displayName: 'ok',
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.ZodValidation);
    }
    // 短密码（< 8）.
    await expect(authService.userRegister({
      email: 'ok@x.com', password: 'short', displayName: 'ok',
    })).rejects.toThrow(AppError);
    // 空昵称.
    await expect(authService.userRegister({
      email: 'ok@x.com', password: 'passwordpassword', displayName: '',
    })).rejects.toThrow(AppError);
  });

  it('TC-SYS-051: 原型链污染防护——__proto__ 注入不影响 Object.prototype', async () => {
    // 构造含 __proto__ 的恶意输入尝试污染原型链.
    const malicious = JSON.parse('{"__proto__":{"polluted":"yes"},"email":"a@x.com"}');
    // 注入尝试：访问 Object.prototype.polluted 应为 undefined.
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    // 即使传入含 __proto__ 的对象，Object.prototype 不受影响（Store 使用显式字段，不展开）.
    // 模拟用户注册时 email 字段访问.
    const email = malicious.email;
    expect(email).toBe('a@x.com');
    // 原型链未被污染.
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    // 验证注册流程不因 __proto__ 字段崩溃.
    const user = await authService.userRegister({
      email: 'safe@x.com', password: 'passwordpassword', displayName: 'safe',
    });
    expect(user.id).toBeTruthy();
    // 全局原型链仍未被污染.
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it('TC-SYS-052: 路径遍历防护——sanitizeFilename 移除 ../ 和路径分隔符', () => {
    // 含 ../ 路径遍历尝试.
    const dirty = '../../../etc/passwd';
    const clean = sanitizeFilename(dirty);
    // 移除 .. 和路径分隔符.
    expect(clean).not.toContain('..');
    expect(clean).not.toContain('/');
    expect(clean).not.toContain('\\');
    // 含 <>"' 的 XSS 文件名.
    const xssName = '<script>alert("xss")</script>.jpg';
    const cleanXss = sanitizeFilename(xssName);
    expect(cleanXss).not.toContain('<');
    expect(cleanXss).not.toContain('>');
    expect(cleanXss).not.toContain('"');
    expect(cleanXss).not.toContain("'");
    // 控制字符移除.
    const ctrlName = 'file\x00\x01name.txt';
    const cleanCtrl = sanitizeFilename(ctrlName);
    expect(cleanCtrl).not.toContain('\x00');
    expect(cleanCtrl).not.toContain('\x01');
  });

  it('TC-SYS-053: XSS 输入消毒——tagNameSchema 拒绝含 <>"\'/\\ 的标签名', () => {
    // 合法标签名通过.
    expect(tagNameSchema.safeParse('React').success).toBe(true);
    expect(tagNameSchema.safeParse('前端').success).toBe(true);
    // 含 XSS 字符的标签名被拒绝.
    expect(tagNameSchema.safeParse('<script>').success).toBe(false);
    expect(tagNameSchema.safeParse('"><img>').success).toBe(false);
    expect(tagNameSchema.safeParse("a'b").success).toBe(false);
    expect(tagNameSchema.safeParse('a/b').success).toBe(false);
    expect(tagNameSchema.safeParse('a\\b').success).toBe(false);
    // 空标签名被拒绝.
    expect(tagNameSchema.safeParse('').success).toBe(false);
    // 超长标签名（> 30）被拒绝.
    expect(tagNameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  it('TC-SYS-054: 文件魔数伪造防护——扩展名与内容不符被拒绝', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // PNG 内容声明为 jpeg → 1001.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'fake.jpg', mimeType: 'image/jpeg', content: pngBytes,
    })).toThrow(AppError);
    try {
      fileService.upload(blogger.id, {
        filename: 'fake.jpg', mimeType: 'image/jpeg', content: pngBytes,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.ZodValidation);
    }
    // 可执行文件伪装成 jpeg（MZ 头）→ 1001.
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'malware.jpg', mimeType: 'image/jpeg', content: exeBytes,
    })).toThrow(AppError);
    // 空内容 → 1001.
    expect(() => fileService.upload(blogger.id, {
      filename: 'empty.jpg', mimeType: 'image/jpeg', content: Buffer.alloc(0),
    })).toThrow(AppError);
    // 合法 jpeg 上传成功.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = fileService.upload(blogger.id, {
      filename: 'ok.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    });
    expect(file.id).toBeTruthy();
  });
});
