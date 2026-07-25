// 系统测试 - 性能基线 (TC-SYS-035 ~ TC-SYS-044).
// 覆盖 10 个性能基线场景：文章创建/全文搜索/用户注册(bcrypt)/文件上传SHA-256/
// 推荐算法hot/通知批量入队/标签云/评论多级回复/JWT签发验证/备份导出.
// 真实 Date.now() 测量，循环 100 次取 P95，禁止伪造数值。
// 真实实例化 Store/Service 三层，禁止 mock 内部模块。

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
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
import { signToken, verifyToken, clearRevokedJtis } from '../../src/utils/auth.js';
import { UserRole, NotificationType, BackupType } from '../../src/types.js';

/**
 * 计算数组的 P95 百分位（升序排序后取第 95% 位置的值）。
 */
function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx]!;
}

describe('TC-SYS-035~044 性能基线 P95', () => {
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

  it('TC-SYS-035: 文章创建 P95 < 200ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      articleService.createArticle(blogger.id, { title: `性能文章${i}`, content: `内容${i}` });
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    // 真实测量断言，禁止伪造.
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
    void admin;
  });

  it('TC-SYS-036: 全文搜索 P95 < 200ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 预置 20 篇文章建立索引.
    for (let i = 0; i < 20; i++) {
      const a = articleService.createArticle(blogger.id, { title: `React${i}`, content: `内容${i}` });
      articleService.submitForReview(blogger.id, a.id);
      articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    }
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      searchService.search(null, 'React', 'relevance', 1, 10);
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-037: 用户注册 bcrypt P95 < 1s（100 次循环）', async () => {
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      await authService.userRegister({
        email: `user${i}@x.com`, password: 'passwordpassword', displayName: `user${i}`,
      });
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    // bcrypt cost=10 通常 50~200ms，P95 阈值 1s 留足余量.
    expect(p95val).toBeLessThan(1000);
    expect(p95val).toBeGreaterThanOrEqual(0);
  }, 60000); // bcrypt 100 次循环需更长超时（60s）.

  it('TC-SYS-038: 文件上传 SHA-256 P95 < 200ms（100 次循环）', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 10KB JPEG 有效内容.
    const jpegBytes = Buffer.alloc(10 * 1024, 0);
    jpegBytes[0] = 0xff; jpegBytes[1] = 0xd8; jpegBytes[2] = 0xff; jpegBytes[3] = 0xe0;
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      // 每次微调内容使 SHA-256 不同，避免去重命中.
      jpegBytes[9] = i & 0xff;
      const t0 = Date.now();
      fileService.upload(blogger.id, {
        filename: `file${i}.jpg`, mimeType: 'image/jpeg', content: Buffer.from(jpegBytes),
      });
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-039: 推荐算法 hot P95 < 200ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 预置 50 篇已发布文章.
    for (let i = 0; i < 50; i++) {
      const a = articleService.createArticle(blogger.id, { title: `推荐${i}`, content: `内容${i}` });
      articleService.submitForReview(blogger.id, a.id);
      articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    }
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      recommendService.hot(1, 10);
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-040: 通知批量入队 P95 < 200ms（100 次循环）', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      notificationService.enqueueNotification(
        blogger.id, NotificationType.System, `通知${i}`, '内容', `ref-${i}`,
      );
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-041: 标签云计算 P95 < 200ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 预置 30 个已审核标签.
    const tagIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const t = tagService.createTag(`Tag${i}`, `tag-${i}`);
      tagService.approveTag(admin.id, 'admin', t.id);
      tagIds.push(t.id);
    }
    // 预置文章并绑定标签.
    for (let i = 0; i < 10; i++) {
      const a = articleService.createArticle(blogger.id, { title: `标签文章${i}`, content: '内容' });
      articleService.submitForReview(blogger.id, a.id);
      articleService.approveArticle(admin.id, UserRole.Admin, a.id);
      tagService.bind(a.id, [tagIds[i % tagIds.length]!]);
    }
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      tagService.cloud(20);
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-042: 评论多级回复 P95 < 200ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'reader',
    });
    const a = articleService.createArticle(blogger.id, { title: '评论性能', content: '内容' });
    articleService.submitForReview(blogger.id, a.id);
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    // 预置根评论.
    const root = commentService.createComment(a.id, reader.id, null, '根评论');
    commentService.approveComment(admin.id, 'admin', root.id, 'approve');
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      const reply = commentService.createComment(a.id, reader.id, root.id, `回复${i}`);
      commentService.approveComment(admin.id, 'admin', reply.id, 'approve');
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-043: JWT 签发+验证 P95 < 200ms（100 次循环）', () => {
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      const token = signToken(`user-${i}`, UserRole.Reader);
      verifyToken(token);
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(200);
    expect(p95val).toBeGreaterThanOrEqual(0);
  });

  it('TC-SYS-044: 备份导出 P95 < 500ms（100 次循环）', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword', displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword', displayName: 'blogger', role: UserRole.Blogger,
    });
    // 预置文章+评论+文件使导出有数据.
    for (let i = 0; i < 10; i++) {
      const a = articleService.createArticle(blogger.id, { title: `导出${i}`, content: `内容${i}` });
      articleService.submitForReview(blogger.id, a.id);
      articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    }
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      backupService.exportUserData(blogger.id);
      latencies.push(Date.now() - t0);
    }
    const p95val = p95(latencies);
    expect(p95val).toBeLessThan(500);
    expect(p95val).toBeGreaterThanOrEqual(0);
    void BackupType;
  });
});
