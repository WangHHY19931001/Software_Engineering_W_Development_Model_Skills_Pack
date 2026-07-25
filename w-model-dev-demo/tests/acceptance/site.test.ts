// 验收测试 - 站点管理 (UAT-001 ~ UAT-003).
// 覆盖 REQ-001 站点管理：站点配置/维护模式/公告定时发布.
// 真实实例化 Store/Service/Controller 三层，从用户场景出发；禁止 mock 内部模块.

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
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import { UserRole } from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-001~003 站点管理验收', () => {
  let userStore: UserStore;
  let siteStore: SiteStore;
  let articleStore: ArticleStore;
  let siteService: SiteService;
  let authService: AuthService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    siteStore = new SiteStore();
    const bloggerStore = new BloggerStore();
    const commentStore = new CommentStore();
    const fileStore = new FileStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    siteService = new SiteService(siteStore);
    authService = new AuthService(userStore);
    clearRevokedJtis();
  });

  it('UAT-001: 站点配置正常更新', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    // 更新站点配置.
    const cfg = siteService.updateConfig(admin.id, 'admin', {
      siteName: '我的博客',
      description: '技术博客',
    });
    expect(cfg.siteName).toBe('我的博客');
    expect(cfg.description).toBe('技术博客');
    // 后续读取返回最新配置.
    const reread = siteService.getConfig();
    expect(reread.siteName).toBe('我的博客');
    expect(reread.description).toBe('技术博客');
  });

  it('UAT-002: 维护模式开关验证', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    // 开启维护模式.
    siteService.setMaintenanceMode(admin.id, 'admin', true);
    expect(siteService.getConfig().maintenanceMode).toBe(true);
    // 普通用户请求被拒绝（requireNotMaintenance 抛 1023）.
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Maintenance);
      expect((e as AppError).httpStatus).toBe(503);
    }
    // 管理员不受维护模式影响.
    expect(() => siteService.requireNotMaintenance('admin')).not.toThrow();
    // 关闭维护模式后普通用户恢复.
    siteService.setMaintenanceMode(admin.id, 'admin', false);
    expect(() => siteService.requireNotMaintenance('reader')).not.toThrow();
  });

  it('UAT-003: 公告定时发布边界', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    // 创建定时公告（未来时间）→ 设置成功，announcement 字段更新.
    const future = new Date(Date.now() + 60_000);
    siteService.scheduleAnnouncement(admin.id, 'admin', '系统升级公告', future);
    expect(siteService.getConfig().announcement).toBe('系统升级公告');
    expect(siteService.getConfig().announcementAt?.getTime()).toBe(future.getTime());
    // 过去时间公告被 announcementSchema 拒绝（at 必须 > now）→ 1001.
    const past = new Date(Date.now() - 60_000);
    expect(() => siteService.scheduleAnnouncement(admin.id, 'admin', '过期公告', past))
      .toThrow(AppError);
    try {
      siteService.scheduleAnnouncement(admin.id, 'admin', '过期公告', past);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.ZodValidation);
    }
    // 非管理员创建公告 → 1021.
    expect(() => siteService.scheduleAnnouncement(admin.id, 'reader', '越权', future))
      .toThrow(AppError);
    // 到达时间后 publishAnnouncement 可触发（at <= now）.
    const reached = new Date(Date.now() - 1_000);
    // 直接覆写 siteStore 让 at 已到达，再调用 publishAnnouncement.
    siteStore.setAnnouncement('已到达公告', reached);
    expect(() => siteService.publishAnnouncement(admin.id, 'admin')).not.toThrow();
  });
});
