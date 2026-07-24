/**
 * UT-DD-017 ~ UT-DD-020 —— 运营支持层单元测试
 * SiteService (2) + AnnouncementScheduler (2) + StatsAggregator (2) + AdService (3) = 9 用例
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiteService } from '../../../src/services/operation/site-service.js';
import { AnnouncementScheduler } from '../../../src/services/operation/announcement-scheduler.js';
import { StatsAggregator } from '../../../src/services/operation/stats-aggregator.js';
import { AdService } from '../../../src/services/operation/ad-service.js';
import { CtrCalculator } from '../../../src/utils/ctr-calculator.js';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { AppError } from '../../../src/utils/errors.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { userStore } from '../../../src/stores/user-store.js';
import { AdService as AdServiceClass } from '../../../src/services/operation/ad-service.js';
import { AnnouncementScheduler as AnnouncementSchedulerClass } from '../../../src/services/operation/announcement-scheduler.js';
import { CommentService } from '../../../src/services/interaction/comment-service.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';
import { EmailSender } from '../../../src/utils/email.js';
import { SensitiveFilter } from '../../../src/utils/sensitive-filter.js';

function makeDeps() {
  const walWriter = new WalWriter('./test.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  return { walWriter, auditLogger, emailSender };
}

function resetAll() {
  userStore.clear();
  articleStore.clear();
  AdServiceClass._reset();
  AnnouncementSchedulerClass._reset();
  CommentService._reset();
  NotificationService._reset();
}

describe('DD-017 SiteService', () => {
  let svc: SiteService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new SiteService({ walWriter: deps.walWriter, auditLogger: deps.auditLogger });
  });

  it('UT-DD-017-066: setSwitch 设置维护模式并写审计', async () => {
    await svc.setSwitch('maintenance', true, 'admin');
    expect(svc.getConfig().switches.maintenance).toBe(true);
    expect(deps.auditLogger.getCount()).toBeGreaterThan(0);
  });

  it('UT-DD-017-067: setSwitch 非法开关名抛 40003', async () => {
    // 实现未在 service 层校验角色（由 RBAC 中间件负责），此处校验非法开关名
    await expect(svc.setSwitch('invalid_switch' as never, true, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.setSwitch('invalid_switch' as never, true, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });
});

describe('DD-018 AnnouncementScheduler', () => {
  let svc: AnnouncementScheduler;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new AnnouncementScheduler({ walWriter: deps.walWriter });
  });

  it('UT-DD-018-068: schedulePublish + processDueAnnouncements 定时发布', async () => {
    const ann = await svc.createAnnouncement({ title: 'T', body: 'B' }, 'admin');
    const futureTime = Math.floor(Date.now() / 1000) + 1;
    await svc.schedulePublish(ann.id, futureTime, 'admin');
    // 等待到期
    await new Promise(r => setTimeout(r, 1500));
    const count = svc.processDueAnnouncements(Math.floor(Date.now() / 1000));
    expect(count).toBe(1);
    const updated = svc.findById(ann.id);
    expect(updated!.status).toBe('published');
  });

  it('UT-DD-018-069: schedulePublish publishAt <= now 抛 40003', async () => {
    const ann = await svc.createAnnouncement({ title: 'T', body: 'B' }, 'admin');
    const pastTime = Math.floor(Date.now() / 1000) - 100;
    await expect(svc.schedulePublish(ann.id, pastTime, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.schedulePublish(ann.id, pastTime, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('UT-DD-018-070: publishAnnouncement 立即发布公告（对应 TLA+ PublishAnnouncement）', async () => {
    const ann = await svc.createAnnouncement({ title: 'T', body: 'B' }, 'admin');
    expect(ann.status).toBe('draft');
    const published = await svc.publishAnnouncement(ann.id, 'admin');
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeDefined();
  });

  it('UT-DD-018-071: publishAnnouncement 重复发布抛 60002', async () => {
    const ann = await svc.createAnnouncement({ title: 'T', body: 'B' }, 'admin');
    await svc.publishAnnouncement(ann.id, 'admin');
    await expect(svc.publishAnnouncement(ann.id, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.publishAnnouncement(ann.id, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(60002);
    }
  });

  it('UT-DD-018-072: publishAnnouncement 不存在抛 40401', async () => {
    await expect(svc.publishAnnouncement('nonexistent', 'admin')).rejects.toThrow(AppError);
    try {
      await svc.publishAnnouncement('nonexistent', 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });

  it('UT-DD-018-073: removeAnnouncement 移除公告（对应 TLA+ RemoveAnnouncement）', async () => {
    const ann = await svc.createAnnouncement({ title: 'T', body: 'B' }, 'admin');
    await svc.removeAnnouncement(ann.id, 'admin');
    expect(svc.findById(ann.id)).toBeNull();
  });

  it('UT-DD-018-074: removeAnnouncement 不存在抛 40401', async () => {
    await expect(svc.removeAnnouncement('nonexistent', 'admin')).rejects.toThrow(AppError);
    try {
      await svc.removeAnnouncement('nonexistent', 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });
});

describe('DD-019 StatsAggregator', () => {
  let svc: StatsAggregator;

  beforeEach(() => {
    resetAll();
    svc = new StatsAggregator();
  });

  it('UT-DD-019-070: calculateHeat 热度公式（7 天衰减）', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      stats: { likes: 10, comments: 5, views: 100, shares: 0, heat: 0 },
      publishedAt: now,
    };
    const heat = svc.calculateHeat(article);
    // rawHeat = 10*2 + 5*3 + 100*1 = 135; decay = exp(0/7) = 1
    const expected = 135 * Math.exp(0);
    expect(heat).toBeCloseTo(expected, 1);
  });

  it('UT-DD-019-071: exportReport CSV 格式', () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'b1', title: 'Test', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const buffer = svc.exportReport('csv', 'article');
    expect(buffer.toString()).toContain('id,title,status');
  });

  it('getArticleStats 返回状态分布和标签分布', () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'published',
      tagIds: ['t1', 't2'], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'b1', title: 'T2', content: 'C', status: 'draft',
      tagIds: ['t1'], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const stats = svc.getArticleStats();
    expect(stats.total).toBe(2);
    expect(stats.statusDistribution['published']).toBe(1);
    expect(stats.statusDistribution['draft']).toBe(1);
    expect(stats.tagDistribution['t1']).toBe(2);
  });

  it('getUserStats 返回角色分布和状态统计', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    userStore.insert({
      id: 'u2', email: 'u2@b.com', passwordHash: 'h', nickname: 'u2',
      role: 'blogger', status: 'banned',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    const stats = svc.getUserStats();
    expect(stats.total).toBe(2);
    expect(stats.roleDistribution['user']).toBe(1);
    expect(stats.roleDistribution['blogger']).toBe(1);
    expect(stats.activeCount).toBe(1);
    expect(stats.bannedCount).toBe(1);
  });

  it('getBloggerStats 返回博主文章数排名', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'b1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    articleStore.insert({
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const stats = svc.getBloggerStats();
    expect(stats.total).toBe(1);
    expect(stats.topByArticles[0].bloggerId).toBe('b1');
    expect(stats.topByArticles[0].articleCount).toBe(1);
  });

  it('getSiteStats 返回汇总报告', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    const stats = svc.getSiteStats();
    expect(stats.users.total).toBe(1);
    expect(stats.articles).toBeDefined();
    expect(stats.bloggers).toBeDefined();
  });

  it('exportReport JSON 格式', () => {
    const buffer = svc.exportReport('json', 'article');
    const parsed = JSON.parse(buffer.toString());
    expect(parsed).toHaveProperty('total');
    expect(parsed).toHaveProperty('statusDistribution');
  });

  it('exportReport JSON user/blogger/site 类型', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    expect(() => svc.exportReport('json', 'user')).not.toThrow();
    expect(() => svc.exportReport('json', 'blogger')).not.toThrow();
    expect(() => svc.exportReport('json', 'site')).not.toThrow();
  });

  it('exportReport CSV user/blogger/site 类型', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    const userCsv = svc.exportReport('csv', 'user');
    expect(userCsv.toString()).toContain('key,value');
    expect(() => svc.exportReport('csv', 'blogger')).not.toThrow();
    expect(() => svc.exportReport('csv', 'site')).not.toThrow();
  });

  it('exportReport CSV 标题含逗号时转义', () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'b1', title: 'Hello, World', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const buffer = svc.exportReport('csv', 'article');
    expect(buffer.toString()).toContain('"Hello, World"');
  });
});

describe('DD-020 AdService', () => {
  let svc: AdService;
  let deps: ReturnType<typeof makeDeps>;
  let ctrCalculator: CtrCalculator;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    ctrCalculator = new CtrCalculator();
    svc = new AdService({
      walWriter: deps.walWriter,
      auditLogger: deps.auditLogger,
      ctrCalculator,
    });
  });

  it('UT-DD-020-072: createAd + approve + serveAd', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    await svc.approve(ad.id, 'admin');
    const served = await svc.serveAd('u1', 'home-top');
    expect(served).not.toBeNull();
    expect(served!.id).toBe(ad.id);
  });

  it('UT-DD-020-073: serveAd 频次超 100/日抛 60006', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    await svc.approve(ad.id, 'admin');
    // 同一用户对同一广告投递 100 次
    for (let i = 0; i < 100; i++) {
      await svc.serveAd('u1', 'home-top');
    }
    // 第 101 次应抛 60006
    await expect(svc.serveAd('u1', 'home-top')).rejects.toThrow(AppError);
    try {
      await svc.serveAd('u1', 'home-top');
    } catch (e) {
      expect((e as AppError).code).toBe(60006);
    }
  });

  it('UT-DD-020-074: serveAd 时间范围外无广告返回', async () => {
    const now = Math.floor(Date.now() / 1000);
    // 广告时间范围在未来
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now + 86400, endAt: now + 172800,
    }, 'admin');
    await svc.approve(ad.id, 'admin');
    const served = await svc.serveAd('u1', 'home-top');
    expect(served).toBeNull();
  });

  it('createAd 输入校验失败抛 40003', async () => {
    await expect(svc.createAd({
      slot: '', startAt: 1, endAt: 2,
    }, 'admin')).rejects.toThrow(AppError);
  });

  it('updateAd 正常更新广告', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    const updated = await svc.updateAd(ad.id, { content: 'new content' }, 'admin');
    expect(updated.content).toBe('new content');
  });

  it('updateAd 广告不存在抛 40401', async () => {
    await expect(svc.updateAd('nonexistent', { content: 'x' }, 'admin')).rejects.toThrow(AppError);
  });

  it('getAd 获取广告', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    const got = svc.getAd(ad.id);
    expect(got.id).toBe(ad.id);
  });

  it('getAd 广告不存在抛 40401', () => {
    expect(() => svc.getAd('nonexistent')).toThrow(AppError);
  });

  it('listAds 按过滤条件分页', async () => {
    const now = Math.floor(Date.now() / 1000);
    await svc.createAd({ slot: 'home-top', startAt: now, endAt: now + 86400 }, 'admin');
    await svc.createAd({ slot: 'side-bar', startAt: now, endAt: now + 86400 }, 'admin');
    const page = svc.listAds({ slot: 'home-top' }, 1, 10);
    expect(page.total).toBe(1);
    expect(page.list[0].slot).toBe('home-top');
  });

  it('listAds 非法 page/size 抛 40003', () => {
    expect(() => svc.listAds({}, 0, 10)).toThrow(AppError);
    expect(() => svc.listAds({}, 1, 0)).toThrow(AppError);
  });

  it('approve 非待审状态抛 60002', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    await svc.approve(ad.id, 'admin');
    await expect(svc.approve(ad.id, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.approve(ad.id, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(60002);
    }
  });

  it('reject 下架广告', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    const rejected = await svc.reject(ad.id, '违规内容', 'admin');
    expect(rejected.status).toBe('rejected');
  });

  it('reject 原因为空抛 40003', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    await expect(svc.reject(ad.id, '', 'admin')).rejects.toThrow(AppError);
  });

  it('recordClick 记录点击', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400,
    }, 'admin');
    svc.recordClick(ad.id);
    expect(ctrCalculator.calculateCtr(ad.id)).toBe(0);
  });

  it('serveAd 目标用户不匹配返回 null', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ad = await svc.createAd({
      slot: 'home-top', startAt: now, endAt: now + 86400, targetUser: 'special-user',
    }, 'admin');
    await svc.approve(ad.id, 'admin');
    const served = await svc.serveAd('other-user', 'home-top');
    expect(served).toBeNull();
  });
});

// DD-017 SiteService 补充测试（覆盖率提升）
describe('DD-017 SiteService 补充', () => {
  let svc: SiteService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new SiteService({ walWriter: deps.walWriter, auditLogger: deps.auditLogger });
  });

  it('updateConfig 更新站点配置', async () => {
    const config = await svc.updateConfig({ maintenance: true } as never, 'admin');
    expect(config).toBeDefined();
  });

  it('getOverview 返回站点统计', () => {
    const overview = svc.getOverview();
    expect(overview).toHaveProperty('userCount');
    expect(overview).toHaveProperty('articleCount');
    expect(overview).toHaveProperty('pageView');
  });

  it('isRegistrationOpen 维护模式关闭注册', async () => {
    await svc.setSwitch('maintenance', true, 'admin');
    expect(svc.isRegistrationOpen()).toBe(false);
  });

  it('isRegistrationOpen 正常开放', () => {
    expect(svc.isRegistrationOpen()).toBe(true);
  });

  it('isCommentOpen 维护模式关闭评论', async () => {
    await svc.setSwitch('maintenance', true, 'admin');
    expect(svc.isCommentOpen()).toBe(false);
  });

  it('isCommentOpen 正常开放', () => {
    expect(svc.isCommentOpen()).toBe(true);
  });

  it('incrementPageView 增加页面浏览量', () => {
    svc.incrementPageView();
    svc.incrementPageView();
    expect(svc.getOverview().pageView).toBe(2);
  });
});
