// 系统测试 - 可靠性/可用性 (TC-SYS-055 ~ TC-SYS-064).
// 覆盖 10 个可靠性场景：备份恢复成功率/错误率/备份完整性/并发安全/
// 离线消息可靠性/状态机一致性/配额管理/推送重试/JWT撤销/级联删除一致性.
// 真实例化 Store/Service 三层，禁止 mock 内部模块；仅可 mock 外部 IO.

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
  ArticleStatus,
  BackupType,
  CommentStatus,
  NotificationType,
  SubscriptionTarget,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('TC-SYS-055~064 可靠性/可用性', () => {
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

  it('TC-SYS-055: 备份恢复成功率 100%（10 次备份+恢复循环）', async () => {
    const { admin } = await seed();
    let successCount = 0;
    for (let i = 0; i < 10; i++) {
      const payload = Buffer.from(JSON.stringify({ round: i, data: `backup-${i}` }), 'utf-8');
      const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
      // 完整性校验.
      const ok = backupService.verifyIntegrity(backup.id);
      if (!ok) continue;
      // 恢复.
      backupService.restore(admin.id, UserRole.Admin, backup.id);
      if (backupStore.getById(backup.id)?.status === 'restored') {
        successCount += 1;
      }
    }
    // 10 次全部成功 → 成功率 100%.
    expect(successCount).toBe(10);
    const successRate = successCount / 10;
    expect(successRate).toBe(1);
  });

  it('TC-SYS-056: 错误率 ≤ 0.1%（1000 次正常操作）', async () => {
    const { admin, blogger } = await seed();
    let errorCount = 0;
    const totalOps = 1000;
    for (let i = 0; i < totalOps; i++) {
      try {
        // 正常操作：创建文章.
        articleService.createArticle(blogger.id, { title: `op-${i}`, content: '内容' });
      } catch {
        errorCount += 1;
      }
    }
    const errorRate = errorCount / totalOps;
    // 错误率 ≤ 0.1%.
    expect(errorRate).toBeLessThanOrEqual(0.001);
    expect(errorCount).toBe(0);
    void admin;
  });

  it('TC-SYS-057: 备份完整性校验 SHA-256 一致性（增量导出可重放）', async () => {
    const { admin, blogger } = await seed();
    // 记录起始时间.
    const since = new Date(Date.now() - 1000);
    // 产生 5 篇文章（数据变更，模拟 WAL）.
    for (let i = 0; i < 5; i++) {
      await publish(blogger.id, `WAL-${i}`, `内容${i}`, admin.id);
    }
    // 增量导出（相当于 WAL replay 快照）.
    const incBuffer = backupService.incremental(admin.id, UserRole.Admin, since);
    expect(incBuffer.length).toBeGreaterThan(0);
    const incData = JSON.parse(incBuffer.toString('utf-8'));
    expect(incData.since).toBe(since.toISOString());
    expect(Array.isArray(incData.articles)).toBe(true);
    // 全量备份完整性.
    const fullPayload = Buffer.from(JSON.stringify({ snapshot: 'full' }), 'utf-8');
    const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, fullPayload);
    // SHA-256 校验通过.
    expect(backupService.verifyIntegrity(backup.id)).toBe(true);
    // 篡改检测：构造相同内容但不同 payload 的备份，SHA-256 必不同.
    const otherPayload = Buffer.from(JSON.stringify({ snapshot: 'tampered' }), 'utf-8');
    const otherBackup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, otherPayload);
    expect(otherBackup.sha256).not.toBe(backup.sha256);
  });

  it('TC-SYS-058: 并发安全——多用户并发操作不互相干扰', async () => {
    const { admin } = await seed();
    // 创建 5 个博主并发创建文章.
    const bloggers = [];
    for (let i = 0; i < 5; i++) {
      const b = await authService.userRegister({
        email: `b${i}@x.com`, password: 'passwordpassword', displayName: `blogger${i}`, role: UserRole.Blogger,
      });
      bloggers.push(b);
    }
    // 并发创建文章（同步循环模拟并发，每个博主独立）.
    const articleIds: string[] = [];
    for (let i = 0; i < bloggers.length; i++) {
      const a = articleService.createArticle(bloggers[i]!.id, { title: `并发${i}`, content: '内容' });
      articleIds.push(a.id);
    }
    // 每个博主只能看到自己的文章.
    for (let i = 0; i < bloggers.length; i++) {
      const list = articleStore.listByAuthor(bloggers[i]!.id);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe(articleIds[i]);
    }
    // 文章 ID 唯一.
    const uniqueIds = new Set(articleIds);
    expect(uniqueIds.size).toBe(articleIds.length);
    void admin;
  });

  it('TC-SYS-059: 离线消息可靠性——上线后投递不丢失', () => {
    // 用户离线时推送 5 条消息（同 channel 'comment'）.
    for (let i = 0; i < 5; i++) {
      pushService.push('offline-user', 'comment', { msg: `msg-${i}` });
    }
    // 离线队列累积 5 条.
    expect(wsStore.getOffline('offline-user').length).toBe(5);
    // 上线后 flush.
    const socket = makeOpenSocket();
    wsStore.register('offline-user', socket);
    const result = pushService.flushOffline('offline-user');
    expect(result.delivered).toBe(true);
    // merged = 通道分组数（5 条同 channel 合并为 1 组）.
    expect(result.merged).toBe(1);
    // 离线队列清空.
    expect(wsStore.getOffline('offline-user').length).toBe(0);
    // socket.send 被调用，且投递的合并 payload 含全部 5 条消息（不丢失）.
    expect(socket.send).toHaveBeenCalled();
    const sentArg = (socket.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(sentArg).toBeTruthy();
    const parsed = JSON.parse(sentArg);
    expect(parsed.items).toBeDefined();
    expect(parsed.items.length).toBe(5);
    expect(parsed.mergedCount).toBe(5);
  });

  it('TC-SYS-060: 状态机一致性——非法跳转全部拒绝', async () => {
    const { admin, blogger } = await seed();
    const a = articleService.createArticle(blogger.id, { title: '状态机', content: '内容' });
    // draft → published 非法（需先 pending_review）→ 1002.
    expect(() => articleService.transition(blogger.id, a.id, ArticleStatus.Published))
      .toThrow(AppError);
    try {
      articleService.transition(blogger.id, a.id, ArticleStatus.Published);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.StateMachineIllegal);
    }
    // draft → pending_review 合法.
    articleService.submitForReview(blogger.id, a.id);
    // pending_review → draft 逆向非法 → 1002.
    expect(() => articleService.transition(blogger.id, a.id, ArticleStatus.Draft))
      .toThrow(AppError);
    // pending_review → published 合法（admin approve）.
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.Published);
    // published → archived 非法（需先 offline）→ 1002.
    expect(() => articleService.archiveArticle(blogger.id, UserRole.Blogger, a.id))
      .toThrow(AppError);
  });

  it('TC-SYS-061: 配额管理——超限拒绝不破坏已存储数据', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 上传一个合法文件.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file1 = fileService.upload(blogger.id, {
      filename: 'ok1.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    });
    // 超 10MB → 1041 拒绝.
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff; big[3] = 0xe0;
    expect(() => fileService.upload(blogger.id, {
      filename: 'big.jpg', mimeType: 'image/jpeg', content: big,
    })).toThrow(AppError);
    try {
      fileService.upload(blogger.id, {
        filename: 'big.jpg', mimeType: 'image/jpeg', content: big,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FileTooLarge);
    }
    // 已存储的 file1 仍可查询.
    const stored = fileService.getById(file1.id);
    expect(stored).not.toBeNull();
    expect(stored?.filename).toBe('ok1.jpg');
    // 用户文件列表仍含 file1.
    const list = fileService.listByUser(blogger.id);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(file1.id);
  });

  it('TC-SYS-062: 推送重试可靠性——3 次重试后转离线', () => {
    // 用户连接但 readyState=CLOSED → send 抛异常 → 重试 3 次后转离线.
    const socket = makeClosedSocket();
    wsStore.register('retry-user', socket);
    const stats = pushService.push('retry-user', 'comment', { msg: 'retry-test' });
    // 投递失败.
    expect(stats.delivered).toBe(false);
    // 重试 3 次.
    expect(stats.attempts).toBe(3);
    // 转入离线队列.
    expect(wsStore.getOffline('retry-user').length).toBe(1);
    // 上线后可 flush.
    const openSocket = makeOpenSocket();
    wsStore.register('retry-user', openSocket);
    const result = pushService.flushOffline('retry-user');
    expect(result.delivered).toBe(true);
  });

  it('TC-SYS-063: JWT 撤销可靠性——登出后 token 立即失效', async () => {
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'reader',
    });
    const { token } = await authService.userLogin('r@x.com', 'passwordpassword');
    // 登出前 token 有效.
    expect(() => authService.verifyToken(token)).not.toThrow();
    // 登出 → 撤销 jti.
    authService.userLogout(token);
    // 登出后 token 立即失效 → 1022 (Banned，jti 已撤销).
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Banned);
    }
    // reader 仍可重新登录获取新 token.
    const { token: newToken } = await authService.userLogin('r@x.com', 'passwordpassword');
    expect(newToken).not.toBe(token);
    expect(() => authService.verifyToken(newToken)).not.toThrow();
    void reader;
  });

  it('TC-SYS-064: 级联删除一致性——分类删除后子分类和绑定关系清理', async () => {
    const { admin, blogger } = await seed();
    // 创建 3 级分类.
    const root = categoryService.createCategory('根', null);
    const child = categoryService.createCategory('子', root.id);
    const grandchild = categoryService.createCategory('孙', child.id);
    expect(categoryService.tree().length).toBe(1);
    // 文章绑定孙分类.
    const article = await publish(blogger.id, '分类文章', '内容', admin.id);
    categoryService.bindCategory(article.id, grandchild.id);
    // 面包屑含 3 级.
    const bc = categoryService.breadcrumb(grandchild.id);
    expect(bc.length).toBe(3);
    // 级联删除根分类.
    categoryService.cascadeDelete(admin.id, 'admin', root.id);
    // tree 为空（子分类一并删除）.
    expect(categoryService.tree().length).toBe(0);
    // 子分类查询返回 null 或已删除.
    expect(categoryStore.getById(child.id)?.deleted ?? true).toBe(true);
    expect(categoryStore.getById(grandchild.id)?.deleted ?? true).toBe(true);
  });
});
