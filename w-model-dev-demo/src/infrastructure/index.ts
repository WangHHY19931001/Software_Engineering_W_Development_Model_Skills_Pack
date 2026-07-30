/**
 * 启动入口
 */
import { getEnv } from '../utils/env.js';
import { createRouters } from './router.js';
import { createApp } from './app.js';
import type { ServiceRegistry } from './routes.js';
import { UserRepository } from '../repositories/user.repository.js';
import { BloggerRepository } from '../repositories/blogger.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { WebhookRepository } from '../repositories/webhook.repository.js';
import { SiteConfigRepository } from '../repositories/site-config.repository.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { ViewRecordRepository } from '../repositories/view-record.repository.js';
import { FollowRepository } from '../repositories/follow.repository.js';
import { AdSlotRepository } from '../repositories/ad-slot.repository.js';
import { StatsRepository } from '../repositories/stats.repository.js';
import { LikeRepositoryImpl, LikeService } from '../services/like.service.js';
import { FavoriteRepositoryImpl, FavoriteService } from '../services/favorite.service.js';
import { AuthService } from '../services/auth.service.js';
import { UserService } from '../services/user.service.js';
import { BloggerService } from '../services/blogger.service.js';
import { ArticleService } from '../services/article.service.js';
import { CommentService } from '../services/comment.service.js';
import { NotificationService } from '../services/notification.service.js';
import { TagService } from '../services/tag.service.js';
import { SearchService } from '../services/search.service.js';
import { WebhookService } from '../services/webhook.service.js';
import { RssService } from '../services/rss.service.js';
import { SiteConfigService } from '../services/site-config.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { ViewRecordService } from '../services/view-record.service.js';
import { RecommendService } from '../services/recommend.service.js';
import { AdService } from '../services/ad.service.js';
import { StatsService } from '../services/stats.service.js';
import { FollowService } from '../services/follow.service.js';

export function buildServices(): { services: ServiceRegistry; repos: Record<string, unknown> } {
  // Repositories
  const userRepo = new UserRepository();
  const bloggerRepo = new BloggerRepository();
  const articleRepo = new ArticleRepository();
  const commentRepo = new CommentRepository();
  const notificationRepo = new NotificationRepository();
  const tagRepo = new TagRepository();
  const webhookRepo = new WebhookRepository();
  const siteConfigRepo = new SiteConfigRepository();
  const auditLogRepo = new AuditLogRepository();
  const viewRecordRepo = new ViewRecordRepository();
  const followRepo = new FollowRepository();
  const adSlotRepo = new AdSlotRepository();
  const statsRepo = new StatsRepository();
  const likeRepo = new LikeRepositoryImpl();
  const favoriteRepo = new FavoriteRepositoryImpl();

  // Services
  const auth = new AuthService(userRepo, bloggerRepo);
  const user = new UserService(userRepo);
  const blogger = new BloggerService(bloggerRepo, userRepo);
  const article = new ArticleService(articleRepo, userRepo, tagRepo, commentRepo);
  const comment = new CommentService(commentRepo, articleRepo, userRepo);
  const notification = new NotificationService(notificationRepo);
  const tag = new TagService(tagRepo);
  const search = new SearchService(articleRepo, tagRepo, userRepo);
  const webhook = new WebhookService(webhookRepo);
  const rss = new RssService(articleRepo, userRepo, bloggerRepo, siteConfigRepo);
  const siteConfig = new SiteConfigService(siteConfigRepo);
  const audit = new AuditLogService(auditLogRepo);
  const viewRecord = new ViewRecordService(viewRecordRepo, articleRepo);
  const recommend = new RecommendService(articleRepo, tagRepo);
  const ad = new AdService(adSlotRepo, siteConfigRepo);
  const stats = new StatsService(articleRepo, userRepo, commentRepo, tagRepo, viewRecordRepo, followRepo);
  const follow = new FollowService(followRepo, userRepo);
  const like = new LikeService(likeRepo, articleRepo);
  const favorite = new FavoriteService(favoriteRepo, articleRepo);

  void statsRepo;
  return {
    services: {
      auth,
      user,
      blogger,
      article,
      comment,
      notification,
      tag,
      search,
      webhook,
      rss,
      siteConfig,
      audit,
      viewRecord,
      recommend,
      ad,
      stats,
      follow,
      like,
      favorite,
    },
    repos: {
      userRepo,
      bloggerRepo,
      articleRepo,
      commentRepo,
      notificationRepo,
      tagRepo,
      webhookRepo,
      siteConfigRepo,
      auditLogRepo,
      viewRecordRepo,
      followRepo,
      adSlotRepo,
      statsRepo,
      likeRepo,
      favoriteRepo,
    },
  };
}

export function bootstrap() {
  const env = getEnv();
  const { services } = buildServices();
  const routers = createRouters({ services });
  const app = createApp({ apiRouter: routers.apiRouter, rssRouter: routers.rssRouter, env });
  return { app, env, services };
}
