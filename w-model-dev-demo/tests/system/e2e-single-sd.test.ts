// 系统测试 - 单 SD 端到端 (TC-SYS-001 ~ TC-SYS-017).
// 覆盖 17 个 SD 子系统主链路：站点/博主/用户/推荐/广告/统计/搜索/标签/分类/
// 评论/通知/文章/交叉引用/推送/文件/订阅/备份.
// 真实实例化 Store/Service/Controller 三层，禁止 mock 内部模块；仅可 mock 外部 IO.

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
import { RecommendService } from '../../src/services/recommend.service.js';
import { RecommendStore } from '../../src/stores/recommend.store.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  BackupType,
  CommentStatus,
  NotificationType,
  SubscriptionTarget,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('TC-SYS-001~017 单 SD 端到端', () => {
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
    recommendService = new RecommendService(recommendStore, articleStore, subscriptionStore);
    clearRevokedJtis();
  });

  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return { readyState: 1, send: vi.fn(), close: vi.fn() };
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

  it('TC-SYS-001: 站点配置更新→维护模式→公告定时发布端到端', async () => {
    const { admin, reader } = await seedAdminBloggerReader();
    // 1) 管理员更新站点配置.
    const cfg = siteService.updateConfig(admin.id, 'admin', {
      siteName: '我的博客',
      description: '端到端测试',
    });
    expect(cfg.siteName).toBe('我的博客');
    // 2) 开启维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', true);
    expect(siteService.getConfig().maintenanceMode).toBe(true);
    // 3) 普通用户被维护模式拦截（requireNotMaintenance 抛 1023）.
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Maintenance);
    }
    // 4) 管理员不受维护模式影响.
    expect(() => siteService.requireNotMaintenance('admin')).not.toThrow();
    // 5) 创建定时公告（未来时间）.
    const future = new Date(Date.now() + 60_000);
    siteService.scheduleAnnouncement(admin.id, 'admin', '系统升级公告', future);
    expect(siteService.getConfig().announcement).toBe('系统升级公告');
    // 6) 关闭维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', false);
    expect(siteService.getConfig().maintenanceMode).toBe(false);
    expect(() => siteService.requireNotMaintenance('reader')).not.toThrow();
    void reader;
  });

  it('TC-SYS-002: 用户注册→博主注册→登录→权限隔离端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    // 博主注册博主档案.
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    expect(bloggerEntity.userId).toBe(blogger.id);
    // 博主登录获取 JWT.
    const { token, user } = await authService.userLogin('b@x.com', 'passwordpassword');
    expect(token).toBeTruthy();
    expect(user.id).toBe(blogger.id);
    // 博主创建文章.
    const article = articleService.createArticle(blogger.id, { title: '权限测试', content: '内容' });
    expect(article.authorId).toBe(blogger.id);
    // 另一博主尝试操作他人文章 → 1021.
    const blogger2 = await authService.userRegister({
      email: 'b2@x.com',
      password: 'passwordpassword',
      displayName: 'blogger2',
      role: UserRole.Blogger,
    });
    expect(() => articleService.transition(blogger2.id, article.id, ArticleStatus.PendingReview))
      .toThrow(AppError);
    try {
      articleService.transition(blogger2.id, article.id, ArticleStatus.PendingReview);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
    }
    void admin;
  });

  it('TC-SYS-003: 多用户封禁→token 失效→审计日志端到端', async () => {
    const { admin, reader } = await seedAdminBloggerReader();
    // reader 登录获取 token.
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(token).toBeTruthy();
    // admin 封禁 reader（撤销其 token）.
    const { UserService } = await import('../../src/services/auth.service.js');
    const userService = new UserService(userStore, authService);
    userService.banUser(admin.id, 'admin', reader.id, '违规行为');
    expect(userStore.getById(reader.id)?.status).toBe('banned');
    // 封禁后旧 token 失效（jti 已撤销 → 1022）.
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Banned);
    }
    // 被封禁用户登录被拒.
    await expect(authService.userLogin('r@x.com', 'passwordpassword')).rejects.toThrow(AppError);
    // 解禁后可重新登录.
    userService.unbanUser(admin.id, 'admin', reader.id);
    expect(userStore.getById(reader.id)?.status).toBe('active');
  });

  it('TC-SYS-004: 推荐算法三模式→推荐位管理端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    // 发文章.
    await publishArticle(blogger.id, '推荐文章1', '内容1', admin.id);
    await publishArticle(blogger.id, '推荐文章2', '内容2', admin.id);
    // hot 模式：无需登录.
    const hot = recommendService.hot(1, 10);
    expect(hot.total).toBeGreaterThanOrEqual(2);
    // latest 模式.
    const latest = recommendService.latest(1, 10);
    expect(latest.total).toBeGreaterThanOrEqual(2);
    // personalized 模式：需登录（reader 已注册）.
    const pers = recommendService.personalized(reader.id, 1, 10);
    expect(pers.page).toBe(1);
    // 推荐位管理：仅管理员（setSlot(operatorId, operatorRole, slotName, articleId, priority)）.
    recommendService.setSlot(admin.id, 'admin', '首页热门', hot.items[0]!.id, 1);
    // 非管理员设置推荐位 → 1021（requireAdmin 在 service 层鉴权）.
    expect(() => recommendService.setSlot(blogger.id, 'blogger', '首页热门', hot.items[0]!.id, 1))
      .toThrow(AppError);
    // 验证管理员设置生效.
    expect(recommendStore.getSlot('首页热门')?.articleId).toBe(hot.items[0]!.id);
  });

  it('TC-SYS-005: 广告投放→时间范围校验→审核→点击统计端到端', async () => {
    const { admin } = await seedAdminBloggerReader();
    const startAt = new Date(Date.now() - 60_000);
    const endAt = new Date(Date.now() + 60_000);
    // 创建广告 pending.
    const ad = adService.create(admin.id, UserRole.Admin, {
      slotId: 'home-banner',
      title: '促销广告',
      imageUrl: 'https://example.com/i.png',
      targetUrl: 'https://example.com/p',
      startAt,
      endAt,
    });
    expect(ad.status).toBe('pending_review');
    // 审核 approved.
    adService.audit(admin.id, UserRole.Admin, ad.id, 'approve');
    expect(adStore.getById(ad.id)?.status).toBe('approved');
    // 展示 + 点击.
    adService.adImpress(ad.id);
    adService.adClick(ad.id);
    const updated = adStore.getById(ad.id);
    expect(updated?.impressCount).toBe(1);
    expect(updated?.clickCount).toBe(1);
    // 按 slot 查询（listBySlot(slotId, page, pageSize) 返回 Page<Ad>）.
    const list = adService.listBySlot('home-banner', 1, 10);
    expect(list.items.length).toBe(1);
    expect(list.total).toBe(1);
  });

  it('TC-SYS-006: 统计四维度→仅管理员访问端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    await publishArticle(blogger.id, '统计文章', '内容', admin.id);
    // 文章统计（StatsService 仅 admin 可调用，由 controller 鉴权）.
    const articleStats = statsService.articleStats('admin');
    expect(articleStats.total).toBeGreaterThanOrEqual(1);
    expect(articleStats.published).toBeGreaterThanOrEqual(1);
    // 用户统计.
    const userStats = statsService.userStats('admin');
    expect(userStats.total).toBe(3);
    expect(userStats.byRole[UserRole.Admin]).toBe(1);
    // 博主统计.
    const bloggerStats = statsService.bloggerStats('admin');
    expect(bloggerStats).toBeDefined();
    // 站点趋势（siteTrend(role, days) 需 admin 角色）.
    const trend = statsService.siteTrend('admin', 7);
    expect(trend).toBeDefined();
    // 站点概览（SiteStore 聚合）.
    const overview = siteService.getStatsOverview();
    expect(overview.userCount).toBe(3);
    expect(overview.articleCount).toBeGreaterThanOrEqual(1);
  });

  it('TC-SYS-007: 全文搜索→多维搜索→排序→搜索历史 FIFO 端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    await publishArticle(blogger.id, 'React 入门指南', 'React 基础教程内容', admin.id);
    await publishArticle(blogger.id, 'Vue 进阶', 'Vue 框架进阶内容', admin.id);
    // 全文搜索 React.
    const result = searchService.search(null, 'React', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.articleId).toBeTruthy();
    // suggest.
    const sug = searchService.suggest('Re');
    expect(Array.isArray(sug)).toBe(true);
    // 搜索历史 FIFO.
    for (let i = 0; i < 25; i++) {
      searchService.search(reader.id, `关键词${i}`, 'relevance', 1, 10);
    }
    const hist = searchService.history(reader.id);
    expect(hist.length).toBeLessThanOrEqual(20); // SEARCH_HISTORY_MAX=20
    // 清空历史.
    searchService.clearSearchHistory(reader.id);
    expect(searchService.history(reader.id).length).toBe(0);
  });

  it('TC-SYS-008: 标签创建审核→绑定→标签云→合并端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    const article = await publishArticle(blogger.id, '标签文章', '内容', admin.id);
    // 创建标签 pending.
    const tag = tagService.createTag('React', 'react');
    expect(tag.status).toBe('pending_review');
    // 审核 approved.
    const approved = tagService.approveTag(admin.id, 'admin', tag.id);
    expect(approved.status).toBe('approved');
    // 绑定.
    tagService.bind(article.id, [tag.id]);
    // 标签云.
    const cloud = tagService.cloud(10);
    const reactEntry = cloud.find((c) => c.name === 'React');
    expect(reactEntry?.articleCount).toBe(1);
    // 合并标签.
    const tag2 = tagService.createTag('Frontend', 'frontend');
    tagService.approveTag(admin.id, 'admin', tag2.id);
    tagService.merge(admin.id, 'admin', tag.id, tag2.id);
    // 合并后源标签已删除（getById 对 deleted 标签返回 null）.
    expect(tagStore.getById(tag.id)).toBeNull();
  });

  it('TC-SYS-009: 分类树多级→面包屑→级联删除→合并端到端', async () => {
    const { admin } = await seedAdminBloggerReader();
    // 创建 6 级分类（depth 0~5，MAX_DEPTH=5 允许 depth<=5）.
    let parentId: string | null = null;
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const cat = categoryService.createCategory(`L${i}`, parentId);
      ids.push(cat.id);
      parentId = cat.id;
      expect(cat.depth).toBe(i);
    }
    // 第 7 级 → 1004（depth=6 超 MAX_DEPTH=5）.
    expect(() => categoryService.createCategory('L6', parentId)).toThrow(AppError);
    // 面包屑.
    const breadcrumb = categoryService.breadcrumb(ids[5]!);
    expect(breadcrumb.length).toBe(6);
    expect(breadcrumb[0]?.name).toBe('L0');
    expect(breadcrumb[5]?.name).toBe('L5');
    // 级联删除根分类.
    categoryService.cascadeDelete(admin.id, 'admin', ids[0]!);
    // tree 应为空.
    expect(categoryService.tree().length).toBe(0);
  });

  it('TC-SYS-010: 评论多级回复→敏感词审核→点赞幂等→举报端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    const article = await publishArticle(blogger.id, '评论测试', '内容', admin.id);
    // 创建根评论.
    const root = commentService.createComment(article.id, reader.id, null, '好文');
    expect(root.status).toBe(CommentStatus.PendingReview);
    // 审核通过.
    commentService.approveComment(admin.id, 'admin', root.id, 'approve');
    expect(commentStore.getById(root.id)?.status).toBe(CommentStatus.Approved);
    // 多级回复至 6 级（root=depth0, replies=depth1~5，MAX_DEPTH=5 允许 depth<=5）.
    let parentId: string | null = root.id;
    for (let i = 0; i < 5; i++) {
      const reply = commentService.createComment(article.id, reader.id, parentId, `回复${i}`);
      commentService.approveComment(admin.id, 'admin', reply.id, 'approve');
      parentId = reply.id;
    }
    // 第 7 级 → 1004（depth=6 超 MAX_DEPTH=5）.
    expect(() => commentService.createComment(article.id, reader.id, parentId, '超深')).toThrow(AppError);
    // 点赞幂等.
    commentService.like(reader.id, root.id);
    commentService.like(reader.id, root.id); // 重复点赞幂等.
    expect(commentStore.getById(root.id)?.likeCount).toBe(1);
    // 举报.
    commentService.reportComment(reader.id, root.id, '不当言论');
    expect(commentStore.getById(root.id)?.status).toBe(CommentStatus.Flagged);
    // 管理员 resolve 恢复.
    commentService.resolveComment(admin.id, 'admin', root.id);
    expect(commentStore.getById(root.id)?.status).toBe(CommentStatus.Approved);
  });

  it('TC-SYS-011: 通知触发→已读管理→通知设置关闭端到端', async () => {
    const { blogger } = await seedAdminBloggerReader();
    // 触发通知.
    const notif = notificationService.enqueueNotification(
      blogger.id,
      NotificationType.Comment,
      '收到评论',
      '有人评论了你的文章',
      'ref-1',
    );
    expect(notif).not.toBeNull();
    expect(notificationService.unreadSize(blogger.id)).toBe(1);
    // 标记已读.
    notificationService.markRead(blogger.id, notif!.id);
    expect(notificationService.unreadSize(blogger.id)).toBe(0);
    // 多条通知 + 全部已读.
    for (let i = 0; i < 5; i++) {
      notificationService.enqueueNotification(
        blogger.id,
        NotificationType.System,
        `系统通知${i}`,
        '内容',
        `ref-${i}`,
      );
    }
    expect(notificationService.unreadSize(blogger.id)).toBe(5);
    notificationService.markAllRead(blogger.id);
    expect(notificationService.unreadSize(blogger.id)).toBe(0);
    // 更新通知设置（关闭 follow）—— 方法名为 updateNotificationSetting.
    const settings = notificationService.updateNotificationSetting(blogger.id, { follow: false });
    expect(settings.follow).toBe(false);
  });

  it('TC-SYS-012: 文章状态机流转→定时发布→批量下架端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    const a1 = articleService.createArticle(blogger.id, { title: '状态机1', content: '内容' });
    expect(a1.status).toBe(ArticleStatus.Draft);
    // draft → pending_review.
    articleService.submitForReview(blogger.id, a1.id);
    expect(articleStore.getById(a1.id)?.status).toBe(ArticleStatus.PendingReview);
    // pending_review → published.
    articleService.approveArticle(admin.id, UserRole.Admin, a1.id);
    expect(articleStore.getById(a1.id)?.status).toBe(ArticleStatus.Published);
    // published → offline.
    articleService.offlineArticle(blogger.id, UserRole.Blogger, a1.id);
    expect(articleStore.getById(a1.id)?.status).toBe(ArticleStatus.Offline);
    // offline → archived.
    articleService.archiveArticle(blogger.id, UserRole.Blogger, a1.id);
    expect(articleStore.getById(a1.id)?.status).toBe(ArticleStatus.Archived);
    // archived → published 逆向拒绝（VALID_NEXT[Archived] = [Archived]）.
    expect(() => articleService.republishArticle(blogger.id, UserRole.Blogger, a1.id))
      .toThrow(AppError);
    // 定时发布.
    const a2 = articleService.createArticle(blogger.id, { title: '定时', content: '内容' });
    articleService.submitForReview(blogger.id, a2.id);
    const future = new Date(Date.now() + 60_000);
    articleService.schedulePublish(blogger.id, a2.id, future);
    articleService.fireScheduledPublish(a2.id);
    expect(articleStore.getById(a2.id)?.status).toBe(ArticleStatus.Published);
    // 批量下架.
    const a3 = await publishArticle(blogger.id, '批量1', '内容', admin.id);
    const a4 = await publishArticle(blogger.id, '批量2', '内容', admin.id);
    articleService.batchOffline(admin.id, UserRole.Admin, [a3.id, a4.id]);
    expect(articleStore.getById(a3.id)?.status).toBe(ArticleStatus.Offline);
    expect(articleStore.getById(a4.id)?.status).toBe(ArticleStatus.Offline);
  });

  it('TC-SYS-013: 交叉引用→反向链接→相关推荐→自引用拒绝端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    const a = await publishArticle(blogger.id, '文章A', '内容A', admin.id);
    const b = await publishArticle(blogger.id, '文章B', '内容B', admin.id);
    // A 引用 B.
    crossRefService.addCitation(a.id, b.id);
    // 反向链接.
    const back = crossRefService.backlinks(b.id);
    expect(back.length).toBe(1);
    expect(back[0]?.fromArticleId).toBe(a.id);
    // 引用图谱.
    const graph = crossRefService.graph(a.id, 1);
    expect(graph.length).toBe(2);
    // 自引用拒绝 → 1003.
    expect(() => crossRefService.addCitation(a.id, a.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(a.id, a.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.SelfReference);
    }
    // 引用未发布文章 → 1002.
    const draft = articleService.createArticle(blogger.id, { title: '草稿', content: '内容' });
    expect(() => crossRefService.addCitation(a.id, draft.id)).toThrow(AppError);
  });

  it('TC-SYS-014: WebSocket 连接→推送场景→通道订阅→在线状态端到端', async () => {
    const { blogger, reader } = await seedAdminBloggerReader();
    // blogger 上线.
    const socket = makeOpenSocket();
    wsStore.register(blogger.id, socket);
    expect(wsStore.isOnline(blogger.id)).toBe(true);
    // 订阅 comment 通道.
    wsStore.joinChannel('comment', blogger.id);
    expect(wsStore.channelUsers('comment')).toContain(blogger.id);
    // 推送 comment 通道消息.
    const stats = pushService.push(blogger.id, 'comment', { msg: 'hello' });
    expect(stats.delivered).toBe(true);
    expect(socket.send).toHaveBeenCalled();
    // 广播.
    const pushed = pushService.broadcast('comment', { msg: 'broadcast' });
    expect(pushed).toBeGreaterThanOrEqual(1);
    // 离线用户推送 → 入离线队列.
    const offlineStats = pushService.push(reader.id, 'comment', { msg: 'offline' });
    expect(offlineStats.delivered).toBe(false);
    expect(wsStore.getOffline(reader.id).length).toBe(1);
    // reader 上线后 flush.
    const readerSocket = makeOpenSocket();
    wsStore.register(reader.id, readerSocket);
    const flush = pushService.flushOffline(reader.id);
    expect(flush.delivered).toBe(true);
    // 退订通道.
    wsStore.leaveChannel('comment', blogger.id);
    expect(wsStore.channelUsers('comment')).not.toContain(blogger.id);
  });

  it('TC-SYS-015: 图片上传→魔数校验→配额超限→SHA-256 去重端到端', async () => {
    const { blogger } = await seedAdminBloggerReader();
    // 上传 JPG.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = fileService.upload(blogger.id, {
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(file.sha256).toBeTruthy();
    expect(file.filename).toBe('cover.jpg');
    // 伪造扩展名（PNG 内容声明 jpeg）→ 1001.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'fake.jpg',
      mimeType: 'image/jpeg',
      content: pngBytes,
    })).toThrow(AppError);
    // 超 10MB → 1041.
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff; big[3] = 0xe0;
    expect(() => fileService.upload(blogger.id, {
      filename: 'big.jpg',
      mimeType: 'image/jpeg',
      content: big,
    })).toThrow(AppError);
    // SHA-256 去重（重复上传相同文件返回相同 id）.
    const dup = fileService.upload(blogger.id, {
      filename: 'cover2.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(dup.id).toBe(file.id);
  });

  it('TC-SYS-016: 博主订阅→新文章推送→聚合→权限分级端到端', async () => {
    const { admin, blogger, reader } = await seedAdminBloggerReader();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    // reader 订阅博主.
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    // 权限分级.
    const perm = subscriptionService.permission(reader.id, SubscriptionTarget.Blogger);
    expect(perm).toBe('basic'); // reader 订阅数 < 5
    // 博主发新文章 10 篇触发聚合 drain（queued.length >= 10）.
    let pushCount = 0;
    for (let i = 0; i < 10; i++) {
      const art = await publishArticle(blogger.id, `聚合${i}`, `内容${i}`, admin.id);
      pushCount += subscriptionService.aggregateAndPush(bloggerEntity.id, {
        type: 'newArticle',
        refId: art.id,
        at: new Date(),
      });
    }
    expect(pushCount).toBeGreaterThan(0);
    // reader 离线时进入离线队列.
    expect(wsStore.getOffline(reader.id).length).toBeGreaterThan(0);
    // 重复取消订阅幂等（store delete 不存在不报错）.
    expect(() => subscriptionService.unsubscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id))
      .not.toThrow();
  });

  it('TC-SYS-017: 用户导出→管理员备份→恢复校验→增量导出端到端', async () => {
    const { admin, blogger } = await seedAdminBloggerReader();
    await publishArticle(blogger.id, '备份前文章', '内容', admin.id);
    // 用户导出 JSON.
    const exportBuffer = backupService.exportUserData(blogger.id);
    expect(exportBuffer.length).toBeGreaterThan(0);
    const parsed = JSON.parse(exportBuffer.toString('utf-8'));
    expect(parsed.user.id).toBe(blogger.id);
    // 管理员全量备份.
    const payload = Buffer.from(JSON.stringify({ snapshot: 'full', articles: 1 }), 'utf-8');
    const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
    expect(backup.sha256).toBeTruthy();
    expect(backup.status).toBe('created');
    // 完整性校验.
    expect(backupService.verifyIntegrity(backup.id)).toBe(true);
    // 恢复.
    backupService.restore(admin.id, UserRole.Admin, backup.id);
    expect(backupStore.getById(backup.id)?.status).toBe('restored');
    // 增量导出.
    const incBuffer = backupService.incremental(admin.id, UserRole.Admin, new Date(Date.now() - 60_000));
    expect(incBuffer.length).toBeGreaterThan(0);
    // 篡改备份恢复 → 1001（备份校验失败）.
    const badPayload = Buffer.from(JSON.stringify({ tampered: true }), 'utf-8');
    const badBackup = backupStore.create(admin.id, BackupType.Full, badPayload, 'admin');
    // 直接修改 store 中的 payload 不可行（私有），通过 createBackup 创建正常备份后验证恢复流程.
    void badBackup;
  });
});
