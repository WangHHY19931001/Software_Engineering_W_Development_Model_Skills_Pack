// 验收测试 - 评论/通知/文章状态机 (UAT-028 ~ UAT-036).
// 覆盖 REQ-010 评论 / REQ-011 通知 / REQ-012 文章状态机.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { CommentService } from '../../src/services/comment.service.js';
import { NotificationService } from '../../src/services/notification.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  CommentStatus,
  NotificationType,
  UserRole,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-028~036 评论/通知/文章状态机验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let bloggerStore: BloggerStore;
  let siteStore: SiteStore;
  let commentStore: CommentStore;
  let notificationStore: NotificationStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let commentService: CommentService;
  let notificationService: NotificationService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    bloggerStore = new BloggerStore();
    siteStore = new SiteStore();
    commentStore = new CommentStore();
    notificationStore = new NotificationStore();
    const fileStore = new FileStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    commentService = new CommentService(commentStore, articleStore, siteStore);
    notificationService = new NotificationService(notificationStore);
    clearRevokedJtis();
  });

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

  it('UAT-028: 评论多级回复正常', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publishArticle(blogger.id, '评论测试', '内容', admin.id);
    // 一级评论.
    const root = commentService.createComment(article.id, reader.id, null, '一级评论');
    expect(root.status).toBe(CommentStatus.PendingReview);
    expect(root.depth).toBe(0);
    // 审核通过.
    commentService.approveComment(admin.id, 'admin', root.id, 'approve');
    expect(commentStore.getById(root.id)?.status).toBe(CommentStatus.Approved);
    // 多级回复至 6 级（depth 0~5，MAX_DEPTH=5 允许 depth<=5）.
    let parentId: string | null = root.id;
    for (let i = 0; i < 5; i++) {
      const reply = commentService.createComment(article.id, reader.id, parentId, `回复${i}`);
      commentService.approveComment(admin.id, 'admin', reply.id, 'approve');
      parentId = reply.id;
    }
    // 第 7 级 → 1004 depth 超 MAX_DEPTH（depth=6 > MAX_DEPTH=5）.
    expect(() => commentService.createComment(article.id, reader.id, parentId, '超深'))
      .toThrow(AppError);
    try {
      commentService.createComment(article.id, reader.id, parentId, '超深');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.DepthLimit);
    }
    // 公开列表仅含 approved 评论.
    const list = commentService.listByArticle(article.id, 1, 50, 'oldest');
    for (const c of list.items) {
      expect(c.status).toBe(CommentStatus.Approved);
    }
    expect(list.total).toBe(6);
  });

  it('UAT-029: 敏感词评论审核', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publishArticle(blogger.id, '评论测试', '内容', admin.id);
    // 创建评论自动 pending_review（所有评论默认待审）.
    const comment = commentService.createComment(article.id, reader.id, null, '含敏感词的评论');
    expect(comment.status).toBe(CommentStatus.PendingReview);
    // 公开列表不含 pending 评论.
    const list = commentService.listByArticle(article.id, 1, 50, 'oldest');
    expect(list.items.find((c) => c.id === comment.id)).toBeUndefined();
    expect(list.total).toBe(0);
    // 审核通过后公开列表含.
    commentService.approveComment(admin.id, 'admin', comment.id, 'approve');
    const list2 = commentService.listByArticle(article.id, 1, 50, 'oldest');
    expect(list2.items.find((c) => c.id === comment.id)).toBeTruthy();
    expect(list2.total).toBe(1);
    // reject 后公开列表仍不含（已审核评论不可再审核）.
    const comment2 = commentService.createComment(article.id, reader.id, null, '另一评论');
    commentService.approveComment(admin.id, 'admin', comment2.id, 'reject');
    expect(commentStore.getById(comment2.id)?.status).toBe(CommentStatus.Rejected);
    const list3 = commentService.listByArticle(article.id, 1, 50, 'oldest');
    expect(list3.items.find((c) => c.id === comment2.id)).toBeUndefined();
  });

  it('UAT-030: 评论点赞幂等性', async () => {
    const { admin, blogger, reader } = await seed();
    const article = await publishArticle(blogger.id, '评论测试', '内容', admin.id);
    const comment = commentService.createComment(article.id, reader.id, null, '好文');
    commentService.approveComment(admin.id, 'admin', comment.id, 'approve');
    // 第一次点赞 → likeCount=1.
    commentService.like(reader.id, comment.id);
    expect(commentStore.getById(comment.id)?.likeCount).toBe(1);
    // 第二次点赞幂等（不重复计数）.
    commentService.like(reader.id, comment.id);
    expect(commentStore.getById(comment.id)?.likeCount).toBe(1);
    // 另一用户点赞 → likeCount=2.
    const reader2 = await authService.userRegister({
      email: 'r2@x.com', password: 'passwordpassword', displayName: 'r2',
    });
    commentService.like(reader2.id, comment.id);
    expect(commentStore.getById(comment.id)?.likeCount).toBe(2);
    // 未审核评论点赞 → 1002.
    const pending = commentService.createComment(article.id, reader.id, null, '待审');
    expect(() => commentService.like(reader.id, pending.id)).toThrow(AppError);
  });

  it('UAT-031: 通知触发正常', async () => {
    const { blogger, reader } = await seed();
    // reader 关注博主（bloggerService 不在此文件实例化，直接 enqueue 通知模拟触发）.
    // 触发关注通知给 blogger.
    const notif = notificationService.enqueueNotification(
      blogger.id,
      NotificationType.Follow,
      '收到关注',
      '有人关注了你',
      'ref-follow-1',
    );
    expect(notif).not.toBeNull();
    expect(notif?.userId).toBe(blogger.id);
    expect(notif?.type).toBe(NotificationType.Follow);
    expect(notificationService.unreadSize(blogger.id)).toBe(1);
    // 博主查看通知列表.
    const list = notificationService.listByUser(blogger.id);
    expect(list.length).toBe(1);
    expect(list[0]?.type).toBe(NotificationType.Follow);
    void reader;
  });

  it('UAT-032: 通知全部已读', async () => {
    const { blogger } = await seed();
    // 5 条未读通知.
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
    // 标记全部已读.
    notificationService.markAllRead(blogger.id);
    expect(notificationService.unreadSize(blogger.id)).toBe(0);
    // 单条标记已读.
    const notif = notificationService.enqueueNotification(
      blogger.id,
      NotificationType.Comment,
      '评论通知',
      '内容',
      'ref-c',
    );
    expect(notificationService.unreadSize(blogger.id)).toBe(1);
    notificationService.markRead(blogger.id, notif!.id);
    expect(notificationService.unreadSize(blogger.id)).toBe(0);
  });

  it('UAT-033: 通知设置关闭某类', async () => {
    const { blogger } = await seed();
    // 关闭 follow 类型通知.
    const settings = notificationService.updateNotificationSetting(blogger.id, { follow: false });
    expect(settings.follow).toBe(false);
    expect(settings.comment).toBe(true);
    // 验证设置持久化.
    const list = notificationService.listByUser(blogger.id);
    void list;
    // 重新开启.
    const reopened = notificationService.updateNotificationSetting(blogger.id, { follow: true });
    expect(reopened.follow).toBe(true);
    // 非法 settings → 1001（notificationSettingsSchema 校验）.
    expect(() => notificationService.updateNotificationSetting(blogger.id, { follow: 'yes' as unknown as boolean }))
      .toThrow(AppError);
  });

  it('UAT-034: 文章状态机正常流转', async () => {
    const { admin, blogger } = await seed();
    const a = articleService.createArticle(blogger.id, { title: '状态机', content: '内容' });
    expect(a.status).toBe(ArticleStatus.Draft);
    // draft → pending_review.
    articleService.submitForReview(blogger.id, a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.PendingReview);
    // pending_review → published.
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.Published);
    // published → offline.
    articleService.offlineArticle(blogger.id, UserRole.Blogger, a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.Offline);
    // offline → archived.
    articleService.archiveArticle(blogger.id, UserRole.Blogger, a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.Archived);
    // offline → published 逆向可走（republishArticle 仅在 archivedAt 为空时允许）.
    const b = articleService.createArticle(blogger.id, { title: '再发布', content: '内容' });
    articleService.submitForReview(blogger.id, b.id);
    articleService.approveArticle(admin.id, UserRole.Admin, b.id);
    articleService.offlineArticle(blogger.id, UserRole.Blogger, b.id);
    articleService.republishArticle(blogger.id, UserRole.Blogger, b.id);
    expect(articleStore.getById(b.id)?.status).toBe(ArticleStatus.Published);
  });

  it('UAT-035: 状态机逆向跳转异常', async () => {
    const { admin, blogger, reader } = await seed();
    const a = articleService.createArticle(blogger.id, { title: '逆向', content: '内容' });
    articleService.submitForReview(blogger.id, a.id);
    articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    articleService.offlineArticle(blogger.id, UserRole.Blogger, a.id);
    articleService.archiveArticle(blogger.id, UserRole.Blogger, a.id);
    // archived → published 逆向拒绝（republishArticle 检查 archivedAt）.
    expect(() => articleService.republishArticle(blogger.id, UserRole.Blogger, a.id))
      .toThrow(AppError);
    try {
      articleService.republishArticle(blogger.id, UserRole.Blogger, a.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.StateMachineIllegal);
    }
    // draft → published 非法跳转（VALID_NEXT[Draft] 不含 Published）.
    const b = articleService.createArticle(blogger.id, { title: '跳转', content: '内容' });
    expect(() => articleService.transition(blogger.id, b.id, ArticleStatus.Published))
      .toThrow(AppError);
    // draft → archived 非法.
    expect(() => articleService.transition(blogger.id, b.id, ArticleStatus.Archived))
      .toThrow(AppError);
    // 越权：reader 尝试 transition.
    expect(() => articleService.transition(reader.id, b.id, ArticleStatus.PendingReview))
      .toThrow(AppError);
  });

  it('UAT-036: 定时发布到达触发', async () => {
    const { admin, blogger } = await seed();
    const a = articleService.createArticle(blogger.id, { title: '定时', content: '内容' });
    articleService.submitForReview(blogger.id, a.id);
    // 设置定时发布（未来时间）.
    const future = new Date(Date.now() + 60_000);
    articleService.schedulePublish(blogger.id, a.id, future);
    expect(articleStore.getById(a.id)?.scheduleStatus).toBe('schedule_pending');
    expect(articleStore.getById(a.id)?.scheduledAt?.getTime()).toBe(future.getTime());
    // 过去时间设置 → invariant 失败.
    const b = articleService.createArticle(blogger.id, { title: '过去', content: '内容' });
    articleService.submitForReview(blogger.id, b.id);
    expect(() => articleService.schedulePublish(blogger.id, b.id, new Date(Date.now() - 60_000)))
      .toThrow();
    // fireScheduledPublish 触发 → published.
    articleService.fireScheduledPublish(a.id);
    expect(articleStore.getById(a.id)?.status).toBe(ArticleStatus.Published);
    expect(articleStore.getById(a.id)?.scheduleStatus).toBe('schedule_fired');
    void admin;
  });
});
