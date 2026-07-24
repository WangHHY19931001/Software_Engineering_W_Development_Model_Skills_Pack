/**
 * 依赖注入容器 —— 组装所有 service 的依赖图
 *
 * 解决循环依赖：通过延迟初始化 + 回调注入。
 * 各 service 通过 deps 注入而非直接 import 单例。
 */
import { WalWriter, MemoryFileWriter } from './infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from './infrastructure/audit.js';
import { EmailSender } from './utils/email.js';
import { SensitiveFilter } from './utils/sensitive-filter.js';
import { CtrCalculator } from './utils/ctr-calculator.js';
import { UserService } from './services/identity/user-service.js';
import { BloggerService } from './services/identity/blogger-service.js';
import { FollowService } from './services/identity/follow-service.js';
import { ArticleService } from './services/content/article-service.js';
import { TagService } from './services/content/tag-service.js';
import { CategoryService } from './services/content/category-service.js';
import { CrossRefService } from './services/content/cross-ref-service.js';
import { CommentService } from './services/interaction/comment-service.js';
import { NotificationService } from './services/interaction/notification-service.js';
import { SiteService } from './services/operation/site-service.js';
import { AnnouncementScheduler } from './services/operation/announcement-scheduler.js';
import { StatsAggregator } from './services/operation/stats-aggregator.js';
import { AdService } from './services/operation/ad-service.js';
import { RecommendationEngine } from './services/discovery/recommendation-engine.js';
import { SearchIndexer } from './services/discovery/search-indexer.js';

export interface Container {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
  emailSender: EmailSender;
  sensitiveFilter: SensitiveFilter;
  ctrCalculator: CtrCalculator;
  userService: UserService;
  bloggerService: BloggerService;
  followService: FollowService;
  articleService: ArticleService;
  tagService: TagService;
  categoryService: CategoryService;
  crossRefService: CrossRefService;
  commentService: CommentService;
  notificationService: NotificationService;
  siteService: SiteService;
  announcementScheduler: AnnouncementScheduler;
  statsAggregator: StatsAggregator;
  adService: AdService;
  recommendationEngine: RecommendationEngine;
  searchIndexer: SearchIndexer;
}

export function createContainer(): Container {
  // 基础设施
  const walWriter = new WalWriter('./wal.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  const sensitiveFilter = new SensitiveFilter();
  const ctrCalculator = new CtrCalculator();

  // 先创建 SiteService（其他服务依赖其开关）
  const siteService = new SiteService({ walWriter, auditLogger });

  // NotificationService 不依赖其他业务 service（仅 EmailSender + WalWriter）
  const notificationService = new NotificationService({ emailSender, walWriter });

  // FollowService 依赖 notifyFollow 回调（指向 NotificationService）
  const followService = new FollowService({
    walWriter,
    notifyFollow: async (followerId, bloggerId) => {
      await notificationService.notify({
        userId: bloggerId,
        type: 'follow',
        title: '新粉丝',
        body: `用户 ${followerId} 关注了您`,
      });
    },
  });

  // UserService 依赖 isRegistrationOpen 回调（指向 SiteService）
  const userService = new UserService({
    walWriter,
    auditLogger,
    isRegistrationOpen: () => siteService.isRegistrationOpen(),
  });

  const bloggerService = new BloggerService({ walWriter, auditLogger });

  // ArticleService
  const articleService = new ArticleService({ walWriter, auditLogger });

  const tagService = new TagService({ walWriter });
  const categoryService = new CategoryService({ walWriter });

  // CrossRefService 依赖 notifyReference 回调
  const crossRefService = new CrossRefService({
    walWriter,
    notifyReference: async (articleId, citeId) => {
      const cited = articleService.getArticle(citeId);
      await notificationService.notify({
        userId: cited.authorId,
        type: 'crossref',
        title: '文章被引用',
        body: `您的文章 ${citeId} 被文章 ${articleId} 引用`,
      });
    },
  });

  // CommentService 依赖 isCommentOpen 回调 + notifyComment 回调
  const commentService = new CommentService({
    walWriter,
    auditLogger,
    sensitiveFilter,
    isCommentOpen: () => siteService.isCommentOpen(),
    notifyComment: async (articleId, commentId, parentAuthorId) => {
      const article = articleService.getArticle(articleId);
      await notificationService.notify({
        userId: article.authorId,
        type: 'comment',
        title: '新评论',
        body: `文章 ${articleId} 收到新评论 ${commentId}`,
      });
      if (parentAuthorId) {
        await notificationService.notify({
          userId: parentAuthorId,
          type: 'commentReply',
          title: '评论被回复',
          body: `您的评论被回复了 ${commentId}`,
        });
      }
    },
  });

  const announcementScheduler = new AnnouncementScheduler({ walWriter });
  const statsAggregator = new StatsAggregator();
  const adService = new AdService({ walWriter, auditLogger, ctrCalculator });

  const recommendationEngine = new RecommendationEngine({
    walWriter,
    getFollowerCount: (bloggerId) => followService.getFollowerCount(bloggerId),
  });

  const searchIndexer = new SearchIndexer();

  return {
    walWriter,
    auditLogger,
    emailSender,
    sensitiveFilter,
    ctrCalculator,
    userService,
    bloggerService,
    followService,
    articleService,
    tagService,
    categoryService,
    crossRefService,
    commentService,
    notificationService,
    siteService,
    announcementScheduler,
    statsAggregator,
    adService,
    recommendationEngine,
    searchIndexer,
  };
}

/** 全局容器单例 */
let container: Container | null = null;

export function getContainer(): Container {
  if (!container) {
    container = createContainer();
  }
  return container;
}

/** 重置容器（供测试使用） */
export function resetContainer(): void {
  container = null;
}
