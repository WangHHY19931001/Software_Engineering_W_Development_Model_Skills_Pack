// 验收测试 - 订阅/备份恢复 (UAT-046 ~ UAT-051).
// 覆盖 REQ-016 订阅 / REQ-017 数据导出与备份.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块；仅可 mock 外部 IO（WebSocket）.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { BackupStore } from '../../src/stores/backup.store.js';
import { BackupService } from '../../src/services/backup.service.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SubscriptionService } from '../../src/services/subscription.service.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { PushService } from '../../src/services/push.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  BackupType,
  SubscriptionLevel,
  SubscriptionTarget,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-046~051 订阅/备份恢复验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerStore: BloggerStore;
  let siteStore: SiteStore;
  let commentStore: CommentStore;
  let notificationStore: NotificationStore;
  let fileStore: FileStore;
  let wsStore: WsStore;
  let backupStore: BackupStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let subscriptionService: SubscriptionService;
  let bloggerService: BloggerService;
  let pushService: PushService;
  let backupService: BackupService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    subscriptionStore = new SubscriptionStore();
    bloggerStore = new BloggerStore();
    siteStore = new SiteStore();
    commentStore = new CommentStore();
    notificationStore = new NotificationStore();
    fileStore = new FileStore();
    wsStore = new WsStore();
    backupStore = new BackupStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    pushService = new PushService(wsStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore, userStore, bloggerStore, tagStore, categoryStore, pushService,
    );
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    backupService = new BackupService(
      backupStore, userStore, bloggerStore, articleStore,
      commentStore, notificationStore, fileStore,
    );
    clearRevokedJtis();
  });

  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return { readyState: 1, send: vi.fn(), close: vi.fn() };
  }

  async function seed() {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword',
      displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword',
      displayName: 'reader',
    });
    return { admin, blogger, reader };
  }

  async function publishArticle(authorId: string, title: string, content: string, adminId: string) {
    const a = articleService.createArticle(authorId, { title, content });
    articleService.submitForReview(authorId, a.id);
    articleService.approveArticle(adminId, UserRole.Admin, a.id);
    return a;
  }

  it('UAT-046: 博主订阅与推送', async () => {
    const { admin, blogger, reader } = await seed();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    // reader 在线.
    const socket = makeOpenSocket();
    wsStore.register(reader.id, socket);
    // reader 订阅博主.
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    expect(subscriptionStore.exists(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id))
      .toBe(true);
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
    // reader 收到推送.
    expect(socket.send).toHaveBeenCalled();
    // 重复订阅幂等.
    expect(() => subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id))
      .not.toThrow();
  });

  it('UAT-047: 标签订阅聚合推送', async () => {
    const { admin, blogger, reader } = await seed();
    // 创建标签并审核.
    const tag = tagStore.create('React', 'react');
    tagStore.approve(tag.id);
    // reader 在线 + 订阅标签.
    const socket = makeOpenSocket();
    wsStore.register(reader.id, socket);
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Tag, tag.id);
    // 发布 10 篇带标签 T 的文章触发聚合（queued.length >= 10）.
    let pushCount = 0;
    for (let i = 0; i < 10; i++) {
      const art = await publishArticle(blogger.id, `标签文${i}`, `内容${i}`, admin.id);
      tagStore.bind(art.id, [tag.id]);
      pushCount += subscriptionService.aggregateAndPush(tag.id, {
        type: 'newArticle',
        refId: art.id,
        at: new Date(),
      });
    }
    expect(pushCount).toBeGreaterThan(0);
    // reader 收到 1 条合并推送.
    expect(socket.send).toHaveBeenCalled();
    // 订阅列表.
    const subs = subscriptionService.listByUser(reader.id, SubscriptionTarget.Tag, 1, 10);
    expect(subs.total).toBe(1);
    expect(subs.items[0]?.targetId).toBe(tag.id);
  });

  it('UAT-048: 订阅权限分级', async () => {
    const { admin, blogger, reader } = await seed();
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'blogger-1', 'bio');
    // reader 订阅数 < 5 → basic.
    subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, bloggerEntity.id);
    const perm1 = subscriptionService.permission(reader.id, SubscriptionTarget.Blogger);
    expect(perm1).toBe(SubscriptionLevel.Basic);
    // 创建更多博主让 reader 订阅达 5+ → premium.
    const bloggers = [];
    for (let i = 0; i < 5; i++) {
      const u = await authService.userRegister({
        email: `b${i}@x.com`, password: 'passwordpassword',
        displayName: `b${i}`, role: UserRole.Blogger,
      });
      const b = bloggerService.bloggerRegister(u.id, `b-${i}`, 'bio');
      bloggers.push(b);
      subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, b.id);
    }
    const perm2 = subscriptionService.permission(reader.id, SubscriptionTarget.Blogger);
    expect(perm2).toBe(SubscriptionLevel.Premium);
    // admin 角色 → admin 级别.
    const permAdmin = subscriptionService.permission(admin.id, SubscriptionTarget.Blogger);
    expect(permAdmin).toBe(SubscriptionLevel.Admin);
    // 不存在用户 → 1031.
    expect(() => subscriptionService.permission('non-existent', SubscriptionTarget.Blogger))
      .toThrow(AppError);
    // 订阅不存在的目标 → 1031.
    expect(() => subscriptionService.subscribe(reader.id, SubscriptionTarget.Blogger, 'non-existent'))
      .toThrow(AppError);
  });

  it('UAT-049: 用户数据导出 JSON', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, '导出文章', '内容', admin.id);
    // 用户导出 JSON.
    const exportBuffer = backupService.exportUserData(blogger.id);
    expect(exportBuffer.length).toBeGreaterThan(0);
    const parsed = JSON.parse(exportBuffer.toString('utf-8'));
    expect(parsed.user.id).toBe(blogger.id);
    expect(parsed.user.email).toBe('b@x.com');
    expect(Array.isArray(parsed.articles)).toBe(true);
    expect(parsed.articles.length).toBeGreaterThanOrEqual(1);
    expect(parsed.exportedAt).toBeTruthy();
    // 不存在用户导出 → 1031.
    expect(() => backupService.exportUserData('non-existent')).toThrow(AppError);
  });

  it('UAT-050: 管理员备份与恢复', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, '备份前文章', '内容', admin.id);
    // 管理员全量备份.
    const payload = Buffer.from(JSON.stringify({ snapshot: 'full', articles: 1 }), 'utf-8');
    const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
    expect(backup.sha256).toBeTruthy();
    expect(backup.status).toBe('created');
    expect(backup.size).toBe(payload.length);
    // 完整性校验.
    expect(backupService.verifyIntegrity(backup.id)).toBe(true);
    // 恢复.
    backupService.restore(admin.id, UserRole.Admin, backup.id);
    expect(backupStore.getById(backup.id)?.status).toBe('restored');
    // 非 admin 备份 → 1021.
    expect(() => backupService.createBackup(blogger.id, UserRole.Blogger, BackupType.Full, payload))
      .toThrow(AppError);
    // 非 admin 恢复 → 1021.
    const backup2 = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
    expect(() => backupService.restore(blogger.id, UserRole.Blogger, backup2.id)).toThrow(AppError);
    // 重复恢复 → 1002（status != created）.
    expect(() => backupService.restore(admin.id, UserRole.Admin, backup.id)).toThrow(AppError);
    // 篡改备份恢复 → 1001.
    const badPayload = Buffer.from('not-json', 'utf-8');
    const badBackup = backupStore.create(admin.id, BackupType.Full, badPayload, 'admin');
    expect(() => backupService.restore(admin.id, UserRole.Admin, badBackup.id)).toThrow(AppError);
  });

  it('UAT-051: 增量导出时间范围', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, '增量文章', '内容', admin.id);
    // 增量导出（since=1分钟前）.
    const incBuffer = backupService.incremental(admin.id, UserRole.Admin, new Date(Date.now() - 60_000));
    expect(incBuffer.length).toBeGreaterThan(0);
    const parsed = JSON.parse(incBuffer.toString('utf-8'));
    expect(parsed.since).toBeTruthy();
    expect(parsed.generatedAt).toBeTruthy();
    expect(Array.isArray(parsed.articles)).toBe(true);
    // since=未来时间 → articles 为空.
    const futureBuffer = backupService.incremental(admin.id, UserRole.Admin, new Date(Date.now() + 60_000));
    const futureParsed = JSON.parse(futureBuffer.toString('utf-8'));
    expect(futureParsed.articles.length).toBe(0);
    // 非 admin 增量导出 → 1021.
    expect(() => backupService.incremental(blogger.id, UserRole.Blogger, new Date(Date.now() - 60_000)))
      .toThrow(AppError);
    // 非法 since（非 Date） → 1001.
    expect(() => backupService.incremental(admin.id, UserRole.Admin, 'invalid' as unknown as Date))
      .toThrow(AppError);
  });
});
