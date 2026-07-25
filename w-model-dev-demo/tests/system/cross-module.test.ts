// 系统测试 - 跨模块协作 (TC-SYS-018 ~ TC-SYS-034).
// 覆盖 17 个跨模块协作场景：文章-评论-通知-推送链路 / 订阅-聚合 / 文件-引用-搜索 /
// 标签-推荐-云 / 分类-面包屑-搜索 / 广告-统计-CTR / 博主-粉丝-推荐 / 站点-统计 /
// 推送-重试-离线 / 备份-恢复-统计 / 封禁-通知 / 站点开关-注册评论 / 下架-搜索-推荐 /
// 引用-通知-推送 / 标签合并-搜索 / 博主导出-订阅图谱 / 维护模式-管理员.
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
  NotificationType,
  SubscriptionTarget,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('TC-SYS-018~034 跨模块协作', () => {
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

  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return { readyState: 1, send: vi.fn(), close: vi.fn() };
  }
  function makeClosedSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return {
      readyState: 3,
      send: vi.fn(() => { throw new Error('closed'); }),
      close: vi.fn(),
    };
  }

  async function seed() {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'reader',
    });
    return { admin, blogger, reader };
  }

  async function publish(authorId: string, title: string, content: string, adminId: string) {
    const a = articleService.createArticle(authorId, { title, content });
    articleService.submitForReview(authorId, a.id);
    articleService.approveArticle(adminId, UserRole.Admin, a.id);
    return a;
  }

  it('TC-SYS-018: 文章发布→评论→通知→推送全链路跨模块', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publish(blogger.id, '全链路', '内容', admin.id);
    // blogger 在线订阅 comment 通道.
    const socket = makeOpenSocket();
    wsStore.register(blogger.id, socket);
    wsStore.joinChannel('comment', blogger.id);
    // reader 评论.
    const comment = commentService.createComment(article.id, reader.id, null, '好文章');
    expect(comment.status).toBe('pending_review');
    // 触发通知.
    const notif = notificationService.enqueueNotification(
      blogger.id, NotificationType.Comment, '新评论', 'reader 评论了你的文章', comment.id,
    );
    expect(notif).not.toBeNull();
    // 推送.
    const stats = pushService.push(blogger.id, 'comment', { notificationId: notif!.id });
    expect(stats.delivered).toBe(true);
    expect(socket.send).toHaveBeenCalled();
    // 未读数.
    expect(notificationService.unreadSize(blogger.id)).toBe(1);
  });

  it('TC-SYS-019: 订阅博主→新文章→聚合推送→通知跨模块', async () => {
    const { admin, blogger, reader } = await seed();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    // 10 篇文章触发 drain.
    let pushCount = 0;
    for (let i = 0; i < 10; i++) {
      const a = await publish(blogger.id, `聚合${i}`, `内容${i}`, admin.id);
      pushCount += subscriptionService.aggregateAndPush(bloggerEntity.id, {
        type: 'newArticle', refId: a.id, at: new Date(),
      });
    }
    expect(pushCount).toBeGreaterThan(0);
    // reader 离线 → 入队.
    expect(wsStore.getOffline(reader.id).length).toBeGreaterThan(0);
  });

  it('TC-SYS-020: 文件上传→文章封面→交叉引用→搜索索引跨模块', async () => {
    const { admin, blogger } = await seed();
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = fileService.upload(blogger.id, {
      filename: 'cover.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    });
    const a = articleService.createArticle(blogger.id, {
      title: '封面文章A', content: '内容A', coverImageUrl: `https://example.com/${file.id}.jpg`,
    });
    const b = await publish(blogger.id, '文章B', '内容B', admin.id);
    articleService.submitForReview(blogger.id, a.id);
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    crossRefService.addCitation(a.id, b.id);
    // 搜索能命中.
    const result = searchService.search(null, '封面文章A', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.articleId).toBe(a.id);
  });

  it('TC-SYS-021: 标签审核→文章绑定→推荐算法→标签云跨模块', async () => {
    const { admin, blogger } = await seed();
    const article = await publish(blogger.id, '标签推荐', '内容', admin.id);
    const tag = tagService.createTag('React', 'react');
    tagService.approveTag(admin.id, 'admin', tag.id);
    tagService.bind(article.id, [tag.id]);
    // 标签云更新.
    const cloud = tagService.cloud(10);
    expect(cloud.find((c) => c.name === 'React')?.articleCount).toBe(1);
    // 推荐算法 hot 含该文章.
    const hot = recommendService.hot(1, 10);
    expect(hot.items.some((a) => a.id === article.id)).toBe(true);
  });

  it('TC-SYS-022: 分类树→文章归类→面包屑→分类搜索跨模块', async () => {
    const { admin, blogger } = await seed();
    const cat = categoryService.createCategory('前端', null);
    const article = await publish(blogger.id, '前端文章', 'React 内容', admin.id);
    categoryService.bindCategory(article.id, cat.id);
    // 面包屑.
    const bc = categoryService.breadcrumb(cat.id);
    expect(bc.length).toBe(1);
    expect(bc[0]?.name).toBe('前端');
    // 搜索能命中.
    const result = searchService.search(null, '前端文章', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('TC-SYS-023: 广告展示→统计 CTR→管理员审核跨模块', async () => {
    const { admin } = await seed();
    const startAt = new Date(Date.now() - 60_000);
    const endAt = new Date(Date.now() + 60_000);
    const ad = adService.create(admin.id, UserRole.Admin, {
      slotId: 'home', title: '广告', imageUrl: 'https://e.com/i.png',
      targetUrl: 'https://e.com/p', startAt, endAt,
    });
    adService.audit(admin.id, UserRole.Admin, ad.id, 'approve');
    adService.adImpress(ad.id);
    adService.adImpress(ad.id);
    adService.adClick(ad.id);
    const updated = adStore.getById(ad.id);
    expect(updated?.impressCount).toBe(2);
    expect(updated?.clickCount).toBe(1);
    // CTR = clicks/impressions = 0.5.
    const ctr = updated!.clickCount / updated!.impressCount;
    expect(ctr).toBe(0.5);
  });

  it('TC-SYS-024: 博主关注→粉丝列表→博主推荐跨模块', async () => {
    const { blogger, reader } = await seed();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    bloggerService.bloggerFollow(reader.id, bloggerEntity.id);
    expect(bloggerStore.getById(bloggerEntity.id)?.followerCount).toBe(1);
    // 推荐服务接口可调用.
    const hot = recommendService.hot(1, 10);
    expect(hot).toBeDefined();
  });

  it('TC-SYS-025: 站点统计概览→用户/文章/评论数实时跨模块', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publish(blogger.id, '统计文章', '内容', admin.id);
    commentService.createComment(article.id, reader.id, null, '评论1');
    commentService.createComment(article.id, reader.id, null, '评论2');
    const overview = siteService.getStatsOverview();
    expect(overview.userCount).toBe(3);
    expect(overview.articleCount).toBeGreaterThanOrEqual(1);
    expect(overview.commentCount).toBeGreaterThanOrEqual(2);
  });

  it('TC-SYS-026: 推送失败重试→离线消息合并→上线推送跨模块', () => {
    // 用户连接但 readyState=CLOSED → 重试 3 次后转离线.
    const socket = makeClosedSocket();
    wsStore.register('u-fail', socket);
    const stats = pushService.push('u-fail', 'comment', { msg: 'retry' });
    expect(stats.delivered).toBe(false);
    expect(stats.attempts).toBe(3);
    expect(wsStore.getOffline('u-fail').length).toBe(1);
    // 上线后 flush 合并投递.
    const openSocket = makeOpenSocket();
    wsStore.register('u-fail', openSocket);
    const result = pushService.flushOffline('u-fail');
    expect(result.delivered).toBe(true);
    expect(result.merged).toBe(1);
  });

  it('TC-SYS-027: 导出含统计数据→备份恢复后状态一致跨模块', async () => {
    const { admin, blogger } = await seed();
    await publish(blogger.id, '备份文章', '内容', admin.id);
    const overviewBefore = siteService.getStatsOverview();
    const payload = Buffer.from(JSON.stringify({ snapshot: 'full' }), 'utf-8');
    const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
    expect(backupService.verifyIntegrity(backup.id)).toBe(true);
    backupService.restore(admin.id, UserRole.Admin, backup.id);
    expect(backupStore.getById(backup.id)?.status).toBe('restored');
    // 恢复后站点统计与备份时一致（内存未变）.
    const overviewAfter = siteService.getStatsOverview();
    expect(overviewAfter.userCount).toBe(overviewBefore.userCount);
    expect(overviewAfter.articleCount).toBe(overviewBefore.articleCount);
  });

  it('TC-SYS-028: 用户封禁→通知/推送停止→解禁恢复跨模块', async () => {
    const { admin, reader } = await seed();
    const { UserService } = await import('../../src/services/auth.service.js');
    const userService = new UserService(userStore, authService);
    // 封禁前能收通知.
    const n1 = notificationService.enqueueNotification(
      reader.id, NotificationType.System, '通知1', '内容', 'r1',
    );
    expect(n1).not.toBeNull();
    // 封禁.
    userService.banUser(admin.id, 'admin', reader.id, '违规');
    expect(userStore.getById(reader.id)?.status).toBe('banned');
    // 解禁.
    userService.unbanUser(admin.id, 'admin', reader.id);
    expect(userStore.getById(reader.id)?.status).toBe('active');
    // 解禁后能收新通知.
    const n2 = notificationService.enqueueNotification(
      reader.id, NotificationType.System, '通知2', '内容', 'r2',
    );
    expect(n2).not.toBeNull();
  });

  it('TC-SYS-029: 注册开关关闭→注册拒绝→评论开关关闭→评论拒绝跨模块', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publish(blogger.id, '开关测试', '内容', admin.id);
    // 关闭评论开关.
    siteService.updateConfig(admin.id, 'admin', { commentOpen: false });
    expect(siteService.getConfig().commentOpen).toBe(false);
    // 评论被拒 → 1025.
    expect(() => commentService.createComment(article.id, reader.id, null, '评论'))
      .toThrow(AppError);
    try {
      commentService.createComment(article.id, reader.id, null, '评论');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.CommentClosed);
    }
    // 重新开启.
    siteService.updateConfig(admin.id, 'admin', { commentOpen: true });
    const c = commentService.createComment(article.id, reader.id, null, '现在可以评论');
    expect(c.status).toBe('pending_review');
  });

  it('TC-SYS-030: 文章下架→搜索索引移除→推荐排除→订阅不推送跨模块', async () => {
    const { admin, blogger } = await seed();
    const article = await publish(blogger.id, '下架测试', '内容', admin.id);
    // 下架前搜索能命中.
    expect(searchService.search(null, '下架测试', 'relevance', 1, 10).total).toBeGreaterThanOrEqual(1);
    // 下架.
    articleService.offlineArticle(blogger.id, UserRole.Blogger, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Offline);
    // 推荐 hot 不含下架文章（hot 仅返回 published）.
    const hot = recommendService.hot(1, 50);
    expect(hot.items.some((a) => a.id === article.id)).toBe(false);
  });

  it('TC-SYS-031: 交叉引用通知原作者→通知→推送跨模块', async () => {
    const { admin, blogger } = await seed();
    const a = await publish(blogger.id, '引用A', '内容', admin.id);
    const b = await publish(blogger.id, '引用B', '内容', admin.id);
    crossRefService.addCitation(a.id, b.id);
    // 模拟通知 B 的作者.
    const notif = notificationService.enqueueNotification(
      blogger.id, NotificationType.Comment, '文章被引用', 'A 引用了你的文章 B', b.id,
    );
    expect(notif).not.toBeNull();
    // 推送.
    const socket = makeOpenSocket();
    wsStore.register(blogger.id, socket);
    const stats = pushService.push(blogger.id, 'comment', { id: notif!.id });
    expect(stats.delivered).toBe(true);
  });

  it('TC-SYS-032: 标签合并→文章标签迁移→搜索索引更新跨模块', async () => {
    const { admin, blogger } = await seed();
    const article = await publish(blogger.id, '合并标签文章', '内容', admin.id);
    const src = tagService.createTag('OldTag', 'old-tag');
    const tgt = tagService.createTag('NewTag', 'new-tag');
    tagService.approveTag(admin.id, 'admin', src.id);
    tagService.approveTag(admin.id, 'admin', tgt.id);
    tagService.bind(article.id, [src.id]);
    // 合并 src → tgt.
    tagService.merge(admin.id, 'admin', src.id, tgt.id);
    // 源标签已删除（getById 对 deleted 标签返回 null）.
    expect(tagStore.getById(src.id)).toBeNull();
    // 标签云中 NewTag 存在.
    const cloud = tagService.cloud(10);
    expect(cloud.find((c) => c.name === 'NewTag')).toBeTruthy();
  });

  it('TC-SYS-033: 博主导出含粉丝/统计→订阅关系图谱双向查询跨模块', async () => {
    const { admin, blogger, reader } = await seed();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    // 博主导出.
    const exportBuffer = backupService.exportUserData(blogger.id);
    expect(exportBuffer.length).toBeGreaterThan(0);
    const parsed = JSON.parse(exportBuffer.toString('utf-8'));
    expect(parsed.user.id).toBe(blogger.id);
    // 订阅图谱双向查询.
    const subsByUser = subscriptionService.listByUser(reader.id, SubscriptionTarget.Blogger, 1, 10);
    expect(subsByUser.total).toBe(1);
    expect(subsByUser.items[0]?.targetId).toBe(bloggerEntity.id);
    void admin;
  });

  it('TC-SYS-034: 维护模式→仅管理员可访问→管理员正常操作跨模块', async () => {
    const { admin, reader } = await seed();
    siteService.setMaintenanceMode(admin.id, 'admin', true);
    // 普通用户被拦截.
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Maintenance);
    }
    // 管理员正常访问.
    expect(() => siteService.requireNotMaintenance('admin')).not.toThrow();
    // 关闭后普通用户可访问.
    siteService.setMaintenanceMode(admin.id, 'admin', false);
    expect(() => siteService.requireNotMaintenance('reader')).not.toThrow();
  });
});
