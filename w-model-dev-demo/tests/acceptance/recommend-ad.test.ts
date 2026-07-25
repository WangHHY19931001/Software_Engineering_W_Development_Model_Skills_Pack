// 验收测试 - 推荐与广告 (UAT-010 ~ UAT-015).
// 覆盖 REQ-004 推荐 / REQ-005 广告：热门推荐/个性化登录/推荐位管理/广告投放/时间范围/审核状态.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { AdStore } from '../../src/stores/ad.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { RecommendStore } from '../../src/stores/recommend.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SubscriptionService } from '../../src/services/subscription.service.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { PushService } from '../../src/services/push.service.js';
import { RecommendService } from '../../src/services/recommend.service.js';
import { AdService } from '../../src/services/ad.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  AdStatus,
  ArticleStatus,
  UserRole,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-010~015 推荐与广告验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerStore: BloggerStore;
  let siteStore: SiteStore;
  let adStore: AdStore;
  let recommendStore: RecommendStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let subscriptionService: SubscriptionService;
  let bloggerService: BloggerService;
  let recommendService: RecommendService;
  let adService: AdService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    subscriptionStore = new SubscriptionStore();
    bloggerStore = new BloggerStore();
    siteStore = new SiteStore();
    adStore = new AdStore();
    recommendStore = new RecommendStore();
    const commentStore = new CommentStore();
    const fileStore = new FileStore();
    const tagStore = new TagStore();
    const categoryStore = new CategoryStore();
    const wsStore = new WsStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore, userStore, bloggerStore, tagStore, categoryStore,
      new PushService(wsStore),
    );
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    recommendService = new RecommendService(recommendStore, articleStore, subscriptionStore);
    adService = new AdService(adStore);
    clearRevokedJtis();
  });

  async function seedAndPublish() {
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
    for (let i = 0; i < 3; i++) {
      const a = articleService.createArticle(blogger.id, { title: `文章${i}`, content: `内容${i}` });
      articleService.submitForReview(blogger.id, a.id);
      articleService.approveArticle(admin.id, UserRole.Admin, a.id);
    }
    return { admin, blogger, reader };
  }

  it('UAT-010: 热门推荐正常返回', async () => {
    const { blogger, admin } = await seedAndPublish();
    void admin;
    // hot 模式：未登录用户请求热门推荐流.
    const hot = recommendService.hot(1, 20);
    expect(hot.total).toBeGreaterThanOrEqual(1);
    expect(hot.items.length).toBeLessThanOrEqual(20);
    // 仅返回 published 状态文章.
    for (const a of hot.items) {
      expect(a.status).toBe(ArticleStatus.Published);
    }
    // 不含已下架/已归档（创建一篇 offline 文章验证不出现）.
    const offline = articleService.createArticle(blogger.id, { title: '下架文', content: '内容' });
    articleService.submitForReview(blogger.id, offline.id);
    const admin2 = await authService.userRegister({
      email: 'admin2@x.com', password: 'passwordpassword',
      displayName: 'admin2', role: UserRole.Admin,
    });
    articleService.approveArticle(admin2.id, UserRole.Admin, offline.id);
    articleService.offlineArticle(blogger.id, UserRole.Blogger, offline.id);
    const hot2 = recommendService.hot(1, 50);
    expect(hot2.items.find((a) => a.id === offline.id)).toBeUndefined();
  });

  it('UAT-011: 个性化推荐需登录', async () => {
    await seedAndPublish();
    // 未登录（userId 为空）请求个性化推荐 → 1011 NoUser.
    expect(() => recommendService.personalized('', 1, 10)).toThrow(AppError);
    try {
      recommendService.personalized('', 1, 10);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.NoUser);
      expect((e as AppError).httpStatus).toBe(401);
    }
    // 已登录用户调用成功（即使无订阅也返回空分页结构）.
    const reader = await authService.userRegister({
      email: 'r2@x.com', password: 'passwordpassword', displayName: 'r2',
    });
    const pers = recommendService.personalized(reader.id, 1, 10);
    expect(pers.page).toBe(1);
    expect(pers.pageSize).toBe(10);
  });

  it('UAT-012: 推荐位管理异常（非管理员）', async () => {
    const { admin, blogger, reader } = await seedAndPublish();
    const hot = recommendService.hot(1, 10);
    const articleId = hot.items[0]!.id;
    // 普通用户尝试创建推荐位 → 1021 Rbac.
    expect(() => recommendService.setSlot(reader.id, UserRole.Reader, '首页推荐', articleId, 1))
      .toThrow(AppError);
    expect(() => recommendService.setSlot(blogger.id, UserRole.Blogger, '首页推荐', articleId, 1))
      .toThrow(AppError);
    try {
      recommendService.setSlot(reader.id, UserRole.Reader, '首页推荐', articleId, 1);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
      expect((e as AppError).httpStatus).toBe(403);
    }
    // 管理员可成功设置.
    recommendService.setSlot(admin.id, UserRole.Admin, '首页推荐', articleId, 1);
    expect(recommendStore.getSlot('首页推荐')?.articleId).toBe(articleId);
    // 非已发布文章设置推荐位 → 1002.
    const draft = articleService.createArticle(blogger.id, { title: '草稿', content: '内容' });
    expect(() => recommendService.setSlot(admin.id, UserRole.Admin, '草稿位', draft.id, 1))
      .toThrow(AppError);
  });

  it('UAT-013: 广告投放正常流程', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
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
    expect(ad.status).toBe(AdStatus.PendingReview);
    // 审核 approved.
    adService.audit(admin.id, UserRole.Admin, ad.id, 'approve');
    expect(adStore.getById(ad.id)?.status).toBe(AdStatus.Approved);
    // 在有效期内展示（adImpress + adClick）.
    adService.adImpress(ad.id);
    adService.adClick(ad.id);
    const updated = adStore.getById(ad.id);
    expect(updated?.impressCount).toBe(1);
    expect(updated?.clickCount).toBe(1);
    // 按 slot 查询返回含该广告.
    const list = adService.listBySlot('home-banner', 1, 10);
    expect(list.items.find((a) => a.id === ad.id)).toBeTruthy();
    expect(list.total).toBeGreaterThanOrEqual(1);
  });

  it('UAT-014: 广告时间范围边界', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
    // 已审核但 endTime 为过去 → adImpress/adClick 被拒（不在窗口内）→ 1002.
    const startAt = new Date(Date.now() - 120_000);
    const endAt = new Date(Date.now() - 60_000);
    const ad = adService.create(admin.id, UserRole.Admin, {
      slotId: 'expired-banner',
      title: '过期广告',
      imageUrl: 'https://example.com/i.png',
      targetUrl: 'https://example.com/p',
      startAt,
      endAt,
    });
    adService.audit(admin.id, UserRole.Admin, ad.id, 'approve');
    expect(adStore.getById(ad.id)?.status).toBe(AdStatus.Approved);
    // 过期广告展示 → 1002.
    expect(() => adService.adImpress(ad.id)).toThrow(AppError);
    expect(() => adService.adClick(ad.id)).toThrow(AppError);
    try {
      adService.adImpress(ad.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.StateMachineIllegal);
    }
    // 有效广告可展示.
    const validAd = adService.create(admin.id, UserRole.Admin, {
      slotId: 'valid-banner',
      title: '有效广告',
      imageUrl: 'https://example.com/i.png',
      targetUrl: 'https://example.com/p',
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60_000),
    });
    adService.audit(admin.id, UserRole.Admin, validAd.id, 'approve');
    expect(() => adService.adImpress(validAd.id)).not.toThrow();
    expect(adStore.getById(validAd.id)?.impressCount).toBe(1);
  });

  it('UAT-015: 广告审核状态异常', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
    // pending 状态广告不应展示.
    const ad = adService.create(admin.id, UserRole.Admin, {
      slotId: 'pending-banner',
      title: '待审广告',
      imageUrl: 'https://example.com/i.png',
      targetUrl: 'https://example.com/p',
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60_000),
    });
    expect(ad.status).toBe(AdStatus.PendingReview);
    // pending 广告展示 → 1002.
    expect(() => adService.adImpress(ad.id)).toThrow(AppError);
    expect(() => adService.adClick(ad.id)).toThrow(AppError);
    try {
      adService.adImpress(ad.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.StateMachineIllegal);
    }
    // rejected 广告也不展示.
    adService.audit(admin.id, UserRole.Admin, ad.id, 'reject');
    expect(adStore.getById(ad.id)?.status).toBe(AdStatus.Rejected);
    expect(() => adService.adImpress(ad.id)).toThrow(AppError);
    // 非 admin 审核 → 1021.
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword', displayName: 'r',
    });
    const ad2 = adService.create(admin.id, UserRole.Admin, {
      slotId: 'b1',
      title: 't',
      imageUrl: 'https://example.com/i.png',
      targetUrl: 'https://example.com/p',
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60_000),
    });
    expect(() => adService.audit(reader.id, UserRole.Reader, ad2.id, 'approve')).toThrow(AppError);
  });
});
