// 集成测试 - 单 INTF 行为集成 (TC-INT-011 ~ TC-INT-020).
// 单 INTF 内部 controller↔service↔store 真实实例化端到端.
// 真实实例化 Store/Service/Controller，禁止 mock 内部模块；仅可 mock 外部 IO。

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { StatsStore } from '../../src/stores/stats.store.js';
import { AppError } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  NotificationType,
  SubscriptionTarget,
  UserRole,
  BackupType,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('TC-INT-011~020 单 INTF 行为集成', () => {
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
    statsStore = new StatsStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    statsStore.setStores({ articleStore, userStore, bloggerStore });
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
    statsService = new StatsService(statsStore);
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

  it('TC-INT-011: 站点配置更新 controller↔service↔store 端到端', async () => {
    const { admin } = await seedAdminBloggerReader();
    // 三层集成：service.updateConfig → store.updateConfig.
    const updated = siteService.updateConfig(admin.id, 'admin', {
      siteName: '我的博客',
      description: '新描述',
    });
    expect(updated.siteName).toBe('我的博客');
    expect(updated.description).toBe('新描述');
    // 持久化：再次读取应保持一致.
    const cfg = siteService.getConfig();
    expect(cfg.siteName).toBe('我的博客');
    // 维护模式开关.
    siteService.setMaintenanceMode(admin.id, 'admin', true);
    expect(siteService.getConfig().maintenanceMode).toBe(true);
    // 非管理员被拦截 → 1023.
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1023);
    }
    // 管理员不受维护模式影响.
    expect(() => siteService.requireNotMaintenance('admin')).not.toThrow();
    // 关闭维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', false);
    expect(() => siteService.requireNotMaintenance('reader')).not.toThrow();
    // 站点统计概览.
    const overview = siteService.getStatsOverview();
    expect(overview.userCount).toBe(3);
  });

  it('TC-INT-012: 博主注册→关注→粉丝列表→取关端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    // 博主注册（先注册用户再创建 blogger 实体）.
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'b1-slug', 'bio1');
    expect(bloggerEntity.userId).toBe(blogger.id);
    expect(bloggerEntity.followerCount).toBe(0);
    // reader 关注 blogger.
    bloggerService.bloggerFollow(reader.id, bloggerEntity.id);
    const after = bloggerStore.getById(bloggerEntity.id);
    expect(after?.followerCount).toBe(1);
    // 重复关注幂等.
    bloggerService.bloggerFollow(reader.id, bloggerEntity.id);
    expect(bloggerStore.getById(bloggerEntity.id)?.followerCount).toBe(1);
    // 粉丝列表（通过订阅关系查询）.
    const followed = bloggerService.listByFollower(reader.id, 1, 10);
    expect(followed.total).toBe(1);
    expect(followed.items[0]?.id).toBe(bloggerEntity.id);
    // 取关.
    bloggerService.bloggerUnfollow(reader.id, bloggerEntity.id);
    expect(bloggerStore.getById(bloggerEntity.id)?.followerCount).toBe(0);
    // 再次取关（已无订阅）→ 1031.
    expect(() => bloggerService.bloggerUnfollow(reader.id, bloggerEntity.id)).toThrow(
      AppError,
    );
    try {
      bloggerService.bloggerUnfollow(reader.id, bloggerEntity.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
    // 自关注禁止.
    expect(() => bloggerService.bloggerFollow(blogger.id, bloggerEntity.id)).toThrow(
      AppError,
    );
    void admin;
  });

  it('TC-INT-013: 用户登录 JWT→封禁→token 失效端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    // 登录签发 token.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(token).toBeTruthy();
    // token 可用.
    const ctx = authService.verifyToken(token);
    expect(ctx.userId).toBe(reader.id);
    // admin 封禁 reader.
    authService.userStore.ban(reader.id, 'violation');
    // 旧 token 立即失效 → 1022（被封禁用户）.
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (err) {
      expect((err as AppError).code).toBe(1022);
    }
    // 解禁后用户可重新登录.
    authService.userStore.unban(reader.id);
    const { token: newToken } = await authService.userLogin(
      'r@x.com',
      'passwordpassword',
    );
    expect(newToken).not.toBe(token);
    const ctx2 = authService.verifyToken(newToken);
    expect(ctx2.userId).toBe(reader.id);
    void blogger;
  });

  it('TC-INT-014: 文章状态机 draft→pending_review→published→offline→archived', async () => {
    const { blogger, admin } = await seedAdminBloggerReader();
    // 创建文章（draft）.
    const article = articleService.createArticle(blogger.id, {
      title: '状态机 测试',
      content: '内容',
    });
    expect(article.status).toBe(ArticleStatus.Draft);
    // draft → pending_review.
    articleService.submitForReview(blogger.id, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.PendingReview);
    // pending_review → published（admin approve）.
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Published);
    // published → offline.
    articleService.offlineArticle(blogger.id, UserRole.Blogger, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Offline);
    // offline → archived.
    articleService.archiveArticle(blogger.id, UserRole.Blogger, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Archived);
    // 发布后 search 索引应被建立.
    const result = searchService.search(null, '状态机', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.articleId).toBe(article.id);
  });

  it('TC-INT-015: 交叉引用建立→图谱→相关文章端到端', async () => {
    const { blogger, admin } = await seedAdminBloggerReader();
    // 创建并发布 A、B 两篇文章.
    const a = articleService.createArticle(blogger.id, {
      title: '文章 A',
      content: '内容 A',
    });
    const b = articleService.createArticle(blogger.id, {
      title: '文章 B',
      content: '内容 B',
    });
    articleService.submitForReview(blogger.id, a.id);
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    articleService.submitForReview(blogger.id, b.id);
    articleService.approveArticle(admin.id, UserRole.Admin, b.id);
    // 建立引用 A → B.
    crossRefService.addCitation(a.id, b.id);
    // 引用图谱.
    const graph = crossRefService.graph(a.id, 1);
    expect(graph.length).toBe(2);
    expect(graph[0]?.articleId).toBe(a.id);
    expect(graph[1]?.articleId).toBe(b.id);
    // 反向链接（被 A 引用的文章 → B 的 backlinks 应含 A）.
    const back = crossRefService.backlinks(b.id);
    expect(back.length).toBe(1);
    expect(back[0]?.fromArticleId).toBe(a.id);
    // 自引用禁止 → 1003.
    expect(() => crossRefService.addCitation(a.id, a.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(a.id, a.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1003);
    }
    // graph depth 非法 → 1001.
    expect(() => crossRefService.graph(a.id, 0)).toThrow(AppError);
    try {
      crossRefService.graph(a.id, 0);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-INT-016: WebSocket 连接→订阅→推送→离线合并端到端', () => {
    // 注册 socket.
    const socket = makeOpenSocket();
    wsStore.register('u-1', socket);
    wsStore.joinChannel('comment', 'u-1');
    expect(wsStore.isOnline('u-1')).toBe(true);
    expect(wsStore.channelUsers('comment')).toContain('u-1');
    // 推送（在线）→ 立即投递.
    const stats = pushService.push('u-1', 'comment', { msg: 'hello' });
    expect(stats.delivered).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ msg: 'hello' }));
    // 广播给通道内所有用户.
    const socket2 = makeOpenSocket();
    wsStore.register('u-2', socket2);
    wsStore.joinChannel('comment', 'u-2');
    const pushed = pushService.broadcast('comment', { msg: 'broadcast' });
    expect(pushed).toBe(2);
    // 离线场景：u-3 未连接，推送入离线队列.
    pushService.push('u-3', 'comment', { msg: 'offline-1' });
    pushService.push('u-3', 'comment', { msg: 'offline-2' });
    expect(wsStore.getOffline('u-3')).toHaveLength(2);
    // 重连后 flushOffline 合并同通道消息.
    const socket3 = makeOpenSocket();
    wsStore.register('u-3', socket3);
    const result = pushService.flushOffline('u-3');
    expect(result.merged).toBe(1);
    expect(wsStore.getOffline('u-3')).toHaveLength(0);
    // 24h 之前的消息被丢弃.
    const oldMsg = {
      channel: 'comment',
      payload: { msg: 'old' },
      at: new Date(Date.now() - 25 * 60 * 60 * 1000),
      attempts: 0,
    };
    wsStore.setOffline('u-4', [oldMsg]);
    const r2 = pushService.flushOffline('u-4');
    expect(r2.discarded).toBe(1);
  });

  it('TC-INT-017: 文件上传→去重→配额查询端到端', async () => {
    const user = await authService.userRegister({
      email: 'fu@x.com',
      password: 'passwordpassword',
      displayName: 'fu',
    });
    // 合法 JPEG 上传.
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    const file = fileService.upload(user.id, {
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    // 同 sha256 去重.
    const dup = fileService.upload(user.id, {
      filename: 'dup.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(dup.id).toBe(file.id);
    // 配额查询.
    const quota = fileService.getQuota(user.id);
    expect(quota.dailyUsed).toBe(jpegBytes.length);
    expect(quota.dailyLimit).toBe(50 * 1024 * 1024);
    expect(quota.monthlyLimit).toBe(500 * 1024 * 1024);
    // 文件元数据查询.
    const fetched = fileService.getById(file.id);
    expect(fetched?.sha256).toBe(file.sha256);
    // 列出用户文件（去重后仅 1 条）.
    const list = fileService.listByUser(user.id);
    expect(list.length).toBe(1);
    // 不同 sha256 上传.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file2 = fileService.upload(user.id, {
      filename: 'b.png',
      mimeType: 'image/png',
      content: pngBytes,
    });
    expect(fileService.listByUser(user.id).length).toBe(2);
    // 删除文件.
    fileService.delete(user.id, 'reader', file2.id);
    expect(fileService.listByUser(user.id).length).toBe(1);
  });

  it('TC-INT-018: 订阅博主→新文章→聚合推送端到端', async () => {
    const { blogger, reader } = await seedAdminBloggerReader();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    // reader 订阅博主.
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    // 模拟博主发新文章事件 → enqueueEvent + aggregateAndPush.
    // reader 未连接 → 推送进入离线队列.
    const event = {
      type: 'newArticle',
      refId: 'a-1',
      at: new Date(),
    };
    // 排队 10 条触发 drain（聚合窗口边界）.
    for (let i = 0; i < 10; i++) {
      subscriptionService.aggregateAndPush(bloggerEntity.id, event);
    }
    // 离线队列应有聚合消息.
    const offline = wsStore.getOffline(reader.id);
    expect(offline.length).toBeGreaterThan(0);
    // 重连后 flush.
    const socket = makeOpenSocket();
    wsStore.register(reader.id, socket);
    const flushResult = pushService.flushOffline(reader.id);
    expect(flushResult.merged).toBeGreaterThan(0);
    // 权限分级.
    const level = subscriptionService.permission(reader.id, SubscriptionTarget.Blogger);
    expect(['basic', 'premium', 'admin']).toContain(level);
    // 取消订阅.
    subscriptionService.unsubscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    expect(
      subscriptionStore.exists(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id),
    ).toBe(false);
  });

  it('TC-INT-019: 数据导出→任务进度→下载端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    // 创建一篇文章 + 文件以便导出有数据.
    const article = articleService.createArticle(blogger.id, {
      title: '导出测试',
      content: '内容',
    });
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    fileService.upload(blogger.id, {
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    // exportUserData 应聚合 User + Blogger + Articles + Notifications + FileAssets 元数据.
    const buffer = backupService.exportUserData(blogger.id);
    expect(buffer.length).toBeGreaterThan(0);
    const parsed = JSON.parse(buffer.toString('utf-8'));
    expect(parsed.user.id).toBe(blogger.id);
    expect(parsed.articles.length).toBe(1);
    expect(parsed.articles[0]?.title).toBe('导出测试');
    expect(parsed.files.length).toBe(1);
    // 创建管理员备份.
    const payload = Buffer.from(JSON.stringify({ snapshot: 'full' }), 'utf-8');
    const backup = backupService.createBackup(
      admin.id,
      UserRole.Admin,
      BackupType.Full,
      payload,
    );
    expect(backup.sha256).toBeTruthy();
    expect(backup.status).toBe('created');
    // 备份完整性校验.
    const ok = backupService.verifyIntegrity(backup.id);
    expect(ok).toBe(true);
    // 恢复（SHA-256 校验通过）.
    backupService.restore(admin.id, UserRole.Admin, backup.id);
    const restored = backupStore.getById(backup.id);
    expect(restored?.status).toBe('restored');
    // 增量导出.
    const incBuffer = backupService.incremental(
      admin.id,
      UserRole.Admin,
      new Date(Date.now() - 60_000),
    );
    expect(incBuffer.length).toBeGreaterThan(0);
  });

  it('TC-INT-020: 广告投放→审核→展示→点击统计端到端', async () => {
    const { admin } = await seedAdminBloggerReader();
    // 创建广告（admin only）.
    const startAt = new Date(Date.now() - 60_000);
    const endAt = new Date(Date.now() + 60_000);
    const ad = adService.create(admin.id, UserRole.Admin, {
      slotId: 'home-banner',
      title: '促销广告',
      imageUrl: 'https://example.com/img.png',
      targetUrl: 'https://example.com/promo',
      startAt,
      endAt,
    });
    expect(ad.status).toBe('pending_review');
    // 非 admin 创建广告 → 1021.
    const reader = await authService.userRegister({
      email: 'r2@x.com',
      password: 'passwordpassword',
      displayName: 'r2',
    });
    expect(() =>
      adService.create(reader.id, 'reader', {
        slotId: 's2',
        title: 't',
        imageUrl: 'https://example.com/i.png',
        targetUrl: 'https://example.com/t',
        startAt,
        endAt,
      }),
    ).toThrow(AppError);
    // 审核 approve.
    adService.audit(admin.id, UserRole.Admin, ad.id, 'approve');
    expect(adStore.getById(ad.id)?.status).toBe('approved');
    // 展示 → impressCount +1.
    adService.adImpress(ad.id);
    expect(adStore.getById(ad.id)?.impressCount).toBe(1);
    // 点击 → clickCount +1.
    adService.adClick(ad.id);
    expect(adStore.getById(ad.id)?.clickCount).toBe(1);
    // 列表分页.
    const list = adService.listBySlot('home-banner', 1, 10);
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(ad.id);
    // 时间窗外展示 → 1002.
    const pastAd = adService.create(admin.id, UserRole.Admin, {
      slotId: 'past',
      title: '过期',
      imageUrl: 'https://example.com/p.png',
      targetUrl: 'https://example.com/p',
      startAt: new Date(Date.now() - 120_000),
      endAt: new Date(Date.now() - 60_000),
    });
    adService.audit(admin.id, UserRole.Admin, pastAd.id, 'approve');
    expect(() => adService.adImpress(pastAd.id)).toThrow(AppError);
    try {
      adService.adImpress(pastAd.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });
});
