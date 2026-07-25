// 集成测试 - 异常路径与 fallback (TC-INT-031 ~ TC-INT-040).
// 覆盖 TC-DES-012（数据传递异常路径）：超时/错误码 fallback/状态机非法跳转.
// 真实实例化 Store/Service/Controller，禁止 mock 内部模块；仅可 mock 外部 IO。

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { BackupService } from '../../src/services/backup.service.js';
import { AuthService } from '../../src/services/auth.service.js';
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
import { AppError } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  SubscriptionTarget,
  UserRole,
  BackupType,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('TC-INT-031~040 异常路径与 fallback', () => {
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
  let authService: AuthService;
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
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    searchService = new SearchService(searchStore);
    tagService = new TagService(tagStore);
    categoryService = new CategoryService(categoryStore);
    pushService = new PushService(wsStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore,
      userStore,
      bloggerStore,
      tagStore,
      categoryStore,
      pushService,
    );
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    fileService = new FileService(fileStore, userStore);
    commentService = new CommentService(commentStore, articleStore, siteStore);
    siteService = new SiteService(siteStore);
    adService = new AdService(adStore);
    crossRefService = new CrossReferenceService(crossRefStore, articleStore, tagStore);
    notificationService = new NotificationService(notificationStore);
    statsService = new StatsService(new StatsStore());
    backupService = new BackupService(
      backupStore,
      userStore,
      bloggerStore,
      articleStore,
      commentStore,
      notificationStore,
      fileStore,
    );
    clearRevokedJtis();
  });

  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
  }

  function makeClosedSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return {
      readyState: 3, // CLOSED
      send: vi.fn(() => {
        throw new Error('socket closed');
      }),
      close: vi.fn(),
    };
  }

  async function seedAdminBloggerReader() {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'reader',
    });
    return { admin, blogger, reader };
  }

  async function publishArticle(authorId: string, title: string, content: string, adminId: string) {
    const article = articleService.createArticle(authorId, { title, content });
    articleService.submitForReview(authorId, article.id);
    articleService.approveArticle(adminId, UserRole.Admin, article.id);
    return article;
  }

  it('TC-INT-031: 推送失败重试 fallback（3 次后转离线消息）', () => {
    // 用户连接但 readyState=CLOSED，send 抛错 → 重试 3 次后转离线.
    const socket = makeClosedSocket();
    wsStore.register('u-fail', socket);
    const stats = pushService.push('u-fail', 'comment', { msg: 'retry-test' });
    // 3 次重试均失败 → delivered=false.
    expect(stats.delivered).toBe(false);
    expect(stats.attempts).toBe(3);
    expect(stats.delays).toEqual([1000, 2000, 4000]);
    // 转离线消息入队.
    const offline = wsStore.getOffline('u-fail');
    expect(offline.length).toBe(1);
    expect(offline[0]?.channel).toBe('comment');
    expect(offline[0]?.attempts).toBe(3);
    // 重连后 flushOffline 合并投递.
    const openSocket = makeOpenSocket();
    wsStore.register('u-fail', openSocket);
    const result = pushService.flushOffline('u-fail');
    expect(result.delivered).toBe(true);
    expect(result.merged).toBe(1);
    expect(wsStore.getOffline('u-fail')).toHaveLength(0);
  });

  it('TC-INT-032: 文章状态机非法跳转 fallback（archived→published/draft 逆向 + draft→archived 跨态）', async () => {
    const { blogger, admin } = await seedAdminBloggerReader();
    // 完整流转到 archived.
    const article = articleService.createArticle(blogger.id, {
      title: '状态机',
      content: 'c',
    });
    articleService.submitForReview(blogger.id, article.id);
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    articleService.offlineArticle(blogger.id, UserRole.Blogger, article.id);
    articleService.archiveArticle(blogger.id, UserRole.Blogger, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Archived);

    // archived → published 逆向 → 1002.
    expect(() =>
      articleService.transition(blogger.id, article.id, ArticleStatus.Published),
    ).toThrow(AppError);
    try {
      articleService.transition(blogger.id, article.id, ArticleStatus.Published);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }

    // archived → draft 逆向 → 1002.
    expect(() =>
      articleService.transition(blogger.id, article.id, ArticleStatus.Draft),
    ).toThrow(AppError);
    try {
      articleService.transition(blogger.id, article.id, ArticleStatus.Draft);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }

    // 新文章 draft → archived 跨态 → 1002.
    const article2 = articleService.createArticle(blogger.id, {
      title: '跨态',
      content: 'c',
    });
    expect(() =>
      articleService.transition(blogger.id, article2.id, ArticleStatus.Archived),
    ).toThrow(AppError);
    try {
      articleService.transition(blogger.id, article2.id, ArticleStatus.Archived);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }

    // draft → published 跨态 → 1002.
    expect(() =>
      articleService.transition(blogger.id, article2.id, ArticleStatus.Published),
    ).toThrow(AppError);
    try {
      articleService.transition(blogger.id, article2.id, ArticleStatus.Published);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }

    // 合法 draft → pending_review → 200.
    articleService.submitForReview(blogger.id, article2.id);
    expect(articleStore.getById(article2.id)?.status).toBe(ArticleStatus.PendingReview);
  });

  it('TC-INT-033: 交叉引用自引用/引用非 published/不存在 fallback', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    const articleA = await publishArticle(blogger.id, '文章 A', '内容 A', admin.id);
    // articleB 为 draft（未发布）.
    const articleB = articleService.createArticle(blogger.id, {
      title: '文章 B',
      content: 'b',
    });

    // 自引用 → 1003.
    expect(() => crossRefService.addCitation(articleA.id, articleA.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(articleA.id, articleA.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1003);
    }

    // 引用 draft 文章 → 1002（状态机非法）.
    expect(() => crossRefService.addCitation(articleA.id, articleB.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(articleA.id, articleB.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }

    // 引用不存在文章 → 1031.
    expect(() =>
      crossRefService.addCitation(articleA.id, 'nonexistent-id'),
    ).toThrow(AppError);
    try {
      crossRefService.addCitation(articleA.id, 'nonexistent-id');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // 合法引用（A → C，C 已 published）.
    const articleC = await publishArticle(blogger.id, '文章 C', '内容 C', admin.id);
    expect(() => crossRefService.addCitation(articleA.id, articleC.id)).not.toThrow();
    // 重复引用 → 1005.
    expect(() => crossRefService.addCitation(articleA.id, articleC.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(articleA.id, articleC.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-INT-034: 文件上传配额超限/大小/MIME/魔数 fallback', async () => {
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'r',
    });
    // 文件超 10MB → 1041.
    const hugeBytes = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    hugeBytes[0] = 0xff;
    hugeBytes[1] = 0xd8;
    hugeBytes[2] = 0xff;
    expect(() =>
      fileService.upload(reader.id, {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        content: hugeBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(reader.id, {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        content: hugeBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1041);
    }

    // MIME 非白名单（魔数检测失败）→ 1001.
    const bmpBytes = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00]); // BMP magic
    expect(() =>
      fileService.upload(reader.id, {
        filename: 'a.bmp',
        mimeType: 'image/bmp',
        content: bmpBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(reader.id, {
        filename: 'a.bmp',
        mimeType: 'image/bmp',
        content: bmpBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 魔数不匹配（扩展名 jpg 但内容 png）→ 1001.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() =>
      fileService.upload(reader.id, {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: pngBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(reader.id, {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: pngBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 日配额超限 → 1005（Service 层预检抛出）.
    // 上传 5 个 10MB 文件（每个内容不同避免去重），总计 50MB 达到日配额上限.
    for (let i = 0; i < 5; i++) {
      const buf = Buffer.alloc(10 * 1024 * 1024, 0);
      buf[0] = 0xff;
      buf[1] = 0xd8;
      buf[2] = 0xff;
      buf[3] = i; // unique byte to avoid dedup
      fileService.upload(reader.id, {
        filename: `q${i}.jpg`,
        mimeType: 'image/jpeg',
        content: buf,
      });
    }
    // 第 6 个文件 → 50MB + size > 50MB → 1005.
    const over = Buffer.alloc(1024, 0);
    over[0] = 0xff;
    over[1] = 0xd8;
    over[2] = 0xff;
    expect(() =>
      fileService.upload(reader.id, {
        filename: 'over.jpg',
        mimeType: 'image/jpeg',
        content: over,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(reader.id, {
        filename: 'over.jpg',
        mimeType: 'image/jpeg',
        content: over,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-INT-035: 备份恢复 SHA-256 校验失败/不存在/越权 fallback', async () => {
    const { admin, reader } = await seedAdminBloggerReader();
    // 创建合法备份.
    const payload = Buffer.from(JSON.stringify({ data: 'ok' }), 'utf-8');
    const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
    // 篡改备份 payload（直接修改 store 内部）.
    const stored = backupStore.getById(backup.id);
    expect(stored).not.toBeNull();
    // 通过反射修改 payload 模拟篡改.
    const tamperedPayload = Buffer.from(JSON.stringify({ data: 'tampered' }), 'utf-8');
    (stored as { payload: Buffer }).payload = tamperedPayload;
    // 恢复被篡改的备份 → 1001（SHA-256 校验失败）.
    expect(() =>
      backupService.restore(admin.id, UserRole.Admin, backup.id),
    ).toThrow(AppError);
    try {
      backupService.restore(admin.id, UserRole.Admin, backup.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 恢复不存在备份 → 1031.
    expect(() =>
      backupService.restore(admin.id, UserRole.Admin, 'nonexistent-id'),
    ).toThrow(AppError);
    try {
      backupService.restore(admin.id, UserRole.Admin, 'nonexistent-id');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // 非管理员恢复 → 1021.
    const validBackup = backupService.createBackup(
      admin.id,
      UserRole.Admin,
      BackupType.Full,
      Buffer.from(JSON.stringify({ x: 1 }), 'utf-8'),
    );
    expect(() =>
      backupService.restore(reader.id, 'reader', validBackup.id),
    ).toThrow(AppError);
    try {
      backupService.restore(reader.id, 'reader', validBackup.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // 合法恢复 → 200.
    expect(() =>
      backupService.restore(admin.id, UserRole.Admin, validBackup.id),
    ).not.toThrow();
    const restored = backupStore.getById(validBackup.id);
    expect(restored?.status).toBe('restored');
  });

  it('TC-INT-036: 维护模式拦截非管理员 fallback', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    // 开启维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', true);
    expect(siteService.getConfig().maintenanceMode).toBe(true);
    // 普通用户访问被拦截 → 1023.
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1023);
    }
    // blogger 也被拦截 → 1023.
    expect(() => siteService.requireNotMaintenance('blogger')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('blogger');
    } catch (err) {
      expect((err as AppError).code).toBe(1023);
    }
    // 管理员不受影响.
    expect(() => siteService.requireNotMaintenance('admin')).not.toThrow();
    // 关闭维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', false);
    // 普通用户访问恢复.
    expect(() => siteService.requireNotMaintenance('reader')).not.toThrow();
    void blogger;
  });

  it('TC-INT-037: 封禁用户 token 失效 + 解禁重新登录 fallback', async () => {
    const { admin, reader } = await seedAdminBloggerReader();
    // reader 登录获取 token.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(token).toBeTruthy();
    // token 可用.
    const ctx = authService.verifyToken(token);
    expect(ctx.userId).toBe(reader.id);
    // admin 封禁 reader.
    userStore.ban(reader.id, 'violation');
    // 旧 token 立即失效 → 1022.
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (err) {
      expect((err as AppError).code).toBe(1022);
    }
    // 解禁.
    userStore.unban(reader.id);
    // 重新登录获取新 token.
    const { token: newToken } = await authService.userLogin(
      'r@x.com',
      'passwordpassword',
    );
    expect(newToken).not.toBe(token);
    const ctx2 = authService.verifyToken(newToken);
    expect(ctx2.userId).toBe(reader.id);
    void admin;
  });

  it('TC-INT-038: JWT 伪造/过期/无 token fallback', async () => {
    const { reader } = await seedAdminBloggerReader();
    // 无 token → 1011.
    expect(() => authService.verifyToken('')).toThrow(AppError);
    try {
      authService.verifyToken('');
    } catch (err) {
      expect((err as AppError).code).toBe(1011);
    }

    // 伪造 token（无效签名）→ 1012.
    const forged = jwt.sign(
      { userId: reader.id, role: UserRole.Reader, jti: 'forged' },
      'wrong-secret',
      { expiresIn: '1h' },
    );
    expect(() => authService.verifyToken(forged)).toThrow(AppError);
    try {
      authService.verifyToken(forged);
    } catch (err) {
      expect((err as AppError).code).toBe(1012);
    }

    // 过期 token → 1013.
    const expired = jwt.sign(
      { userId: reader.id, role: UserRole.Reader, jti: 'expired' },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1s' }, // 已过期
    );
    expect(() => authService.verifyToken(expired)).toThrow(AppError);
    try {
      authService.verifyToken(expired);
    } catch (err) {
      expect((err as AppError).code).toBe(1013);
    }

    // 合法 token → 200.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    const ctx = authService.verifyToken(token);
    expect(ctx.userId).toBe(reader.id);

    // 错误格式 token（非 JWT）→ 1012.
    expect(() => authService.verifyToken('not.a.jwt')).toThrow(AppError);
    try {
      authService.verifyToken('not.a.jwt');
    } catch (err) {
      expect([1012, 1011]).toContain((err as AppError).code);
    }
  });

  it('TC-INT-039: RBAC 越权 fallback（user/blogger 访问 admin 接口）', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    // user 访问统计 → 1021.
    expect(() => statsService.articleStats('reader')).toThrow(AppError);
    try {
      statsService.articleStats('reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // user 创建广告 → 1021（adService.create 委托 store.create 校验角色）.
    const startAt = new Date(Date.now() - 60_000);
    const endAt = new Date(Date.now() + 60_000);
    expect(() =>
      adService.create(reader.id, 'reader', {
        slotId: 's',
        title: 't',
        imageUrl: 'https://e.com/i.png',
        targetUrl: 'https://e.com/t',
        startAt,
        endAt,
      }),
    ).toThrow(AppError);
    try {
      adService.create(reader.id, 'reader', {
        slotId: 's',
        title: 't',
        imageUrl: 'https://e.com/i.png',
        targetUrl: 'https://e.com/t',
        startAt,
        endAt,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // blogger 访问统计 → 1021.
    expect(() => statsService.articleStats('blogger')).toThrow(AppError);
    try {
      statsService.articleStats('blogger');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // blogger 创建广告 → 1021.
    expect(() =>
      adService.create(blogger.id, 'blogger', {
        slotId: 's2',
        title: 't2',
        imageUrl: 'https://e.com/i2.png',
        targetUrl: 'https://e.com/t2',
        startAt,
        endAt,
      }),
    ).toThrow(AppError);
    try {
      adService.create(blogger.id, 'blogger', {
        slotId: 's2',
        title: 't2',
        imageUrl: 'https://e.com/i2.png',
        targetUrl: 'https://e.com/t2',
        startAt,
        endAt,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // admin 访问统计 → 200.
    const stats = statsService.articleStats('admin');
    expect(stats).toBeDefined();
    // admin 创建广告 → 201.
    const ad = adService.create(admin.id, 'admin', {
      slotId: 's3',
      title: 't3',
      imageUrl: 'https://e.com/i3.png',
      targetUrl: 'https://e.com/t3',
      startAt,
      endAt,
    });
    expect(ad.id).toBeTruthy();
  });

  it('TC-INT-040: 评论嵌套深度超限 + 内容超长 + 开关关闭 fallback', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    const article = await publishArticle(blogger.id, '评论边界', '内容', admin.id);

    // 创建嵌套评论链 depth 0→5（MAX_DEPTH=5）.
    let parent: string | null = null;
    for (let i = 0; i < 6; i++) {
      const c = commentService.createComment(
        article.id,
        reader.id,
        parent,
        `第 ${i + 1} 层评论`,
      );
      // 审核 approve 后才能继续操作（创建不要求 approve，但下一层 parent 需存在）.
      commentService.approveComment(admin.id, 'admin', c.id, 'approve');
      parent = c.id;
    }
    // 第 7 层 depth=6 > MAX_DEPTH=5 → 1004.
    expect(() =>
      commentService.createComment(article.id, reader.id, parent, '第 7 层超限'),
    ).toThrow(AppError);
    try {
      commentService.createComment(article.id, reader.id, parent, '第 7 层超限');
    } catch (err) {
      expect((err as AppError).code).toBe(1004);
    }

    // 评论内容超长（>2000 字符）→ 1001.
    const longContent = 'x'.repeat(2001);
    expect(() =>
      commentService.createComment(article.id, reader.id, null, longContent),
    ).toThrow(AppError);
    try {
      commentService.createComment(article.id, reader.id, null, longContent);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 评论开关关闭 → 1025.
    siteService.updateConfig(admin.id, 'admin', { commentOpen: false });
    expect(siteService.getConfig().commentOpen).toBe(false);
    expect(() =>
      commentService.createComment(article.id, reader.id, null, '正常内容'),
    ).toThrow(AppError);
    try {
      commentService.createComment(article.id, reader.id, null, '正常内容');
    } catch (err) {
      expect((err as AppError).code).toBe(1025);
    }

    // 重新打开评论后合法评论 → 201.
    siteService.updateConfig(admin.id, 'admin', { commentOpen: true });
    const ok = commentService.createComment(article.id, reader.id, null, '合法评论');
    expect(ok.id).toBeTruthy();
    expect(ok.status).toBe('pending_review');
  });
});
